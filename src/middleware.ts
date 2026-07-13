// Site middleware. Its ONLY job is the passcode gate on the private
// Forever Promise review tree (/writing/forever-promise/...). Every other
// path — the whole public site — passes straight through untouched.
// The gated pages are all server-rendered (prerender = false), so this
// runs for them on every request; prerendered public pages are never
// affected at runtime.
import { defineMiddleware } from 'astro:middleware';
import { FP_PREFIX, fpToken, readCookie } from './lib/fp';

const ROBOTS = 'noindex, nofollow, noarchive';

function gatePage(wrong: boolean): Response {
  const msg = wrong
    ? '<p class="fp-wrong">That passcode didn&rsquo;t match &mdash; please check your invitation and try again.</p>'
    : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${ROBOTS}"><title>The Forever Promise &middot; Advance Review Copy</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#f5f1e8;color:#1a1a2e;font-family:'EB Garamond',Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1.5rem}
  .card{background:#fffdf7;border:1px solid #d8d1c2;border-top:4px solid #a87f2c;max-width:26rem;width:100%;padding:2.4rem 2.2rem;box-shadow:0 10px 30px rgba(20,36,60,.08)}
  .eyebrow{font-family:'Public Sans',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.16em;color:#a87f2c;text-transform:uppercase;margin:0 0 .6rem}
  h1{font-style:italic;font-weight:600;color:#1b3252;font-size:1.7rem;margin:0 0 .4rem;line-height:1.25}
  p{font-size:1.02rem;line-height:1.6;margin:.5rem 0}
  .fp-wrong{color:#7a2e2e;font-family:'Public Sans',sans-serif;font-size:.85rem}
  label{display:block;font-family:'Public Sans',sans-serif;font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#14243c;margin:1.2rem 0 .35rem}
  input{width:100%;box-sizing:border-box;padding:.6rem .7rem;font-size:1rem;font-family:'Public Sans',sans-serif;border:1px solid #d8d1c2;border-radius:3px;background:#fff}
  button{margin-top:1rem;width:100%;padding:.65rem;font-family:'Public Sans',sans-serif;font-weight:700;font-size:.9rem;letter-spacing:.06em;color:#fffdf7;background:#1b3252;border:none;border-radius:3px;cursor:pointer}
  button:hover{background:#14243c}
  .foot{margin-top:1.4rem;font-size:.85rem;color:#6b6455;font-style:italic}
</style></head><body>
<form class="card" method="post">
  <p class="eyebrow">Advance review copy</p>
  <h1>The Forever Promise</h1>
  <p>This is a private, unpublished reading room for the book&rsquo;s review crew. If you were invited, your note included a passcode.</p>
  ${msg}
  <label for="fp_passcode">Passcode</label>
  <input id="fp_passcode" name="fp_passcode" type="password" autocomplete="off" autofocus required>
  <button type="submit">Open the book</button>
  <p class="foot">Not for sale or citation &mdash; July 2026.</p>
</form></body></html>`;
  return new Response(html, { status: wrong ? 401 : 401, headers: { 'content-type': 'text/html; charset=utf-8', 'X-Robots-Tag': ROBOTS, 'cache-control': 'no-store' } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  if (!pathname.startsWith(FP_PREFIX)) return next();

  const env: any = (context.locals as any)?.runtime?.env || {};
  const passcode = env.FP_PASSCODE;
  if (!passcode) {
    return new Response('The review copy is not configured yet. Please check back shortly.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'X-Robots-Tag': ROBOTS, 'Cache-Control': 'private, no-store' },
    });
  }
  const expected = await fpToken(passcode);

  // Passcode submission
  const ctype = context.request.headers.get('content-type') || '';
  if (context.request.method === 'POST' && (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data'))) {
    let form: FormData | null = null;
    try { form = await context.request.clone().formData(); } catch { form = null; }
    if (form && form.has('fp_passcode')) {
      const given = (form.get('fp_passcode') || '').toString().trim();
      if (given.toLowerCase() === String(passcode).toLowerCase()) {
        return new Response(null, {
          status: 303,
          headers: {
            location: pathname + (search || ''),
            'set-cookie': `fp_key=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=5184000`,
            'X-Robots-Tag': ROBOTS,
            'Cache-Control': 'private, no-store',
          },
        });
      }
      return gatePage(true);
    }
  }

  const given = readCookie(context.request.headers.get('cookie'), 'fp_key');
  if (given !== expected) return gatePage(false);

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', ROBOTS);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('Pragma', 'no-cache');
  return out;
});
