// Site Update v33 — Mark a single notification read.
//
// POST /api/notification/{id}/mark-read
// Updates notifications.read_at = now() for the patron's own row. RLS
// already enforces user_id = auth.uid() on the update path; the explicit
// .eq('user_id', user.id) predicate is defence-in-depth.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../../lib/supabase';

export const prerender = false;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async (Astro) => {
  const id = Astro.params.id;
  if (!id || typeof id !== 'string') {
    return json(400, { error: 'Missing notification id.' });
  }

  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { error: 'Sign in required.' });

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true });
};
