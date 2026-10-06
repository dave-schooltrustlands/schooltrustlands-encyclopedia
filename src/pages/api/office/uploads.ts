// Private office: the owner uploads one file.
//   POST /api/office/uploads?filename=<name>&kind=file|voice
//   Body: the file itself (not a form). Streams straight into the private bucket.
// The file is "pending" until a request or follow-up is sent that names it;
// pending files nobody sends are removed after 24 hours.
// Sign-in and the same-site check are enforced by the gate in src/middleware.ts.
import type { APIRoute } from 'astro';
import { RATE, officeEnv, officeUser } from '../../../lib/office/config';
import { audit, overLimit } from '../../../lib/office/db';
import { storeUpload } from '../../../lib/office/files';
import { apiError, clientIp, json } from '../../../lib/office/util';
export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  if (!user.isOwner) return apiError(403, 'forbidden', 'Only the office owner can add files.');
  if (await overLimit(env.OFFICE_DB, 'upload:' + user.email, RATE.ownerUploads)) {
    return apiError(429, 'rate_limited', 'That is a lot of files in one hour. Please wait a little and try again.');
  }

  const url = new URL(ctx.request.url);
  const kind = url.searchParams.get('kind') === 'voice' ? 'voice' : 'file';
  const stored = await storeUpload(env, ctx.request, {
    filename: url.searchParams.get('filename'),
    kind,
    uploaderKind: 'owner',
    uploadedBy: user.email,
    requestId: null,
  });
  if (stored instanceof Response) return stored;

  await audit(env.OFFICE_DB, {
    actor_kind: 'owner', actor_id: user.email, action: 'file.uploaded', target_id: stored.id, ip: clientIp(ctx.request),
    meta: { kind, size: stored.size, type: stored.content_type },
  });
  return json(201, { ok: true, attachment: stored });
};
