// Two optional signals that leave the site. Neither ever carries content.
//
//  1. An email to the owner when a reply lands ("there is something waiting"),
//     sent through Resend, the email service this site already uses.
//  2. A "doorbell" webhook to a bot when a request is queued for it. The bot's
//     routine then calls the normal bot API to fetch and claim the work, so
//     the request itself never travels in a webhook.
import { siteOrigin, isTrue, type OfficeEnv } from './config';
import { audit, type Row } from './db';
import { hmacHex, nowIso, randomHex } from './util';

const NOTIFY_QUIET_MINUTES = 15;

/** Tells the owner a reply is waiting. No title, no text, no bot name. */
export async function notifyOwner(env: OfficeEnv, request: Row, requestUrl: URL): Promise<void> {
  if (!isTrue(env.OFFICE_NOTIFY)) return;
  const from = String(env.OFFICE_FROM_EMAIL || env.FEEDBACK_FROM_EMAIL || '').trim();
  if (!env.RESEND_API_KEY || !from) return;
  const db = env.OFFICE_DB;

  // One note per quiet period per owner, however many replies arrive.
  const since = new Date(Date.now() - NOTIFY_QUIET_MINUTES * 60 * 1000).toISOString();
  const recent = await db
    .prepare('SELECT 1 AS x FROM requests WHERE owner_email = ? AND last_notified_at > ? LIMIT 1')
    .bind(request.owner_email, since)
    .first();
  if (recent) return;
  await db.prepare('UPDATE requests SET last_notified_at = ? WHERE id = ?').bind(nowIso(), request.id).run();

  const link = siteOrigin(requestUrl) + '/office/';
  let ok = false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [request.owner_email],
        subject: 'New reply in your office',
        text:
          'A new reply is waiting in your office at America’s School Trust Library.\n\n' +
          'Open the office: ' + link + '\n\n' +
          'This note carries no details on purpose. Sign in to read the reply.\n',
      }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  await audit(db, { actor_kind: 'system', action: ok ? 'notify.sent' : 'notify.failed', request_id: request.id });
}

/** The signing key for one bot's doorbell. Derived, so it is never stored. */
export async function webhookKey(env: OfficeEnv, botId: string, version: number): Promise<string | null> {
  const secret = String(env.OFFICE_WEBHOOK_SECRET || '');
  if (secret.length < 32) return null;
  return 'ofw_' + (await hmacHex(secret, `office-webhook-v1|${botId}|${version}`));
}

export function validWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^[\d.]+$/.test(host) || host.includes(':')) return false; // no bare IP addresses
  return value.length <= 500;
}

/**
 * Rings a bot's doorbell: a small signed POST saying "request X is queued".
 * Tried up to three times over about ten seconds. If it never lands nothing is
 * lost, because the bot's regular poll picks the request up anyway.
 *
 *   X-Office-Delivery:  unique id for this delivery (drop repeats)
 *   X-Office-Timestamp: seconds since 1970 (reject if more than 5 minutes off)
 *   X-Office-Signature: v1=<hex HMAC-SHA256 of "<timestamp>.<body>" with the bot's doorbell key>
 */
export async function ringDoorbell(env: OfficeEnv, bot: Row, requestId: string, event: 'request.queued'): Promise<void> {
  const url = String(bot.webhook_url || '');
  if (!url || !validWebhookUrl(url)) return;
  const key = await webhookKey(env, String(bot.id), Number(bot.webhook_key_version || 1));
  if (!key) return;

  const delivery = 'd_' + randomHex(12);
  const body = JSON.stringify({ event, request_id: requestId, bot: bot.id, sent_at: nowIso() });
  let status = 0;
  let attempts = 0;
  for (const waitMs of [0, 3000, 8000]) {
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    attempts++;
    const ts = String(Math.floor(Date.now() / 1000));
    try {
      const res = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'stl-office-doorbell/1',
          'x-office-delivery': delivery,
          'x-office-timestamp': ts,
          'x-office-signature': 'v1=' + (await hmacHex(key, ts + '.' + body)),
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      status = res.status;
      await res.body?.cancel().catch(() => undefined);
      if (res.ok) break;
    } catch {
      status = 0;
    }
  }
  await audit(env.OFFICE_DB, {
    actor_kind: 'system', action: status >= 200 && status < 300 ? 'doorbell.delivered' : 'doorbell.failed',
    request_id: requestId, target_id: String(bot.id), meta: { status, attempts },
  });
}
