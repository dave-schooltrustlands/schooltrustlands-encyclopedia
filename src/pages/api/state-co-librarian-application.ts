// Site Update v35 — Public State Co-Librarian application endpoint.
//
// POST {
//   name, pseudonym_requested, affiliation, states, background,
//   sample_corrections, references, preferred_contact, library_card_number
// }.
//
// Accepts anonymous (no signed-in user — user_id null) AND authenticated
// submissions. The form lives behind /apply/state-co-librarian/ (built by
// BETA) and is also linkable from /express-interest/co-librarian/ (DELTA).
// The trigger assigns SCL-YYYY-NNNNN. Rate-limited to one application
// per IP per hour (in-memory; per-isolate) plus a DB-side guard against
// the same preferred_contact submitting twice in the last hour.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';
import { sendTemplateEmail } from '../../lib/email';

export const prerender = false;

const MAX_NAME = 160;
const MAX_AFFILIATION = 200;
const MAX_BACKGROUND = 5000;
const MAX_SAMPLE = 5000;
const MAX_REFERENCES = 4000;
const MAX_PREFERRED_CONTACT = 200;
const MAX_LIBRARY_CARD = 64;
const MAX_STATES = 3;
const MIN_STATE_LEN = 2;
const MAX_STATE_LEN = 40;

// Simple in-memory rate-limit. Per-Cloudflare-Pages-isolate (so the
// effective ceiling at the edge is N-isolates × 1/hr) but acceptable for
// the launch volume of this surface. If the volume grows, swap for a KV
// or D1-backed counter.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const recentSubmissionsByIp = new Map<string, number>();

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

function isEmailShape(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asTrimmedString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  return s.length > max ? s.slice(0, max) : s;
}

function asOptionalString(value: unknown, max: number): string | null {
  const s = asTrimmedString(value, max);
  return s ? s : null;
}

function asStatesArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < 1 || value.length > MAX_STATES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const s = item.trim();
    if (s.length < MIN_STATE_LEN || s.length > MAX_STATE_LEN) return null;
    out.push(s);
  }
  return out;
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let payload: {
    name?: unknown;
    pseudonym_requested?: unknown;
    affiliation?: unknown;
    states?: unknown;
    background?: unknown;
    sample_corrections?: unknown;
    references?: unknown;
    preferred_contact?: unknown;
    library_card_number?: unknown;
  };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const name = asTrimmedString(payload.name, MAX_NAME);
  if (!name) {
    return json(400, { error: 'Please tell us your name (a pseudonym is fine).' });
  }
  const pseudonymRequested = payload.pseudonym_requested === true;
  const affiliation = asOptionalString(payload.affiliation, MAX_AFFILIATION);
  const states = asStatesArray(payload.states);
  if (!states) {
    return json(400, {
      error: `Please choose 1 to ${MAX_STATES} states (each ${MIN_STATE_LEN}-${MAX_STATE_LEN} characters).`,
    });
  }
  const background = asTrimmedString(payload.background, MAX_BACKGROUND + 1);
  if (background.length > MAX_BACKGROUND) {
    return json(400, { error: `Background too long (max ${MAX_BACKGROUND} characters).` });
  }
  const sampleCorrections = asOptionalString(payload.sample_corrections, MAX_SAMPLE);
  const referencesText = asOptionalString(payload.references, MAX_REFERENCES);
  const preferredContact = asTrimmedString(payload.preferred_contact, MAX_PREFERRED_CONTACT);
  if (!preferredContact) {
    return json(400, { error: 'Please tell us how to contact you (email or otherwise).' });
  }
  const libraryCardNumber = asOptionalString(payload.library_card_number, MAX_LIBRARY_CARD);

  // Rate-limit by IP (in-memory) and by preferred_contact (DB side).
  const ip = getClientIp(Astro.request);
  const now = Date.now();
  const lastByIp = recentSubmissionsByIp.get(ip);
  if (lastByIp && now - lastByIp < RATE_WINDOW_MS) {
    return json(429, {
      error: 'You recently submitted an application. Please wait an hour before submitting another.',
    });
  }

  // Best-effort DB-side guard against the same contact applying twice in
  // an hour. RLS only lets the submitter read their own row, so this query
  // runs as the anon/authenticated user and may simply return no rows —
  // that is fine; the IP guard above is the primary control.
  const oneHourAgo = new Date(now - RATE_WINDOW_MS).toISOString();
  const { data: recentByContact } = await supabase
    .from('state_co_librarian_applications')
    .select('id')
    .eq('preferred_contact', preferredContact)
    .gte('submitted_at', oneHourAgo)
    .limit(1)
    .maybeSingle();
  if (recentByContact) {
    return json(429, {
      error: 'An application with this contact was submitted recently. Please wait an hour.',
    });
  }

  const insertRow: {
    user_id: string | null;
    name: string;
    pseudonym_requested: boolean;
    affiliation: string | null;
    states: string[];
    background: string | null;
    sample_corrections: string | null;
    references_text: string | null;
    preferred_contact: string;
    library_card_number: string | null;
  } = {
    user_id: user ? user.id : null,
    name,
    pseudonym_requested: pseudonymRequested,
    affiliation,
    states,
    background: background || null,
    sample_corrections: sampleCorrections,
    references_text: referencesText,
    preferred_contact: preferredContact,
    library_card_number: libraryCardNumber,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('state_co_librarian_applications')
    .insert(insertRow)
    .select('id, ticket_number')
    .single();
  if (insertErr || !inserted) {
    return json(500, {
      error: insertErr?.message || 'Could not record your application. Please try again.',
    });
  }

  // Record IP submission timestamp AFTER successful insert so a failed
  // insert (validation, DB hiccup) doesn't lock the IP out.
  recentSubmissionsByIp.set(ip, now);
  // Garbage-collect old entries opportunistically so the map doesn't grow
  // unbounded over the life of the isolate.
  if (recentSubmissionsByIp.size > 256) {
    const cutoff = now - RATE_WINDOW_MS;
    for (const [k, ts] of recentSubmissionsByIp) {
      if (ts < cutoff) recentSubmissionsByIp.delete(k);
    }
  }

  // Acknowledgment email — best-effort. Only attempt the send when the
  // preferred_contact looks like an email; otherwise silently skip.
  let emailSent = false;
  let emailSkipped: string | undefined;
  if (isEmailShape(preferredContact)) {
    const send = await sendTemplateEmail({
      template: 'state_co_lib_application_received',
      to: preferredContact,
      variables: {
        ticket_number: inserted.ticket_number,
        applicant_name: pseudonymRequested
          ? '(pseudonym requested)'
          : name,
      },
    });
    emailSent = send.sent;
    if (!send.sent) emailSkipped = send.reason;
  } else {
    emailSkipped = 'preferred_contact is not an email';
  }

  return json(200, {
    ok: true,
    ticket_number: inserted.ticket_number,
    email_sent: emailSent,
    ...(emailSkipped ? { email_skipped: emailSkipped } : {}),
  });
};
