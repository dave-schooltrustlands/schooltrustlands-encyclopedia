// Renders src/og/og-default.svg to public/og-default.png at 1200×630.
// Run manually after editing the SVG: `node scripts/build-og-images.mjs`.
//
// Sharp resolves font-family via fontconfig at render time. Source Serif 4
// and Inter are unlikely to be installed on the build machine; the SVG
// declares Georgia / sans-serif fallbacks so rendering degrades cleanly
// to DejaVu (Linux) or system equivalents. The rendered PNG is the social
// preview; the live site uses the actual web fonts for everything else.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const svgPath = resolve(repoRoot, 'src/og/og-default.svg');
const pngPath = resolve(repoRoot, 'public/og-default.png');

const svg = await readFile(svgPath);
const png = await sharp(svg, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(pngPath, png);
console.log(`wrote ${pngPath} (${png.length} bytes)`);
