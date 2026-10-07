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
  queued: 'Waiting for the bot',
  claimed: 'Picked up',
  in_progress: 'Working on it',
  answered: 'Answered',
  failed: 'Did not finish',
  needs_info: 'Needs your answer',
};

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
  OFFICE_NOTIFY?: string; // "on" sends a content-free email when a reply lands
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
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: zone }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(d);
  }
}
