// Site Update v32 — Engagement Breadth: corrections submission endpoint.
//
// Accepts POST with either a JSON body (from the CorrectionLink modal) or
// form-encoded body (from the /correct/[...path] fallback form). Verifies the
// request is from a signed-in patron via the Supabase session cookie. Inserts
// a row into public.corrections; the before-insert trigger assigns the
// CR-YYYY-NNNNN ticket number.
//
// JSON callers receive `{ ticket_number, status }`. Form-encoded callers
// receive a 303 redirect to `/correct/thanks?t=<ticket_number>`. A confirmation
// email is sent best-effort using the `correction_received` template.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';
import { sendTemplateEmail } from '../../lib/email';

export const prerender = false;

const MAX_CLAIM = 600;
const MAX_FIX = 1500;
const MAX_SOURCE = 500;
const MAX_REASONING = 2000;
const MAX_PAGE_URL = 2000;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type Submission = {
  page_url: string;
  claim: string;
  proposed_fix: string;
  source_offered: string;
  reasoning: string;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(s: Submission): string | null {
  if (!s.page_url) return 'Missing page_url.';
  if (s.page_url.length > MAX_PAGE_URL) return 'page_url too long.';
  if (!s.claim) return 'Please describe the error before submitting.';
  if (s.claim.length > MAX_CLAIM) {
    return `Claim too long (max ${MAX_CLAIM} characters).`;
  }
  if (!s.proposed_fix) return 'Please write your proposed fix before submitting.';
  if (s.proposed_fix.length > MAX_FIX) {
    return `Proposed fix too long (max ${MAX_FIX} characters).`;
  }
  if (s.source_offered.length > MAX_SOURCE) {
    return `Source too long (max ${MAX_SOURCE} characters).`;
  }
  if (s.reasoning.length > MAX_REASONING) {
    return `Reasoning too long (max ${MAX_REASONING} characters).`;
  }
  return null;
}

async function readSubmission(
  request: Request
): Promise<{ submission: Submission; isForm: boolean } | { error: string }> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      return {
        submission: {
          page_url: readString(form.get('page_url')),
          claim: readString(form.get('claim')),
          proposed_fix: readString(form.get('proposed_fix')),
          source_offered: readString(form.get('source_offered')),
          reasoning: readString(form.get('reasoning')),
        },
        isForm: true,
      };
    } catch {
      return { error: 'Invalid form body.' };
    }
  }
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    return {
      submission: {
        page_url: readString(payload.page_url),
        claim: readString(payload.claim),
        proposed_fix: readString(payload.proposed_fix),
        source_offered: readString(payload.source_offered),
        reasoning: readString(payload.reasoning),
      },
      isForm: false,
    };
  } catch {
    return { error: 'Invalid JSON body.' };
  }
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { error: 'Sign in to submit a correction.' });
  }

  const parsed = await readSubmission(Astro.request);
  if ('error' in parsed) {
    return json(400, { error: parsed.error });
  }
  const { submission, isForm } = parsed;

  const validationError = validate(submission);
  if (validationError) {
    if (isForm) {
      // Round-trip the user back to the fallback form with the error attached.
      const back = new URL(submission.page_url || '/correct/', Astro.url);
      back.searchParams.set('error', validationError);
      return new Response(null, {
        status: 303,
        headers: { Location: back.pathname + back.search },
      });
    }
    return json(400, { error: validationError });
  }

  const { data, error } = await supabase
    .from('corrections')
    .insert({
      user_id: user.id,
      page_url: submission.page_url,
      claim: submission.claim,
      proposed_fix: submission.proposed_fix,
      source_offered: submission.source_offered || null,
      reasoning: submission.reasoning || null,
    })
    .select('id, ticket_number, status')
    .single();

  if (error || !data) {
    if (isForm) {
      return new Response(
        'Could not record your correction. Please try again.',
        { status: 500 }
      );
    }
    return json(500, {
      error: error?.message || 'Could not record your correction. Please try again.',
    });
  }

  // Confirmation email — best-effort. Loaded after insert so a missing
  // template never blocks the ticket. Pull patron display_name for the
  // greeting; fall back to "Library Patron" if profile is sparse.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const patronName = (profile?.display_name ?? '').trim() || 'Library Patron';

  await sendTemplateEmail({
    template: 'correction_received',
    to: user.email ?? '',
    variables: {
      ticket_number: data.ticket_number,
      patron_name: patronName,
      page_url: submission.page_url,
    },
  });

  if (isForm) {
    return new Response(null, {
      status: 303,
      headers: { Location: `/correct/thanks/?t=${encodeURIComponent(data.ticket_number)}` },
    });
  }

  // v32: include the row id so the client can attach files (separate POSTs
  // to /api/attachment with parent_type='correction' and parent_id=id).
  return json(200, {
    id: data.id,
    ticket_number: data.ticket_number,
    status: data.status,
  });
};
