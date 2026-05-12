// Site Update v42 — Newsroom RSS 2.0 feed.
//
// Emits an RSS feed of all Newsroom weekly entries, newest first. The
// landing page at /newsroom/ surfaces this via a <link rel="alternate"
// type="application/rss+xml"> tag so feed readers auto-discover it.

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const entries = (await getCollection('newsroom')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: "America's School Trust Library — Newsroom",
    description:
      'Weekly survey of what changed in school trust lands across the United States.',
    site: context.site ?? 'https://schooltrusts.net',
    items: entries.map((entry) => ({
      title: entry.data.title,
      link: `/newsroom/${entry.slug}/`,
      pubDate: entry.data.date,
      description: entry.data.kicker,
    })),
    customData: '<language>en-us</language>',
  });
}
