// Streams a figure asset from R2 (forever-promise/assets/<name>).
// Sits inside the gated tree, so the middleware passcode check covers it.
import type { APIRoute } from 'astro';
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env: any = (ctx.locals as any)?.runtime?.env || {};
  const bucket = env.COMMENTS_BUCKET;
  const name = String(ctx.params.name || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!bucket || !name) return new Response('Not found', { status: 404 });
  const obj = await bucket.get('forever-promise/assets/' + name);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'private, max-age=3600',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
