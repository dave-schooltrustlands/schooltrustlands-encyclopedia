#!/usr/bin/env node
// Turns an approved office publication packet into a Zybach Collection page.
//
//   node scripts/office/publish-packet.mjs <packet.json> [--files <dir>] [--index] [--force]
//
// Input:  the JSON Dave downloads from /office/admin/ ("Download packet").
//         --files <dir>: a folder holding the cleared attachments, downloaded
//         by hand from the same admin page. Each file must match a name and
//         size listed in the packet; anything else is refused.
// Output: src/data/zybach_desk/<slug>.json            (page data)
//         public/collections/zybach/desk/<slug>/<file> (cleared files, if any)
// The page itself is src/pages/collections/zybach/desk/[slug].astro.
// The page ships noindex unless --index is given (do that only after the live
// page has been checked). Nothing is pushed or deployed: review the diff and
// commit it through the normal process.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;
const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,150}$/;
const ALLOWED_EXT = new Set(['pdf', 'txt', 'md', 'csv', 'json', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'm4a', 'wav', 'docx', 'xlsx']);

export function validatePacket(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['packet is not a JSON object'];
  if (p.format !== 'office-publication-packet/v1') errs.push('format must be office-publication-packet/v1');
  if (!/^p_[a-f0-9]{24}$/.test(String(p.publication_id || ''))) errs.push('publication_id is missing or malformed');
  if (!SLUG_RE.test(String(p.slug || ''))) errs.push('slug must be 2-80 lowercase letters, digits, or hyphens');
  if (!String(p.title || '').trim()) errs.push('title is empty');
  if (!String(p.approved_by || '').trim() || !String(p.approved_at || '').trim()) errs.push('packet is not approved');
  if (typeof p.body_markdown !== 'string' || !p.body_markdown.trim()) errs.push('body_markdown is empty');
  if (!Array.isArray(p.attachments)) errs.push('attachments must be a list');
  for (const a of p.attachments || []) {
    const name = String(a?.filename || '');
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!SAFE_NAME_RE.test(name) || name.includes('..') || !ALLOWED_EXT.has(ext)) errs.push(`attachment name not allowed: ${JSON.stringify(name)}`);
  }
  return errs;
}

/** The page data: only fields meant for the public page. No request text, no emails. */
export function pageDataFor(p, { index = false } = {}) {
  return {
    format: 'zybach-desk-page/v1',
    slug: p.slug,
    title: String(p.title).trim().slice(0, 200),
    attribution: String(p.attribution || '').trim().slice(0, 300),
    approved_at: p.approved_at,
    replied_at: p.source?.replied_at || null,
    bot_name: String(p.source?.bot_name || '').slice(0, 80),
    noindex: !index,
    body_markdown: p.body_markdown,
    files: (p.attachments || []).map((a) => ({
      filename: a.filename,
      size: Number(a.size) || 0,
      href: `/collections/zybach/desk/${p.slug}/${encodeURIComponent(a.filename)}`,
    })),
    publication_id: p.publication_id,
  };
}

export async function publish(packet, { root = ROOT, filesDir = null, index = false, force = false } = {}) {
  const errs = validatePacket(packet);
  if (errs.length) throw new Error('Refused:\n - ' + errs.join('\n - '));
  const outJson = path.join(root, 'src/data/zybach_desk', `${packet.slug}.json`);
  if (!force) {
    const prior = await fs.readFile(outJson, 'utf8').then(JSON.parse, () => null);
    if (prior && prior.publication_id !== packet.publication_id) {
      throw new Error(`Refused: ${packet.slug} already belongs to ${prior.publication_id}. Pick another slug or pass --force.`);
    }
  }
  const pubDir = path.join(root, 'public/collections/zybach/desk', packet.slug);
  if (packet.attachments.length) {
    if (!filesDir) throw new Error('Refused: the packet lists files; pass --files <dir> with the downloaded copies.');
    for (const a of packet.attachments) {
      const st = await fs.stat(path.join(filesDir, a.filename)).catch(() => null);
      if (!st || !st.isFile()) throw new Error(`Refused: ${a.filename} is not in ${filesDir}`);
      if (st.size !== Number(a.size)) throw new Error(`Refused: ${a.filename} is ${st.size} bytes, the packet says ${a.size}`);
    }
    await fs.mkdir(pubDir, { recursive: true });
    for (const a of packet.attachments) await fs.copyFile(path.join(filesDir, a.filename), path.join(pubDir, a.filename));
  }
  await fs.mkdir(path.dirname(outJson), { recursive: true });
  await fs.writeFile(outJson, JSON.stringify(pageDataFor(packet, { index }), null, 2) + '\n', 'utf8');
  return { outJson, pubDir, files: packet.attachments.length };
}

async function main(argv) {
  const args = argv.slice(2);
  const fi = args.indexOf('--files');
  const filesDir = fi >= 0 ? args[fi + 1] : null;
  const file = args.filter((a, i) => !a.startsWith('--') && !(fi >= 0 && i === fi + 1))[0];
  if (!file) { console.error('usage: publish-packet.mjs <packet.json> [--files <dir>] [--index] [--force]'); return 2; }
  const packet = JSON.parse(await fs.readFile(file, 'utf8'));
  const r = await publish(packet, { filesDir, index: args.includes('--index'), force: args.includes('--force') });
  console.log(`Wrote ${path.relative(ROOT, r.outJson)}${r.files ? ` and ${r.files} file(s) in ${path.relative(ROOT, r.pubDir)}` : ''}.`);
  console.log(`Page: /collections/zybach/desk/${packet.slug}/ (${args.includes('--index') ? 'indexable' : 'noindex'}). Review with git diff, then commit.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(1); });
}
