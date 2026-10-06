// The door to the private office. Called from src/middleware.ts for every
// request to /office, /office/*, and /api/office/*, before any page or
// endpoint code runs. Nothing under those paths is reachable without passing
// here, so a new route added later cannot forget to check who is asking.
//
// People:  Cloudflare Access signs them in; this gate verifies the signed
//          token itself, then checks the email against the owner and admin
//          lists. State-changing calls must also come from the office's own
//          pages (Origin check plus a custom header), because the site-wide
//          Astro CSRF check is switched off.
// Bots:    /api/office/bot/* uses a per-bot bearer token instead. Only a hash
//          of each token is stored.
//
// Fails closed: anything missing or wrong ends in a refusal, never a pass.
import type { APIContext, MiddlewareNext } from 'astro';
import { normalizeTeamDomain, parseAudiences, verifyAccessJwt } from './access';
import {
  OFFICE_ADMIN_API_PREFIX,
  OFFICE_ADMIN_PAGE_PREFIX,
  OFFICE_API_PREFIX,
  OFFICE_BOT_API_PREFIX,
  OFFICE_PAGE_PREFIX,
  RATE,
  hostAllowed,
  isLocalHost,
  isTrue,
  listOf,
  officeEnv,
  type OfficeBot,
  type OfficeEnv,
  type OfficeUser,
} from './config';
import { audit, ratePeek, rateHit } from './db';
import { apiError, clientIp, nowIso, sha256Hex, timingSafeEqual } from './util';

const ROBOTS = 'noindex, nofollow, noarchive';

// The office pages load one script file and no inline script, so a reply that
// somehow carried markup still could not run code. Images and media come only
// from this site, which also keeps tracking pixels out of bot replies.
const PAGE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function isOfficePath(pathname: string): boolean {
  return pathname === OFFICE_PAGE_PREFIX || pathname.startsWith(OFFICE_PAGE_PREFIX + '/') || pathname.startsWith(OFFICE_API_PREFIX);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function refusalPage(status: number, heading: string, detail: string): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${ROBOTS}"><title>Private office</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#f5f1e8;color:#1a1a2e;font-family:'Newsreader',Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1.5rem}
  .card{background:#fffdf7;border:1px solid #d8d1c2;border-top:4px solid #a87f2c;max-width:27rem;width:100%;box-sizing:border-box;padding:2.3rem 2.2rem;box-shadow:0 10px 30px rgba(20,36,60,.08)}
  .eyebrow{font-family:'Public Sans',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.16em;color:#a87f2c;text-transform:uppercase;margin:0 0 .6rem}
  h1{font-weight:700;color:#14243c;font-size:1.6rem;margin:0 0 .5rem;line-height:1.2}
  p{font-size:1.04rem;line-height:1.6;margin:.5rem 0}
  a{color:#1b3252}
  .foot{margin-top:1.3rem;font-family:'Public Sans',sans-serif;font-size:.8rem;color:#6b6455}
</style></head><body>
<main class="card">
  <p class="eyebrow">America&rsquo;s School Trust Library</p>
  <h1>${esc(heading)}</h1>
  <p>${esc(detail)}</p>
  <p class="foot"><a href="/">Back to the Library</a></p>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': ROBOTS,
      'cache-control': 'private, no-store',
      'content-security-policy': PAGE_CSP,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    },
  });
}

function refuse(isApi: boolean, status: number, code: string, heading: string, detail: string, headers: Record<string, string> = {}): Response {
  const res = isApi ? apiError(status, code, detail, {}, headers) : refusalPage(status, heading, detail);
  return harden(res, isApi);
}

/** Headers that go on every response from the office, pages and API alike. */
function harden(res: Response, isApi: boolean): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', ROBOTS);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('Pragma', 'no-cache');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'no-referrer');
  out.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  out.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  if (!out.headers.has('Content-Security-Policy')) {
    const type = out.headers.get('content-type') || '';
    out.headers.set('Content-Security-Policy', !isApi && type.includes('text/html') ? PAGE_CSP : "default-src 'none'; frame-ancestors 'none'");
  }
  return out;
}

async function signInPerson(context: APIContext, env: OfficeEnv): Promise<OfficeUser | { refused: string }> {
  let email = '';

  // Local development only: wrangler serves on localhost and there is no
  // Access in front of it. Honoured for no other hostname, ever.
  const dev = String(env.OFFICE_DEV_USER || '').trim().toLowerCase();
  if (dev && isLocalHost(context.url.hostname)) {
    email = dev;
  } else {
    const result = await verifyAccessJwt(context.request.headers.get('cf-access-jwt-assertion'), {
      teamDomain: env.OFFICE_ACCESS_TEAM_DOMAIN || '',
      audiences: parseAudiences(env.OFFICE_ACCESS_AUD),
    });
    if (!result.ok) return { refused: result.reason };
    email = result.identity.email;
  }

  const isOwner = listOf(env.OFFICE_OWNER_EMAILS).includes(email);
  const isAdmin = listOf(env.OFFICE_ADMIN_EMAILS).includes(email);
  if (!isOwner && !isAdmin) {
    // Signed in through Access but not on either list. Worth a record.
    await audit(env.OFFICE_DB, { actor_kind: 'unknown', actor_id: email, action: 'auth.not_listed', ip: clientIp(context.request) });
    return { refused: 'not_listed' };
  }
  return { kind: 'user', email, isOwner, isAdmin, adminCanRead: isAdmin && isTrue(env.OFFICE_ADMIN_CAN_READ) };
}

const BOT_TOKEN_RE = /^Bearer (ofb_([a-f0-9]{16})_[A-Za-z0-9_-]{43})$/;

async function signInBot(context: APIContext, env: OfficeEnv): Promise<OfficeBot | Response> {
  const db = env.OFFICE_DB;
  const ip = clientIp(context.request) || 'unknown';
  const [maxFails, failWindow] = RATE.botFailuresPerIp;
  const unauthorized = () =>
    refuse(true, 401, 'unauthorized', '', 'Send a valid bot token: Authorization: Bearer <token>.', { 'www-authenticate': 'Bearer' });

  const match = BOT_TOKEN_RE.exec(context.request.headers.get('authorization') || '');
  if (!match) return unauthorized();
  const token = match[1] as string;
  const tokenId = match[2] as string;

  if ((await ratePeek(db, 'botfail:' + ip, failWindow)) >= maxFails) {
    return refuse(true, 429, 'rate_limited', '', 'Too many failed sign-ins from this address. Try again later.', { 'retry-after': String(failWindow) });
  }

  const row = await db
    .prepare(
      `SELECT t.id, t.token_hash, t.expires_at, t.revoked_at, t.last_used_at, b.id AS bot_id, b.name AS bot_name, b.enabled
       FROM bot_tokens t JOIN bots b ON b.id = t.bot_id WHERE t.id = ?`,
    )
    .bind(tokenId)
    .first();

  // Always hash and compare, even when there is no such token, so a wrong
  // token id and a wrong secret take the same path.
  const presented = await sha256Hex(token);
  const matches = timingSafeEqual(presented, String(row?.token_hash || '0'.repeat(64)));
  const now = nowIso();
  let reason = '';
  if (!row || !matches) reason = 'bad_token';
  else if (row.revoked_at) reason = 'revoked';
  else if (row.expires_at && row.expires_at < now) reason = 'expired';
  else if (!row.enabled) reason = 'bot_disabled';
  if (reason) {
    await rateHit(db, 'botfail:' + ip, failWindow);
    await audit(db, { actor_kind: 'unknown', actor_id: row ? String(row.bot_id) : '', action: 'bot.auth_failed', target_id: row ? tokenId : null, ip, meta: { reason } });
    return unauthorized();
  }

  const [maxCalls, callWindow] = RATE.botCallsPerToken;
  if ((await rateHit(db, 'bot:' + tokenId, callWindow)) > maxCalls) {
    return refuse(true, 429, 'rate_limited', '', 'This token is calling too often. Slow down and try again.', { 'retry-after': '60' });
  }
  if (!row.last_used_at || Date.parse(row.last_used_at) < Date.now() - 5 * 60 * 1000) {
    await db.prepare('UPDATE bot_tokens SET last_used_at = ? WHERE id = ?').bind(now, tokenId).run();
  }
  return { kind: 'bot', botId: String(row.bot_id), botName: String(row.bot_name), tokenId };
}

/** True when a state-changing call demonstrably came from one of the office's own pages. */
function sameOriginCall(context: APIContext): boolean {
  const request = context.request;
  if (request.headers.get('origin') !== context.url.origin) return false;
  if (request.headers.get('x-office-request') !== '1') return false;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin';
}

export async function officeGate(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const { pathname } = context.url;
  const isApi = pathname.startsWith(OFFICE_API_PREFIX);
  const env = officeEnv(context.locals);

  try {
    const notSetUp = () => refuse(isApi, 503, 'not_configured', 'The office is not set up yet', 'Please check back shortly.');
    if (!env.OFFICE_DB || !env.OFFICE_BUCKET) return notSetUp();

    // The office answers only on the hostnames that Cloudflare Access covers.
    // Anywhere else (for example a *.pages.dev address) it does not exist.
    const devMode = !!String(env.OFFICE_DEV_USER || '').trim() && isLocalHost(context.url.hostname);
    if (!devMode) {
      if (!listOf(env.OFFICE_ALLOWED_HOSTS).length) return notSetUp();
      if (!hostAllowed(context.url.hostname, env)) {
        return refuse(isApi, 404, 'not_found', 'Nothing here', 'The office is not available at this address.');
      }
    }

    if (pathname.startsWith(OFFICE_BOT_API_PREFIX)) {
      const bot = await signInBot(context, env);
      if (bot instanceof Response) return bot;
      (context.locals as any).office = bot;
    } else {
      if (!devMode && (!normalizeTeamDomain(env.OFFICE_ACCESS_TEAM_DOMAIN) || !parseAudiences(env.OFFICE_ACCESS_AUD).length)) {
        return notSetUp();
      }
      const user = await signInPerson(context, env);
      if ('refused' in user) {
        return user.refused === 'not_listed'
          ? refuse(isApi, 403, 'forbidden', 'This office is private', 'You are signed in, but this address has not been given a key to the office.')
          : refuse(isApi, 401, 'unauthorized', 'This office is private', 'Please open the office from its usual address and sign in.');
      }

      const method = context.request.method.toUpperCase();
      if (isApi && method !== 'GET' && method !== 'HEAD' && !sameOriginCall(context)) {
        return refuse(true, 403, 'cross_site', '', 'This action must be started from the office pages.');
      }

      const adminArea =
        pathname === OFFICE_ADMIN_PAGE_PREFIX ||
        pathname.startsWith(OFFICE_ADMIN_PAGE_PREFIX + '/') ||
        pathname.startsWith(OFFICE_ADMIN_API_PREFIX);
      if (adminArea && !user.isAdmin) {
        return refuse(isApi, 403, 'forbidden', 'Nothing here', 'That page is for the office administrator.');
      }
      (context.locals as any).office = user;
    }

    return harden(await next(), isApi);
  } catch (err) {
    // Log the kind of failure and where, never what was being read or written.
    const e = err as Error;
    console.error('office: unhandled error', pathname.split('/').slice(0, 4).join('/'), e?.name || 'Error', String(e?.message || '').slice(0, 160));
    return refuse(isApi, 500, 'server_error', 'Something went wrong', 'Please try again in a moment.');
  }
}
