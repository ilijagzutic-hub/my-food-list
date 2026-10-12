// Offline self-test (no network, no keys): node selftest.mjs
// Generates neutral synthetic fixtures (shapes on a gradient — no real photos), including one that
// carries fake EXIF + GPS and a sideways orientation, and checks the whole processing pipeline.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { processImage, validateProvenance, storagePaths, HERO, THUMB } from './lib.mjs';

export function fixtureSvg(w, h, hue = 'warm') {
  const [a, b, c] = hue === 'warm' ? ['#c19a4b', '#7a3b1f', '#fffdf8'] : ['#1c4028', '#0a1a12', '#d4af6a'];
  const s = Math.min(w, h);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="r"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity=".15"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${w * 0.5}" cy="${h * 0.52}" r="${s * 0.34}" fill="url(#r)"/>
    <circle cx="${w * 0.5}" cy="${h * 0.52}" r="${s * 0.22}" fill="none" stroke="${b}" stroke-width="${s * 0.012}" opacity=".6"/>
    <circle cx="${w * 0.2}" cy="${h * 0.25}" r="${s * 0.07}" fill="${c}" opacity=".5"/>
    <rect x="${w * 0.7}" y="${h * 0.62}" width="${s * 0.18}" height="${s * 0.18}" rx="${s * 0.03}" fill="${c}" opacity=".35"/>
  </svg>`);
}

/** JPEG fixture with fake camera EXIF + GPS and orientation 6 (stored sideways, i.e. a phone portrait shot). */
export async function fixtureJpegWithExif(w = 3000, h = 2000) {
  return sharp(fixtureSvg(w, h))
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: 'FixtureCam', Model: 'SelfTest 1', Copyright: 'selftest' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '33/1 52/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '151/1 12/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

let passed = 0;
const ok = (name) => { passed++; console.log(`PASS  ${name}`); };

// 1. EXIF/GPS fixture: stripped, orientation applied, sizes/ratios/budgets
const jpeg = await fixtureJpegWithExif();
const before = await sharp(jpeg).metadata();
assert.ok(before.exif && before.exif.length > 0, 'fixture should carry EXIF');
assert.equal(before.orientation, 6);
ok('fixture carries EXIF + GPS + orientation 6');

const r = await processImage(jpeg);
assert.equal(r.source.hadExif, true);
// source stored 3000x2000 but orientation 6 => displayed 2000x3000 (portrait); 3:2 crop width limited by height/1.5
assert.equal(r.source.width, 2000);
assert.equal(r.source.height, 3000);
ok('orientation applied before sizing (portrait source)');

for (const [label, v] of [['hero', r.hero], ['thumb', r.thumb]]) {
  const m = await sharp(v.buffer).metadata();
  assert.equal(m.format, 'webp');
  assert.ok(!m.exif && !m.icc && !m.xmp && !m.iptc, `${label} has no metadata`);
  assert.equal(m.width, v.width);
  assert.equal(m.height, v.height);
  assert.ok(!v.buffer.includes(Buffer.from('FixtureCam')) && !v.buffer.includes(Buffer.from('selftest')), `${label} bytes contain no EXIF strings`);
}
ok('hero + thumb are metadata-free WebP (EXIF / GPS / XMP / IPTC / ICC gone)');

assert.ok(Math.abs(r.hero.width / r.hero.height - HERO.ratio) < 0.01, 'hero is 3:2');
assert.ok(Math.abs(r.thumb.width / r.thumb.height - THUMB.ratio) < 0.01, 'thumb is 4:3');
assert.ok(r.hero.width <= 1200 && r.thumb.width <= 480);
ok(`dimensions: hero ${r.hero.width}x${r.hero.height}, thumb ${r.thumb.width}x${r.thumb.height}`);
assert.ok(r.hero.bytes <= HERO.maxBytes && r.thumb.bytes <= THUMB.maxBytes, 'within byte targets');
ok(`byte budgets: hero ${(r.hero.bytes / 1024).toFixed(1)} KB (<=220), thumb ${(r.thumb.bytes / 1024).toFixed(1)} KB (<=60)`);

assert.match(r.hash, /^[0-9a-f]{16}$/);
assert.match(r.dominantColor, /^#[0-9a-f]{6}$/);
const again = await processImage(jpeg);
assert.equal(again.hash, r.hash);
ok(`content hash is deterministic (${r.hash}) and dominant colour is ${r.dominantColor}`);

const p = storagePaths(42, r.hash);
assert.equal(p.thumb, `restaurants/42/${r.hash}-thumb.webp`);
assert.equal(p.hero, `restaurants/42/${r.hash}-hero.webp`);
ok('storage paths follow restaurants/{id}/{hash}-{variant}.webp');

// 2. Landscape PNG, no EXIF
const png = await sharp(fixtureSvg(2400, 1600, 'cool')).png().toBuffer();
const r2 = await processImage(png);
assert.equal(r2.source.hadExif, false);
assert.equal(r2.hero.width, 1200);
assert.equal(r2.hero.height, 800);
assert.notEqual(r2.hash, r.hash);
ok('landscape PNG -> 1200x800 hero, different hash');

// 3. Rejections
const tiny = await sharp(fixtureSvg(500, 300)).png().toBuffer();
await assert.rejects(() => processImage(tiny), /too small/);
ok('too-small image is rejected');
await assert.rejects(() => processImage(Buffer.from('this is not an image')), /Could not read this image/);
ok('non-image bytes are rejected with a helpful message');

// 4. Provenance rules (mirror the DB constraints)
assert.deepEqual(validateProvenance({ sourceKind: 'own_photo' }), []);
ok('own_photo needs no credit');
assert.ok(validateProvenance({ sourceKind: 'owner_permission' }).length >= 2);
assert.deepEqual(validateProvenance({ sourceKind: 'owner_permission', credit: 'The Owner', licenseNote: 'Permission by email 2026-10-12' }), []);
ok('owner_permission needs credit + permission note');
assert.ok(validateProvenance({ sourceKind: 'open_license', credit: 'A. Photographer', licenseNote: 'CC BY 4.0' }).some((e) => /source-url/.test(e)));
assert.deepEqual(validateProvenance({ sourceKind: 'open_license', credit: 'A. Photographer', licenseNote: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' }), []);
ok('open_license needs credit + licence + source link');
assert.ok(validateProvenance({ sourceKind: 'stock_photo' }).length === 1);
assert.ok(validateProvenance({ sourceKind: 'own_photo', sourceUrl: 'javascript:alert(1)' }).length === 1);
ok('unapproved source kinds and non-http source URLs are rejected');

// 5. High-entropy image (worst case for file size): quality ladder runs, output stays valid and metadata-free
const noisy = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 70 } } }).jpeg({ quality: 92 }).toBuffer();
const r3 = await processImage(noisy);
assert.ok(r3.hero.quality < 80 && r3.hero.bytes > 0);
assert.ok(r3.hero.width === 1200 && r3.thumb.width === 480);
ok(`noisy photo: quality ladder used (hero q${r3.hero.quality}, ${(r3.hero.bytes / 1024).toFixed(0)} KB, withinBudget=${r3.hero.withinBudget}; thumb q${r3.thumb.quality}, ${(r3.thumb.bytes / 1024).toFixed(0)} KB, withinBudget=${r3.thumb.withinBudget})`);

console.log(`\n${passed} checks passed`);
