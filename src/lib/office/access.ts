// Cloudflare Access sign-in check.
//
// Access sits in front of schooltrusts.org/office and /api/office and, after a
// person signs in, adds a signed token to every request in the
// Cf-Access-Jwt-Assertion header. This module verifies that token itself
// (signature, issuer, audience, expiry) so the office never trusts the mere
// presence of the header. A request that did not come through Access, for
// example one sent to a *.pages.dev address, has no valid token and is refused.
//
// Web Crypto only; no dependency.
import { base64UrlToBytes } from './util';

export interface AccessIdentity {
  email: string;
  sub: string;
  exp: number;
}

export type AccessResult = { ok: true; identity: AccessIdentity } | { ok: false; reason: string };

export interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

export interface VerifyOptions {
  teamDomain: string;
  audiences: string[];
  /** Seconds since the epoch. Tests pass a fixed clock. */
  now?: number;
  /** Tests pass a stand-in for the network call. */
  fetchJwks?: (url: string) => Promise<{ keys?: Jwk[] }>;
}

const TEAM_DOMAIN_RE = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/;
const KEY_TTL_MS = 60 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

let cache: { domain: string; at: number; keys: Map<string, CryptoKey> } | null = null;
let lastFailedFetch = 0;

export function normalizeTeamDomain(value: string | undefined): string | null {
  const v = String(value || '').trim().toLowerCase().replace(/\/+$/, '');
  return TEAM_DOMAIN_RE.test(v) ? v : null;
}

export function parseAudiences(value: string | undefined): string[] {
  return String(value || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-f0-9]{32,128}$/.test(s));
}

async function defaultFetchJwks(url: string): Promise<{ keys?: Jwk[] }> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('certs ' + res.status);
  return (await res.json()) as { keys?: Jwk[] };
}

async function loadKeys(domain: string, opts: VerifyOptions, force: boolean): Promise<Map<string, CryptoKey>> {
  const have = cache && cache.domain === domain ? cache : null;
  const age = have ? Date.now() - have.at : Infinity;
  if (have && !force && age < KEY_TTL_MS) return have.keys;
  // An unknown key id asks for a refresh, but at most once a minute.
  if (have && force && age < MIN_REFRESH_MS) return have.keys;
  // After a failed fetch, wait a minute before asking again.
  if (have && Date.now() - lastFailedFetch < MIN_REFRESH_MS && age < MAX_STALE_MS) return have.keys;

  let data: { keys?: Jwk[] };
  try {
    data = await (opts.fetchJwks || defaultFetchJwks)(domain + '/cdn-cgi/access/certs');
  } catch (err) {
    lastFailedFetch = Date.now();
    // Signing keys change about every six weeks and the old one stays valid
    // for a week, so a held copy is safe to keep using through a short outage
    // of the certs address. Past a week, refuse rather than trust it.
    if (have && age < MAX_STALE_MS) return have.keys;
    throw err;
  }
  const keys = new Map<string, CryptoKey>();
  for (const jwk of data.keys || []) {
    if (!jwk || jwk.kty !== 'RSA' || !jwk.kid || !jwk.n || !jwk.e) continue;
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      keys.set(jwk.kid, key);
    } catch {
      /* skip a key we cannot import */
    }
  }
  cache = { domain, at: Date.now(), keys };
  return keys;
}

function decodeJson(part: string): any {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

export async function verifyAccessJwt(token: string | null, opts: VerifyOptions): Promise<AccessResult> {
  const domain = normalizeTeamDomain(opts.teamDomain);
  if (!domain) return { ok: false, reason: 'team_domain_not_configured' };
  if (!opts.audiences.length) return { ok: false, reason: 'audience_not_configured' };
  if (!token || token.length > 8192) return { ok: false, reason: 'no_token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [h, p, s] = parts as [string, string, string];

  let header: any;
  let payload: any;
  let signature: ReturnType<typeof base64UrlToBytes>;
  try {
    header = decodeJson(h);
    payload = decodeJson(p);
    signature = base64UrlToBytes(s);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'bad_header' };

  let keys: Map<string, CryptoKey>;
  try {
    keys = await loadKeys(domain, opts, false);
    if (!keys.has(header.kid)) keys = await loadKeys(domain, opts, true); // key rotation
  } catch {
    return { ok: false, reason: 'keys_unavailable' };
  }
  const key = keys.get(header.kid);
  if (!key) return { ok: false, reason: 'unknown_key' };

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    new TextEncoder().encode(h + '.' + p),
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'malformed' };
  if (payload.iss !== domain) return { ok: false, reason: 'wrong_issuer' };
  const aud: string[] = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud || '')];
  if (!aud.some((a) => opts.audiences.includes(a.toLowerCase()))) return { ok: false, reason: 'wrong_audience' };
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < now) return { ok: false, reason: 'expired' };
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > now) return { ok: false, reason: 'not_yet_valid' };
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_S > now) return { ok: false, reason: 'not_yet_valid' };
  // Service tokens carry no email; the office is for named people only.
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) return { ok: false, reason: 'no_email' };

  return { ok: true, identity: { email, sub: String(payload.sub || ''), exp: payload.exp } };
}

/** For tests only. */
export function resetAccessKeyCache(): void {
  cache = null;
  lastFailedFetch = 0;
}
