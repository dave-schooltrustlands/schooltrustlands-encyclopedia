// One-off image resize pass. Walks public/img/, resizes anything over
// 500 KB to max 1600px wide at quality 82, replaces in place. Run once:
//   node scripts/resize-images.mjs
// Future image installs should be sized correctly at install time —
// don't wire this into the regular build.

import sharp from 'sharp';
import { readdir, stat, rename } from 'fs/promises';
import { join } from 'path';

const TARGET_DIR = 'public/img';
const MAX_BYTES = 500 * 1024;
const MAX_WIDTH = 1600;
const QUALITY = 82;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

for await (const file of walk(TARGET_DIR)) {
  if (!/\.(jpe?g|png)$/i.test(file)) continue;
  const s = await stat(file);
  if (s.size <= MAX_BYTES) continue;
  console.log(`resizing ${file} (${(s.size / 1024).toFixed(0)} KB)`);
  const tmp = file + '.tmp';
  await sharp(file)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: QUALITY })
    .toFile(tmp);
  await rename(tmp, file);
  const ns = await stat(file);
  console.log(`  -> ${(ns.size / 1024).toFixed(0)} KB`);
}
