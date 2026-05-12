// Site Update v31 — Public librarian-application endpoint.
//
// POST { statement, relevant_experience?, time_commitment? }.
// Verifies the caller is signed in, refuses duplicates, inserts a row
// (trigger assigns LA-YYYY-NNNNN), sends the confirmation email.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';
import { sendTemplateEmail } from '../../lib/email';

export const prerender = false;

const MAX_STATEMENT = 4000;
const MAX_EXPERIENCE = 4000;
const MAX_TIME = 500;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { error: 'Sign in to apply.' });

  let payload: {
    statement?: unknown;
    relevant_experience?: unknown;
    time_commitment?: unknown;
  };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const statement = typeof payload.statement === 'string' ? payload.statement.trim() : '';
  const experience = typeof payload.relevant_experience === 'string'
    ? payload.relevant_experience.trim()
    : '';
  const time = typeof payload.time_commitment === 'string'
    ? payload.time_commitment.trim()
    : '';

  if (!statement) return json(400, { error: 'Please write a few words about why you want to volunteer.' });
  if (statement.length > MAX_STATEMENT) {
    return json(400, { error: `Statement too long (max ${MAX_STATEMENT} characters).` });
  }
  if (experience.length > MAX_EXPERIENCE) {
    return json(400, { error: `Experience too long (max ${MAX_EXPERIENCE} characters).` });
  }
  if (time.length > MAX_TIME) {
    return json(400, { error: `Time-commitment too long (max ${MAX_TIME} characters).` });
  }

  // Duplicate check — already pending application?
  const { data: existingPending } = await supabase
    .from('librarian_applications')
    .select('id, ticket_number, status')
    .eq('user_id', user.id)
    .in('status', ['new', 'in_review'])
    .maybeSingle();
  if (existingPending) {
    return json(409, {
      error: `You already have an application in review (${existingPending.ticket_number}).`,
      ticket_number: existingPending.ticket_number,
    });
  }

  const { data: insertRow, error: insertErr } = await supabase
    .from('librarian_applications')
    .insert({
      user_id: user.id,
      statement,
      relevant_experience: experience || null,
      time_commitment: time || null,
    })
    .select('id, ticket_number')
    .single();
  if (insertErr || !insertRow) {
    return json(500, {
      error: insertErr?.message || 'Could not record your application. Please try again.',
    });
  }

  // Confirmation email — best-effort.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const patronName = (profile?.display_name ?? '').trim() || 'Library Patron';

  const send = await sendTemplateEmail({
    template: 'librarian_application_received',
    to: user.email ?? '',
    variables: {
      ticket_number: insertRow.ticket_number,
      patron_name: patronName,
    },
  });

  return json(200, {
    ticket_number: insertRow.ticket_number,
    email_sent: send.sent,
    ...(send.sent ? {} : { email_skipped: send.reason }),
  });
};
