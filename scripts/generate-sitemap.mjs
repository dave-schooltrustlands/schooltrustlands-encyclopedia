import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://schooltrusts.org';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITEMAP = path.join(DIST, 'sitemap.xml');
const STATES_ALIAS_RE = /^\/states\/[^/]+\/$/;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function pathnameForHtml(filePath) {
  const relative = path.relative(DIST, filePath).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) {
    return `/${relative.slice(0, -'index.html'.length)}`;
  }
  if (relative.endsWith('.html')) return `/${relative.slice(0, -'.html'.length)}/`;
  return null;
}

function canonicalFromHtml(html) {
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i);
  if (!match) return null;
  const href = match[0].match(/\shref=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const locs = [];

for await (const filePath of walk(DIST)) {
  if (!filePath.endsWith('.html')) continue;
  const pathname = pathnameForHtml(filePath);
  if (!pathname || pathname === '/404/') continue;
  if (STATES_ALIAS_RE.test(pathname)) continue;

  const loc = `${SITE_URL}${pathname}`;
  const html = await fs.readFile(filePath, 'utf8');
  const canonical = canonicalFromHtml(html);

  if (canonical && canonical !== loc) continue;
  locs.push(loc);
}

const uniqueLocs = [...new Set(locs)].sort();
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  uniqueLocs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join('\n') +
  `\n</urlset>\n`;

await fs.writeFile(SITEMAP, xml, 'utf8');
console.log(`Generated sitemap.xml with ${uniqueLocs.length} URLs`);
