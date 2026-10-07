// Bot API: download one attachment.
//   GET /api/office/bot/attachments/<id>
// A bot can fetch a file only if it sits on a message in a request addressed
// to that bot. Anything else is 404.
import type { APIRoute } from 'astro';
import { officeBot, officeEnv } from '../../../../../lib/office/config';
import { serveAttachment } from '../../../../../lib/office/files';
import { apiError, isId } from '../../../../../lib/office/util';
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = officeEnv(ctx.locals);
  const bot = officeBot(ctx.locals);
  if (!bot) return apiError(401, 'unauthorized', 'Send a valid bot token.');
  const id = ctx.params.id;
  if (!isId('a', id)) return apiError(404, 'not_found', 'No such file.');
  const att = await env.OFFICE_DB
    .prepare(
      `SELECT a.id, a.r2_key, a.filename, a.content_type, a.size
       FROM attachments a JOIN requests r ON r.id = a.request_id
       WHERE a.id = ? AND r.bot_id = ? AND a.message_id IS NOT NULL`,
    )
    .bind(id, bot.botId)
    .first();
  if (!att) return apiError(404, 'not_found', 'No such file.');
  return serveAttachment(env, ctx.request, att);
};
