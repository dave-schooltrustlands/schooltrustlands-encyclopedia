// Attachments for the private office: what may be stored, how it is stored in
// the private bucket, and how it is streamed back out to someone who has
// already been authorised by the caller.
//
// Rules that matter for safety:
//  - The server decides the content type from the file extension. The type the
//    sender claims is ignored, and anything that a browser could run as a page
//    (HTML, SVG, scripts) is not accepted at all.
//  - A file is never served from a public bucket address. Every download goes
//    through a route that checks who is asking first.
//  - File names never become part of the storage key.
import { LIMITS, R2_PREFIX, type OfficeEnv } from './config';
import { apiError, cleanLine, newId, nowIso } from './util';

interface FileType {
  type: string;
  /** Safe to show in the browser (images, audio, video, PDF, plain text). */
  inline?: true;
  /** Can be sent for transcription. */
  audio?: true;
}

export const FILE_TYPES: Record<string, FileType> = {
  // Documents
  pdf: { type: 'application/pdf', inline: true },
  txt: { type: 'text/plain; charset=utf-8', inline: true },
  md: { type: 'text/plain; charset=utf-8', inline: true },
  csv: { type: 'text/csv; charset=utf-8' },
  tsv: { type: 'text/tab-separated-values; charset=utf-8' },
  json: { type: 'application/json' },
  rtf: { type: 'application/rtf' },
  doc: { type: 'application/msword' },
  docx: { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xls: { type: 'application/vnd.ms-excel' },
  xlsx: { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ppt: { type: 'application/vnd.ms-powerpoint' },
  pptx: { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  odt: { type: 'application/vnd.oasis.opendocument.text' },
  ods: { type: 'application/vnd.oasis.opendocument.spreadsheet' },
  // Images (no SVG: it can carry script)
  png: { type: 'image/png', inline: true },
  jpg: { type: 'image/jpeg', inline: true },
  jpeg: { type: 'image/jpeg', inline: true },
  gif: { type: 'image/gif', inline: true },
  webp: { type: 'image/webp', inline: true },
  tif: { type: 'image/tiff' },
  tiff: { type: 'image/tiff' },
  heic: { type: 'image/heic' },
  // Audio and video
  mp3: { type: 'audio/mpeg', inline: true, audio: true },
  m4a: { type: 'audio/mp4', inline: true, audio: true },
  wav: { type: 'audio/wav', inline: true, audio: true },
  ogg: { type: 'audio/ogg', inline: true, audio: true },
  oga: { type: 'audio/ogg', inline: true, audio: true },
  opus: { type: 'audio/ogg', inline: true, audio: true },
  webm: { type: 'video/webm', inline: true, audio: true },
  mp4: { type: 'video/mp4', inline: true, audio: true },
  mov: { type: 'video/quicktime' },
  // Maps and archives
  kml: { type: 'application/vnd.google-earth.kml+xml' },
  kmz: { type: 'application/vnd.google-earth.kmz' },
  gpx: { type: 'application/gpx+xml' },
  geojson: { type: 'application/geo+json' },
  zip: { type: 'application/zip' },
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_TYPES).sort();

export interface SafeName {
  name: string;
  ext: string;
}

/** Reduces whatever the sender called the file to a plain, bounded display name. */
export function safeFilename(raw: unknown): SafeName | null {
  let s = raw == null ? '' : String(raw);
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep the undecoded text */
  }
  s = s.split(/[\\/]/).pop() || '';
  s = cleanLine(s, 400).replace(/[<>:"|?*]/g, '_').replace(/^\.+/, '');
  const dot = s.lastIndexOf('.');
  if (dot <= 0 || dot === s.length - 1) return null;
  const ext = s.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return null;
  const base = s.slice(0, dot).trim().slice(0, 110) || 'file';
  return { name: `${base}.${ext}`, ext };
}

export function typeFor(ext: string, kind: 'file' | 'voice'): FileType | null {
  const t = FILE_TYPES[ext];
  if (!t) return null;
  // A recording made in the browser arrives as .webm or .mp4 but is audio only.
  if (kind === 'voice' && ext === 'webm') return { ...t, type: 'audio/webm' };
  if (kind === 'voice' && ext === 'mp4') return { ...t, type: 'audio/mp4' };
  return t;
}

export function isInline(contentType: string): boolean {
  return Object.values(FILE_TYPES).some((t) => t.inline && t.type === contentType) || contentType === 'audio/webm';
}

export function isAudio(row: { filename?: unknown; content_type?: unknown }): boolean {
  const name = String(row.filename || '');
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return !!FILE_TYPES[ext]?.audio || String(row.content_type || '').startsWith('audio/');
}

export function isImage(contentType: string): boolean {
  return /^image\/(png|jpeg|gif|webp)$/.test(contentType);
}

export interface StoredAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  kind: 'file' | 'voice';
  created_at: string;
}

export interface StoreOptions {
  filename: unknown;
  kind: 'file' | 'voice';
  uploaderKind: 'owner' | 'bot';
  uploadedBy: string;
  /** Set for bot uploads (which always belong to a claimed request). */
  requestId: string | null;
}

/**
 * Streams the raw request body into the private bucket and records it.
 * The body is the file itself (not a form), so nothing is buffered in memory.
 * Returns the new attachment or a ready-to-send error response.
 */
export async function storeUpload(
  env: OfficeEnv,
  request: Request,
  opts: StoreOptions,
): Promise<StoredAttachment | Response> {
  const declared = Number(request.headers.get('content-length'));
  if (!request.body || !Number.isFinite(declared) || declared <= 0) {
    return apiError(411, 'length_required', 'Send the file as the request body with a Content-Length.');
  }
  if (declared > LIMITS.fileBytes) {
    return apiError(413, 'too_large', `Files can be up to ${Math.round(LIMITS.fileBytes / 1048576)} MB.`, {
      max_bytes: LIMITS.fileBytes,
    });
  }
  const safe = safeFilename(opts.filename);
  if (!safe) return apiError(400, 'bad_filename', 'Give the file a name with an extension, e.g. ?filename=notes.pdf');
  const type = typeFor(safe.ext, opts.kind);
  if (!type) {
    return apiError(415, 'unsupported_type', `Files ending in .${safe.ext} are not accepted here.`, {
      allowed_extensions: ALLOWED_EXTENSIONS,
    });
  }
  if (opts.kind === 'voice' && !type.audio) {
    return apiError(415, 'unsupported_type', 'A voice recording must be an audio file.');
  }

  const id = newId('a');
  const created = nowIso();
  const key = `${R2_PREFIX}attachments/${created.slice(0, 4)}/${created.slice(5, 7)}/${id}`;
  let stored: any;
  try {
    stored = await env.OFFICE_BUCKET.put(key, request.body, {
      httpMetadata: { contentType: type.type },
      customMetadata: { uploader: opts.uploaderKind },
    });
  } catch {
    return apiError(500, 'storage_error', 'The file could not be stored. Please try again.');
  }
  const size = Number(stored?.size ?? declared);
  if (!size || size > LIMITS.fileBytes) {
    await env.OFFICE_BUCKET.delete(key).catch(() => undefined);
    return apiError(size ? 413 : 400, size ? 'too_large' : 'empty_file', size ? 'That file is too large.' : 'That file is empty.');
  }

  try {
    await env.OFFICE_DB.prepare(
      `INSERT INTO attachments (id, request_id, message_id, uploader_kind, uploaded_by, kind, r2_key, filename, content_type, size, etag, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, opts.requestId, opts.uploaderKind, opts.uploadedBy, opts.kind, key, safe.name, type.type, size, stored?.etag ?? null, created)
      .run();
  } catch {
    await env.OFFICE_BUCKET.delete(key).catch(() => undefined);
    return apiError(500, 'storage_error', 'The file could not be recorded. Please try again.');
  }
  return { id, filename: safe.name, content_type: type.type, size, kind: opts.kind, created_at: created };
}

export function contentDisposition(filename: string, inline: boolean): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const star = encodeURIComponent(filename).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${star}`;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // ignore forms we do not support
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!suffix) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

export interface AttachmentRow {
  id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size: number;
}

/** Streams a stored file. The caller has already decided this person may have it. */
export async function serveAttachment(env: OfficeEnv, request: Request, row: AttachmentRow): Promise<Response> {
  const range = parseRange(request.headers.get('range'), row.size);
  // ?download=1 asks for a plain download (the "Download" link on a thread page).
  const inline = isInline(row.content_type) && new URL(request.url).searchParams.get('download') !== '1';
  const headers: Record<string, string> = {
    'content-type': row.content_type,
    'content-disposition': contentDisposition(row.filename, inline),
    'accept-ranges': 'bytes',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    // If someone opens the file directly, it may not run script or load anything.
    // (No sandbox for PDF: browsers' built-in PDF viewers refuse to open sandboxed.)
    'content-security-policy':
      row.content_type === 'application/pdf'
        ? "default-src 'none'; frame-ancestors 'none'"
        : "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'",
  };
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${row.size}` } });
  }
  const obj = await env.OFFICE_BUCKET.get(
    row.r2_key,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!obj) return apiError(404, 'not_found', 'That file is no longer stored.');
  if (range) {
    headers['content-range'] = `bytes ${range.start}-${range.end}/${row.size}`;
    headers['content-length'] = String(range.end - range.start + 1);
    return new Response(obj.body, { status: 206, headers });
  }
  headers['content-length'] = String(row.size);
  return new Response(request.method === 'HEAD' ? null : obj.body, { status: 200, headers });
}

/** Removes stored bytes for a set of attachment rows. Row cleanup is the caller's job. */
export async function deleteObjects(env: OfficeEnv, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 500) {
    await env.OFFICE_BUCKET.delete(keys.slice(i, i + 500));
  }
}
