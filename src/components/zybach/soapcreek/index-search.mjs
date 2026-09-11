/** Search the published index's organization, without generating answers. */
export function normalizeIndexQuery(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en').replace(/['’‘]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findIndexEntries(entries, query, book = '') {
  const q = normalizeIndexQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const contains = text => tokens.every(t => text.includes(t));
  const results = [];
  for (const entry of entries) {
    if (book && !Object.hasOwn(entry.books, book)) continue;
    const heading = normalizeIndexQuery(entry.heading);
    const names = [heading, ...entry.variants.map(normalizeIndexQuery)];
    const direct = names.some(contains);
    const subs = entry.subheadings.filter(s => (!book || s.books.includes(book)) &&
      names.some(n => contains(`${n} ${normalizeIndexQuery(s.heading)}`)));
    if (!direct && !subs.length) continue;
    const words = heading.split(' ');
    const score = heading === q ? 0 : heading.startsWith(q) ? 1 :
      tokens.every(t => words.some(w => w.startsWith(t))) ? 2 : direct ? 3 : 4;
    results.push({ entry, matchingSubheadings: subs.map(s => s.heading), score });
  }
  return results.sort((a, b) => a.score - b.score || a.entry.heading.localeCompare(b.entry.heading, 'en', { sensitivity: 'base' }));
}
