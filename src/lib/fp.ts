// Forever Promise review edition — shared helpers.
// The whole /writing/forever-promise/ tree is a private, passcode-gated
// advance review copy. Content lives ONLY in R2 (bucket binding
// COMMENTS_BUCKET, prefix forever-promise/) — never in this public repo.
export const FP_PREFIX = '/writing/forever-promise';
export const FP_R2_PREFIX = 'forever-promise/';

const te = new TextEncoder();

export async function fpToken(passcode: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode('fp-gate|' + passcode), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode('forever-promise-reader-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function fpEnv(locals: any): any {
  return locals?.runtime?.env || {};
}

export async function fpAuthed(request: Request, env: any): Promise<boolean> {
  const passcode = env?.FP_PASSCODE;
  if (!passcode) return false;
  const given = readCookie(request.headers.get('cookie'), 'fp_key');
  return !!given && given === (await fpToken(passcode));
}

export async function fpContent<T = any>(env: any, name: string): Promise<T | null> {
  const bucket = env?.COMMENTS_BUCKET;
  if (!bucket) return null;
  const obj = await bucket.get(FP_R2_PREFIX + 'content/' + name);
  if (!obj) return null;
  return (await obj.json()) as T;
}
