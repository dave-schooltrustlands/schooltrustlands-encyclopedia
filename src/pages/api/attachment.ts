// Site Update v32 — File-attachment upload endpoint.
//
// Accepts multipart/form-data POSTs:
//   parent_type: 'feedback' | 'correction' | 'review'
//   parent_id:   uuid of the parent row
//   file:        a single file (the client makes N parallel requests for N files)
//
// The handler:
//   1. Verifies a signed-in session.
//   2. Validates parent_type and that the caller OWNS the parent row.
//   3. Validates content_type whitelist and byte size (<= 10 MB).
//   4. Generates a uuid for the attachment, builds the canonical storage path:
//        {user.id}/{parent_type}/{parent_id}/{file_id}-{sanitized_name}
//   5. Uploads to the `attachments` storage bucket.
//   6. Inserts a file_attachments row.
//   7. Returns { id, storage_path, file_name, content_type, byte_size }.
//
// The storage bucket itself ('attachments') must be created manually in the
// Supabase dashboard (Storage → New bucket → Private). If the upload fails
// because the bucket does not exist, we surface a clear error so the head
// librarian knows to create it.

import type { APIRoute } from 'astro';
import { getServerSupabase } from '../../lib/supabase';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PARENTS = new Set(['feedback', 'correction', 'review']);
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// parent_type → table name (1:1 today, but mapped explicitly so future
// renames don't accidentally break ownership verification).
const PARENT_TABLES: Record<string, string> = {
  feedback: 'feedback',
  correction: 'corrections',
  review: 'reviews',
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sanitizeFileName(name: string): string {
  // Keep extension and alnum/dot/dash/underscore. Replace anything else with
  // an underscore. Cap to 120 chars so storage paths stay sane.
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_');
  if (cleaned.length <= 120) return cleaned || 'file';
  // Preserve the extension if the cap kicks in.
  const dot = cleaned.lastIndexOf('.');
  if (dot > 0 && cleaned.length - dot <= 10) {
    return cleaned.slice(0, 120 - (cleaned.length - dot)) + cleaned.slice(dot);
  }
  return cleaned.slice(0, 120);
}

export const POST: APIRoute = async (Astro) => {
  const supabase = getServerSupabase(Astro);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { error: 'Sign in required to upload attachments.' });

  let form: FormData;
  try {
    form = await Astro.request.formData();
  } catch {
    return json(400, { error: 'Expected multipart/form-data body.' });
  }

  const parentType = String(form.get('parent_type') ?? '').trim();
  const parentId = String(form.get('parent_id') ?? '').trim();
  const fileField = form.get('file');

  if (!ALLOWED_PARENTS.has(parentType)) {
    return json(400, { error: 'Invalid parent_type.' });
  }
  if (!parentId) {
    return json(400, { error: 'Missing parent_id.' });
  }
  if (!(fileField instanceof File)) {
    return json(400, { error: 'Missing file.' });
  }

  const file = fileField as File;
  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return json(400, {
      error:
        'Unsupported file type. Allowed: PDF, JPG, PNG, TXT, DOCX.',
    });
  }
  if (file.size <= 0) {
    return json(400, { error: 'Empty file.' });
  }
  if (file.size > MAX_BYTES) {
    return json(400, { error: 'File too large (max 10 MB).' });
  }

  // Ownership check: the caller must own the parent row. RLS would catch
  // a cross-tenant insert into file_attachments anyway, but we'd rather
  // 403 here than burn a Storage upload first.
  const parentTable = PARENT_TABLES[parentType];
  const { data: parentRow, error: parentErr } = await supabase
    .from(parentTable)
    .select('id, user_id')
    .eq('id', parentId)
    .maybeSingle();
  if (parentErr) {
    return json(500, { error: parentErr.message });
  }
  if (!parentRow || parentRow.user_id !== user.id) {
    return json(404, { error: 'Parent ticket not found.' });
  }

  // Generate a uuid for the attachment row (and the storage filename
  // prefix). crypto.randomUUID is available in the Cloudflare Workers
  // runtime and modern Node.
  const fileId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : // Fallback: timestamp + random. Not RFC 4122 but unique enough.
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const safeName = sanitizeFileName(file.name || 'file');
  const storagePath = `${user.id}/${parentType}/${parentId}/${fileId}-${safeName}`;

  // Convert to an ArrayBuffer so Supabase's storage client can hand it to
  // fetch as a Blob/Buffer body uniformly across Node + edge runtimes.
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from('attachments')
    .upload(storagePath, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadErr) {
    // The bucket is created manually (Supabase dashboard). If it doesn't
    // exist yet, surface a clear, actionable error instead of the raw
    // "Bucket not found" string. The migration writes the storage
    // policies but cannot create the bucket itself.
    const message = uploadErr.message || '';
    if (/bucket/i.test(message) && /not found|does not exist/i.test(message)) {
      return json(503, {
        error:
          'Attachments are not yet enabled — please ask the head librarian to create the storage bucket.',
      });
    }
    return json(500, { error: message || 'Upload failed.' });
  }

  // Insert the metadata row. RLS enforces user_id = auth.uid().
  const { data: row, error: insertErr } = await supabase
    .from('file_attachments')
    .insert({
      id: fileId,
      parent_type: parentType,
      parent_id: parentId,
      user_id: user.id,
      storage_path: storagePath,
      file_name: safeName,
      content_type: contentType,
      byte_size: file.size,
    })
    .select('id, storage_path, file_name, content_type, byte_size')
    .single();

  if (insertErr || !row) {
    // Best-effort cleanup of the orphan Storage object so the next retry
    // doesn't trip the "object already exists" path.
    await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
    return json(500, {
      error: insertErr?.message || 'Could not record the attachment.',
    });
  }

  return json(200, row);
};
