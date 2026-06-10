import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const root = process.cwd();
const currentFfgVersion = '30';
const strict = process.argv.includes('--strict');
const warnings = [];

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function readBytes(path) {
  return readFileSync(join(root, path));
}

function fail(message) {
  warnings.push(message);
  console.warn(`writing freshness warning: ${message}`);
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const ffgPage = readText('src/pages/writing/schools-of-the-republic/index.astro');
const ffgVersions = readText('src/data/ffgVersions.ts');
const registry = readText('src/data/writingBookRegistry.ts');
const substrateRoot = root.includes(`${sep}_site_work${sep}`)
  ? root.slice(0, root.indexOf(`${sep}_site_work${sep}`))
  : null;

const versionMatches = [...ffgVersions.matchAll(/v: 'v(\d+)'/g)].map((match) => match[1]);
if (versionMatches[0] !== currentFfgVersion) {
  fail(`FFG version register first/current version is v${versionMatches[0] ?? 'missing'}, expected v${currentFfgVersion}`);
}

if (!ffgPage.includes('Current reading draft, June 2026')) {
  fail('FFG page subtitle does not identify the current June 2026 reading draft');
}

if (!ffgPage.includes('Chapter 9 - What Citizens Can Do Now')) {
  fail('FFG page still appears to describe an older chapter structure');
}

if (ffgPage.includes('revised May 2026')) {
  fail('FFG page still carries the old May 2026 structure label');
}

if (!registry.includes(`Current reading draft is v${currentFfgVersion}`)) {
  fail(`Writing Room registry does not name v${currentFfgVersion} as the current FFG reading draft`);
}

if (substrateRoot) {
  const manifestPath = join(substrateRoot, 'L4_Deliverables/_book_manifests/ffg.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!String(manifest.body_file ?? '').includes(`FFG_v${currentFfgVersion}_`)) {
      fail(`substrate ffg.json body_file is ${manifest.body_file}, expected FFG_v${currentFfgVersion}`);
    }
  }
}

const currentDraft = readBytes(`public/drafts/ffg-v${currentFfgVersion}.docx`);
const latestDraft = readBytes('public/drafts/schools-of-the-republic-latest.docx');
if (hash(currentDraft) !== hash(latestDraft)) {
  fail(`schools-of-the-republic-latest.docx does not match ffg-v${currentFfgVersion}.docx`);
}

if (warnings.length === 0) {
  console.log(`writing freshness check passed: FFG v${currentFfgVersion} is current and latest draft matches`);
} else if (strict) {
  console.error(`writing freshness strict mode failed with ${warnings.length} warning(s)`);
  process.exitCode = 1;
} else {
  console.warn(`writing freshness check completed with ${warnings.length} warning(s); deploy is not blocked`);
}
