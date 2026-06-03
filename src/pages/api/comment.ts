import type { APIRoute } from 'astro';
export const prerender = false;

const J = (s: number, p: any) =>
  new Response(JSON.stringify(p), { status: s, headers: { 'content-type': 'application/json' } });

// Public comment endpoint. No login required. Stores text + media in R2 and
// opens a GitHub issue (which emails Dave). Prototype: no spam protection.
export const POST: APIRoute = async (ctx) => {
  const env: any = (ctx.locals as any)?.runtime?.env || {};
  const bucket = env.COMMENTS_BUCKET;
  if (!bucket) return J(500, { error: 'Storage is not configured yet.' });

  let form: FormData;
  try { form = await ctx.request.formData(); } catch { return J(400, { error: 'Expected a form submission.' }); }

  const text = (form.get('text') || '').toString().trim().slice(0, 6000);
  const name = (form.get('name') || '').toString().trim().slice(0, 120);
  const email = (form.get('email') || '').toString().trim().slice(0, 200);
  const page = (form.get('page_url') || '').toString().trim().slice(0, 2000);
  const files = form.getAll('files').filter((f: any) => f && typeof f === 'object' && 'arrayBuffer' in f && f.size > 0) as any[];

  if (!text && files.length === 0) return J(400, { error: 'Please write a comment or add a recording or file.' });

  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const stored: any[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const base = (f.name || ('file-' + i)).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || ('file-' + i);
    const fname = i + '-' + base;
    const buf = await f.arrayBuffer();
    await bucket.put('comments/' + id + '/' + fname, buf, { httpMetadata: { contentType: f.type || 'application/octet-stream' } });
    stored.push({ name: f.name || fname, fname, type: f.type || '', size: f.size });
  }

  const record = { id, created: new Date().toISOString(), name, email, page_url: page, text, files: stored };
  await bucket.put('comments/' + id + '/comment.json', JSON.stringify(record, null, 2), { httpMetadata: { contentType: 'application/json' } });

  try {
    const ghTok = env.COMMENT_GH_TOKEN;
    const adminKey = env.COMMENT_ADMIN_KEY || '';
    const origin = new URL(ctx.request.url).origin;
    if (ghTok) {
      const links = stored.map((s: any) =>
        '- [' + s.name + '](' + origin + '/api/comment-media?id=' + id + '&name=' + encodeURIComponent(s.fname) + '&key=' + adminKey + ') — ' + (s.type || 'file') + ', ' + Math.round(s.size / 1024) + ' KB'
      ).join('\n');
      const body =
        '**New reader comment in the Writing Room**\n\n' +
        '**Page:** ' + (page || '(unknown)') + '\n' +
        '**From:** ' + (name || '(anonymous)') + (email ? ' <' + email + '>' : '') + '\n\n' +
        (text ? text : '_(no text — see attached media)_') + '\n\n' +
        (stored.length ? '**Attachments (' + stored.length + '):**\n' + links : '_No attachments._') + '\n\n' +
        '_Comment id: ' + id + '_';
      await fetch('https://api.github.com/repos/dave-schooltrustlands/schooltrustlands-encyclopedia/issues', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + ghTok, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'ffg-comments' },
        body: JSON.stringify({ title: 'Reader comment: ' + (text || '(media)').slice(0, 60), body, labels: ['reader-comment'] }),
      });
    }
  } catch { /* notification is best-effort; the comment is already stored */ }

  return J(200, { ok: true, id });
};
