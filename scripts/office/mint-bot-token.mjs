#!/usr/bin/env node
// Private research office: make a bot token from the command line.
//
// The usual way is the "Make a token" button on /office/admin/. This script is
// the fallback (first-time setup, or when the admin page is unreachable). It
// touches nothing by itself: it prints the new token once, plus the one SQL
// statement that registers its fingerprint. You run that statement yourself.
//
//   node scripts/office/mint-bot-token.mjs <bot-id> [--label "where it lives"] [--days 365] [--by you@example.org]
//
// Then, for the production database (use the preview database name to test):
//   npx wrangler d1 execute <database-name> --remote --command "<the printed SQL>"
//
// The token itself is never written to disk here and is not stored on the
// site (only its SHA-256 fingerprint is). Put it in the bot's environment
// straight away; if it is lost, revoke it and make another.
import { createHash, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const botId = args[0] && !args[0].startsWith('--') ? args[0] : '';
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

if (!/^[a-z][a-z0-9-]{1,31}$/.test(botId)) {
  console.error('Usage: node scripts/office/mint-bot-token.mjs <bot-id> [--label "..."] [--days N] [--by email]');
  console.error('The bot id is the lowercase id from the bots table, e.g. herald.');
  process.exit(1);
}

const sqlText = (s) => "'" + String(s).replace(/[\u0000-\u001f]/g, ' ').replace(/'/g, "''") + "'";
const label = opt('label', 'made with mint-bot-token.mjs').slice(0, 80);
const by = opt('by', 'cli').slice(0, 120);
const days = Math.floor(Number(opt('days', '0')));
const now = new Date();
const expires = days > 0 ? new Date(now.getTime() + Math.min(days, 3650) * 86400 * 1000).toISOString() : null;

const tokenId = randomBytes(8).toString('hex');
const token = `ofb_${tokenId}_${randomBytes(32).toString('base64url')}`;
const hash = createHash('sha256').update(token).digest('hex');

const sql =
  'INSERT INTO bot_tokens (id, bot_id, token_hash, label, created_at, created_by, expires_at) VALUES (' +
  [sqlText(tokenId), sqlText(botId), sqlText(hash), sqlText(label), sqlText(now.toISOString()), sqlText(by), expires ? sqlText(expires) : 'NULL'].join(', ') +
  ');';

const envName = 'OFFICE_BOT_TOKEN_' + botId.toUpperCase().replace(/-/g, '_');
console.log('');
console.log('Token (shown once; put it in the bot\'s environment as ' + envName + '):');
console.log('');
console.log('  ' + token);
console.log('');
console.log('Register it by running this SQL against the office database:');
console.log('');
console.log('  ' + sql);
console.log('');
console.log('Token id ' + tokenId + (expires ? ', expires ' + expires : ', no expiry') + '. The bot row "' + botId + '" must already exist.');
