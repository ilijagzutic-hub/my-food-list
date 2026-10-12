#!/usr/bin/env node
// Trusted local tool: add ONE approved image to ONE restaurant.
//
//   resize + strip EXIF/GPS  ->  thumb (480w) + hero (1200w) WebP  ->  content hash
//   ->  upload both to Supabase Storage (bucket "restaurant-images")  ->  record provenance in restaurant_images
//
// The service-role key is read from the environment only. It is never written to disk, never logged,
// and never belongs in this repo or in the browser bundle.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... node upload.mjs --restaurant 42 --file ./photo.jpg --source-kind own_photo
//   node upload.mjs --restaurant 42 --file ./photo.jpg --source-kind own_photo --dry-run      (no key needed)
//   see README.md for the other source kinds and flags.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import { BUCKET, processImage, storagePaths, validateProvenance } from './lib.mjs';

const DEFAULT_URL = 'https://vcsbitkftcnyywfodrue.supabase.co';

function parseArgs(argv) {
  const out = { flags: new Set(), opts: {} };
  const valueFlags = new Set(['restaurant', 'file', 'source-kind', 'credit', 'source-url', 'license-note', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`);
    const key = a.slice(2);
    if (valueFlags.has(key)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`--${key} needs a value`);
      out.opts[key] = v;
    } else if (['dry-run', 'no-primary', 'yes', 'help'].includes(key)) {
      out.flags.add(key);
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  return out;
}

const HELP = `
Add one approved image to one restaurant.

Required:
  --restaurant <id>        restaurants.id
  --file <path>            JPEG / PNG / WebP / TIFF / GIF / AVIF (HEIC: convert first)
  --source-kind <kind>     own_photo | owner_permission | open_license

Provenance (required unless own_photo):
  --credit "<who>"         photographer / supplier
  --license-note "<text>"  e.g. "CC BY-SA 4.0"  or  "Supplied by the owner, permission by email 2026-10-12"
  --source-url <url>       required for open_license (link to the original + licence)

Options:
  --no-primary             upload and record it, but do not make it the restaurant's primary image
  --dry-run                process only; write previews to --out (default ./preview); no network, no key needed
  --out <dir>              preview folder for --dry-run
  --yes                    skip the "is this the right restaurant?" prompt (required when not run in a terminal)

Environment:
  SUPABASE_SERVICE_ROLE_KEY   required for a real upload (never commit it)
  SUPABASE_URL                optional, defaults to this project
`;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  if (flags.has('help') || process.argv.length <= 2) {
    console.log(HELP);
    return;
  }

  const restaurantId = Number(opts.restaurant);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) throw new Error('--restaurant must be a positive integer id');
  if (!opts.file) throw new Error('--file is required');

  const prov = {
    sourceKind: opts['source-kind'],
    credit: opts.credit,
    sourceUrl: opts['source-url'],
    licenseNote: opts['license-note'],
  };
  const provErrors = validateProvenance(prov);
  if (provErrors.length) throw new Error(`Provenance problem:\n  - ${provErrors.join('\n  - ')}`);

  console.log(`Reading ${opts.file} …`);
  const input = await readFile(opts.file);
  const processed = await processImage(input);
  const paths = storagePaths(restaurantId, processed.hash);

  console.log(
    `Source ${processed.source.width}x${processed.source.height} ${processed.source.format}` +
      `${processed.source.hadExif ? ' (EXIF present — stripped)' : ''}`
  );
  console.log(`hero  ${processed.hero.width}x${processed.hero.height}  ${kb(processed.hero.bytes)}  q${processed.hero.quality}${processed.hero.withinBudget ? '' : '  (over the ~220 KB target)'}`);
  console.log(`thumb ${processed.thumb.width}x${processed.thumb.height}  ${kb(processed.thumb.bytes)}  q${processed.thumb.quality}${processed.thumb.withinBudget ? '' : '  (over the ~60 KB target)'}`);
  console.log(`hash ${processed.hash}   dominant colour ${processed.dominantColor}`);

  const payload = {
    restaurant_id: restaurantId,
    source_kind: prov.sourceKind,
    credit: prov.credit ?? null,
    source_url: prov.sourceUrl ?? null,
    license_note: prov.licenseNote ?? null,
    dominant_color: processed.dominantColor,
    make_primary: !flags.has('no-primary'),
    variants: {
      thumb: { path: paths.thumb, width: processed.thumb.width, height: processed.thumb.height },
      hero: { path: paths.hero, width: processed.hero.width, height: processed.hero.height },
    },
  };

  if (flags.has('dry-run')) {
    const outDir = path.resolve(opts.out || './preview');
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, `${processed.hash}-thumb.webp`), processed.thumb.buffer);
    await writeFile(path.join(outDir, `${processed.hash}-hero.webp`), processed.hero.buffer);
    console.log(`\nDRY RUN — nothing uploaded. Previews written to ${outDir}`);
    console.log('Would call add_restaurant_image with:\n' + JSON.stringify(payload, null, 2));
    return;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (use --dry-run to test without it).');
  if (key.startsWith('sb_publishable_')) {
    console.warn('WARNING: that is the public publishable key, not the service-role key. Writes are expected to fail.');
  }
  const url = process.env.SUPABASE_URL || DEFAULT_URL;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('id,name,suburb')
    .eq('id', restaurantId)
    .maybeSingle();
  if (rErr) throw new Error(`Could not look up the restaurant: ${rErr.message}`);
  if (!restaurant) throw new Error(`No restaurant with id ${restaurantId}`);

  const label = `${restaurant.name}${restaurant.suburb ? ` (${restaurant.suburb})` : ''}`;
  if (!flags.has('yes')) {
    if (!process.stdin.isTTY) throw new Error('Not running in a terminal — re-run with --yes to confirm the restaurant.');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`\nAttach this image to #${restaurant.id} "${label}" as ${prov.sourceKind}? [y/N] `)).trim().toLowerCase();
    rl.close();
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Cancelled — nothing uploaded.');
      return;
    }
  }

  const storage = supabase.storage.from(BUCKET);
  const newlyUploaded = [];
  try {
    for (const [variant, file] of [['thumb', processed.thumb], ['hero', processed.hero]]) {
      const { error } = await storage.upload(paths[variant], file.buffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // immutable: the filename contains the content hash
        upsert: false,
      });
      if (!error) {
        newlyUploaded.push(paths[variant]);
        console.log(`uploaded ${paths[variant]}`);
      } else if (/already exists|Duplicate|409/i.test(`${error.message} ${error.statusCode ?? ''}`)) {
        console.log(`already stored (same content) ${paths[variant]}`);
      } else {
        throw new Error(`Storage upload failed for ${variant}: ${error.message}`);
      }
    }

    const { data, error } = await supabase.rpc('add_restaurant_image', { p: payload });
    if (error) throw new Error(`Recording the image failed: ${error.message}`);
    console.log(`\nRecorded for #${restaurant.id} "${label}"  primary=${data.primary}`);
  } catch (e) {
    if (newlyUploaded.length) {
      const { error: rmErr } = await storage.remove(newlyUploaded);
      console.error(rmErr ? `Could not remove the files uploaded by this run (${rmErr.message}); remove manually: ${newlyUploaded.join(', ')}` : 'Rolled back: removed the files uploaded by this run.');
    }
    throw e;
  }

  console.log('Public URLs:');
  for (const v of ['thumb', 'hero']) console.log(`  ${v}: ${storage.getPublicUrl(paths[v]).data.publicUrl}`);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
