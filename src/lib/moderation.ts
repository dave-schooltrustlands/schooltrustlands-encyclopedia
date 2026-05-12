// Site Update v32 — Moderation guard helper.
//
// requireModerator(Astro) mirrors requireLibrarian but accepts the wider set
// of librarian_roles.role values that the v32 migration enables — the new
// `discussion_moderator` value plus the three pre-existing librarian-tier
// roles (librarian, head_librarian, admin). A pure discussion_moderator
// reaches the Moderation dashboard tab; the librarian-tier roles do too,
// because the v32 spec says moderation is a strict subset of the librarian
// surface (every librarian can moderate).
//
// 404-not-403: callers without any librarian_roles row at all get a 404 in
// keeping with the rest of the dashboard family — we don't telegraph that
// the moderation surface exists.
//
// isModerator(supabase, userId) is the simple boolean form used by API
// endpoints that already have their own auth flow.

import type { AstroGlobal } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from './supabase';

export type ModeratorRole =
  | 'librarian'
  | 'head_librarian'
  | 'admin'
  | 'discussion_moderator';

export type ModeratorContext = {
  user: { id: string; email?: string | null };
  supabase: SupabaseClient;
  role: ModeratorRole;
};

export type RequireModeratorResult =
  | { ok: true; context: ModeratorContext }
  | { ok: false; response: Response };

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function requireModerator(
  Astro: AstroGlobal
): Promise<RequireModeratorResult> {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: notFound() };
  }

  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!roleRow) {
    return { ok: false, response: notFound() };
  }

  const role = roleRow.role as ModeratorRole;
  // Any row in librarian_roles satisfies the moderator predicate — the
  // role check check-constraint in the migration restricts the set to the
  // four values above.

  return {
    ok: true,
    context: {
      user: { id: user.id, email: user.email ?? null },
      supabase,
      role,
    },
  };
}

export async function isModerator(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return false;
  const role = String(data.role);
  return (
    role === 'librarian' ||
    role === 'head_librarian' ||
    role === 'admin' ||
    role === 'discussion_moderator'
  );
}
