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

const attr = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function figureForMarker(figures: any[], marker: string, pageSlug: string): any | null {
  const exact = figures.find((f) => String(f?.num || '').toLowerCase() === marker.toLowerCase()
    && (!f?.where?.slug || f.where.slug === pageSlug));
  if (exact) return exact;
  if (/^part openers?$/i.test(marker)) {
    return figures.find((f) => f?.where?.slug === pageSlug && /^part-opener/.test(String(f?.id || '')))
      || figures.find((f) => f?.id === 'part-openers')
      || null;
  }
  return figures.find((f) => String(f?.num || '').toLowerCase() === marker.toLowerCase())
    || figures.find((f) => String(f?.id || '').toLowerCase() === marker.toLowerCase())
    || null;
}

/**
 * Reconciles the manuscript's stable figure anchors with the authoritative
 * R2 figure register at render time. The manuscript remains untouched, while
 * finished art, designed evidence placeholders, and current status language
 * can never drift from the figure record again.
 */
export function fpEnhanceFigures(html: string, figures: any[], pageSlug: string): string {
  if (!html || !figures?.length) return html;
  return html.replace(
    /<div class="fp-fig" data-fig="([^"]+)">([\s\S]*?)<\/div>/g,
    (whole, marker: string, inside: string) => {
      const f = figureForMarker(figures, marker, pageSlug);
      if (!f) return whole;

      let next = inside.replace(
        /<span class="fp-fig-status">[\s\S]*?<\/span>/,
        `<span class="fp-fig-status">${attr(f.status)}</span>`,
      );

      if (f.image) {
        const imageUrl = `${FP_PREFIX}/asset/${encodeURIComponent(f.image)}`;
        const recordUrl = `${FP_PREFIX}/figures/${encodeURIComponent(f.id)}/`;
        const alt = f.alt || f.title;
        const art = `<span class="fp-fig-art"><a class="fp-fig-image" href="${imageUrl}" target="_blank" rel="noopener" aria-label="Open ${attr(f.title)} at full size"><img src="${imageUrl}" alt="${attr(alt)}" loading="lazy" decoding="async" /></a></span>`;
        next = next.replace(
          /<span class="fp-fig-art">[\s\S]*?<\/span>(?=<figcaption class="fp-fig-cap)/,
          art,
        );
        next = next.replace(
          /<a class="fp-fig-link"[^>]*>[\s\S]*?<\/a>/,
          `<a class="fp-fig-link" href="${recordUrl}">Caption, sources &amp; production record &rarr;</a>`,
        );
      }

      const state = f.image
        ? (/placeholder/i.test(String(f.status || '')) ? 'placeholder' : 'art')
        : 'awaiting';
      return `<figure class="fp-fig" id="figure-${attr(f.id)}" data-fig="${attr(marker)}" data-figure-id="${attr(f.id)}" data-figure-state="${state}">${next}</figure>`;
    },
  );
}
