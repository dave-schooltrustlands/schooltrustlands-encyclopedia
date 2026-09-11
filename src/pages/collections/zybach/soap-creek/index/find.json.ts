import { seriesIndexLetter, seriesIndexLetterSlugs } from '../../../../../components/zybach/soapcreek/data';
import type { Ref } from '../../../../../components/zybach/soapcreek/data';
import { indexLetterHref, resolveMonoSlug } from '../../../../../components/zybach/soapcreek/links';
import { namesASite } from '../../../../../components/zybach/soapcreek/suppress';

export const prerender = true;

// Only the public accessor supplies entries and references. Never serialize
// raw index metadata: it includes references removed by the publication holds.
function bookCounts(refs: Ref[]) {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    const slug = resolveMonoSlug(ref.mono_slug ?? ref.mono_number ?? ref.zc_id);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

export function GET() {
  const entries = seriesIndexLetterSlugs.flatMap(letter =>
    seriesIndexLetter(letter).filter(e => e.entry_id && e.heading).map(e => {
      const subs = e.subentries ?? [];
      const refs = [...(e.refs ?? []), ...subs.flatMap(s => s.refs ?? [])];
      return {
        heading: e.heading,
        href: `${indexLetterHref(letter)}#${e.entry_id}`,
        variants: (e.variants ?? []).filter(v => !namesASite(v)),
        subheadings: subs.map(s => ({ heading: s.subheading ?? '', books: Object.keys(bookCounts(s.refs ?? [])) })),
        books: bookCounts(refs),
        refs: refs.length,
      };
    }),
  );
  return new Response(JSON.stringify({ version: 1, entries }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
