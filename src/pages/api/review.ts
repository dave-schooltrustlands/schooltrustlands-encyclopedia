// Site Update v32 — Review submission endpoint.
//
// POST { work_id, rating, body }. Authenticates via the Supabase session
// cookie. Validates rating 1–5 and body length. Upserts a review row for
// (work_id, user_id): inserts if none, updates if an unpublished draft
// exists, refuses with 409 if a published review already exists (the
// patron must contact a librarian to edit a published review).
//
// Reviews land as is_published=false. A librarian publishes via
// /api/review/[id]/publish.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

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
  if (!user) return json(401, { error: 'Sign in to write a review.' });

  let payload: { work_id?: unknown; rating?: unknown; body?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const workId = typeof payload.work_id === 'string' ? payload.work_id.trim() : '';
  const ratingNum =
    typeof payload.rating === 'number'
      ? payload.rating
      : typeof payload.rating === 'string'
        ? Number.parseInt(payload.rating, 10)
        : NaN;
  const bodyRaw = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (!workId) return json(400, { error: 'Missing work_id.' });
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return json(400, { error: 'Rating must be a whole number between 1 and 5.' });
  }
  if (!bodyRaw) return json(400, { error: 'Write your review before submitting.' });
  if (bodyRaw.length > MAX_BODY) {
    return json(400, { error: `Your review is too long (max ${MAX_BODY} characters).` });
  }

  // Confirm the work exists. RLS allows public reads of works.
  const { data: work } = await supabase
    .from('works')
    .select('id, slug, title')
    .eq('id', workId)
    .maybeSingle();
  if (!work) return json(404, { error: 'Work not found.' });

  // Look for an existing review by this patron on this work.
  const { data: existing } = await supabase
    .from('reviews')
    .select('id, is_published')
    .eq('work_id', workId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.is_published) {
    return json(409, {
      error:
        'Your review of this work is already published. To revise it, contact a librarian via the Submit Feedback link.',
      id: existing.id,
      is_published: true,
    });
  }

  if (existing) {
    // Update the existing unpublished draft. RLS policy
    // "Own review write unpublished" gates this on is_published = false.
    const { data: updateRow, error: updateErr } = await supabase
      .from('reviews')
      .update({
        rating: Math.trunc(ratingNum),
        body: bodyRaw,
      })
      .eq('id', existing.id)
      .select('id, is_published')
      .single();
    if (updateErr || !updateRow) {
      return json(500, {
        error: updateErr?.message || 'Could not save your review. Please try again.',
      });
    }
    return json(200, { id: updateRow.id, is_published: updateRow.is_published });
  }

  // Insert a fresh draft.
  const { data: insertRow, error: insertErr } = await supabase
    .from('reviews')
    .insert({
      work_id: workId,
      user_id: user.id,
      rating: Math.trunc(ratingNum),
      body: bodyRaw,
    })
    .select('id, is_published')
    .single();
  if (insertErr || !insertRow) {
    return json(500, {
      error: insertErr?.message || 'Could not record your review. Please try again.',
    });
  }

  return json(200, { id: insertRow.id, is_published: insertRow.is_published });
};
