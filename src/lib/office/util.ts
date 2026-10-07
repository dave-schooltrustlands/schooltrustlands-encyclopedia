// Small shared helpers for the private office. Web-standard APIs only
// (Web Crypto, fetch, TextEncoder), so everything runs on Cloudflare Workers.

const te = new TextEncoder();

export const nowIso = (): string => new Date().toISOString();
export const isoIn = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

export function json(status: number, payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Every error from the office API has this one shape. */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json(status, { error: { code, message, ...extra } }, headers);
}

export function hex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return out;
}

export function randomHex(nBytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(nBytes)));
}

/** URL-safe base64 without padding. */
export function randomToken(nBytes: number): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(nBytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export type IdKind = 'r' | 'm' | 'a' | 'p';
/** Unguessable ids (96 random bits): r_ request, m_ message, a_ attachment, p_ publication. */
export const newId = (kind: IdKind): string => `${kind}_${randomHex(12)}`;

export const ID_RE: Record<IdKind, RegExp> = {
  r: /^r_[a-f0-9]{24}$/,
  m: /^m_[a-f0-9]{24}$/,
  a: /^a_[a-f0-9]{24}$/,
  p: /^p_[a-f0-9]{24}$/,
};
export const isId = (kind: IdKind, value: unknown): value is string =>
  typeof value === 'string' && ID_RE[kind].test(value);

export async function sha256Hex(input: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', te.encode(input)));
}

export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', te.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(message)));
}

/** Compares two strings without stopping at the first difference. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = te.encode(a);
  const y = te.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s);
}

export function base64UrlToBytes(value: string) {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Trims, drops control characters (keeps tab and newline), and caps length. */
export function cleanText(value: unknown, max: number): string {
  return (value == null ? '' : String(value))
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

export function cleanLine(value: unknown, max: number): string {
  return cleanText(value, max * 4).replace(/\s+/g, ' ').trim().slice(0, max);
}

export function clientIp(request: Request): string {
  return (request.headers.get('cf-connecting-ip') || '').slice(0, 64);
}

export function slugify(value: string, max = 80): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export class BodyError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Reads a JSON object body with a hard size cap. Throws BodyError. */
export async function readJson(request: Request, maxBytes: number): Promise<Record<string, any>> {
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared > maxBytes) throw new BodyError(413, 'too_large', 'The request body is too large.');
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) throw new BodyError(415, 'expected_json', 'Send JSON with Content-Type: application/json.');
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new BodyError(400, 'bad_request', 'The request body could not be read.');
  }
  if (te.encode(text).length > maxBytes) throw new BodyError(413, 'too_large', 'The request body is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BodyError(400, 'bad_json', 'The request body is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BodyError(400, 'bad_json', 'The request body must be a JSON object.');
  }
  return parsed as Record<string, any>;
}

export function bodyErrorResponse(err: unknown): Response | null {
  return err instanceof BodyError ? apiError(err.status, err.code, err.message) : null;
}

/** A list of ids of one kind, de-duplicated, or null if anything is malformed. */
export function idList(kind: IdKind, value: unknown, max: number): string[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  const out: string[] = [];
  for (const v of value) {
    if (!isId(kind, v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Cuts text at a word boundary and adds an ellipsis, so it never ends mid-word. */
export function shortTitle(line: string, max: number): string {
  const t = String(line || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : t.slice(0, max)).replace(/[\s,;:.\-]+$/, '') + '…';
}
