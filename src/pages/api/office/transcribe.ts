// Private office: turn one of the owner's recordings into text.
//   POST /api/office/transcribe   { "attachment_id": "a_..." }
//   -> { "ok": true, "text": "..." }
// Uses Workers AI (binding AI) with Whisper. The audio stays in the private
// bucket as an attachment either way; the text comes back so the owner can
// correct it before sending. The uncorrected machine transcript is also kept
// with the recording, so the bot can compare it against the audio.
// If the AI binding is missing this answers 501 and the office carries on
// without transcription (the bot still receives the recording).
import type { APIRoute } from 'astro';
import { DEFAULT_WHISPER_MODEL, LIMITS, RATE, canSendRequests, officeEnv, officeUser } from '../../../lib/office/config';
import { audit, overLimit } from '../../../lib/office/db';
import { isAudio } from '../../../lib/office/files';
import { canReadAttachment } from '../../../lib/office/rules';
import { apiError, bodyErrorResponse, bytesToBase64, cleanText, clientIp, isId, json, readJson } from '../../../lib/office/util';
export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  if (!canSendRequests(user)) return apiError(403, 'forbidden', 'Only the office owner can transcribe recordings.');

  let body: Record<string, any>;
  try {
    body = await readJson(ctx.request, LIMITS.jsonBytes);
  } catch (err) {
    return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
  }
  if (!isId('a', body.attachment_id)) return apiError(400, 'bad_request', 'attachment_id is missing or malformed.');

  const db = env.OFFICE_DB;
  const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(body.attachment_id).first();
  if (!att || att.uploader_kind !== 'owner' || att.uploaded_by !== user.email || !(await canReadAttachment(db, user, att))) {
    return apiError(404, 'not_found', 'That recording was not found.');
  }
  if (!isAudio(att)) return apiError(415, 'unsupported_type', 'Only audio recordings can be transcribed.');
  if (att.size > LIMITS.transcribeBytes) {
    return apiError(413, 'too_large', 'That recording is too long to transcribe here. It is still attached, and the bot will receive it.');
  }
  if (!env.AI) {
    return apiError(501, 'transcription_unavailable', 'Transcription is not switched on. Your recording is still attached, and the bot will receive it.');
  }
  if (await overLimit(db, 'transcribe:' + user.email, RATE.ownerTranscriptions)) {
    return apiError(429, 'rate_limited', 'That is a lot of recordings in one hour. Please wait a little and try again.');
  }

  const obj = await env.OFFICE_BUCKET.get(att.r2_key);
  if (!obj) return apiError(404, 'not_found', 'That recording is no longer stored.');
  const bytes = new Uint8Array(await obj.arrayBuffer());

  const model = String(env.OFFICE_WHISPER_MODEL || DEFAULT_WHISPER_MODEL);
  let text = '';
  try {
    // whisper-large-v3-turbo takes the audio as base64. If OFFICE_WHISPER_MODEL
    // names another model, it must accept the same input.
    const input = { audio: bytesToBase64(bytes), task: 'transcribe', vad_filter: true };
    const out = await env.AI.run(model, input);
    text = cleanText(out?.text, LIMITS.ownerBodyChars);
  } catch {
    await audit(db, { actor_kind: 'owner', actor_id: user.email, action: 'transcribe.failed', target_id: att.id, ip: clientIp(ctx.request), meta: { size: att.size } });
    return apiError(502, 'transcription_failed', 'The recording could not be transcribed just now. It is still attached, and the bot will receive it.');
  }

  await db.prepare('UPDATE attachments SET transcript = ? WHERE id = ?').bind(text, att.id).run();
  await audit(db, {
    actor_kind: 'owner', actor_id: user.email, action: 'transcribe.done', target_id: att.id, ip: clientIp(ctx.request),
    meta: { size: att.size, chars: text.length },
  });
  return json(200, { ok: true, attachment_id: att.id, text });
};
