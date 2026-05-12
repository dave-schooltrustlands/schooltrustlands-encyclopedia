// Site Update v32 — Member-badge grant endpoint.
//
// POST { user_id, badge, attribution? }. Head-librarian-only (the badge
// is part of the institutional identity surface; granting it is a head-of-
// institution prerogative, not a moderation or even a librarian-day-to-day
// action). Inserts a member_badges row; the table's unique (user_id, badge,
// attribution) constraint deduplicates.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

const ALLOWED_BADGES = new Set([
  'state_expert',
  'oastl_board',
  'astl_board',
  'friend_of_library',
  'editorial_contributor',
  'citizen_historian',
]);
const MAX_ATTRIBUTION = 120;

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
  if (!user) return new Response('Not Found', { status: 404 });

  // Head-librarian (or admin) only.
  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow || !['head_librarian', 'admin'].includes(roleRow.role)) {
    return new Response('Not Found', { status: 404 });
  }

  let payload: {
    user_id?: unknown;
    badge?: unknown;
    attribution?: unknown;
  };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const targetUserId = typeof payload.user_id === 'string' ? payload.user_id : '';
  const badge = typeof payload.badge === 'string' ? payload.badge : '';
  const attributionRaw = typeof payload.attribution === 'string' ? payload.attribution.trim() : '';

  if (!targetUserId) return json(400, { error: 'Missing user_id.' });
  if (!ALLOWED_BADGES.has(badge)) {
    return json(400, { error: `Unknown badge "${badge}".` });
  }
  if (attributionRaw.length > MAX_ATTRIBUTION) {
    return json(400, {
      error: `Attribution too long (max ${MAX_ATTRIBUTION} characters).`,
    });
  }

  // state_expert and {oastl,astl}_board carry an attribution by convention
  // (state name; organization name). The other badges don't need one.
  const attribution = attributionRaw || null;

  const { data: inserted, error } = await supabase
    .from('member_badges')
    .insert({
      user_id: targetUserId,
      badge,
      attribution,
      granted_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    // unique-violation -> the patron already has this exact badge.
    if (error.code === '23505') {
      return json(409, { error: 'Patron already has this badge.' });
    }
    return json(500, { error: error.message });
  }

  return json(200, { id: inserted?.id });
};
