// Forever Promise review edition — crew maintenance endpoint.
// Everything here is confined to the forever-promise/ prefix of the
// ffg-comments bucket and gated by the COMMENT_ADMIN_KEY secret.
// Used to (a) load book content into R2 without it ever entering this
// public repo, (b) sweep suggestions for the next draft, (c) drop in
// figure assets as they arrive.
//   PUT  /api/fp-admin?op=put&key=content/manifest.json   (body = the object)
//   GET  /api/fp-admin?op=list&prefix=suggestions/
//   GET  /api/fp-admin?op=get&key=suggestions/...json
//   POST /api/fp-admin?op=del&key=suggestions/...json
// Auth: header  x-fp-admin-key: <COMMENT_ADMIN_KEY>
import type { APIRoute } from 'astro';
export const prerender = false;

const PREFIX = 'forever-promise/';
const J = (s: number, p: any) =>
  new Response(JSON.stringify(p), { status: s, headers: { 'content-type': 'application/json' } });

function guard(ctx: any): { env: any; bucket: any } | Response {
  const env: any = (ctx.locals as any)?.runtime?.env || {};
  const key = ctx.request.headers.get('x-fp-admin-key') || '';
  if (!env.COMMENT_ADMIN_KEY || key !== env.COMMENT_ADMIN_KEY) return J(401, { error: 'Bad admin key.' });
  if (!env.COMMENTS_BUCKET) return J(500, { error: 'No bucket binding.' });
  return { env, bucket: env.COMMENTS_BUCKET };
}
const safeKey = (raw: string | null): string | null => {
  const k = (raw || '').replace(/^\/+/, '');
  if (!k || k.includes('..')) return null;
  return PREFIX + k.replace(new RegExp('^' + PREFIX), '');
};

export const GET: APIRoute = async (ctx) => {
  const g = guard(ctx); if (g instanceof Response) return g;
  const url = new URL(ctx.request.url);
  const op = url.searchParams.get('op') || 'list';
  if (op === 'list') {
    const prefix = PREFIX + (url.searchParams.get('prefix') || 'suggestions/').replace(/^\/+/, '');
    const out: any[] = [];
    let cursor: string | undefined;
    do {
      const page = await g.bucket.list({ prefix, cursor, limit: 500 });
      for (const o of page.objects) out.push({ key: o.key, size: o.size, uploaded: o.uploaded });
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor && out.length < 5000);
    return J(200, { count: out.length, objects: out });
  }
  if (op === 'get') {
    const key = safeKey(url.searchParams.get('key'));
    if (!key) return J(400, { error: 'Bad key.' });
    const obj = await g.bucket.get(key);
    if (!obj) return J(404, { error: 'Not found.' });
    return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream' } });
  }
  return J(400, { error: 'Unknown op.' });
};

export const PUT: APIRoute = async (ctx) => {
  const g = guard(ctx); if (g instanceof Response) return g;
  const url = new URL(ctx.request.url);
  const key = safeKey(url.searchParams.get('key'));
  if (!key) return J(400, { error: 'Bad key.' });
  const buf = await ctx.request.arrayBuffer();
  await g.bucket.put(key, buf, {
    httpMetadata: { contentType: ctx.request.headers.get('content-type') || 'application/json' },
  });
  return J(200, { ok: true, key, size: buf.byteLength });
};

export const POST: APIRoute = async (ctx) => {
  const g = guard(ctx); if (g instanceof Response) return g;
  const url = new URL(ctx.request.url);
  if ((url.searchParams.get('op') || '') !== 'del') return J(400, { error: 'Unknown op.' });
  const key = safeKey(url.searchParams.get('key'));
  if (!key) return J(400, { error: 'Bad key.' });
  await g.bucket.delete(key);
  return J(200, { ok: true, deleted: key });
};
