// Site Update v32 — Publish a patron review.
//
// POST. Librarian-only — we deliberately re-check the role string here
// rather than relying on isLibrarian(), because v32 introduces a
// `discussion_moderator` role row that grants tabs but NOT review
// publication authority. Direct librarian_roles select, then check
// role in ('librarian','head_librarian','admin').
//
// On success: sets is_published=true, published_at=now(), published_by=user,
// and sends the review_published email to the review's author.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../../lib/supabase';
import { sendTemplateEmail } from '../../../../lib/email';

export const prerender = false;

const PUBLISH_ROLES = new Set(['librarian', 'head_librarian', 'admin']);

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

  // Librarian-role gate. discussion_moderator does NOT count — moderators
  // handle discussion content, not book reviews.
  const { data: roleRow } = await supabase
    .from('librarian_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!roleRow || !PUBLISH_ROLES.has(roleRow.role)) return notFound();

  const id = Astro.params.id;
  if (!id || typeof id !== 'string') return notFound();

  // Load the review + its parent work so we have everything for the email.
  const { data: review } = await supabase
    .from('reviews')
    .select('id, work_id, user_id, rating, body, is_published')
    .eq('id', id)
    .maybeSingle();
  if (!review) return json(404, { error: 'Review not found.' });
  if (review.is_published) {
    return json(200, { is_published: true, already: true });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('reviews')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq('id', id)
    .select('id, is_published, published_at')
    .single();
  if (updateErr || !updated) {
    return json(500, {
      error: updateErr?.message || 'Could not publish the review.',
    });
  }

  // Fetch the work for the email URLs and title.
  const { data: work } = await supabase
    .from('works')
    .select('slug, title')
    .eq('id', review.work_id)
    .maybeSingle();

  // Reviewer name + email.
  const { data: reviewerProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', review.user_id)
    .maybeSingle();
  const { data: emailLookup } = await supabase.rpc('get_user_email', {
    p_user_id: review.user_id,
  });
  const reviewerEmail = typeof emailLookup === 'string' ? emailLookup : '';
  const patronName =
    (reviewerProfile?.display_name ?? '').trim() || 'Library Patron';

  const workSlug = work?.slug ?? '';
  const workTitle = work?.title ?? 'this work';
  const workUrl = workSlug ? `https://schooltrusts.net/reading/${workSlug}/` : '';
  const reviewUrl = workSlug
    ? `https://schooltrusts.net/reading/${workSlug}/reviews/#review-${review.id}`
    : '';

  const send = await sendTemplateEmail({
    template: 'review_published',
    to: reviewerEmail,
    variables: {
      patron_name: patronName,
      work_title: workTitle,
      work_url: workUrl,
      review_body: review.body,
      review_url: reviewUrl,
    },
  });

  return json(200, {
    is_published: true,
    email_sent: send.sent,
    ...(send.sent ? {} : { email_skipped: send.reason }),
  });
};
