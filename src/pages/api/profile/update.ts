// Site Update v33 — Patron profile-editor endpoint.
//
// POST /api/profile/update
// body: { display_name?, bio?, is_public_profile? }
//
// Validates the fields, then updates public.profiles for the current user.
// is_public_profile = true means the patron's /p/{patron-number}/ public page
// becomes visible (the public read policy is gated on this flag).

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../../lib/supabase';

export const prerender = false;

const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 500;

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

  let payload: {
    display_name?: unknown;
    bio?: unknown;
    is_public_profile?: unknown;
  };
  try {
    payload = await Astro.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const update: Record<string, string | boolean | null> = {};

  if (payload.display_name !== undefined) {
    if (typeof payload.display_name !== 'string') {
      return json(400, { error: 'display_name must be a string.' });
    }
    const trimmed = payload.display_name.trim();
    if (trimmed.length < 1) {
      return json(400, { error: 'Display name cannot be empty.' });
    }
    if (trimmed.length > MAX_DISPLAY_NAME) {
      return json(400, {
        error: `Display name is too long (max ${MAX_DISPLAY_NAME} characters).`,
      });
    }
    update.display_name = trimmed;
  }

  if (payload.bio !== undefined) {
    if (typeof payload.bio !== 'string') {
      return json(400, { error: 'bio must be a string.' });
    }
    const trimmed = payload.bio.trim();
    if (trimmed.length > MAX_BIO) {
      return json(400, {
        error: `Bio is too long (max ${MAX_BIO} characters).`,
      });
    }
    update.bio = trimmed.length > 0 ? trimmed : null;
  }

  if (payload.is_public_profile !== undefined) {
    if (typeof payload.is_public_profile !== 'boolean') {
      return json(400, { error: 'is_public_profile must be a boolean.' });
    }
    update.is_public_profile = payload.is_public_profile;
  }

  if (Object.keys(update).length === 0) {
    return json(400, { error: 'No fields provided to update.' });
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true });
};
