// Forever Promise review edition — suggestion intake.
// JSON POST from the gated reading pages; requires the gate cookie.
// Records land in R2 (bucket ffg-comments) under forever-promise/suggestions/
// for the writing crew to sweep when assembling the next draft.
import type { APIRoute } from 'astro';
import { fpAuthed } from '../../lib/fp';
export const prerender = false;

const J = (s: number, p: any) =>
  new Response(JSON.stringify(p), { status: s, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async (ctx) => {
  const env: any = (ctx.locals as any)?.runtime?.env || {};
  const bucket = env.COMMENTS_BUCKET;
  if (!bucket) return J(500, { error: 'Storage is not configured yet.' });
  if (!(await fpAuthed(ctx.request, env))) return J(401, { error: 'The reading-room passcode is required.' });

  let body: any;
  try { body = await ctx.request.json(); } catch { return J(400, { error: 'Expected JSON.' }); }
  const clean = (v: any, n: number) => (v == null ? '' : String(v)).trim().slice(0, n);
  const record = {
    id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    created: new Date().toISOString(),
    book: 'the-forever-promise',
    draft: 'v0.2-2026-07-11',
    kind: clean(body.kind, 20) === 'general' ? 'general' : 'paragraph',
    page: clean(body.page, 80),
    pid: clean(body.pid, 40),
    snippet: clean(body.snippet, 300),
    name: clean(body.name, 120),
    suggestion: clean(body.suggestion, 8000),
  };
  if (!record.suggestion) return J(400, { error: 'Please write a suggestion.' });
  if (!record.page) return J(400, { error: 'Missing page id.' });

  const day = record.created.slice(0, 10);
  await bucket.put(
    'forever-promise/suggestions/' + day + '/' + record.id + '.json',
    JSON.stringify(record, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  );
  return J(200, { ok: true, id: record.id });
};
