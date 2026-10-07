// The private research office (/office/ and /api/office/*): names, limits, and
// the shape of the environment it needs.
//
// Nothing secret lives in this file or anywhere in this public repo. Every
// binding, address, and token is set in Cloudflare Pages -> Settings, and all
// office content lives in the OFFICE_DB database and the OFFICE_BUCKET bucket.
// See docs/office/ARCHITECTURE.md.

export const OFFICE_PAGE_PREFIX = '/office';
export const OFFICE_API_PREFIX = '/api/office/';
export const OFFICE_BOT_API_PREFIX = '/api/office/bot/';
export const OFFICE_ADMIN_PAGE_PREFIX = '/office/admin';
export const OFFICE_ADMIN_API_PREFIX = '/api/office/admin/';

/** Every stored file sits under this prefix in OFFICE_BUCKET. */
export const R2_PREFIX = 'office/v1/';

export const DEFAULT_WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

export const LIMITS = {
  /** Largest single file, from the owner or from a bot. */
  fileBytes: 25 * 1024 * 1024,
  /** Largest recording the site will send for transcription. */
  transcribeBytes: 12 * 1024 * 1024,
  filesPerMessage: 10,
  titleChars: 140,
  ownerBodyChars: 20_000,
  botBodyChars: 100_000,
  noteChars: 1_000,
  /** JSON request bodies (owner and admin). */
  jsonBytes: 128 * 1024,
  /** JSON request bodies from bots (a reply can be long). */
  botJsonBytes: 512 * 1024,
  leaseDefaultSeconds: 900,
  leaseMinSeconds: 60,
  leaseMaxSeconds: 3600,
  /** A request is marked failed after this many claims without an answer. */
  maxAttempts: 5,
  /** Files uploaded but never sent are removed after this long. */
  pendingUploadHours: 24,
  auditRetentionDays: 365,
} as const;

/** Fixed-window rate limits: [max events, window in seconds]. */
export const RATE = {
  botFailuresPerIp: [20, 600],
  botCallsPerToken: [300, 300],
  ownerRequests: [60, 3600],
  ownerUploads: [200, 3600],
  ownerTranscriptions: [60, 3600],
  adminActions: [200, 3600],
} as const;

export const REQUEST_STATUSES = ['queued', 'claimed', 'in_progress', 'answered', 'failed', 'needs_info'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Plain-language labels shown to the owner. */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  queued: 'Waiting for a helper',
  claimed: 'Being worked on',
  in_progress: 'Being worked on',
  answered: 'Answered',
  failed: 'Did not finish',
  needs_info: 'Helper has a question',
};

/**
 * One plain-English line about each helper, shown in the picker when the
 * administrator has not written a description for that bot on /office/admin/.
 * A description saved on the admin page always wins.
 */
export const HELPER_BLURB: Record<string, string> = {
  herald: 'Your research and writing helper. Start here for anything: finding sources, drafting, editing, transcribing.',
  librarian: 'Looks things up in the Library’s own collections and catalog.',
  chronicle: 'Land Histories: the county-by-county record of school lands.',
  'chronicle-refdesk': 'Answers questions about Land History sources and records.',
  'chronicle-builder': 'Builds and updates Land History pages.',
  'chronicle-reviewer': 'Checks Land History pages for mistakes.',
  'chronicle-ops': 'Keeps the Land History project running.',
  'farm-chatgpt': 'Asks ChatGPT and brings back its answer, for a second opinion.',
  'farm-fable': 'Asks Fable and brings back its answer, for a second opinion.',
  'farm-gemini': 'Asks Gemini and brings back its answer, for a second opinion.',
  'farm-grok': 'Asks Grok and brings back its answer, for a second opinion.',
};

/** The helper every new request goes to unless someone picks another. */
export const DEFAULT_HELPER_ID = 'herald';

export function helperBlurb(bot: { id: string; description?: string | null }): string {
  const own = String(bot.description || '').trim();
  return own || HELPER_BLURB[bot.id] || '';
}

export interface OfficeEnv {
  // Bindings
  OFFICE_DB?: any; // D1
  OFFICE_BUCKET?: any; // R2 (private; no public access, no custom domain)
  AI?: any; // Workers AI (optional; only used for transcription)
  // Sign-in (Cloudflare Access)
  OFFICE_ACCESS_TEAM_DOMAIN?: string; // https://<team>.cloudflareaccess.com
  OFFICE_ACCESS_AUD?: string; // one or more Application Audience tags, comma separated
  OFFICE_ALLOWED_HOSTS?: string; // hostnames the office may be served on, comma separated
  // People
  OFFICE_OWNER_EMAILS?: string;
  OFFICE_ADMIN_EMAILS?: string;
  OFFICE_ADMIN_CAN_READ?: string; // "true" lets admins read the owner's threads
  OFFICE_DISPLAY_NAME?: string; // e.g. "Bob" -> "Bob's Office"
  OFFICE_TIMEZONE?: string; // IANA zone for displayed times
  // Optional features
  OFFICE_NOTIFY?: string; // "off" stops the content-free answer-ready email (on whenever Resend is configured)
  OFFICE_FROM_EMAIL?: string;
  OFFICE_WEBHOOK_SECRET?: string; // only needed if a bot uses the doorbell webhook
  OFFICE_WHISPER_MODEL?: string;
  OFFICE_RETENTION_DAYS?: string; // unset = keep threads until the owner deletes them
  // Local development only; ignored unless the hostname is localhost.
  OFFICE_DEV_USER?: string;
  // Already present in the Pages project
  RESEND_API_KEY?: string;
  FEEDBACK_FROM_EMAIL?: string;
}

export interface OfficeUser {
  kind: 'user';
  email: string;
  isOwner: boolean;
  isAdmin: boolean;
  /** True when this admin may read threads that are not their own. */
  adminCanRead: boolean;
}

/**
 * Who may write a request. The owner, for real work; an administrator, to send
 * a test from the same desk (it lands in the helper's queue like any other,
 * marked as coming from the administrator, and the owner never sees it).
 */
export function canSendRequests(user: OfficeUser | null): boolean {
  return !!user && (user.isOwner || user.isAdmin);
}

export interface OfficeBot {
  kind: 'bot';
  botId: string;
  botName: string;
  tokenId: string;
}

export type OfficeActor = OfficeUser | OfficeBot;

export function officeEnv(locals: unknown): OfficeEnv {
  return ((locals as any)?.runtime?.env || {}) as OfficeEnv;
}

/** The signed-in person, as established by the middleware gate. */
export function officeUser(locals: unknown): OfficeUser | null {
  const a = (locals as any)?.office as OfficeActor | undefined;
  return a && a.kind === 'user' ? a : null;
}

/** The authenticated bot, as established by the middleware gate. */
export function officeBot(locals: unknown): OfficeBot | null {
  const a = (locals as any)?.office as OfficeActor | undefined;
  return a && a.kind === 'bot' ? a : null;
}

/** Runs a promise after the response is sent, when the platform allows it. */
export function defer(locals: unknown, work: Promise<unknown>): void {
  const safe = work.catch(() => undefined);
  const ctx = (locals as any)?.runtime?.ctx;
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(safe);
}

export function listOf(value: string | undefined): string[] {
  return String(value || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isTrue(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

export function hostAllowed(hostname: string, env: OfficeEnv): boolean {
  const host = hostname.toLowerCase();
  for (const rule of listOf(env.OFFICE_ALLOWED_HOSTS)) {
    if (rule === host) return true;
    if (rule.startsWith('*.') && host.endsWith(rule.slice(1)) && host.length > rule.length - 1) return true;
  }
  return false;
}

export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function officeTitle(env: OfficeEnv): string {
  const name = String(env.OFFICE_DISPLAY_NAME || '').trim().slice(0, 40);
  if (!name) return 'Research Office';
  return /s$/i.test(name) ? `${name}’ Office` : `${name}’s Office`;
}

/**
 * Origin used in links that leave the site (the notification email, the
 * attachment links handed to bots). Always the address the request came in on,
 * so a preview deployment hands out preview links and production hands out
 * production links.
 */
export function siteOrigin(requestUrl: URL): string {
  return requestUrl.origin;
}

export function formatWhen(iso: string | null | undefined, env: OfficeEnv): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zone = String(env.OFFICE_TIMEZONE || 'America/Los_Angeles');
  // No time-zone label: every time in the office is in OFFICE_TIMEZONE.
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: zone }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(d);
  }
}

function zoneOf(env: OfficeEnv): string {
  const zone = String(env.OFFICE_TIMEZONE || 'America/Los_Angeles');
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; } catch { return 'UTC'; }
}

function dayKey(d: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "today, 3:21 PM", "yesterday, 9:05 AM", "Oct 5, 3:21 PM", or "Oct 5, 2025" for an older year. */
export function friendlyWhen(iso: string | null | undefined, env: OfficeEnv, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zone = zoneOf(env);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(d);
  const key = dayKey(d, zone);
  if (key === dayKey(now, zone)) return `today, ${time}`;
  if (key === dayKey(new Date(now.getTime() - 86400000), zone)) return `yesterday, ${time}`;
  const sameYear = key.slice(0, 4) === dayKey(now, zone).slice(0, 4);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
  return sameYear ? `${date}, ${time}` : date;
}

/** "Oct 7" in the office's time zone, for naming voice notes. */
export function shortDate(iso: string | null | undefined, env: OfficeEnv): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: zoneOf(env), month: 'short', day: 'numeric' }).format(d);
}
