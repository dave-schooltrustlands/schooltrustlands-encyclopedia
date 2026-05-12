// Site Update v32 — Per-thread mute toggle endpoint.
//
// POST { discussion_id, muted: boolean }. When muted=true, inserts/upserts a
// discussion_mutes row for the current user. When muted=false, deletes it.
// Used by the discussion_reply email to silence future notifications on a
// thread (the UI links to /discussions/<ticket>/#mute in v33; this endpoint
// is the back-end already in place).

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

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

  let payload: { discussion_id?: unknown; muted?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const discussionId =
    typeof payload.discussion_id === 'string' ? payload.discussion_id : '';
  const muted = payload.muted === true;

  if (!discussionId) return json(400, { error: 'Missing discussion_id.' });

  if (muted) {
    const { error } = await supabase
      .from('discussion_mutes')
      .upsert(
        { user_id: user.id, discussion_id: discussionId },
        { onConflict: 'user_id,discussion_id' }
      );
    if (error) return json(500, { error: error.message });
    return json(200, { muted: true });
  } else {
    const { error } = await supabase
      .from('discussion_mutes')
      .delete()
      .eq('user_id', user.id)
      .eq('discussion_id', discussionId);
    if (error) return json(500, { error: error.message });
    return json(200, { muted: false });
  }
};
