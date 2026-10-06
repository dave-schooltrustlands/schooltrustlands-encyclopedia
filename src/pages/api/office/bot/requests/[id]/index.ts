// Bot API: read one thread.
//   GET /api/office/bot/requests/<id>
// Returns the whole thread (every message, with attachment links) for a
// request addressed to the calling bot. A request addressed to another bot
// looks exactly like one that does not exist: 404.
import type { APIRoute } from 'astro';
import { officeBot, officeEnv, siteOrigin } from '../../../../../../lib/office/config';
import { getThread, threadForBot } from '../../../../../../lib/office/db';
import { apiError, isId, json } from '../../../../../../lib/office/util';
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const bot = officeBot(ctx.locals);
  if (!bot) return apiError(401, 'unauthorized', 'Send a valid bot token.');
  const id = ctx.params.id;
  if (!isId('r', id)) return apiError(404, 'not_found', 'No such request.');
  const thread = await getThread(env.OFFICE_DB, id);
  if (!thread || thread.request.bot_id !== bot.botId) return apiError(404, 'not_found', 'No such request.');
  return json(200, threadForBot(thread, siteOrigin(new URL(ctx.request.url))));
};
