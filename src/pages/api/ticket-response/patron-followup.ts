// Site Update v31 — Patron-side follow-up endpoint.
//
// POST { ticket_type, ticket_id, body }. Verifies the caller owns the
// parent ticket, inserts a patron-role ticket_responses row, resets the
// ticket to 'in_review' for librarian attention. No email is sent.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../lib/supabase';

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
  if (!user) return json(401, { error: 'Sign in to reply.' });

  let payload: { ticket_type?: unknown; ticket_id?: unknown; body?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const ticketType = typeof payload.ticket_type === 'string' ? payload.ticket_type : '';
  const ticketId = typeof payload.ticket_id === 'string' ? payload.ticket_id : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (ticketType !== 'feedback') {
    return json(400, { error: 'Only feedback tickets are supported in v31.' });
  }
  if (!ticketId) return json(400, { error: 'Missing ticket_id.' });
  if (!body) return json(400, { error: 'Write a reply before sending.' });
  if (body.length > MAX_BODY) {
    return json(400, { error: `Reply too long (max ${MAX_BODY} characters).` });
  }

  // Ownership check — RLS would refuse on insert anyway, but we want a
  // clean 403 + clear error instead of a generic 500.
  const { data: ticket } = await supabase
    .from('feedback')
    .select('id, user_id, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) return json(404, { error: 'Ticket not found.' });
  if (ticket.user_id !== user.id) {
    return json(403, { error: 'You can only reply to your own tickets.' });
  }
  if (ticket.status === 'archived') {
    return json(409, { error: 'This ticket is archived; open a new feedback ticket instead.' });
  }

  const { data: insertRow, error: insertErr } = await supabase
    .from('ticket_responses')
    .insert({
      ticket_type: 'feedback',
      ticket_id: ticketId,
      author_id: user.id,
      author_role: 'patron',
      body,
      is_public: false,
    })
    .select('id')
    .single();
  if (insertErr || !insertRow) {
    return json(500, {
      error: insertErr?.message || 'Could not record your reply. Please try again.',
    });
  }

  // The ticket-status reset is handled by the
  // ticket_responses_reset_parent_status() trigger (security definer) on
  // ticket_responses insert — patrons don't have an UPDATE policy on
  // feedback, so doing it server-side would be refused by RLS. The
  // trigger guarantees the status flip even if a future caller forgets.

  return json(200, {
    id: insertRow.id,
    ticket_status: ticket.status === 'archived' ? ticket.status : 'in_review',
  });
};
