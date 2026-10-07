// Private office: administrator actions. The gate in src/middleware.ts has
// already confirmed the caller is on the admin list.
//   POST /api/office/admin/bot-save            add or change a bot in the registry
//   POST /api/office/admin/token-mint          issue a bot token (shown once, never stored)
//   POST /api/office/admin/token-revoke        switch a token off at once
//   POST /api/office/admin/webhook-key         show a bot's doorbell signing key
//   POST /api/office/admin/publication-decide  approve or decline a nominated reply
//   POST /api/office/admin/publication-url     record where an approved reply was published
//   GET  /api/office/admin/packet?id=p_...     download the publication packet for an approved reply
//
// Approving a reply publishes nothing. It allows a packet to be exported; a
// person then commits that packet to the Library through the normal process.
import type { APIRoute } from 'astro';
import { LIMITS, RATE, officeEnv, officeUser } from '../../../../lib/office/config';
import { botUsable, isBlockedAgent, normAgentId } from '../../../../lib/office/policy';
import { audit, getBot, getPublication, overLimit, parseIdArray } from '../../../../lib/office/db';
import { validWebhookUrl, webhookKey } from '../../../../lib/office/notify';
import {
  apiError, bodyErrorResponse, cleanLine, cleanText, clientIp, idList, isId, json, nowIso, randomHex, randomToken, readJson,
  sha256Hex, slugify,
} from '../../../../lib/office/util';
export const prerender = false;

const BOT_ID_RE = /^[a-z][a-z0-9-]{1,31}$/;

function packetFor(pub: Record<string, any>, files: Record<string, any>[]): Record<string, unknown> {
  return {
    format: 'office-publication-packet/v1',
    publication_id: pub.id,
    title: pub.title,
    slug: pub.slug,
    // A proposal. The Zybach Collection's own generator decides the final address.
    proposed_path: `/collections/zybach/desk/${pub.slug}/`,
    // Ship the page with noindex first; remove it once the live page has been checked.
    noindex: true,
    attribution: pub.attribution,
    approved_by: pub.decided_by,
    approved_at: pub.decided_at,
    source: { request_id: pub.request_id, message_id: pub.message_id, bot_id: pub.bot_id, bot_name: pub.bot_name, replied_at: pub.message_at },
    body_markdown: pub.message_body,
    attachments: files.map((f) => ({
      id: f.id, filename: f.filename, content_type: f.content_type, size: f.size,
      download: `/api/office/attachments/${f.id}`,
    })),
    excluded: 'The request text, voice recordings, every other message in the thread, and any file not listed above stay private.',
  };
}

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user?.isAdmin) return apiError(403, 'forbidden', 'Administrators only.');
  if (ctx.params.action !== 'packet') return apiError(404, 'not_found', 'Unknown action.');
  // This download also records that the packet was exported, so do not let another site trigger it.
  if (ctx.request.headers.get('sec-fetch-site') === 'cross-site') return apiError(403, 'cross_site', 'Open this from the admin page.');
  const id = new URL(ctx.request.url).searchParams.get('id');
  if (!isId('p', id)) return apiError(400, 'bad_request', 'id is missing or malformed.');

  const db = env.OFFICE_DB;
  const pub = await getPublication(db, id);
  if (!pub || pub.state !== 'approved') return apiError(404, 'not_found', 'There is no approved reply with that id.');
  const ids = parseIdArray(pub.attachment_ids);
  const files = ids.length
    ? (await db
        .prepare(`SELECT id, filename, content_type, size FROM attachments WHERE message_id = ? AND kind = 'file' AND id IN (${ids.map(() => '?').join(', ')})`)
        .bind(pub.message_id, ...ids)
        .all()).results || []
    : [];
  await db.prepare('UPDATE publications SET exported_at = ? WHERE id = ?').bind(nowIso(), id).run();
  await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'publication.exported', request_id: pub.request_id, target_id: id, ip: clientIp(ctx.request), meta: { files: files.length } });
  return json(200, packetFor(pub, files), {
    'content-disposition': `attachment; filename="office-publication-${pub.slug || id}.json"`,
  });
};

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user?.isAdmin) return apiError(403, 'forbidden', 'Administrators only.');
  const db = env.OFFICE_DB;
  const ip = clientIp(ctx.request);
  if (await overLimit(db, 'admin:' + user.email, RATE.adminActions)) {
    return apiError(429, 'rate_limited', 'Too many changes in one hour. Please wait a little and try again.');
  }

  let body: Record<string, any>;
  try {
    body = await readJson(ctx.request, LIMITS.jsonBytes);
  } catch (err) {
    return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
  }
  const now = nowIso();

  switch (ctx.params.action) {
    case 'bot-save': {
      const id = cleanLine(body.id, 40).toLowerCase();
      const name = cleanLine(body.name, 60);
      const description = cleanLine(body.description, 200);
      const sort = Math.max(0, Math.min(9999, Math.floor(Number(body.sort)) || 100));
      const enabled = body.enabled === false || body.enabled === 0 ? 0 : 1;
      const webhookUrl = cleanLine(body.webhook_url, 500);
      const agentId = normAgentId(cleanLine(body.agent_id, 64));
      if (agentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(agentId)) return apiError(422, 'invalid', 'The agent id must be a UUID.');
      if (isBlockedAgent(agentId)) return apiError(422, 'bot_blocked', 'That agent is blocked from this office.');
      if (!BOT_ID_RE.test(id)) return apiError(422, 'invalid', 'The id must be 2 to 32 lowercase letters, digits, or hyphens, starting with a letter.');
      if (!name) return apiError(422, 'invalid', 'Give the bot a name.');
      if (webhookUrl && !validWebhookUrl(webhookUrl)) return apiError(422, 'invalid', 'The doorbell address must be a public https:// address.');
      const existing = await getBot(db, id);
      const rotate = !!existing && body.rotate_webhook_key === true;
      await db
        .prepare(
          `INSERT INTO bots (id, name, description, enabled, sort, webhook_url, webhook_key_version, agent_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, enabled = excluded.enabled,
             sort = excluded.sort, webhook_url = excluded.webhook_url, agent_id = excluded.agent_id, updated_at = excluded.updated_at,
             webhook_key_version = bots.webhook_key_version + ?`,
        )
        .bind(id, name, description, enabled, sort, webhookUrl || null, agentId || null, user.email, now, now, rotate ? 1 : 0)
        .run();
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: existing ? 'bot.updated' : 'bot.created', target_id: id, ip, meta: { enabled, doorbell: !!webhookUrl, rotated: rotate } });
      return json(200, { ok: true, id, created: !existing });
    }

    case 'token-mint': {
      const botId = cleanLine(body.bot_id, 40);
      const bot = await getBot(db, botId);
      if (!bot) return apiError(422, 'invalid', 'Choose a bot.');
      if (!botUsable(bot, env)) return apiError(422, 'bot_not_allowed', 'That bot is not on the office allow list, so it cannot get a token.');
      const days = Math.floor(Number(body.expires_days));
      const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86400 * 1000).toISOString() : null;
      const tokenId = randomHex(8);
      const token = `ofb_${tokenId}_${randomToken(32)}`;
      await db
        .prepare('INSERT INTO bot_tokens (id, bot_id, token_hash, label, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(tokenId, botId, await sha256Hex(token), cleanLine(body.label, 80), now, user.email, expiresAt)
        .run();
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'token.minted', target_id: tokenId, ip, meta: { bot: botId, expires: !!expiresAt } });
      // The only time the token is ever shown. It is not stored anywhere on the site.
      return json(201, {
        ok: true, token, token_id: tokenId, bot_id: botId, expires_at: expiresAt,
        env_name: 'OFFICE_BOT_TOKEN_' + botId.toUpperCase().replace(/-/g, '_'),
      });
    }

    case 'token-revoke': {
      const tokenId = String(body.token_id || '');
      if (!/^[a-f0-9]{16}$/.test(tokenId)) return apiError(400, 'bad_request', 'token_id is missing or malformed.');
      const res = await db.prepare('UPDATE bot_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, tokenId).run();
      if (Number(res.meta?.changes || 0) !== 1) return apiError(404, 'not_found', 'No active token has that id.');
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'token.revoked', target_id: tokenId, ip });
      return json(200, { ok: true, revoked: tokenId });
    }

    case 'webhook-key': {
      const bot = await getBot(db, cleanLine(body.bot_id, 40));
      if (!bot) return apiError(404, 'not_found', 'No such bot.');
      const key = await webhookKey(env, String(bot.id), Number(bot.webhook_key_version || 1));
      if (!key) return apiError(501, 'not_configured', 'Set the OFFICE_WEBHOOK_SECRET secret (32 or more characters) to use doorbells.');
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'webhook_key.shown', target_id: String(bot.id), ip });
      return json(200, { ok: true, bot_id: bot.id, key, version: bot.webhook_key_version });
    }

    case 'publication-decide': {
      if (!isId('p', body.id)) return apiError(400, 'bad_request', 'id is missing or malformed.');
      const pub = await getPublication(db, body.id);
      if (!pub || pub.state !== 'nominated') return apiError(409, 'conflict', 'That suggestion is not waiting for a decision.');
      const note = cleanText(body.note, LIMITS.noteChars);
      if (body.decision === 'reject') {
        const res = await db.prepare(`UPDATE publications SET state = 'rejected', decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND state = 'nominated'`)
          .bind(user.email, now, note, pub.id).run();
        if (Number(res.meta?.changes || 0) !== 1) return apiError(409, 'conflict', 'That suggestion is not waiting for a decision.');
        await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'publication.rejected', request_id: pub.request_id, target_id: pub.id, ip });
        return json(200, { ok: true, state: 'rejected' });
      }
      if (body.decision !== 'approve') return apiError(400, 'bad_request', 'decision must be "approve" or "reject".');
      const title = cleanLine(body.title, LIMITS.titleChars) || String(pub.request_title);
      const slug = slugify(cleanLine(body.slug, 100) || title);
      const attribution = cleanText(body.attribution, 600);
      if (!slug) return apiError(422, 'invalid', 'Give the public page a short address (letters, digits, hyphens).');
      if (!attribution) return apiError(422, 'invalid', 'Say how the reply should be credited.');
      // Only files the nominator offered can be cleared; the admin may clear fewer, never more.
      const offered = parseIdArray(pub.attachment_ids);
      const chosen = idList('a', body.attachment_ids ?? offered, LIMITS.filesPerMessage);
      if (!chosen || chosen.some((a) => !offered.includes(a))) return apiError(422, 'invalid', 'Only files offered with the suggestion can be included.');
      const res = await db
        .prepare(`UPDATE publications SET state = 'approved', decided_by = ?, decided_at = ?, decision_note = ?, title = ?, slug = ?, attribution = ?, attachment_ids = ?
                  WHERE id = ? AND state = 'nominated'`)
        .bind(user.email, now, note, title, slug, attribution, JSON.stringify(chosen), pub.id)
        .run();
      // The suggestion may have been taken back while the admin was reading it.
      if (Number(res.meta?.changes || 0) !== 1) return apiError(409, 'conflict', 'That suggestion is not waiting for a decision.');
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'publication.approved', request_id: pub.request_id, target_id: pub.id, ip, meta: { files: chosen.length } });
      return json(200, { ok: true, state: 'approved', slug });
    }

    case 'publication-url': {
      if (!isId('p', body.id)) return apiError(400, 'bad_request', 'id is missing or malformed.');
      const url = cleanLine(body.public_url, 300);
      if (url && !/^https:\/\/[^\s]+$/.test(url) && !/^\/(?![\/\\])[^\s\\]*$/.test(url)) return apiError(422, 'invalid', 'Enter a full https:// address or a path starting with /.');
      const res = await db.prepare(`UPDATE publications SET public_url = ? WHERE id = ? AND state = 'approved'`).bind(url || null, body.id).run();
      if (Number(res.meta?.changes || 0) !== 1) return apiError(404, 'not_found', 'There is no approved reply with that id.');
      await audit(db, { actor_kind: 'admin', actor_id: user.email, action: 'publication.url_set', target_id: body.id, ip });
      return json(200, { ok: true });
    }

    default:
      return apiError(404, 'not_found', 'Unknown action.');
  }
};
