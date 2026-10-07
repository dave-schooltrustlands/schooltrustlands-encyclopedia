// Two signals that leave the site. Neither ever carries the request's content.
//
//  1. An email to the owner when a helper's answer (or question) is ready,
//     sent through Resend, the email service this site already uses (the
//     same RESEND_API_KEY and FEEDBACK_FROM_EMAIL as src/lib/email.ts). On by
//     default whenever Resend is configured; OFFICE_NOTIFY=off switches it
//     off. Never sent for a test request (one not written by an owner).
//  2. A "doorbell" webhook to a bot when a request is queued for it. The bot's
//     routine then calls the normal bot API to fetch and claim the work, so
//     the request itself never travels in a webhook.
import { siteOrigin, isLocalHost, officeTitle, type OfficeEnv } from './config';
import { audit, type Row } from './db';
import { emailListed } from './policy';
import { hmacHex, nowIso, randomHex } from './util';

const NOTIFY_QUIET_MINUTES = 10;

/** Same default sender as src/lib/email.ts. */
const DEFAULT_FROM = 'library@schooltrusts.net';

function resendKey(env: OfficeEnv): string {
  // Runtime binding first (Pages variables and secrets); then the build-time
  // value, which is how src/lib/email.ts reads it. Keep the exact
  // import.meta.env.NAME form: Astro replaces it at build time.
  return String(env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY || '').trim();
}

function fromAddress(env: OfficeEnv): string {
  return String(env.OFFICE_FROM_EMAIL || env.FEEDBACK_FROM_EMAIL || import.meta.env.FEEDBACK_FROM_EMAIL || DEFAULT_FROM).trim();
}

export type EmailStatus = { ready: true; from: string } | { ready: false; reason: string };

/** Whether answer-ready emails can go out, for the admin page. Never reveals the key. */
export function answerEmailStatus(env: OfficeEnv): EmailStatus {
  if (/^(0|false|no|off)$/i.test(String(env.OFFICE_NOTIFY || '').trim())) return { ready: false, reason: 'switched off (OFFICE_NOTIFY is off)' };
  if (!resendKey(env)) return { ready: false, reason: 'RESEND_API_KEY is not set for this site' };
  return { ready: true, from: fromAddress(env) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface AnswerEmail { subject: string; text: string; html: string }

/**
 * The email itself. Plain and short, one big button. It names the helper but
 * carries no title and no text of the request or answer: those stay behind
 * the sign-in.
 */
export function answerEmail(opts: { botName: string; link: string; kind: 'answered' | 'needs_info'; officeName: string; test?: boolean }): AnswerEmail {
  const bot = opts.botName || 'Your helper';
  const subject = (opts.test ? '[Test] ' : '') + (opts.kind === 'needs_info' ? `${bot} has a question for you` : `Your answer from ${bot} is ready`);
  const lead = opts.kind === 'needs_info'
    ? `${bot} has a question for you about one of your requests in ${opts.officeName}.`
    : `${bot} has answered one of your requests in ${opts.officeName}.`;
  const button = opts.kind === 'needs_info' ? `Read ${bot}’s question` : 'Read the answer';
  const text = [
    lead, '', `${button}: ${opts.link}`, '',
    'You may be asked to sign in with a code sent to this email address.', '',
    '— America’s School Trust Library',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f1e8;font-family:Georgia,serif;color:#1a1a2e">
<div style="max-width:520px;margin:0 auto;background:#fffdf7;border:1px solid #d8d1c2;border-top:4px solid #a87f2c;padding:28px 26px">
<p style="margin:0 0 6px;font:700 13px/1.3 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a5a17">${esc(opts.officeName)}</p>
<p style="margin:0 0 22px;font-size:21px;line-height:1.45">${esc(lead)}</p>
<p style="margin:0 0 24px"><a href="${esc(opts.link)}" style="display:inline-block;background:#1b3252;color:#fffdf7;text-decoration:none;font:700 20px/1.2 Arial,sans-serif;padding:16px 28px;border-radius:8px">${esc(button)}</a></p>
<p style="margin:0 0 8px;font-size:17px;line-height:1.5;color:#3b3a47">You may be asked to sign in with a code sent to this email address.</p>
<p style="margin:18px 0 0;font-size:16px;color:#5f5a4d">America’s School Trust Library</p>
</div></body></html>`;
  return { subject, text, html };
}

async function sendViaResend(env: OfficeEnv, to: string, mail: AnswerEmail, requestUrl: URL): Promise<boolean> {
  // On the builder's own computer (localhost with OFFICE_DEV_USER), log the
  // email instead of sending it. Never honoured on any other hostname.
  if (String(env.OFFICE_DEV_USER || '').trim() && isLocalHost(requestUrl.hostname)) {
    console.log('office dev mail:', JSON.stringify({ to, subject: mail.subject, text: mail.text }));
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + resendKey(env), 'content-type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(env), to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Tells the owner an answer (or a question) is ready, with a link to that
 * request. Only for the owner's own requests, never for tests, at most one
 * email per request per quiet period. Fails quietly.
 */
export async function notifyOwner(env: OfficeEnv, request: Row, requestUrl: URL, status: string): Promise<void> {
  if (status !== 'answered' && status !== 'needs_info') return;
  if (!emailListed(request.owner_email, env.OFFICE_OWNER_EMAILS)) return; // a test request: never email
  if (!answerEmailStatus(env).ready) return;
  const db = env.OFFICE_DB;

  const since = new Date(Date.now() - NOTIFY_QUIET_MINUTES * 60 * 1000).toISOString();
  const recent = await db.prepare('SELECT 1 AS x FROM requests WHERE id = ? AND last_notified_at > ? LIMIT 1').bind(request.id, since).first();
  if (recent) return;
  await db.prepare('UPDATE requests SET last_notified_at = ? WHERE id = ?').bind(nowIso(), request.id).run();

  const mail = answerEmail({
    botName: String(request.bot_name || ''),
    link: `${siteOrigin(requestUrl)}/office/${request.id}/`,
    kind: status,
    officeName: officeTitle(env),
  });
  const ok = await sendViaResend(env, String(request.owner_email), mail, requestUrl);
  await audit(db, { actor_kind: 'system', action: ok ? 'notify.sent' : 'notify.failed', request_id: request.id, meta: { kind: status } });
}

/** The admin's "send me a test email" button: the same email, to the admin's own address. */
export async function sendTestAnswerEmail(env: OfficeEnv, to: string, requestUrl: URL): Promise<{ ok: boolean; reason?: string }> {
  const status = answerEmailStatus(env);
  if (!status.ready) return { ok: false, reason: status.reason };
  const mail = answerEmail({ botName: 'Herald', link: `${siteOrigin(requestUrl)}/office/`, kind: 'answered', officeName: officeTitle(env), test: true });
  const ok = await sendViaResend(env, to, mail, requestUrl);
  return ok ? { ok } : { ok, reason: 'Resend did not accept the email (check the key and that the sender address is on a verified domain)' };
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
