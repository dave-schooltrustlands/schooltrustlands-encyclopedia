// Site Update v32 — Discussion thread creation endpoint.
//
// POST { title, body, topic? }. Authenticates via the session cookie,
// validates lengths, inserts a discussions row (the trigger assigns
// DI-YYYY-NNNNN). Returns { ticket_number, id }.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

const MAX_TITLE = 120;
const MAX_BODY = 8000;
const MAX_TOPIC = 80;

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
  if (!user) return json(401, { error: 'Sign in to start a discussion.' });

  let payload: { title?: unknown; body?: unknown; topic?: unknown };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';

  if (!title) return json(400, { error: 'Please give your discussion a title.' });
  if (title.length > MAX_TITLE) {
    return json(400, { error: `Title is too long (max ${MAX_TITLE} characters).` });
  }
  if (!body) return json(400, { error: 'Please write the opening post.' });
  if (body.length > MAX_BODY) {
    return json(400, { error: `Opening post is too long (max ${MAX_BODY} characters).` });
  }
  if (topic && topic.length > MAX_TOPIC) {
    return json(400, { error: `Topic is too long (max ${MAX_TOPIC} characters).` });
  }

  const { data, error } = await supabase
    .from('discussions')
    .insert({
      user_id: user.id,
      title,
      body,
      topic: topic || null,
    })
    .select('id, ticket_number')
    .single();

  if (error || !data) {
    return json(500, {
      error: error?.message || 'Could not record your discussion. Please try again.',
    });
  }

  return json(200, {
    id: data.id,
    ticket_number: data.ticket_number,
  });
};
