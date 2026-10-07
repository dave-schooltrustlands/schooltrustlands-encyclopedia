// Bundles an office TypeScript module with esbuild (already a dependency via
// Astro) so the node:test suites can import it without a TS toolchain.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export async function loadTs(rel) {
  const out = await build({ entryPoints: [path.join(ROOT, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  const dir = mkdtempSync(path.join(tmpdir(), 'office-test-'));
  const file = path.join(dir, path.basename(rel).replace(/\.ts$/, '.mjs'));
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
export { ROOT };
