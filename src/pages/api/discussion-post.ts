// Site Update v32 — Discussion reply endpoint.
//
// POST { discussion_id, body }. Authenticates via the session cookie,
// validates, refuses to write to closed/hidden threads, inserts a
// discussion_posts row (the trigger bumps last_activity_at on the parent),
// then sends a best-effort discussion_reply email to every prior participant
// in the thread (excluding the current author and anyone who has muted).

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';
import { sendTemplateEmail } from '../../lib/email';
import { getSiteOrigin } from '../../lib/supabase';
import { notify } from '../../lib/notify';

export const prerender = false;

const MAX_BODY = 8000;

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

  let payload: { discussion_id?: unknown; body?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const discussionId =
    typeof payload.discussion_id === 'string' ? payload.discussion_id : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (!discussionId) return json(400, { error: 'Missing discussion_id.' });
  if (!body) return json(400, { error: 'Write a reply before submitting.' });
  if (body.length > MAX_BODY) {
    return json(400, { error: `Reply is too long (max ${MAX_BODY} characters).` });
  }

  // Pull the parent thread — we need to know it exists, is not closed/hidden,
  // and we want the title + ticket_number for the email.
  const { data: thread } = await supabase
    .from('discussions')
    .select('id, ticket_number, title, status, user_id')
    .eq('id', discussionId)
    .maybeSingle();
  if (!thread) return json(404, { error: 'Thread not found.' });
  if (thread.status === 'closed') {
    return json(403, { error: 'This thread is locked.' });
  }
  if (thread.status === 'hidden') {
    return json(403, { error: 'This thread is hidden.' });
  }

  const { data: insertRow, error: insertErr } = await supabase
    .from('discussion_posts')
    .insert({
      discussion_id: discussionId,
      user_id: user.id,
      body,
    })
    .select('id')
    .single();
  if (insertErr || !insertRow) {
    return json(500, { error: insertErr?.message || 'Could not record the reply.' });
  }

  // Best-effort notification fan-out. Anything below this point should not
  // affect the success of the reply post itself.
  try {
    // Distinct participant user_ids = thread.user_id ∪ post.user_id for
    // every prior post in the thread, minus the current author, minus
    // anyone muted.
    const { data: postRows } = await supabase
      .from('discussion_posts')
      .select('user_id')
      .eq('discussion_id', discussionId);
    const participantSet = new Set<string>();
    if (thread.user_id) participantSet.add(thread.user_id);
    for (const r of postRows ?? []) {
      if (r.user_id) participantSet.add(String(r.user_id));
    }
    participantSet.delete(user.id);

    // Subtract muted users.
    const { data: muteRows } = await supabase
      .from('discussion_mutes')
      .select('user_id')
      .eq('discussion_id', discussionId);
    for (const m of muteRows ?? []) {
      if (m.user_id) participantSet.delete(String(m.user_id));
    }

    const recipientIds = Array.from(participantSet);

    if (recipientIds.length > 0) {
      // Author display_name for the notification body.
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      const authorName =
        (authorProfile?.display_name ?? '').trim() || 'A Library Patron';

      // Recipient profiles for personalised greetings.
      const { data: recipientProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', recipientIds);
      const recipientNameMap = new Map<string, string>();
      for (const p of recipientProfiles ?? []) {
        recipientNameMap.set(
          p.id,
          (p.display_name ?? '').trim() || 'Library Patron'
        );
      }

      const origin = getSiteOrigin(Astro.request);
      const threadUrl = `${origin}/discussions/${thread.ticket_number}/`;
      const muteUrl = `${origin}/discussions/${thread.ticket_number}/#mute`;

      // v33 — fan-out includes both the transactional email send AND a
      // notifications-row insert per recipient. Both are best-effort:
      // the Promise.allSettled wrapper guarantees rejections don't
      // escape and 500 a successful reply.
      const notifyTitle = `New reply in "${thread.title}"`;
      const notifyBody = body.slice(0, 200);
      const notifyLink = `/discussions/${thread.ticket_number}/`;

      const tasks: Array<Promise<unknown>> = [];
      for (const uid of recipientIds) {
        tasks.push(
          (async () => {
            const { data: emailLookup } = await supabase.rpc('get_user_email', {
              p_user_id: uid,
            });
            const email = typeof emailLookup === 'string' ? emailLookup : '';
            if (!email) return { sent: false, reason: 'no email' };
            return sendTemplateEmail({
              template: 'discussion_reply',
              to: email,
              variables: {
                patron_name: recipientNameMap.get(uid) ?? 'Library Patron',
                thread_title: thread.title,
                thread_url: threadUrl,
                author_name: authorName,
                reply_body: body,
                mute_url: muteUrl,
              },
            });
          })()
        );
        tasks.push(
          notify(supabase, {
            user_id: uid,
            kind: 'discussion_reply',
            title: notifyTitle,
            body: notifyBody,
            link_url: notifyLink,
          })
        );
      }

      const sends = await Promise.allSettled(tasks);

      // We deliberately discard the per-send results — notifications are
      // strictly best-effort. The settled-array exists only so promise
      // rejections don't escape and 500 the request.
      void sends;
    }
  } catch {
    // Notification path failed; the reply itself is recorded.
  }

  return json(200, { id: insertRow.id });
};
