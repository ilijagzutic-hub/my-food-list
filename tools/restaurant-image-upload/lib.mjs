// Shared image processing + provenance rules for the trusted restaurant-image tool.
// No network access in this file — everything here is pure and unit-testable.
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const BUCKET = 'restaurant-images';
export const SOURCE_KINDS = ['own_photo', 'owner_permission', 'open_license'];

// Two stored variants. Hero is 3:2, thumb is 4:3; the UI crops them further with object-fit: cover.
export const HERO = { maxWidth: 1200, ratio: 3 / 2, quality: [80, 74, 68, 62], maxBytes: 220 * 1024 };
export const THUMB = { maxWidth: 480, ratio: 4 / 3, quality: [76, 70, 64, 58], maxBytes: 60 * 1024 };
export const MIN_HERO_WIDTH = 600;
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

/** Provenance rules — mirrors the restaurant_images CHECK constraints so mistakes fail before any upload. */
export function validateProvenance({ sourceKind, credit, sourceUrl, licenseNote }) {
  const errors = [];
  const has = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!SOURCE_KINDS.includes(sourceKind)) {
    errors.push(`--source-kind must be one of: ${SOURCE_KINDS.join(', ')}`);
    return errors;
  }
  if (has(sourceUrl) && !/^https?:\/\//i.test(sourceUrl.trim())) errors.push('--source-url must start with http:// or https://');
  if (sourceKind !== 'own_photo') {
    if (!has(credit)) errors.push(`--credit is required for ${sourceKind} (who made / supplied the image)`);
    if (!has(licenseNote)) {
      errors.push(
        `--license-note is required for ${sourceKind} (` +
          (sourceKind === 'owner_permission'
            ? 'e.g. "Supplied by the owner, permission given by email 2026-10-12"'
            : 'e.g. "CC BY-SA 4.0"') +
          ')'
      );
    }
    if (sourceKind === 'open_license' && !has(sourceUrl)) errors.push('--source-url is required for open_license (link to the original + licence)');
  }
  return errors;
}

export function storagePaths(restaurantId, hash) {
  return {
    thumb: `restaurants/${restaurantId}/${hash}-thumb.webp`,
    hero: `restaurants/${restaurantId}/${hash}-hero.webp`,
  };
}

async function encode(input, { width, height, quality }) {
  const make = (q) =>
    sharp(input, { failOn: 'error', limitInputPixels: 120_000_000 })
      .rotate() // apply EXIF orientation first, because all metadata is dropped below
      .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: q, effort: 5 }) // sharp drops EXIF / GPS / XMP / IPTC / ICC by default
      .toBuffer({ resolveWithObject: true });
  return make(quality);
}

async function encodeWithinBudget(input, spec, width, height) {
  let last;
  for (const q of spec.quality) {
    last = await encode(input, { width, height, quality: q });
    if (last.data.length <= spec.maxBytes) return { ...last, quality: q, withinBudget: true };
  }
  return { ...last, quality: spec.quality[spec.quality.length - 1], withinBudget: false };
}

/** Throws unless the buffer is a metadata-free WebP. */
export async function assertNoMetadata(buf, label) {
  const m = await sharp(buf).metadata();
  const leaked = ['exif', 'icc', 'iptc', 'xmp', 'tifftagPhotoshop'].filter((k) => m[k] && m[k].length);
  if (m.format !== 'webp') throw new Error(`${label}: expected webp, got ${m.format}`);
  if (leaked.length) throw new Error(`${label}: output still carries metadata (${leaked.join(', ')})`);
}

export async function processImage(inputBuffer) {
  if (inputBuffer.length > MAX_INPUT_BYTES) throw new Error('Input file is larger than 40 MB');
  let meta;
  try {
    meta = await sharp(inputBuffer, { failOn: 'error' }).metadata();
  } catch (e) {
    throw new Error(`Could not read this image (${e.message}). HEIC/HEIF is not supported — convert first, e.g.: sips -s format jpeg in.heic --out out.jpg`);
  }
  // metadata() reports pre-rotation size; swap if EXIF says the image is turned sideways.
  const turned = meta.orientation && meta.orientation >= 5;
  const srcW = turned ? meta.height : meta.width;
  const srcH = turned ? meta.width : meta.height;
  if (!srcW || !srcH) throw new Error('Image has no readable dimensions');

  const heroW = Math.min(HERO.maxWidth, srcW, Math.floor(srcH * HERO.ratio));
  if (heroW < MIN_HERO_WIDTH) {
    throw new Error(`Image is too small after cropping to 3:2 (${heroW}px wide; need at least ${MIN_HERO_WIDTH}px). Use a larger original.`);
  }
  const heroH = Math.round(heroW / HERO.ratio);
  const thumbW = Math.min(THUMB.maxWidth, heroW);
  const thumbH = Math.round(thumbW / THUMB.ratio);

  const hero = await encodeWithinBudget(inputBuffer, HERO, heroW, heroH);
  const thumb = await encodeWithinBudget(inputBuffer, THUMB, thumbW, thumbH);
  await assertNoMetadata(hero.data, 'hero');
  await assertNoMetadata(thumb.data, 'thumb');

  const hash = createHash('sha256').update(hero.data).digest('hex').slice(0, 16);

  const { dominant } = await sharp(thumb.data).stats();
  const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const dominantColor = `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;

  return {
    hash,
    dominantColor,
    source: { width: srcW, height: srcH, format: meta.format, hadExif: !!meta.exif, orientation: meta.orientation ?? 1 },
    hero: { buffer: hero.data, width: hero.info.width, height: hero.info.height, bytes: hero.data.length, quality: hero.quality, withinBudget: hero.withinBudget },
    thumb: { buffer: thumb.data, width: thumb.info.width, height: thumb.info.height, bytes: thumb.data.length, quality: thumb.quality, withinBudget: thumb.withinBudget },
  };
}
