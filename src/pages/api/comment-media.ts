import type { APIRoute } from 'astro';
export const prerender = false;

// Gated retrieval of a stored comment file. Links (with ?key=) are emailed to
// Dave via the GitHub issue; the key is the COMMENT_ADMIN_KEY secret.
export const GET: APIRoute = async (ctx) => {
  const env: any = (ctx.locals as any)?.runtime?.env || {};
  const u = new URL(ctx.request.url);
  const id = u.searchParams.get('id') || '';
  const name = u.searchParams.get('name') || '';
  const key = u.searchParams.get('key') || '';
  if (!env.COMMENT_ADMIN_KEY || key !== env.COMMENT_ADMIN_KEY) return new Response('Forbidden', { status: 403 });
  if (!/^[A-Za-z0-9._-]+$/.test(id) || !/^[A-Za-z0-9._-]+$/.test(name)) return new Response('Bad request', { status: 400 });
  const obj = await env.COMMENTS_BUCKET.get('comments/' + id + '/' + name);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream' } });
};
