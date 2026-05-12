// Site Update v33 — Mark every unread notification read for the patron.
//
// POST /api/notification/mark-all-read
// Sets read_at = now() on every notifications row for the current user
// whose read_at is null. Returns the number marked.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../lib/supabase';

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

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('id');

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, count: (data ?? []).length });
};
