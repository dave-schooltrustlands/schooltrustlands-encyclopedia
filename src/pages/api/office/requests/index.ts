// Private office: the owner sends a new request to a bot.
//   POST /api/office/requests
//   { "bot_id": "herald", "title": "optional", "body": "markdown", "attachment_ids": ["a_..."], "client_key": "..." }
//   -> 201 { "ok": true, "id": "r_...", "url": "/office/r_.../" }
// The request goes into that bot's queue as 'queued'. client_key makes a
// double-click or a retried send land as one request, not two.
import type { APIRoute } from 'astro';
import { LIMITS, RATE, defer, officeEnv, officeUser } from '../../../../lib/office/config';
import { botUsable } from '../../../../lib/office/policy';
import { createRequest, getBot, overLimit, pendingOwnerUploads } from '../../../../lib/office/db';
import { ringDoorbell } from '../../../../lib/office/notify';
import { apiError, bodyErrorResponse, cleanLine, cleanText, clientIp, idList, json, readJson } from '../../../../lib/office/util';
export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  if (!user.isOwner) return apiError(403, 'forbidden', 'Only the office owner can send requests.');
  const db = env.OFFICE_DB;

  let body: Record<string, any>;
  try {
    body = await readJson(ctx.request, LIMITS.jsonBytes);
  } catch (err) {
    return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
  }

  const botId = cleanLine(body.bot_id, 40);
  const text = cleanText(body.body, LIMITS.ownerBodyChars + 1);
  const attachmentIds = idList('a', body.attachment_ids, LIMITS.filesPerMessage);
  const clientKey = /^[A-Za-z0-9._:-]{8,128}$/.test(String(body.client_key || '')) ? String(body.client_key) : null;

  if (!attachmentIds) return apiError(422, 'invalid', `Attach at most ${LIMITS.filesPerMessage} files.`);
  if (text.length > LIMITS.ownerBodyChars) return apiError(422, 'invalid', 'That request is too long. Put the long part in an attached file.');
  if (!text && attachmentIds.length === 0) return apiError(422, 'invalid', 'Write what you need, record it, or attach a file.');

  const bot = await getBot(db, botId);
  if (!bot || !botUsable(bot, env)) return apiError(422, 'invalid', 'Choose who to send this to.');

  const pending = await pendingOwnerUploads(db, user.email, attachmentIds);
  if (pending.length !== attachmentIds.length) {
    return apiError(422, 'invalid', 'One of the attached files is no longer available. Remove it and attach it again.');
  }

  if (await overLimit(db, 'request:' + user.email, RATE.ownerRequests)) {
    return apiError(429, 'rate_limited', 'That is a lot of requests in one hour. Please wait a little and try again.');
  }

  const firstLine = (text.split('\n').find((l) => l.trim()) || '').replace(/^[#>*\-\s]+/, '');
  const title =
    cleanLine(body.title, LIMITS.titleChars) ||
    cleanLine(firstLine, 80) ||
    (pending.some((p) => p.kind === 'voice') ? 'Voice request' : 'Request with attachments');

  const created = await createRequest(db, {
    email: user.email, botId, title, body: text, attachmentIds, clientKey, ip: clientIp(ctx.request),
  });
  if (!created.replayed) defer(ctx.locals, ringDoorbell(env, bot, created.id, 'request.queued'));

  return json(created.replayed ? 200 : 201, { ok: true, id: created.id, url: `/office/${created.id}/`, replayed: created.replayed });
};
