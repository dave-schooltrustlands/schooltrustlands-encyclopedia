// Server-side helper for writing rows to public.notifications.
//
// Site Update v33 — every transactional email path also writes a notifications
// row so the patron sees the same event in their /my-library/ inbox. Three
// SECURITY DEFINER triggers cover ticket-response / review-publish /
// badge-grant; the remaining two (application_approved|declined,
// discussion_reply) are written from the API layer via this helper.
//
// RLS gates inserts behind public.is_moderator() — see the policy
// "Librarians insert notifications" in 20260511_v33_notifications_and_profile.sql.
// All sends are best-effort: failures are returned as { ok: false, error }
// rather than thrown, so a notification failure never bubbles up and 500s a
// successful action (approve / decline / reply).

import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind =
  | 'response_received'
  | 'review_published'
  | 'application_approved'
  | 'application_declined'
  | 'discussion_reply'
  | 'badge_granted'
  | 'ticket_status_changed';

export type NotifyResult = { ok: true } | { ok: false; error: string };

export async function notify(
  supabase: SupabaseClient,
  args: {
    user_id: string;
    kind: NotificationKind;
    title: string;
    body?: string;
    link_url?: string;
  }
): Promise<NotifyResult> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: args.user_id,
      kind: args.kind,
      title: args.title,
      body: args.body ?? null,
      link_url: args.link_url ?? null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'notify failed' };
  }
}
