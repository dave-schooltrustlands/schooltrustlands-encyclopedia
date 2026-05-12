// Site Update v31 — Librarian-side ticket-response endpoint.
//
// POST { ticket_type, ticket_id, body, is_public? }. Verifies librarian,
// inserts a ticket_responses row, transitions the parent ticket to
// 'responded', and sends the response email to the submitter.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';
import { sendTemplateEmail } from '../../lib/email';

export const prerender = false;

const MAX_BODY = 4000;

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
  if (!user) return json(401, { error: 'Sign in required.' });

  // Verify librarian via librarian_roles. Non-librarians get the same 404 as
  // the dashboard route — the API is a back-end of the same private surface.
  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow) return new Response('Not Found', { status: 404 });

  let payload: {
    ticket_type?: unknown;
    ticket_id?: unknown;
    body?: unknown;
    is_public?: unknown;
  };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const ticketType = typeof payload.ticket_type === 'string' ? payload.ticket_type : '';
  const ticketId = typeof payload.ticket_id === 'string' ? payload.ticket_id : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const isPublic = payload.is_public === true;

  if (ticketType !== 'feedback') {
    return json(400, { error: 'Only feedback tickets are supported in v31.' });
  }
  if (!ticketId) return json(400, { error: 'Missing ticket_id.' });
  if (!body) return json(400, { error: 'Write a response before submitting.' });
  if (body.length > MAX_BODY) {
    return json(400, { error: `Response too long (max ${MAX_BODY} characters).` });
  }

  // Load the parent ticket so we can (a) confirm it exists and (b) collect
  // the submitter's email + page for the response email.
  const { data: ticket } = await supabase
    .from('feedback')
    .select('id, ticket_number, page_url, user_id, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) return json(404, { error: 'Ticket not found.' });

  // Insert the response. Librarian author_role per RLS.
  const { data: insertRow, error: insertErr } = await supabase
    .from('ticket_responses')
    .insert({
      ticket_type: 'feedback',
      ticket_id: ticketId,
      author_id: user.id,
      author_role: 'librarian',
      body,
      is_public: isPublic,
    })
    .select('id')
    .single();
  if (insertErr || !insertRow) {
    return json(500, {
      error: insertErr?.message || 'Could not record the response.',
    });
  }

  // Transition the ticket to 'responded'. RLS lets the librarian update.
  const { error: updateErr } = await supabase
    .from('feedback')
    .update({ status: 'responded' })
    .eq('id', ticketId);
  if (updateErr) {
    // Response is already recorded; do not 500 just because the status
    // transition failed. Surface the error in the response payload so the
    // dashboard can show a hint.
    return json(200, {
      id: insertRow.id,
      ticket_status: ticket.status,
      warning: `Response saved but status not updated: ${updateErr.message}`,
    });
  }

  // Look up the submitter's email via the security-definer RPC. The anon-key
  // SSR client cannot read auth.users directly; get_user_email() bridges
  // that, guarded by an internal is_librarian() check.
  const { data: emailLookup } = await supabase.rpc('get_user_email', {
    p_user_id: ticket.user_id,
  });
  let submitterEmail = typeof emailLookup === 'string' ? emailLookup : '';

  // Patron name + librarian name for the template variables.
  const { data: patronProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', ticket.user_id)
    .maybeSingle();
  const { data: librarianProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const patronName = (patronProfile?.display_name ?? '').trim() || 'Library Patron';
  const librarianName = (librarianProfile?.display_name ?? '').trim() || 'A Librarian';

  const send = await sendTemplateEmail({
    template: 'ticket_response',
    to: submitterEmail,
    variables: {
      ticket_number: ticket.ticket_number,
      patron_name: patronName,
      page_url: ticket.page_url,
      response_body: body,
      librarian_name: librarianName,
      librarian_role: roleRow.role.replace(/_/g, ' '),
    },
  });

  return json(200, {
    id: insertRow.id,
    ticket_status: 'responded',
    email_sent: send.sent,
    ...(send.sent ? {} : { email_skipped: send.reason }),
  });
};
