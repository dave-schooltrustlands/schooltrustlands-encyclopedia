// Site Update v35 — Head-librarian decision endpoint for State
// Co-Librarian applications.
//
// POST { decision: 'accept' | 'decline', reviewer_notes? }. Verifies the
// caller is head_librarian or admin (404 otherwise — same 404-not-403
// pattern used elsewhere in /librarian/*). Updates the application row;
// the decision-notification trigger writes the inbox row automatically,
// so no notify() call is needed here. Logs to moderation_audit and
// sends the acceptance/decline email.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../../lib/supabase';
import { sendTemplateEmail } from '../../../../lib/email';

export const prerender = false;

const MAX_NOTES = 4000;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

function isEmailShape(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 404, not 401 — don't telegraph the dashboard's existence.
  if (!user) return notFound();

  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow) return notFound();
  if (roleRow.role !== 'head_librarian' && roleRow.role !== 'admin') {
    return notFound();
  }

  const id = Astro.params.id;
  if (!id) return json(400, { error: 'Missing application id.' });

  let payload: { decision?: unknown; reviewer_notes?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }
  const decision = typeof payload.decision === 'string' ? payload.decision : '';
  const reviewerNotes =
    typeof payload.reviewer_notes === 'string' ? payload.reviewer_notes.trim() : '';
  if (decision !== 'accept' && decision !== 'decline') {
    return json(400, { error: 'decision must be "accept" or "decline".' });
  }
  if (reviewerNotes.length > MAX_NOTES) {
    return json(400, { error: `Reviewer notes too long (max ${MAX_NOTES} characters).` });
  }

  const { data: app } = await supabase
    .from('state_co_librarian_applications')
    .select('id, ticket_number, user_id, name, preferred_contact, status, pseudonym_requested')
    .eq('id', id)
    .maybeSingle();
  if (!app) return json(404, { error: 'Application not found.' });
  if (app.status === 'accepted' || app.status === 'declined') {
    return json(409, { error: `Application already ${app.status}.` });
  }

  const newStatus = decision === 'accept' ? 'accepted' : 'declined';

  const { error: updErr } = await supabase
    .from('state_co_librarian_applications')
    .update({
      status: newStatus,
      reviewer_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
    })
    .eq('id', id);
  if (updErr) {
    return json(500, { error: `Could not update application: ${updErr.message}` });
  }

  // Log to moderation_audit. The audit insert is gated by is_moderator()
  // RLS; head_librarian/admin are members of that set.
  const { error: auditErr } = await supabase.from('moderation_audit').insert({
    actor_id: user.id,
    action: 'scl_application_decision',
    target_type: 'state_co_librarian_application',
    target_id: app.id,
    reason: `${newStatus}${reviewerNotes ? ' — ' + reviewerNotes.slice(0, 400) : ''}`,
  });
  // We don't fail the decide on an audit failure; the state change is
  // already applied. Surface as a warning in the response instead.
  const auditWarning = auditErr ? `audit log failed: ${auditErr.message}` : undefined;

  // Reviewer profile (for the email's signature line).
  const { data: reviewerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const reviewerName =
    (reviewerProfile?.display_name ?? '').trim() || 'A Head Librarian';
  const reviewerRole = roleRow.role.replace(/_/g, ' ');

  // Email — best-effort. Only attempt if preferred_contact looks like an
  // email. The applicant's name in the salutation respects the pseudonym
  // request (we don't have a different pseudonym field; we just substitute
  // a generic salutation rather than risk leaking the legal name back).
  let emailSent = false;
  let emailSkipped: string | undefined;
  if (isEmailShape(app.preferred_contact)) {
    const template =
      decision === 'accept'
        ? 'state_co_lib_application_accepted'
        : 'state_co_lib_application_declined';
    const send = await sendTemplateEmail({
      template,
      to: app.preferred_contact,
      variables: {
        ticket_number: app.ticket_number,
        applicant_name: app.pseudonym_requested ? 'Applicant' : app.name,
        reviewer_notes: reviewerNotes,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
      },
    });
    emailSent = send.sent;
    if (!send.sent) emailSkipped = send.reason;
  } else {
    emailSkipped = 'preferred_contact is not an email';
  }

  return json(200, {
    ok: true,
    status: newStatus,
    email_sent: emailSent,
    ...(emailSkipped ? { email_skipped: emailSkipped } : {}),
    ...(auditWarning ? { warning: auditWarning } : {}),
  });
};
