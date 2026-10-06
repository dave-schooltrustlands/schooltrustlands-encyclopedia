// Who may see and change what inside the office. One place, so every page and
// endpoint asks the same questions the same way.
//
//   Owner  - sees and changes only their own threads and files.
//   Admin  - manages bots, tokens, and publication decisions. Reads the
//            owner's threads only if OFFICE_ADMIN_CAN_READ is on; never
//            writes in them. Always sees a reply that was nominated for
//            publication, because nominating it is asking for that review.
//   Bot    - handled separately (src/pages/api/office/bot/*): a bot sees only
//            requests addressed to it.
import type { OfficeUser } from './config';
import { parseIdArray, type Row } from './db';

export function canReadRequest(user: OfficeUser, request: Row): boolean {
  return (user.isOwner && request.owner_email === user.email) || user.adminCanRead;
}

export function canWriteRequest(user: OfficeUser, request: Row): boolean {
  return user.isOwner && request.owner_email === user.email;
}

export function canNominate(user: OfficeUser, request: Row): boolean {
  return canWriteRequest(user, request) || user.adminCanRead;
}

export async function canReadAttachment(db: any, user: OfficeUser, att: Row): Promise<boolean> {
  // Not sent yet: only the person who uploaded it. (A bot's upload that has
  // not been used in a reply yet is not shown to anyone.)
  if (!att.message_id) return att.uploader_kind === 'owner' && att.uploaded_by === user.email && !att.request_id;
  const request = await db.prepare('SELECT id, owner_email FROM requests WHERE id = ?').bind(att.request_id).first();
  if (!request) return false;
  if (canReadRequest(user, request)) return true;
  if (user.isAdmin) {
    // An admin who cannot read the office may still open the files that were
    // offered with a suggested reply, and only those.
    const open = await db
      .prepare(`SELECT attachment_ids FROM publications WHERE message_id = ? AND state IN ('nominated','approved')`)
      .bind(att.message_id)
      .all();
    return ((open.results || []) as Row[]).some((p) => parseIdArray(p.attachment_ids).includes(att.id));
  }
  return false;
}
