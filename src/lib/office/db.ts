// Data access for the private office (Cloudflare D1, binding OFFICE_DB).
//
// Every state change that must not half-happen goes through db.batch(), which
// D1 runs as one transaction. The claim and reply statements carry their own
// guards in the WHERE clause, so two bot runs can never both win a request.
import { LIMITS, type OfficeEnv, type RequestStatus } from './config';
import { deleteObjects } from './files';
import { botUsable, emailListed } from './policy';
import { isoIn, newId, nowIso, randomToken, sha256Hex } from './util';

export type Row = Record<string, any>;
type DB = any;

// ---------------------------------------------------------------- audit log

export interface AuditEntry {
  actor_kind: 'owner' | 'admin' | 'bot' | 'system' | 'unknown';
  actor_id?: string;
  action: string;
  request_id?: string | null;
  target_id?: string | null;
  ip?: string | null;
  /** Ids, counts, sizes, statuses only. Never content. */
  meta?: Record<string, unknown>;
}

export function auditStmt(db: DB, e: AuditEntry): any {
  return db
    .prepare('INSERT INTO audit_log (at, actor_kind, actor_id, action, request_id, target_id, ip, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(nowIso(), e.actor_kind, e.actor_id || '', e.action, e.request_id ?? null, e.target_id ?? null, e.ip ?? null, e.meta ? JSON.stringify(e.meta) : null);
}

export async function audit(db: DB, e: AuditEntry): Promise<void> {
  try {
    await auditStmt(db, e).run();
  } catch {
    /* the audit trail must never break the action it records */
  }
}

// --------------------------------------------------------------- rate limits

/** Counts one event and returns the total for the current window. */
export async function rateHit(db: DB, key: string, windowSeconds: number): Promise<number> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (k, window_start, n) VALUES (?, ?, 1)
       ON CONFLICT(k) DO UPDATE SET
         n = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.n + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING n`,
    )
    .bind(key, windowStart)
    .first();
  return Number(row?.n || 1);
}

/** Reads the current count without adding to it. */
export async function ratePeek(db: DB, key: string, windowSeconds: number): Promise<number> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const row = await db.prepare('SELECT n FROM rate_limits WHERE k = ? AND window_start = ?').bind(key, windowStart).first();
  return Number(row?.n || 0);
}

/** True when this event puts the caller over the limit. */
export async function overLimit(db: DB, key: string, limit: readonly [number, number]): Promise<boolean> {
  return (await rateHit(db, key, limit[1])) > limit[0];
}

// ---------------------------------------------------------------------- bots

export async function listBots(db: DB, enabledOnly: boolean): Promise<Row[]> {
  const res = await db
    .prepare(`SELECT id, name, description, enabled, sort, webhook_url, webhook_key_version, agent_id, created_by, created_at, updated_at
              FROM bots ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY sort, name`)
    .all();
  return res.results || [];
}

/** Bots the owner may pick: enabled and allowed by the office bot policy. */
export async function listUsableBots(db: DB, env: Pick<OfficeEnv, 'OFFICE_OWNER_EMAILS'>): Promise<Row[]> {
  return (await listBots(db, true)).filter((b) => botUsable(b, env));
}

export async function getBot(db: DB, id: string): Promise<Row | null> {
  return (await db.prepare('SELECT * FROM bots WHERE id = ?').bind(id).first()) || null;
}

// ------------------------------------------------------------------ requests

const REQUEST_COLUMNS = `r.id, r.owner_email, r.bot_id, r.title, r.status, r.status_note, r.attempts,
  r.lease_expires_at, r.claimed_at, r.queued_at, r.answered_at, r.owner_unread, r.created_at, r.updated_at`;

/**
 * Marks requests failed when a bot has claimed them the maximum number of
 * times and let every lease run out. Cheap; called before lists are shown.
 */
export async function expireStale(db: DB): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE requests SET status = 'failed', status_note = 'lease_expired', lease_token_hash = NULL,
              lease_expires_at = NULL, owner_unread = 1, updated_at = ?
       WHERE status IN ('claimed','in_progress') AND lease_expires_at < ? AND attempts >= ?`,
    )
    .bind(now, now, LIMITS.maxAttempts)
    .run();
}

export async function listRequests(db: DB, ownerEmail: string | null): Promise<Row[]> {
  const sql = `SELECT ${REQUEST_COLUMNS}, b.name AS bot_name,
      (SELECT COUNT(*) FROM messages m WHERE m.request_id = r.id) AS message_count
    FROM requests r JOIN bots b ON b.id = r.bot_id
    ${ownerEmail ? 'WHERE r.owner_email = ?' : ''}
    ORDER BY r.updated_at DESC LIMIT 300`;
  const stmt = ownerEmail ? db.prepare(sql).bind(ownerEmail) : db.prepare(sql);
  return (await stmt.all()).results || [];
}

export async function getRequest(db: DB, id: string): Promise<Row | null> {
  return (
    (await db
      .prepare(`SELECT ${REQUEST_COLUMNS}, r.lease_token_hash, b.name AS bot_name FROM requests r JOIN bots b ON b.id = r.bot_id WHERE r.id = ?`)
      .bind(id)
      .first()) || null
  );
}

export interface Thread {
  request: Row;
  messages: Row[];
  /** Attachments grouped by message id. */
  files: Map<string, Row[]>;
  /** Publication rows keyed by message id (latest per message). */
  publications: Map<string, Row>;
}

export async function getThread(db: DB, id: string): Promise<Thread | null> {
  const request = await getRequest(db, id);
  if (!request) return null;
  const [msgs, atts, pubs] = await db.batch([
    db.prepare('SELECT id, author_kind, author_id, kind, body, created_at FROM messages WHERE request_id = ? ORDER BY created_at, id').bind(id),
    db.prepare(`SELECT id, message_id, uploader_kind, kind, filename, content_type, size, transcript, created_at
                FROM attachments WHERE request_id = ? AND message_id IS NOT NULL ORDER BY created_at, id`).bind(id),
    db.prepare('SELECT * FROM publications WHERE request_id = ? ORDER BY nominated_at').bind(id),
  ]);
  const files = new Map<string, Row[]>();
  for (const a of (atts.results || []) as Row[]) {
    const list = files.get(a.message_id) || [];
    list.push(a);
    files.set(a.message_id, list);
  }
  const publications = new Map<string, Row>();
  for (const p of (pubs.results || []) as Row[]) publications.set(p.message_id, p);
  return { request, messages: (msgs.results || []) as Row[], files, publications };
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

/** The owner's own uploads that have not been sent with a message yet. */
export async function pendingOwnerUploads(db: DB, email: string, ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  const res = await db
    .prepare(`SELECT id, kind FROM attachments WHERE id IN (${placeholders(ids.length)})
              AND uploader_kind = 'owner' AND uploaded_by = ? AND message_id IS NULL AND request_id IS NULL`)
    .bind(...ids, email)
    .all();
  return res.results || [];
}

async function findByIdempotency(db: DB, authorKind: string, authorId: string, key: string | null): Promise<Row | null> {
  if (!key) return null;
  return (
    (await db
      .prepare('SELECT id, request_id, kind, created_at FROM messages WHERE author_kind = ? AND author_id = ? AND idempotency_key = ?')
      .bind(authorKind, authorId, key)
      .first()) || null
  );
}

export interface OwnerMessageInput {
  email: string;
  body: string;
  attachmentIds: string[];
  clientKey: string | null;
  ip: string;
}

export async function createRequest(
  db: DB,
  input: OwnerMessageInput & { botId: string; title: string },
): Promise<{ id: string; replayed: boolean }> {
  const prior = await findByIdempotency(db, 'owner', input.email, input.clientKey);
  if (prior) return { id: prior.request_id, replayed: true };

  const id = newId('r');
  const messageId = newId('m');
  const now = nowIso();
  const stmts = [
    db
      .prepare(`INSERT INTO requests (id, owner_email, bot_id, title, status, attempts, queued_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?)`)
      .bind(id, input.email, input.botId, input.title, now, now, now),
    db
      .prepare(`INSERT INTO messages (id, request_id, author_kind, author_id, kind, body, idempotency_key, created_at)
                VALUES (?, ?, 'owner', ?, 'prompt', ?, ?, ?)`)
      .bind(messageId, id, input.email, input.body, input.clientKey, now),
  ];
  if (input.attachmentIds.length) {
    stmts.push(
      db
        .prepare(`UPDATE attachments SET request_id = ?, message_id = ? WHERE id IN (${placeholders(input.attachmentIds.length)})
                  AND uploader_kind = 'owner' AND uploaded_by = ? AND message_id IS NULL AND request_id IS NULL`)
        .bind(id, messageId, ...input.attachmentIds, input.email),
    );
  }
  stmts.push(
    auditStmt(db, {
      actor_kind: 'owner', actor_id: input.email, action: 'request.created', request_id: id, target_id: messageId, ip: input.ip,
      meta: { bot: input.botId, chars: input.body.length, files: input.attachmentIds.length },
    }),
  );
  try {
    await db.batch(stmts);
  } catch (err) {
    // Two identical sends raced; the unique index let exactly one through.
    const again = await findByIdempotency(db, 'owner', input.email, input.clientKey);
    if (again) return { id: again.request_id, replayed: true };
    throw err;
  }
  return { id, replayed: false };
}

/**
 * Adds the owner's follow-up to a thread. If the bot had finished (answered,
 * asked a question, or failed) the request goes back in the queue. That
 * decision is made by the database inside the same transaction as the insert,
 * not from a status read earlier, so it cannot race with a bot's reply. If a
 * bot is holding the request right now the status is left alone; see botReply
 * for how the follow-up is still guaranteed to be seen.
 */
export async function addOwnerMessage(
  db: DB,
  request: Row,
  input: OwnerMessageInput,
): Promise<{ messageId: string; requeued: boolean; replayed: boolean }> {
  const prior = await findByIdempotency(db, 'owner', input.email, input.clientKey);
  if (prior) return { messageId: prior.id, requeued: false, replayed: true };

  const messageId = newId('m');
  const now = nowIso();
  const stmts = [
    db
      .prepare(`INSERT INTO messages (id, request_id, author_kind, author_id, kind, body, idempotency_key, created_at)
                VALUES (?, ?, 'owner', ?, 'followup', ?, ?, ?)`)
      .bind(messageId, request.id, input.email, input.body, input.clientKey, now),
    db
      .prepare(`UPDATE requests SET status = 'queued', status_note = NULL, attempts = 0, queued_at = ?,
                       lease_token_hash = NULL, lease_expires_at = NULL
                WHERE id = ? AND status IN ('answered','needs_info','failed')`)
      .bind(now, request.id),
    db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').bind(now, request.id),
  ];
  if (input.attachmentIds.length) {
    stmts.push(
      db
        .prepare(`UPDATE attachments SET request_id = ?, message_id = ? WHERE id IN (${placeholders(input.attachmentIds.length)})
                  AND uploader_kind = 'owner' AND uploaded_by = ? AND message_id IS NULL AND request_id IS NULL`)
        .bind(request.id, messageId, ...input.attachmentIds, input.email),
    );
  }
  let results: any[];
  try {
    results = await db.batch(stmts);
  } catch (err) {
    const again = await findByIdempotency(db, 'owner', input.email, input.clientKey);
    if (again) return { messageId: again.id, requeued: false, replayed: true };
    throw err;
  }
  const requeued = Number(results[1]?.meta?.changes || 0) === 1;
  await audit(db, {
    actor_kind: 'owner', actor_id: input.email, action: 'message.added', request_id: request.id, target_id: messageId, ip: input.ip,
    meta: { chars: input.body.length, files: input.attachmentIds.length, requeued },
  });
  return { messageId, requeued, replayed: false };
}

export async function retryRequest(db: DB, id: string): Promise<boolean> {
  const now = nowIso();
  const res = await db
    .prepare(`UPDATE requests SET status = 'queued', status_note = NULL, attempts = 0, queued_at = ?, updated_at = ?,
                     lease_token_hash = NULL, lease_expires_at = NULL
              WHERE id = ? AND status = 'failed'`)
    .bind(now, now, id)
    .run();
  return Number(res.meta?.changes || 0) === 1;
}

export async function markRead(db: DB, id: string): Promise<void> {
  await db.prepare('UPDATE requests SET owner_unread = 0 WHERE id = ? AND owner_unread = 1').bind(id).run();
}

/**
 * Removes a thread for good. The rows go first, in one transaction, and hand
 * back the storage keys of the files they pointed at; the stored bytes are
 * removed straight after. Doing it in that order means a file can never be
 * left reachable through a row once the delete has been confirmed.
 */
export async function deleteRequest(env: OfficeEnv, id: string): Promise<{ files: number; messages: number }> {
  const db = env.OFFICE_DB;
  const results = await db.batch([
    db.prepare('DELETE FROM publications WHERE request_id = ?').bind(id),
    db.prepare('DELETE FROM attachments WHERE request_id = ? RETURNING r2_key').bind(id),
    db.prepare('DELETE FROM messages WHERE request_id = ?').bind(id),
    db.prepare('DELETE FROM requests WHERE id = ?').bind(id),
  ]);
  const keys = ((results[1]?.results || []) as Row[]).map((r) => String(r.r2_key));
  await purgeObjects(env, keys, id);
  return { files: keys.length, messages: Number(results[2]?.meta?.changes || 0) };
}

/** Deletes stored bytes whose rows are already gone. A failure is recorded so the leftovers can be removed by hand. */
async function purgeObjects(env: OfficeEnv, keys: string[], requestId: string | null): Promise<void> {
  if (!keys.length) return;
  try {
    await deleteObjects(env, keys);
  } catch {
    await audit(env.OFFICE_DB, { actor_kind: 'system', action: 'storage.leftover', request_id: requestId, meta: { keys: keys.slice(0, 40) } });
  }
}

// ------------------------------------------------------------------ bot side

/** Requests this bot may claim now: queued ones, plus any whose lease ran out. */
export async function listClaimable(db: DB, botId: string, limit: number): Promise<Row[]> {
  const now = nowIso();
  const res = await db
    .prepare(
      `SELECT r.id, r.title, r.status, r.attempts, r.queued_at, r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.request_id = r.id) AS message_count
       FROM requests r
       WHERE r.bot_id = ? AND r.attempts < ?
         AND (r.status = 'queued' OR (r.status IN ('claimed','in_progress') AND r.lease_expires_at < ?))
       ORDER BY r.queued_at, r.id LIMIT ?`,
    )
    .bind(botId, LIMITS.maxAttempts, now, limit)
    .all();
  return res.results || [];
}

export async function listByStatus(db: DB, botId: string, status: RequestStatus, limit: number): Promise<Row[]> {
  const res = await db
    .prepare(
      `SELECT r.id, r.title, r.status, r.attempts, r.queued_at, r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.request_id = r.id) AS message_count
       FROM requests r WHERE r.bot_id = ? AND r.status = ? ORDER BY r.updated_at DESC LIMIT ?`,
    )
    .bind(botId, status, limit)
    .all();
  return res.results || [];
}

export function clampLease(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return LIMITS.leaseDefaultSeconds;
  return Math.min(LIMITS.leaseMaxSeconds, Math.max(LIMITS.leaseMinSeconds, n));
}

/**
 * Atomically hands a request to one bot run. The single UPDATE only matches a
 * request that is free (queued, or held under an expired lease), so if two
 * runs call this at once exactly one sees changes = 1.
 */
export async function claimRequest(
  db: DB,
  botId: string,
  id: string,
  leaseSeconds: number,
): Promise<{ leaseToken: string; leaseExpiresAt: string } | null> {
  const leaseToken = 'ofl_' + randomToken(24);
  const now = nowIso();
  const leaseExpiresAt = isoIn(leaseSeconds);
  const res = await db
    .prepare(
      `UPDATE requests SET status = 'claimed', status_note = NULL, lease_token_hash = ?, lease_expires_at = ?,
              claimed_at = ?, attempts = attempts + 1, updated_at = ?,
              claimed_seq = (SELECT COALESCE(MAX(m.rowid), 0) FROM messages m WHERE m.request_id = requests.id)
       WHERE id = ? AND bot_id = ? AND attempts < ?
         AND (status = 'queued' OR (status IN ('claimed','in_progress') AND lease_expires_at < ?))`,
    )
    .bind(await sha256Hex(leaseToken), leaseExpiresAt, now, now, id, botId, LIMITS.maxAttempts, now)
    .run();
  if (Number(res.meta?.changes || 0) !== 1) return null;
  return { leaseToken, leaseExpiresAt };
}

/** Extends a lease the bot still holds. Optionally reports that work has started. */
export async function heartbeat(
  db: DB,
  botId: string,
  id: string,
  leaseToken: string,
  leaseSeconds: number,
): Promise<string | null> {
  const leaseExpiresAt = isoIn(leaseSeconds);
  const res = await db
    .prepare(
      `UPDATE requests SET status = 'in_progress', lease_expires_at = ?, updated_at = ?
       WHERE id = ? AND bot_id = ? AND lease_token_hash = ? AND status IN ('claimed','in_progress')`,
    )
    .bind(leaseExpiresAt, nowIso(), id, botId, await sha256Hex(leaseToken))
    .run();
  return Number(res.meta?.changes || 0) === 1 ? leaseExpiresAt : null;
}

/** Gives a claimed request back to the queue without answering it. */
export async function releaseRequest(db: DB, botId: string, id: string, leaseToken: string): Promise<boolean> {
  const now = nowIso();
  const res = await db
    .prepare(
      `UPDATE requests SET status = 'queued', lease_token_hash = NULL, lease_expires_at = NULL, updated_at = ?,
              attempts = MAX(attempts - 1, 0)
       WHERE id = ? AND bot_id = ? AND lease_token_hash = ? AND status IN ('claimed','in_progress')`,
    )
    .bind(now, id, botId, await sha256Hex(leaseToken))
    .run();
  return Number(res.meta?.changes || 0) === 1;
}

export interface BotReplyInput {
  botId: string;
  request: Row;
  leaseToken: string;
  status: 'answered' | 'needs_info' | 'failed' | 'in_progress';
  body: string;
  attachmentIds: string[];
  idempotencyKey: string | null;
  leaseSeconds: number;
  ip: string;
}

export type BotReplyResult =
  | { ok: true; messageId: string; requestStatus: RequestStatus; requeued: boolean; replayed: boolean; leaseExpiresAt: string | null }
  | { ok: false; reason: 'lease_lost' | 'bad_attachments' };

const KIND_FOR_STATUS = { answered: 'reply', needs_info: 'needs_info', failed: 'failure', in_progress: 'progress' } as const;

export async function botReply(db: DB, input: BotReplyInput): Promise<BotReplyResult> {
  const { request, botId } = input;
  const leaseHash = await sha256Hex(input.leaseToken);

  // An Idempotency-Key is scoped to this bot, this request, and this lease.
  // Repeating a POST under the same lease returns the message already stored
  // (even after that reply ended the lease), so a bot can safely retry a POST
  // whose response it lost. The same key under a later lease is a new reply.
  const scopedKey = input.idempotencyKey ? `${request.id}:${leaseHash.slice(0, 32)}:${input.idempotencyKey}` : null;
  const replay = async (): Promise<BotReplyResult | null> => {
    const prior = await findByIdempotency(db, 'bot', botId, scopedKey);
    if (!prior || prior.request_id !== request.id) return null;
    const current = await getRequest(db, request.id);
    return {
      ok: true, messageId: prior.id, requestStatus: (current?.status || request.status) as RequestStatus,
      requeued: false, replayed: true, leaseExpiresAt: current?.lease_expires_at || null,
    };
  };
  const earlier = await replay();
  if (earlier) return earlier;

  if (!input.leaseToken || !['claimed', 'in_progress'].includes(request.status) || request.lease_token_hash !== leaseHash) {
    return { ok: false, reason: 'lease_lost' };
  }

  if (input.attachmentIds.length) {
    const found = await db
      .prepare(`SELECT COUNT(*) AS n FROM attachments WHERE id IN (${placeholders(input.attachmentIds.length)})
                AND request_id = ? AND uploader_kind = 'bot' AND uploaded_by = ? AND message_id IS NULL`)
      .bind(...input.attachmentIds, request.id, botId)
      .first();
    if (Number(found?.n || 0) !== input.attachmentIds.length) return { ok: false, reason: 'bad_attachments' };
  }

  const now = nowIso();
  const messageId = newId('m');
  const final = input.status !== 'in_progress';
  const leaseExpiresAt = final ? null : isoIn(input.leaseSeconds);

  // Every write below only happens if this run still holds the lease.
  const held = `id = ? AND bot_id = ? AND lease_token_hash = ? AND status IN ('claimed','in_progress')`;
  // True when the owner has added a message that the claiming run was never
  // shown. Decided by the database inside the transaction (by insertion order,
  // not by clocks), so it cannot race with the owner's own write. In that case
  // the reply is kept and the request goes straight back in the queue, with a
  // fresh attempt count, so the addition gets read.
  const unseen = `EXISTS (SELECT 1 FROM messages m WHERE m.request_id = requests.id AND m.author_kind = 'owner' AND m.rowid > requests.claimed_seq)`;

  const stmts = [
    db
      .prepare(`INSERT INTO messages (id, request_id, author_kind, author_id, kind, body, idempotency_key, created_at)
                SELECT ?, ?, 'bot', ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM requests WHERE ${held})`)
      .bind(messageId, request.id, botId, KIND_FOR_STATUS[input.status], input.body, scopedKey, now, request.id, botId, leaseHash),
  ];
  if (input.attachmentIds.length) {
    stmts.push(
      db
        .prepare(`UPDATE attachments SET message_id = ? WHERE id IN (${placeholders(input.attachmentIds.length)})
                  AND request_id = ? AND uploader_kind = 'bot' AND uploaded_by = ? AND message_id IS NULL
                  AND EXISTS (SELECT 1 FROM messages WHERE id = ?)`)
        .bind(messageId, ...input.attachmentIds, request.id, botId, messageId),
    );
  }
  stmts.push(
    final
      ? db
          .prepare(`UPDATE requests SET
                      status = CASE WHEN ${unseen} THEN 'queued' ELSE ? END,
                      status_note = CASE WHEN ${unseen} THEN 'owner_followup' ELSE NULL END,
                      attempts = CASE WHEN ${unseen} THEN 0 ELSE attempts END,
                      queued_at = CASE WHEN ${unseen} THEN ? ELSE queued_at END,
                      answered_at = CASE WHEN ? = 'answered' AND NOT ${unseen} THEN ? ELSE answered_at END,
                      lease_token_hash = NULL, lease_expires_at = NULL, owner_unread = 1, updated_at = ?
                    WHERE ${held} RETURNING status`)
          .bind(input.status, now, input.status, now, now, request.id, botId, leaseHash)
      : db
          .prepare(`UPDATE requests SET status = 'in_progress', lease_expires_at = ?, owner_unread = 1, updated_at = ?
                    WHERE ${held} RETURNING status`)
          .bind(leaseExpiresAt, now, request.id, botId, leaseHash),
  );

  let results: any[];
  try {
    results = await db.batch(stmts);
  } catch (err) {
    // Two identical POSTs raced; the unique index let exactly one through.
    const again = await replay();
    if (again) return again;
    throw err;
  }
  // The lease was taken over between the check above and the write: nothing was stored.
  if (Number(results[0]?.meta?.changes || 0) !== 1) return { ok: false, reason: 'lease_lost' };

  const after = (results[results.length - 1]?.results?.[0]?.status || (final ? input.status : 'in_progress')) as RequestStatus;
  const requeued = final && after === 'queued';
  await audit(db, {
    actor_kind: 'bot', actor_id: botId, action: 'bot.reply', request_id: request.id, target_id: messageId, ip: input.ip,
    meta: { status: input.status, request_status: after, chars: input.body.length, files: input.attachmentIds.length },
  });
  return { ok: true, messageId, requestStatus: after, requeued, replayed: false, leaseExpiresAt };
}

/** The thread as a bot sees it. Attachment links point at the bot download route. */
export function threadForBot(thread: Thread, origin: string, ownerEmails?: string): Record<string, unknown> {
  const r = thread.request;
  return {
    request: {
      id: r.id, title: r.title, status: r.status, bot: r.bot_id, attempts: r.attempts,
      // "owner" for the office owner's real requests; "test" for one sent by the administrator or a setup check.
      ...(ownerEmails === undefined ? {} : { sent_by: emailListed(r.owner_email, ownerEmails) ? 'owner' : 'test' }),
      created_at: r.created_at, updated_at: r.updated_at, queued_at: r.queued_at,
      claimed_at: r.claimed_at, lease_expires_at: r.lease_expires_at,
    },
    messages: thread.messages.map((m) => ({
      id: m.id,
      author: m.author_kind,
      kind: m.kind,
      body: m.body,
      created_at: m.created_at,
      attachments: (thread.files.get(m.id) || []).map((a) => ({
        id: a.id, filename: a.filename, content_type: a.content_type, size: a.size, kind: a.kind,
        transcript: a.transcript || null,
        url: `${origin}/api/office/bot/attachments/${a.id}`,
      })),
    })),
  };
}

// -------------------------------------------------------------- publications

export async function listPublications(db: DB, states: string[]): Promise<Row[]> {
  const res = await db
    .prepare(
      `SELECT p.*, r.title AS request_title, r.owner_email, r.bot_id, b.name AS bot_name, m.body AS message_body, m.created_at AS message_at
       FROM publications p
       JOIN requests r ON r.id = p.request_id
       JOIN bots b ON b.id = r.bot_id
       JOIN messages m ON m.id = p.message_id
       WHERE p.state IN (${placeholders(states.length)})
       ORDER BY p.nominated_at DESC LIMIT 100`,
    )
    .bind(...states)
    .all();
  return res.results || [];
}

export async function getPublication(db: DB, id: string): Promise<Row | null> {
  return (
    (await db
      .prepare(
        `SELECT p.*, r.title AS request_title, r.owner_email, r.bot_id, b.name AS bot_name, m.body AS message_body, m.created_at AS message_at
         FROM publications p
         JOIN requests r ON r.id = p.request_id
         JOIN bots b ON b.id = r.bot_id
         JOIN messages m ON m.id = p.message_id
         WHERE p.id = ?`,
      )
      .bind(id)
      .first()) || null
  );
}

export function parseIdArray(json: unknown): string[] {
  try {
    const v = JSON.parse(String(json || '[]'));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------- upkeep

/**
 * Housekeeping, run at most once an hour from the office home page:
 * uploads that were never sent, old audit rows, spent rate-limit counters,
 * and (only if OFFICE_RETENTION_DAYS is set) threads past the retention period.
 */
export async function sweep(env: OfficeEnv): Promise<void> {
  const db = env.OFFICE_DB;
  if ((await rateHit(db, 'sweep', 3600)) > 1) return;

  // Uploads that were never sent with a message. Rows first, then the bytes.
  const cutoff = new Date(Date.now() - LIMITS.pendingUploadHours * 3600 * 1000).toISOString();
  const gone = await db
    .prepare(`DELETE FROM attachments WHERE id IN (SELECT id FROM attachments WHERE message_id IS NULL AND created_at < ? LIMIT 200)
              AND message_id IS NULL RETURNING r2_key`)
    .bind(cutoff)
    .all();
  await purgeObjects(env, ((gone.results || []) as Row[]).map((r) => String(r.r2_key)), null);

  const auditCutoff = new Date(Date.now() - LIMITS.auditRetentionDays * 86400 * 1000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM audit_log WHERE at < ?').bind(auditCutoff),
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Math.floor(Date.now() / 1000) - 2 * 86400),
  ]);

  const days = Math.floor(Number(env.OFFICE_RETENTION_DAYS));
  if (Number.isFinite(days) && days >= 30) {
    const old = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const stale = (await db.prepare('SELECT id FROM requests WHERE updated_at < ? LIMIT 20').bind(old).all()).results || [];
    for (const r of stale as Row[]) {
      const removed = await deleteRequest(env, r.id);
      await audit(db, { actor_kind: 'system', action: 'request.expired', request_id: r.id, meta: { ...removed, retention_days: days } });
    }
  }
}
