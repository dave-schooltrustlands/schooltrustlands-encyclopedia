// Bot API: "who am I?" A cheap way for a bot routine to check its token.
//   GET /api/office/bot/me   ->   { "bot": { "id": "herald", "name": "Herald" }, "token_id": "...", "time": "..." }
// The bearer token was verified by the gate in src/middleware.ts.
import type { APIRoute } from 'astro';
import { LIMITS, officeBot } from '../../../../lib/office/config';
import { ALLOWED_EXTENSIONS } from '../../../../lib/office/files';
import { apiError, json, nowIso } from '../../../../lib/office/util';
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const bot = officeBot(ctx.locals);
  if (!bot) return apiError(401, 'unauthorized', 'Send a valid bot token.');
  return json(200, {
    bot: { id: bot.botId, name: bot.botName },
    token_id: bot.tokenId,
    time: nowIso(),
    limits: {
      max_file_bytes: LIMITS.fileBytes,
      max_files_per_reply: LIMITS.filesPerMessage,
      max_reply_chars: LIMITS.botBodyChars,
      lease_seconds: { default: LIMITS.leaseDefaultSeconds, min: LIMITS.leaseMinSeconds, max: LIMITS.leaseMaxSeconds },
      max_attempts: LIMITS.maxAttempts,
      allowed_extensions: ALLOWED_EXTENSIONS,
    },
  });
};
