// Site Update v31 — Librarian-side application-decision endpoint.
//
// POST { decision: 'approve' | 'decline', note? }. Verifies librarian,
// loads the application, on approve grants 'librarian' role and updates
// status; on decline updates status. Sends the appropriate email.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../../lib/supabase';
import { sendTemplateEmail } from '../../../../lib/email';
import { notify } from '../../../../lib/notify';

export const prerender = false;

const MAX_NOTE = 4000;

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

  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow) return new Response('Not Found', { status: 404 });

  const id = Astro.params.id;
  if (!id) return json(400, { error: 'Missing application id.' });

  let payload: { decision?: unknown; note?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }
  const decision = typeof payload.decision === 'string' ? payload.decision : '';
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';
  if (decision !== 'approve' && decision !== 'decline') {
    return json(400, { error: 'decision must be "approve" or "decline".' });
  }
  if (note.length > MAX_NOTE) {
    return json(400, { error: `Note too long (max ${MAX_NOTE} characters).` });
  }

  // Load + lock application.
  const { data: app } = await supabase
    .from('librarian_applications')
    .select('id, user_id, ticket_number, status')
    .eq('id', id)
    .maybeSingle();
  if (!app) return json(404, { error: 'Application not found.' });
  if (!['new', 'in_review'].includes(app.status)) {
    return json(409, { error: `Application already ${app.status}.` });
  }

  const newStatus = decision === 'approve' ? 'approved' : 'declined';

  if (decision === 'approve') {
    // Grant librarian role (idempotent — on conflict do nothing).
    const { error: roleErr } = await supabase
      .from('librarian_roles')
      .upsert(
        { user_id: app.user_id, role: 'librarian', granted_by: user.id },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
    if (roleErr) {
      return json(500, { error: `Could not grant librarian role: ${roleErr.message}` });
    }
  }

  const { error: updErr } = await supabase
    .from('librarian_applications')
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note || null,
    })
    .eq('id', id);
  if (updErr) {
    return json(500, { error: `Could not update application: ${updErr.message}` });
  }

  // Email send — best-effort.
  const { data: applicantEmailRaw } = await supabase.rpc('get_user_email', {
    p_user_id: app.user_id,
  });
  const applicantEmail = typeof applicantEmailRaw === 'string' ? applicantEmailRaw : '';

  const { data: applicantProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', app.user_id)
    .maybeSingle();
  const { data: reviewerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const patronName = (applicantProfile?.display_name ?? '').trim() || 'Library Patron';
  const reviewerName = (reviewerProfile?.display_name ?? '').trim() || 'A Librarian';
  const reviewerRole = roleRow.role.replace(/_/g, ' ');

  const template = decision === 'approve'
    ? 'librarian_application_approved'
    : 'librarian_application_declined';

  const send = await sendTemplateEmail({
    template,
    to: applicantEmail,
    variables: {
      ticket_number: app.ticket_number,
      patron_name: patronName,
      decision_note: note,
      approver_name: reviewerName,
      approver_role: reviewerRole,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
    },
  });

  // v33 — best-effort inbox notification. Wrapped defensively so any
  // failure (RLS, transport, import-resolution) does not 500 the decide.
  try {
    const notifyKind =
      decision === 'approve' ? 'application_approved' : 'application_declined';
    const notifyTitle =
      decision === 'approve'
        ? 'Your librarian application was approved.'
        : 'Your librarian application was reviewed.';
    await notify(supabase, {
      user_id: app.user_id,
      kind: notifyKind,
      title: notifyTitle,
      body: note || undefined,
      link_url: '/my-library/',
    });
  } catch {
    // Notification path failed; the decision itself is recorded.
  }

  return json(200, {
    status: newStatus,
    email_sent: send.sent,
    ...(send.sent ? {} : { email_skipped: send.reason }),
  });
};
