// Bot API: work on one request. All POST, all scoped to the calling bot.
//   POST /api/office/bot/requests/<id>/claim        { "lease_seconds": 900 }
//   POST /api/office/bot/requests/<id>/heartbeat    { "lease_token": "...", "lease_seconds": 900 }
//   POST /api/office/bot/requests/<id>/release      { "lease_token": "..." }
//   POST /api/office/bot/requests/<id>/attachments?filename=report.pdf    (body = the file; header X-Office-Lease)
//   POST /api/office/bot/requests/<id>/reply        { "lease_token", "status", "body", "attachment_ids" }  (+ Idempotency-Key header)
// Full contract with examples: docs/office/BOT_API.md
//
// A claim is a lease: it belongs to one run for a limited time. Only the run
// holding the current lease token can upload files or post the reply, so two
// overlapping runs cannot both answer the same request.
import type { APIRoute } from 'astro';
import { LIMITS, defer, officeBot, officeEnv, siteOrigin } from '../../../../../../lib/office/config';
import {
  audit, botReply, claimRequest, clampLease, expireStale, getBot, getRequest, getThread, heartbeat, releaseRequest, threadForBot,
} from '../../../../../../lib/office/db';
import { storeUpload } from '../../../../../../lib/office/files';
import { notifyOwner, ringDoorbell } from '../../../../../../lib/office/notify';
import {
  apiError, bodyErrorResponse, cleanText, clientIp, idList, isId, json, readJson, sha256Hex,
} from '../../../../../../lib/office/util';
export const prerender = false;

const notFound = () => apiError(404, 'not_found', 'No such request.');
const leaseLost = (status: string) =>
  apiError(409, 'lease_lost', 'This run no longer holds the request. Stop work on it; do not retry.', { request_status: status });

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const bot = officeBot(ctx.locals);
  if (!bot) return apiError(401, 'unauthorized', 'Send a valid bot token.');
  const { id, action } = ctx.params;
  if (!isId('r', id)) return notFound();
  const db = env.OFFICE_DB;
  const ip = clientIp(ctx.request);
  const origin = siteOrigin(new URL(ctx.request.url));

  const request = await getRequest(db, id);
  if (!request || request.bot_id !== bot.botId) return notFound();

  // ---- attachments: the body is the file itself, so handle it before any JSON parsing.
  if (action === 'attachments') {
    const lease = ctx.request.headers.get('x-office-lease') || '';
    if (!lease || !['claimed', 'in_progress'].includes(request.status) || request.lease_token_hash !== (await sha256Hex(lease))) {
      return leaseLost(request.status);
    }
    const pending = await db
      .prepare(`SELECT COUNT(*) AS n FROM attachments WHERE request_id = ? AND uploader_kind = 'bot' AND message_id IS NULL`)
      .bind(id)
      .first();
    if (Number(pending?.n || 0) >= LIMITS.filesPerMessage * 2) {
      return apiError(409, 'too_many_files', 'Too many files are waiting on this request. Post a reply that uses them first.');
    }
    const stored = await storeUpload(env, ctx.request, {
      filename: new URL(ctx.request.url).searchParams.get('filename'),
      kind: 'file',
      uploaderKind: 'bot',
      uploadedBy: bot.botId,
      requestId: id,
    });
    if (stored instanceof Response) return stored;
    await audit(db, { actor_kind: 'bot', actor_id: bot.botId, action: 'bot.file_uploaded', request_id: id, target_id: stored.id, ip, meta: { size: stored.size, type: stored.content_type } });
    return json(201, { ok: true, attachment: { id: stored.id, filename: stored.filename, content_type: stored.content_type, size: stored.size } });
  }

  let body: Record<string, any> = {};
  try {
    // claim may be sent with no body at all.
    const hasBody = Number(ctx.request.headers.get('content-length') || '0') > 0;
    if (action !== 'claim' || hasBody) body = await readJson(ctx.request, LIMITS.botJsonBytes);
  } catch (err) {
    return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
  }
  const leaseToken = typeof body.lease_token === 'string' ? body.lease_token.slice(0, 200) : '';
  const leaseSeconds = clampLease(body.lease_seconds);

  switch (action) {
    case 'claim': {
      await expireStale(db);
      const claim = await claimRequest(db, bot.botId, id, leaseSeconds);
      if (!claim) {
        const current = await getRequest(db, id);
        return apiError(409, 'not_claimable', 'This request is not available to claim right now.', {
          request_status: current?.status || request.status,
          lease_expires_at: current?.lease_expires_at || null,
        });
      }
      const thread = await getThread(db, id);
      if (!thread) return notFound();
      await audit(db, { actor_kind: 'bot', actor_id: bot.botId, action: 'bot.claimed', request_id: id, ip, meta: { attempt: thread.request.attempts, lease_seconds: leaseSeconds } });
      return json(200, { ok: true, lease_token: claim.leaseToken, lease_expires_at: claim.leaseExpiresAt, ...threadForBot(thread, origin) });
    }

    case 'heartbeat': {
      if (!leaseToken) return apiError(400, 'bad_request', 'lease_token is required.');
      const until = await heartbeat(db, bot.botId, id, leaseToken, leaseSeconds);
      if (!until) return leaseLost(request.status);
      return json(200, { ok: true, request_status: 'in_progress', lease_expires_at: until });
    }

    case 'release': {
      if (!leaseToken) return apiError(400, 'bad_request', 'lease_token is required.');
      if (!(await releaseRequest(db, bot.botId, id, leaseToken))) return leaseLost(request.status);
      await audit(db, { actor_kind: 'bot', actor_id: bot.botId, action: 'bot.released', request_id: id, ip });
      return json(200, { ok: true, request_status: 'queued' });
    }

    case 'reply': {
      const status = String(body.status || '');
      if (!['answered', 'needs_info', 'failed', 'in_progress'].includes(status)) {
        return apiError(400, 'bad_request', 'status must be one of: answered, needs_info, failed, in_progress.');
      }
      const rawKey = ctx.request.headers.get('idempotency-key') || '';
      if (rawKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(rawKey)) {
        return apiError(400, 'bad_request', 'Idempotency-Key must be 8 to 128 characters: letters, digits, and . _ : -');
      }
      const text = cleanText(body.body, LIMITS.botBodyChars + 1);
      if (text.length > LIMITS.botBodyChars) {
        return apiError(413, 'too_large', `A reply can be up to ${LIMITS.botBodyChars} characters. Put longer material in an attached file.`);
      }
      const attachmentIds = idList('a', body.attachment_ids, LIMITS.filesPerMessage);
      if (!attachmentIds) return apiError(422, 'invalid', `attachment_ids must be a list of at most ${LIMITS.filesPerMessage} attachment ids.`);
      if (!text && status !== 'failed' && attachmentIds.length === 0) {
        return apiError(422, 'invalid', 'A reply needs a body or at least one attachment.');
      }
      if (!leaseToken) return apiError(400, 'bad_request', 'lease_token is required.');

      const result = await botReply(db, {
        botId: bot.botId, request, leaseToken, status: status as 'answered' | 'needs_info' | 'failed' | 'in_progress',
        body: text || (status === 'failed' ? 'The bot could not complete this request.' : ''),
        attachmentIds, idempotencyKey: rawKey || null, leaseSeconds, ip,
      });
      if (!result.ok) {
        if (result.reason === 'bad_attachments') {
          return apiError(422, 'invalid', 'Each attachment id must be a file this bot uploaded to this request and has not used yet.');
        }
        return leaseLost(request.status);
      }
      if (!result.replayed && status !== 'in_progress') {
        if (result.requeued) {
          // Back in the queue for the owner's addition: ring the bot rather than the owner.
          const row = await getBot(db, bot.botId);
          if (row) defer(ctx.locals, ringDoorbell(env, row, id, 'request.queued'));
        } else {
          defer(ctx.locals, notifyOwner(env, request, new URL(ctx.request.url)));
        }
      }
      return json(result.replayed ? 200 : 201, {
        ok: true,
        message_id: result.messageId,
        request_status: result.requestStatus,
        // True when the owner added to the thread while this run was working:
        // the request is back in the queue so the addition gets read.
        requeued: result.requeued,
        replayed: result.replayed,
        lease_expires_at: result.leaseExpiresAt,
      });
    }

    default:
      return notFound();
  }
};
