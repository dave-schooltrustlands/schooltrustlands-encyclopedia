// Server-side helpers for the librarian route family.
//
// The 404-not-403 contract: a non-librarian visitor to /librarian/* should
// receive a 404 indistinguishable from a missing route — we don't telegraph
// that a librarian dashboard exists. `requireLibrarian(Astro)` returns either
// the authenticated librarian context (user, supabase, role) or a Response
// suitable for the .astro page to `return` directly.

import type { AstroGlobal } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from './supabase';

// v32: the role union widens to include discussion_moderator. requireLibrarian
// still returns ok=true for any row in librarian_roles (so a pure moderator
// reaches the dashboard and the six-tab nav can show them their Moderation +
// Discussions tabs), but dashboard pages that show librarian-only content
// must call isLibrarianRole(role) to gate.
export type LibrarianRole =
  | 'librarian'
  | 'head_librarian'
  | 'admin'
  | 'discussion_moderator';

export type LibrarianContext = {
  user: { id: string; email?: string | null };
  supabase: SupabaseClient;
  role: LibrarianRole;
};

// True only for the librarian-tier roles — discussion_moderator excluded.
// Use this in pages like /librarian/, /librarian/applications/, /librarian/
// patrons/, /librarian/reviews/ to render an early-return 404 when the
// dashboard guard succeeds but the user is only a moderator.
export function isLibrarianRole(role: LibrarianRole | string): boolean {
  return role === 'librarian' || role === 'head_librarian' || role === 'admin';
}

export type RequireLibrarianResult =
  | { ok: true; context: LibrarianContext }
  | { ok: false; response: Response };

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function requireLibrarian(
  Astro: AstroGlobal
): Promise<RequireLibrarianResult> {
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

  return {
    ok: true,
    context: {
      user: { id: user.id, email: user.email ?? null },
      supabase,
      role: roleRow.role as LibrarianRole,
    },
  };
}

export async function isLibrarian(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('librarian_roles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

// Patron-side helper used by /my-library/ to decide whether to render the
// "Become a librarian" link. Same shape as isLibrarian but resolves to false
// (rather than throwing) on RLS or transport errors.
export async function userHasLibrarianRole(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    return await isLibrarian(supabase, userId);
  } catch {
    return false;
  }
}

// Format a numeric patron_number as "00 001" — the same convention
// /my-library/ uses. Centralised here so the librarian-side tables match.
export function formatPatronNumber(n: number | null | undefined): string {
  const v = typeof n === 'number' && n > 0 ? n : 0;
  const s = String(v).padStart(5, '0');
  return s.slice(0, 2) + ' ' + s.slice(2);
}

// DD Mon YYYY in UTC — also matches the /my-library/ convention.
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate().toString().padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
