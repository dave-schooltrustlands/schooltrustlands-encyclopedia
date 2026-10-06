// Private office: read or remove one file.
//   GET    /api/office/attachments/<id>   stream the file (supports Range, for audio)
//   DELETE /api/office/attachments/<id>   remove a file that has not been sent yet
// There is no public address for any stored file; this route checks who is
// asking on every request. Unknown and not-yours look the same: 404.
import type { APIRoute } from 'astro';
import { officeEnv, officeUser } from '../../../../lib/office/config';
import { audit } from '../../../../lib/office/db';
import { serveAttachment } from '../../../../lib/office/files';
import { canReadAttachment } from '../../../../lib/office/rules';
import { apiError, clientIp, isId, json } from '../../../../lib/office/util';
export const prerender = false;

const notFound = () => apiError(404, 'not_found', 'That file was not found.');

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  const id = ctx.params.id;
  if (!isId('a', id)) return notFound();

  const db = env.OFFICE_DB;
  const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first();
  if (!att || !(await canReadAttachment(db, user, att))) return notFound();

  // A read by anyone other than the thread's owner gets a line in the log.
  if (att.request_id && !ctx.request.headers.get('range')) {
    const request = await db.prepare('SELECT owner_email FROM requests WHERE id = ?').bind(att.request_id).first();
    if (request && request.owner_email !== user.email) {
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'admin.file_read', request_id: att.request_id, target_id: att.id, ip: clientIp(ctx.request) });
    }
  }
  return serveAttachment(env, ctx.request, att);
};

export const DELETE: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  const id = ctx.params.id;
  if (!isId('a', id)) return notFound();

  const db = env.OFFICE_DB;
  const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(id).first();
  if (!att || att.uploader_kind !== 'owner' || att.uploaded_by !== user.email) return notFound();
  if (att.message_id) {
    return apiError(409, 'already_sent', 'That file is part of a sent message. Delete the thread to remove it.');
  }
  // Row first, and only if it is still unsent; then the stored bytes.
  const gone = await db.prepare('DELETE FROM attachments WHERE id = ? AND message_id IS NULL RETURNING r2_key').bind(id).first();
  if (!gone) return apiError(409, 'already_sent', 'That file is part of a sent message. Delete the thread to remove it.');
  await env.OFFICE_BUCKET.delete(gone.r2_key);
  await audit(db, { actor_kind: 'owner', actor_id: user.email, action: 'file.removed', target_id: id, ip: clientIp(ctx.request) });
  return json(200, { ok: true, deleted: id });
};
