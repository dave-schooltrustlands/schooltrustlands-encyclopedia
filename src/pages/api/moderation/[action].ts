// Site Update v32 — Generic moderator-action endpoint.
//
// POST /api/moderation/{hide|unhide|lock|unlock}
//   body: { target_type: 'discussion_post' | 'discussion', target_id, reason? }
//
// hide/unhide → flips is_hidden on a discussion_post, or sets status on a
//               discussion to/from 'hidden'.
// lock/unlock → sets status on a discussion to/from 'closed'. Not applicable
//               to discussion_post.
//
// Every action writes a row to moderation_audit. Auth requires the caller
// to satisfy isModerator(); failure returns a 404 to match the rest of the
// moderator surface contract.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../lib/supabase';
import { isModerator } from '../../../lib/moderation';

export const prerender = false;

const VALID_ACTIONS = new Set(['hide', 'unhide', 'lock', 'unlock']);
const VALID_TARGET_TYPES = new Set(['discussion_post', 'discussion']);

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function notFound() {
  return new Response('Not Found', { status: 404 });
}

export const POST: APIRoute = async (Astro) => {
  const action = Astro.params.action;
  if (!action || !VALID_ACTIONS.has(action)) return notFound();

  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const isMod = await isModerator(supabase, user.id);
  if (!isMod) return notFound();

  let payload: { target_type?: unknown; target_id?: unknown; reason?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const targetType =
    typeof payload.target_type === 'string' ? payload.target_type : '';
  const targetId =
    typeof payload.target_id === 'string' ? payload.target_id : '';
  const reason =
    typeof payload.reason === 'string' && payload.reason.trim().length > 0
      ? payload.reason.trim()
      : null;

  if (!VALID_TARGET_TYPES.has(targetType)) {
    return json(400, { error: 'Unsupported target_type.' });
  }
  if (!targetId) {
    return json(400, { error: 'Missing target_id.' });
  }

  // Lock/unlock only make sense for a discussion thread, not a post.
  if ((action === 'lock' || action === 'unlock') && targetType !== 'discussion') {
    return json(400, { error: 'lock/unlock only apply to a discussion thread.' });
  }

  // Apply the action.
  if (targetType === 'discussion_post') {
    // hide ↔ unhide
    const isHidden = action === 'hide';
    const { error } = await supabase
      .from('discussion_posts')
      .update({ is_hidden: isHidden })
      .eq('id', targetId);
    if (error) return json(500, { error: error.message });
  } else {
    // discussion thread: status transitions.
    let nextStatus: 'open' | 'closed' | 'hidden' | null = null;
    if (action === 'hide') nextStatus = 'hidden';
    else if (action === 'unhide') nextStatus = 'open';
    else if (action === 'lock') nextStatus = 'closed';
    else if (action === 'unlock') nextStatus = 'open';
    if (!nextStatus) {
      return json(400, { error: 'Unsupported action for discussion target.' });
    }
    const { error } = await supabase
      .from('discussions')
      .update({ status: nextStatus })
      .eq('id', targetId);
    if (error) return json(500, { error: error.message });
  }

  // Record the audit row. RLS gates this to moderators; we just verified.
  const { error: auditErr } = await supabase.from('moderation_audit').insert({
    actor_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
  if (auditErr) {
    // The state change is already applied; report the audit failure as a
    // warning rather than a 500 so the UI doesn't think the action failed.
    return json(200, { ok: true, warning: `audit log failed: ${auditErr.message}` });
  }

  return json(200, { ok: true });
};
