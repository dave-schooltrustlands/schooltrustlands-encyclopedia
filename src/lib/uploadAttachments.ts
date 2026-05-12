// Site Update v32 — Client-side helper for uploading FileUpload selections.
//
// Used by FeedbackLink, CorrectionLink, and the review form. After the
// parent insert succeeds and returns parent_id, call:
//
//     await uploadFilesFor('feedback', ticketId, fileInput, {
//       onProgress: (done, total) => { ... },
//     });
//
// Each file becomes a separate POST to /api/attachment. Uploads run
// sequentially (not parallel) — keeps the progress counter monotonic and
// avoids overwhelming the Cloudflare Worker concurrency limit per request.

export interface UploadResult {
  id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  byte_size: number;
}

export interface UploadOutcome {
  uploaded: UploadResult[];
  failed: { file_name: string; error: string }[];
}

export interface UploadOptions {
  onProgress?: (done: number, total: number) => void;
}

export async function uploadFilesFor(
  parentType: 'feedback' | 'correction' | 'review',
  parentId: string,
  fileInput: HTMLInputElement | null | undefined,
  options: UploadOptions = {}
): Promise<UploadOutcome> {
  const out: UploadOutcome = { uploaded: [], failed: [] };
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return out;
  }

  const files = Array.from(fileInput.files);
  const total = files.length;
  options.onProgress?.(0, total);

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const fd = new FormData();
    fd.append('parent_type', parentType);
    fd.append('parent_id', parentId);
    fd.append('file', file);

    try {
      const res = await fetch('/api/attachment', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        out.failed.push({
          file_name: file.name,
          error: (data && data.error) || `HTTP ${res.status}`,
        });
      } else {
        out.uploaded.push(data as UploadResult);
      }
    } catch (err) {
      out.failed.push({
        file_name: file.name,
        error: err instanceof Error ? err.message : 'Network error',
      });
    }
    options.onProgress?.(i + 1, total);
  }

  return out;
}
