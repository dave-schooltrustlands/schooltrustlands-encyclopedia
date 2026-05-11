// Site Update v30 — Feedback Foundation: submission endpoint.
//
// Accepts POST { page_url, subject?, body }. Verifies the request is from a
// signed-in patron via the Supabase session cookie. Inserts a row into
// public.feedback; the before-insert trigger assigns the ticket number.
// On success returns { ticket_number, status: 'new' }.
//
// Email confirmation is sent best-effort after the insert; a failed send
// does not fail the request (the ticket is still recorded).

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

const MAX_BODY = 4000;
const MAX_SUBJECT = 60;
const MAX_PAGE_URL = 2000;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function sendConfirmationEmail(
  toEmail: string,
  ticketNumber: string
): Promise<void> {
  // Best-effort. v30 uses whatever email mechanism is already wired for the
  // magic-link flow (Supabase default sender). Resend branding lands in v30.5.
  // If a RESEND_API_KEY is present at runtime we send via Resend directly;
  // otherwise the confirmation email is skipped (the ticket is still recorded
  // and the patron can see it in My Library → My Tickets).
  const resendKey = import.meta.env.RESEND_API_KEY;
  if (!resendKey || !toEmail) return;

  const subject = `Library feedback received — ${ticketNumber}`;
  const lines = [
    `Thank you for your feedback. We have received it and assigned it ticket number ${ticketNumber}.`,
    '',
    'A librarian will follow up by email if a response is warranted. You can view your tickets at any time on your My Library page:',
    '',
    'https://schooltrusts.net/my-library/',
    '',
    '— America’s School Trust Library',
  ];
  const text = lines.join('\n');
  const html =
    '<p>Thank you for your feedback. We have received it and assigned it ticket number ' +
    `<strong>${ticketNumber}</strong>.</p>` +
    '<p>A librarian will follow up by email if a response is warranted. You can view your tickets at any time on your ' +
    '<a href="https://schooltrusts.net/my-library/">My Library page</a>.</p>' +
    '<p>— America’s School Trust Library</p>';

  const fromAddress =
    import.meta.env.FEEDBACK_FROM_EMAIL || 'library@schooltrusts.net';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: toEmail,
        subject,
        text,
        html,
      }),
    });
  } catch {
    // swallow — confirmation email is a courtesy, never blocks the ticket.
  }
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { error: 'Sign in to submit feedback.' });
  }

  let payload: { page_url?: unknown; subject?: unknown; body?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const pageUrlRaw = typeof payload.page_url === 'string' ? payload.page_url.trim() : '';
  const subjectRaw = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const bodyRaw = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (!bodyRaw) {
    return json(400, { error: 'Please write your feedback before submitting.' });
  }
  if (bodyRaw.length > MAX_BODY) {
    return json(400, {
      error: `Your feedback is too long (max ${MAX_BODY} characters).`,
    });
  }
  if (subjectRaw.length > MAX_SUBJECT) {
    return json(400, {
      error: `Subject is too long (max ${MAX_SUBJECT} characters).`,
    });
  }
  if (!pageUrlRaw) {
    return json(400, { error: 'Missing page_url.' });
  }
  if (pageUrlRaw.length > MAX_PAGE_URL) {
    return json(400, { error: 'page_url too long.' });
  }

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      page_url: pageUrlRaw,
      subject: subjectRaw || null,
      body: bodyRaw,
    })
    .select('ticket_number, status')
    .single();

  if (error || !data) {
    return json(500, {
      error: error?.message || 'Could not record your feedback. Please try again.',
    });
  }

  await sendConfirmationEmail(user.email || '', data.ticket_number);

  return json(200, {
    ticket_number: data.ticket_number,
    status: data.status,
  });
};
