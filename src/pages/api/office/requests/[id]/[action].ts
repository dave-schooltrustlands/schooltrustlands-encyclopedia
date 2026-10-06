// Private office: everything the owner (or a reading admin) can do to one thread.
//   GET  /api/office/requests/<id>/state      status + counters, for the page's quiet refresh
//   POST /api/office/requests/<id>/messages   add a follow-up        { body, attachment_ids, client_key }
//   POST /api/office/requests/<id>/retry      send a failed request again
//   POST /api/office/requests/<id>/delete     delete the thread and its files, for good
//   POST /api/office/requests/<id>/nominate   suggest a bot reply for the Library  { message_id, note, attachment_ids }
//   POST /api/office/requests/<id>/withdraw   take a suggestion back               { publication_id }
// A thread that is not yours looks exactly like one that does not exist: 404.
import type { APIRoute } from 'astro';
import { LIMITS, RATE, defer, officeEnv, officeUser } from '../../../../../lib/office/config';
import {
  addOwnerMessage, audit, deleteRequest, getBot, getRequest, overLimit, pendingOwnerUploads, retryRequest,
} from '../../../../../lib/office/db';
import { ringDoorbell } from '../../../../../lib/office/notify';
import { canNominate, canReadRequest, canWriteRequest } from '../../../../../lib/office/rules';
import {
  apiError, bodyErrorResponse, cleanText, clientIp, idList, isId, json, newId, nowIso, readJson,
} from '../../../../../lib/office/util';
export const prerender = false;

const notFound = () => apiError(404, 'not_found', 'That thread was not found.');

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  const { id, action } = ctx.params;
  if (action !== 'state' || !isId('r', id)) return notFound();
  const request = await getRequest(env.OFFICE_DB, id);
  if (!request || !canReadRequest(user, request)) return notFound();
  const count = await env.OFFICE_DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE request_id = ?').bind(id).first();
  return json(200, { id, status: request.status, updated_at: request.updated_at, message_count: Number(count?.n || 0) });
};

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  const { id, action } = ctx.params;
  if (!isId('r', id)) return notFound();
  const db = env.OFFICE_DB;
  const request = await getRequest(db, id);
  if (!request || !canReadRequest(user, request)) return notFound();
  const ip = clientIp(ctx.request);
  const actorKind = canWriteRequest(user, request) ? 'owner' : 'admin';

  let body: Record<string, any> = {};
  if (action === 'messages' || action === 'nominate' || action === 'withdraw') {
    try {
      body = await readJson(ctx.request, LIMITS.jsonBytes);
    } catch (err) {
      return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
    }
  }

  switch (action) {
    case 'messages': {
      if (!canWriteRequest(user, request)) return apiError(403, 'forbidden', 'Only the owner of this thread can write in it.');
      const text = cleanText(body.body, LIMITS.ownerBodyChars + 1);
      const attachmentIds = idList('a', body.attachment_ids, LIMITS.filesPerMessage);
      const clientKey = /^[A-Za-z0-9._:-]{8,128}$/.test(String(body.client_key || '')) ? String(body.client_key) : null;
      if (!attachmentIds) return apiError(422, 'invalid', `Attach at most ${LIMITS.filesPerMessage} files.`);
      if (text.length > LIMITS.ownerBodyChars) return apiError(422, 'invalid', 'That message is too long. Put the long part in an attached file.');
      if (!text && attachmentIds.length === 0) return apiError(422, 'invalid', 'Write a message, record one, or attach a file.');
      const pending = await pendingOwnerUploads(db, user.email, attachmentIds);
      if (pending.length !== attachmentIds.length) {
        return apiError(422, 'invalid', 'One of the attached files is no longer available. Remove it and attach it again.');
      }
      if (await overLimit(db, 'request:' + user.email, RATE.ownerRequests)) {
        return apiError(429, 'rate_limited', 'That is a lot of messages in one hour. Please wait a little and try again.');
      }
      const added = await addOwnerMessage(db, request, { email: user.email, body: text, attachmentIds, clientKey, ip });
      if (added.requeued) {
        const bot = await getBot(db, request.bot_id);
        if (bot) defer(ctx.locals, ringDoorbell(env, bot, request.id, 'request.queued'));
      }
      return json(added.replayed ? 200 : 201, { ok: true, message_id: added.messageId, requeued: added.requeued, replayed: added.replayed });
    }

    case 'retry': {
      if (!canWriteRequest(user, request)) return apiError(403, 'forbidden', 'Only the owner of this thread can send it again.');
      if (!(await retryRequest(db, request.id))) return apiError(409, 'conflict', 'Only a request that did not finish can be sent again.');
      await audit(db, { actor_kind: 'owner', actor_id: user.email, action: 'request.retried', request_id: request.id, ip });
      const bot = await getBot(db, request.bot_id);
      if (bot) defer(ctx.locals, ringDoorbell(env, bot, request.id, 'request.queued'));
      return json(200, { ok: true, status: 'queued' });
    }

    case 'delete': {
      if (!canWriteRequest(user, request)) return apiError(403, 'forbidden', 'Only the owner of this thread can delete it.');
      const removed = await deleteRequest(env, request.id);
      await audit(db, { actor_kind: 'owner', actor_id: user.email, action: 'request.deleted', request_id: request.id, ip, meta: removed });
      return json(200, { ok: true, deleted: request.id });
    }

    case 'nominate': {
      if (!canNominate(user, request)) return apiError(403, 'forbidden', 'You cannot nominate replies in this thread.');
      if (!isId('m', body.message_id)) return apiError(400, 'bad_request', 'message_id is missing or malformed.');
      const attachmentIds = idList('a', body.attachment_ids, LIMITS.filesPerMessage);
      if (!attachmentIds) return apiError(422, 'invalid', 'The list of files is malformed.');
      const message = await db
        .prepare(`SELECT id FROM messages WHERE id = ? AND request_id = ? AND author_kind = 'bot' AND kind = 'reply'`)
        .bind(body.message_id, request.id)
        .first();
      if (!message) return apiError(422, 'invalid', 'Only a finished bot reply can be suggested for the Library.');
      if (attachmentIds.length) {
        const ok = await db
          .prepare(`SELECT COUNT(*) AS n FROM attachments WHERE message_id = ? AND kind = 'file' AND id IN (${attachmentIds.map(() => '?').join(', ')})`)
          .bind(body.message_id, ...attachmentIds)
          .first();
        if (Number(ok?.n || 0) !== attachmentIds.length) return apiError(422, 'invalid', 'Only files attached to that reply can go with it.');
      }
      const pubId = newId('p');
      try {
        await db
          .prepare(`INSERT INTO publications (id, request_id, message_id, state, nominated_by, nominated_at, note, attachment_ids)
                    VALUES (?, ?, ?, 'nominated', ?, ?, ?, ?)`)
          .bind(pubId, request.id, body.message_id, user.email, nowIso(), cleanText(body.note, LIMITS.noteChars), JSON.stringify(attachmentIds))
          .run();
      } catch {
        return apiError(409, 'conflict', 'That reply has already been suggested.');
      }
      await audit(db, { actor_kind: actorKind, actor_id: user.email, action: 'publication.nominated', request_id: request.id, target_id: pubId, ip, meta: { files: attachmentIds.length } });
      return json(201, { ok: true, publication_id: pubId, state: 'nominated' });
    }

    case 'withdraw': {
      if (!canNominate(user, request)) return apiError(403, 'forbidden', 'You cannot change nominations in this thread.');
      if (!isId('p', body.publication_id)) return apiError(400, 'bad_request', 'publication_id is missing or malformed.');
      const res = await db
        .prepare(`UPDATE publications SET state = 'withdrawn', decided_by = ?, decided_at = ? WHERE id = ? AND request_id = ? AND state = 'nominated'`)
        .bind(user.email, nowIso(), body.publication_id, request.id)
        .run();
      if (Number(res.meta?.changes || 0) !== 1) return apiError(409, 'conflict', 'That suggestion has already been decided.');
      await audit(db, { actor_kind: actorKind, actor_id: user.email, action: 'publication.withdrawn', request_id: request.id, target_id: body.publication_id, ip });
      return json(200, { ok: true, state: 'withdrawn' });
    }

    default:
      return notFound();
  }
};
