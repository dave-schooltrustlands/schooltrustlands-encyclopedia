// Site Update v32 — Reject (delete) a patron review.
//
// POST. Librarian-only — same role check as /api/review/[id]/publish:
// only librarian, head_librarian, or admin may reject. Rejection here
// means deletion of the row, so the patron is free to write a fresh
// review (rather than living with a hidden draft that can't be edited).
//
// An optional { reason } may be supplied for the librarian's own record;
// v32 does not write the rejection into moderation_audit (that table
// is owned by GAMMA's discussion moderation flow). If we want a paper
// trail for review rejections later we can add it without breaking the
// endpoint contract.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../../lib/supabase';

export const prerender = false;

const REJECT_ROLES = new Set(['librarian', 'head_librarian', 'admin']);

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow || !REJECT_ROLES.has(roleRow.role)) return notFound();

  const id = Astro.params.id;
  if (!id || typeof id !== 'string') return notFound();

  // Optional reason — read but not persisted in v32.
  try {
    await Astro.request.json();
  } catch {
    // Body is optional; ignore JSON parse failure.
  }

  // Confirm the row exists so we can give a sensible 404 vs. 200.
  const { data: review } = await supabase
    .from('reviews')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!review) return json(404, { error: 'Review not found.' });

  const { error: deleteErr } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);
  if (deleteErr) {
    return json(500, { error: deleteErr.message || 'Could not reject the review.' });
  }

  return json(200, { ok: true });
};
