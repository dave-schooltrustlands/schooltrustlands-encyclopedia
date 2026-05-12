// Site Update v42 — Newsroom monthly-digest subscription endpoint.
//
// Accepts POST { name, email, opt_in: true } from anonymous visitors and
// inserts a row into public.newsroom_subscribers. RLS allows anon inserts
// directly, so the endpoint exists mainly to (a) keep the supabase URL
// and anon key off the form's client JS, (b) normalise email casing, and
// (c) translate duplicate-email collisions into a friendly response.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async (Astro) => {
  let payload: { name?: unknown; email?: unknown; opt_in?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const optIn = payload.opt_in === true;

  if (!name || name.length > MAX_NAME) {
    return json(400, { error: 'Please enter your name.' });
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' });
  }
  if (!optIn) {
    return json(400, {
      error: 'Please confirm the opt-in checkbox to subscribe.',
    });
  }

  const supabase = getServerSupabase(Astro);
  const { error } = await supabase
    .from('newsroom_subscribers')
    .insert({ name, email });

  if (error) {
    // 23505 = unique_violation (duplicate email).
    if (error.code === '23505') {
      return json(200, { duplicate: true });
    }
    return json(500, {
      error: 'Could not record your subscription. Please try again.',
    });
  }

  return json(200, { ok: true });
};
