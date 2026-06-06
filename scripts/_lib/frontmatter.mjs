// Minimal YAML frontmatter reader for the per-state markdown files.
//
// Why hand-rolled instead of js-yaml: the frontmatter shape is regular and
// authored exclusively by the migration scripts in this repo, so a small
// targeted parser avoids pulling in a dependency for one read path. Handles
// the four shapes that actually appear:
//
//   key: scalar              — string, number, null, bool, ISO date
//   key: "quoted"            — single-line quoted (may span multiple lines
//                              when the quote stays open — used for the
//                              long governanceForm strings, e.g. Hawaii)
//   key:                     — nested mapping starting on the next line,
//     subkey: value            indented by one or more spaces
//   key:                     — same shape, also valid for null mappings;
//                              `key: null` and `key: ~` also yield null

import { readFileSync } from 'node:fs';

export function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  const q = v.match(/^"(.*)"$/) || v.match(/^'(.*)'$/);
  if (q) return q[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function readFrontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`No frontmatter in ${path}`);
  const lines = m[1].replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.startsWith('#')) { i++; continue; }
    const top = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!top) { i++; continue; }
    const [, key, raw] = top;

    if (raw === '' || raw === undefined) {
      // Nested map on subsequent indented lines.
      const nested = {};
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        const sub = lines[i].match(/^\s+([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
        if (sub) nested[sub[1]] = parseScalar(sub[2]);
        i++;
      }
      out[key] = Object.keys(nested).length === 0 ? null : nested;
      continue;
    }

    // Multi-line quoted string: opening quote with no closing quote on
    // the same line. Concatenate subsequent lines (joined with a space)
    // until the closing quote appears.
    if (
      (raw.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(raw.trim())) ||
      (raw.startsWith("'") && !/^'(?:[^'\\]|\\.)*'$/.test(raw.trim()))
    ) {
      const quote = raw[0];
      let buf = raw.slice(1);
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const closeIdx = next.indexOf(quote);
        if (closeIdx >= 0) {
          buf += ' ' + next.slice(0, closeIdx);
          i++;
          break;
        }
        buf += ' ' + next;
        i++;
      }
      out[key] = buf.trim();
      continue;
    }

    out[key] = parseScalar(raw);
    i++;
  }
  return out;
}
