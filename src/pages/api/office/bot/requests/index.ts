// Bot API: the queue.
//   GET /api/office/bot/requests?status=queued&limit=10
// Lists requests addressed to the calling bot. status=queued (the default)
// means "claimable now": queued requests, oldest first, plus any whose earlier
// claim ran out of time. Other statuses list that bot's requests as they stand.
// Summaries only; the text and files come with a successful claim.
import type { APIRoute } from 'astro';
import { REQUEST_STATUSES, officeBot, officeEnv, type RequestStatus } from '../../../../../lib/office/config';
import { expireStale, listByStatus, listClaimable } from '../../../../../lib/office/db';
import { apiError, json } from '../../../../../lib/office/util';
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const bot = officeBot(ctx.locals);
  if (!bot) return apiError(401, 'unauthorized', 'Send a valid bot token.');

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get('status') || 'queued';
  const limit = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('limit'))) || 10));
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) {
    return apiError(400, 'bad_request', 'status must be one of: ' + REQUEST_STATUSES.join(', '));
  }

  const db = env.OFFICE_DB;
  await expireStale(db);
  const rows = status === 'queued' ? await listClaimable(db, bot.botId, limit) : await listByStatus(db, bot.botId, status as RequestStatus, limit);
  return json(200, {
    bot: bot.botId,
    status,
    count: rows.length,
    requests: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      // True when an earlier run claimed this and its lease ran out.
      reclaim: status === 'queued' && r.status !== 'queued',
      attempts: r.attempts,
      message_count: r.message_count,
      queued_at: r.queued_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  });
};
