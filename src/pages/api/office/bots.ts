// Private office: the owner adds a bot of his own.
//   POST /api/office/bots   { "id": "my-helper", "name": "My helper", "description": "optional" }
// Dave's rule (Oct 6, 2026): the owner may use any bot he creates himself. The
// row is stored with created_by = the owner's email and no agent id, which is
// what src/lib/office/policy.ts treats as "owner-created". An existing id is
// never overwritten. The bot still needs a token, which the admin mints on
// /office/admin/ and hands to whoever runs the bot.
// Sign-in and the same-site check are enforced by the gate in src/middleware.ts.
import type { APIRoute } from 'astro';
import { LIMITS, RATE, officeEnv, officeUser } from '../../../lib/office/config';
import { audit, getBot, overLimit } from '../../../lib/office/db';
import { apiError, bodyErrorResponse, cleanLine, clientIp, json, nowIso, readJson } from '../../../lib/office/util';
export const prerender = false;

const BOT_ID_RE = /^[a-z][a-z0-9-]{1,31}$/;

export const POST: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const user = officeUser(ctx.locals);
  if (!user) return apiError(401, 'unauthorized', 'Please sign in.');
  if (!user.isOwner) return apiError(403, 'forbidden', 'Only the office owner can add a bot here.');
  const db = env.OFFICE_DB;
  let body: Record<string, any>;
  try {
    body = await readJson(ctx.request, LIMITS.jsonBytes);
  } catch (err) {
    return bodyErrorResponse(err) || apiError(400, 'bad_request', 'Bad request.');
  }
  const id = cleanLine(body.id, 40).toLowerCase();
  const name = cleanLine(body.name, 60);
  const description = cleanLine(body.description, 200);
  if (!BOT_ID_RE.test(id)) return apiError(422, 'invalid', 'The id must be 2 to 32 lowercase letters, digits, or hyphens, starting with a letter.');
  if (!name) return apiError(422, 'invalid', 'Give the bot a name.');
  if (await overLimit(db, 'botcreate:' + user.email, RATE.adminActions)) return apiError(429, 'rate_limited', 'Please wait a little and try again.');
  if (await getBot(db, id)) return apiError(409, 'conflict', 'A bot with that id already exists. Pick another id.');
  const now = nowIso();
  await db
    .prepare(`INSERT INTO bots (id, name, description, enabled, sort, agent_id, created_by, created_at, updated_at)
              VALUES (?, ?, ?, 1, 200, NULL, ?, ?, ?)`)
    .bind(id, name, description, user.email, now, now)
    .run();
  await audit(db, { actor_kind: 'owner', actor_id: user.email, action: 'bot.created_by_owner', target_id: id, ip: clientIp(ctx.request) });
  return json(201, { ok: true, id, created: true });
};
