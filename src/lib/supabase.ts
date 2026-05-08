// Supabase clients for the Library Card v1 auth + bookmarks layer.
//
// Server-side (createServerClient): used inside .astro pages with
// `export const prerender = false` and inside API endpoints. Reads
// and writes the auth cookies via Astro's cookies API so the session
// roundtrips correctly through Cloudflare Pages Functions.
//
// Browser-side (createBrowserClient): used inside <script> tags on
// client pages — the bookmark button. The PUBLIC_* env vars are
// baked into the build by Vite and shipped to the browser.

import { createServerClient, createBrowserClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

type AstroLike = {
  cookies: AstroCookies;
  request: Request;
};

/** Server-side client for use in .astro frontmatter and API endpoints. */
export function getServerSupabase(astro: AstroLike) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Set in .env locally and in Cloudflare Pages env vars.'
    );
  }
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        // Astro's Cookies API doesn't expose getAll; iterate the Cookie header.
        const header = astro.request.headers.get('cookie') ?? '';
        if (!header) return [];
        return header.split(/;\s*/).map((pair) => {
          const eq = pair.indexOf('=');
          if (eq < 0) return { name: pair, value: '' };
          return {
            name: pair.slice(0, eq),
            value: decodeURIComponent(pair.slice(eq + 1)),
          };
        });
      },
      setAll(cookiesToSet) {
        // @supabase/ssr controls which cookies need httpOnly/secure/sameSite
        // — it sets them per-cookie. Pass options through unchanged so the
        // browser SDK can read the session cookies it needs.
        for (const { name, value, options } of cookiesToSet) {
          astro.cookies.set(name, value, options);
        }
      },
    },
  });
}

/** Browser client — for bookmark button hydration and any client JS. */
export function getBrowserSupabase() {
  // These are inlined at build time for client-side code.
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  return createBrowserClient(url, anon);
}
