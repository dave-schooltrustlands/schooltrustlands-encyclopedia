// Who may use Bob's office, as decided by Dave on Oct 6, 2026 (11:18 PM PT).
//
// 1. Dave sees everything: admins read every thread (read-only, logged) unless
//    OFFICE_ADMIN_CAN_READ is set to "false" explicitly.
// 2. Bots: the owner may use only
//      - a bot the owner created (bots.created_by is an owner email), or
//      - a bot whose agent id is on BOT_ALLOW_LIST below.
//    Everything else is refused (default deny). A bot whose agent id is on
//    BOT_BLOCK_LIST is refused even if someone also lists it or marks it as
//    owner-created. The block list holds agent ids only, never names, because
//    this repo is public.
// 3. Sign-in addresses live in OFFICE_OWNER_EMAILS / OFFICE_ADMIN_EMAILS in the
//    Cloudflare Pages settings (not in this public repo) and are compared
//    case-insensitively (see emailListed).
//
// The rule is applied at every point a bot is used: the picker, sending a new
// request, a follow-up, minting a token, and every bot sign-in.

import { isTrue, listOf, type OfficeEnv } from './config';

export interface AllowedAgent { agentId: string; slug: string; name: string; group: string }

export const BOT_ALLOW_LIST: readonly AllowedAgent[] = Object.freeze([
  { agentId: '172b9fc7-8ab9-4f46-a0ad-5af2bb0da669', slug: 'herald', name: 'Herald', group: 'Library' },
  { agentId: '107c2f90-7993-48f2-b2f7-87ab20448a30', slug: 'librarian', name: 'Librarian', group: 'Library' },
  { agentId: 'acfdd5b0-01f5-4177-975b-2db4086f6b5e', slug: 'chronicle', name: 'Chronicle', group: 'Chronicle' },
  { agentId: 'b53c2932-8194-4c50-bf20-98ac29e65b79', slug: 'chronicle-builder', name: 'Chronicle Builder', group: 'Chronicle' },
  { agentId: '92e7cc91-9dc8-4d75-8486-3487a067ad90', slug: 'chronicle-reviewer', name: 'Chronicle Reviewer', group: 'Chronicle' },
  { agentId: 'c0b0d209-2379-4142-94d5-ac2ff1c24c9c', slug: 'chronicle-refdesk', name: 'Chronicle Reference Desk', group: 'Chronicle' },
  { agentId: 'cfa34469-26a0-4768-95fb-d9b31cd88c0f', slug: 'chronicle-ops', name: 'Chronicle Ops', group: 'Chronicle' },
  { agentId: '02ed0bba-b794-4136-a971-320cd3881dbb', slug: 'farm-chatgpt', name: 'Farm ChatGPT', group: 'Farm' },
  { agentId: '317a7ef0-2083-4e5d-be40-17f4cafcc88c', slug: 'farm-grok', name: 'Farm Grok', group: 'Farm' },
  { agentId: '480ec19b-be3c-44e6-8e3b-dd551c736cad', slug: 'farm-gemini', name: 'Farm Gemini', group: 'Farm' },
  { agentId: 'd6c99e17-0597-49d7-b728-b2b89a3230c4', slug: 'farm-fable', name: 'Farm Fable', group: 'Farm' },
  // Added Oct 7, 2026 (12:27 AM PT): Dave put Chaney on the allow list.
  { agentId: '620cd4d3-81ea-435f-b2fd-2aa2ae073176', slug: 'chaney', name: 'Chaney', group: 'Chaney' },
]);

/** Agent ids that may never be used from the office. */
export const BOT_BLOCK_LIST: readonly string[] = Object.freeze([
  '3fd9e184-04f6-4e2a-91ce-a2ee7ed43b14',
  '586a0801-ba61-4c2c-b4cf-ca29d99860fc',
  '6a8bc53a-7bdd-4964-ac47-aa2137f57d66',
  '9b36b41d-8ed0-4596-bbf8-e6a78130c43a',
]);

const ALLOWED_IDS = new Set(BOT_ALLOW_LIST.map((a) => a.agentId));
const BLOCKED_IDS = new Set(BOT_BLOCK_LIST);

export function normAgentId(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

export function isBlockedAgent(agentId: unknown): boolean {
  return BLOCKED_IDS.has(normAgentId(agentId));
}

export function isAllowedAgent(agentId: unknown): boolean {
  const id = normAgentId(agentId);
  return ALLOWED_IDS.has(id) && !BLOCKED_IDS.has(id);
}

/** Case-insensitive, whitespace-tolerant membership test for an address list. */
export function emailListed(email: unknown, list: string | undefined): boolean {
  const e = String(email ?? '').trim().toLowerCase();
  return !!e && listOf(list).includes(e);
}

export interface BotRowLike { enabled?: unknown; agent_id?: unknown; created_by?: unknown }

export type BotVerdict = 'ok' | 'disabled' | 'blocked' | 'not_allowed';

/** The one place that decides whether a bot row may be used from the office. */
export function botVerdict(bot: BotRowLike | null | undefined, env: Pick<OfficeEnv, 'OFFICE_OWNER_EMAILS'>): BotVerdict {
  if (!bot) return 'not_allowed';
  if (isBlockedAgent(bot.agent_id)) return 'blocked';
  if (!Number(bot.enabled)) return 'disabled';
  if (isAllowedAgent(bot.agent_id)) return 'ok';
  if (!normAgentId(bot.agent_id) && emailListed(bot.created_by, env.OFFICE_OWNER_EMAILS)) return 'ok';
  return 'not_allowed';
}

export function botUsable(bot: BotRowLike | null | undefined, env: Pick<OfficeEnv, 'OFFICE_OWNER_EMAILS'>): boolean {
  return botVerdict(bot, env) === 'ok';
}

/** Decision 1: admins (Dave) read everything unless explicitly switched off. */
export function adminCanReadSetting(env: Pick<OfficeEnv, 'OFFICE_ADMIN_CAN_READ'>): boolean {
  const v = String(env.OFFICE_ADMIN_CAN_READ ?? '').trim();
  if (!v) return true;
  return isTrue(v);
}
