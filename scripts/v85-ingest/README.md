# v85 substrate ingestion

Wave 1-2 backend artifacts for Ask ASTL / Ask OASTL. Frontend (Waves 3-6) was deployed by Claude Code; backend deploy + ingestion are these scripts and require credentials Claude Code didn't have access to.

## What's here

- `../supabase/migrations/v85_ask_corpus_discriminator.sql` — adds the `corpus` column + index + check constraint to `librarian_chunks`, and updates `match_librarian_chunks` to accept a `corpus_filter`. Backward-compatible with the Library Reference Desk (defaults to `'library'`).
- `../supabase/functions/ask_v1/index.ts` — the v85 Edge Function. Accepts `{ property: 'astl' | 'oastl', messages: [...] }`, picks the right system prompt, runs the three-tool agentic loop (search_substrate, web_search, web_fetch), returns response + sources_cited.
- `ingest-corpus.mjs` — Node 20+ script to walk substrate files in either repo, chunk + embed via OpenAI, insert into `librarian_chunks` with the right `corpus` value.

## Deploy steps (Dave)

1. **Apply the migration** in the Supabase dashboard SQL editor (or via `supabase db push` if the project is linked):
   ```
   psql ... -f supabase/migrations/v85_ask_corpus_discriminator.sql
   ```
   This is additive and safe to re-run.

2. **Set Edge Function secrets** in the Supabase dashboard:
   - `ANTHROPIC_API_KEY` — same key already in use by `librarian_answer_v0`
   - `OPENAI_API_KEY` — same key already in use
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-populated by Supabase

3. **Deploy the Edge Function**:
   ```
   cd /home/drdav/schooltrustlands-encyclopedia
   supabase functions deploy ask_v1 --no-verify-jwt
   ```
   `--no-verify-jwt` is required because Ask ASTL / Ask OASTL are anonymous-access (no Library Card).

4. **Ingest both corpora**:
   ```
   cd /home/drdav/schooltrustlands-encyclopedia
   npm i @supabase/supabase-js@2   # if not already installed

   SUPABASE_URL='https://mbdfvdevisdbpgrqtzqz.supabase.co' \
   SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
   OPENAI_API_KEY='sk-...' \
   node scripts/v85-ingest/ingest-corpus.mjs astl

   SUPABASE_URL='https://mbdfvdevisdbpgrqtzqz.supabase.co' \
   SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' \
   OPENAI_API_KEY='sk-...' \
   node scripts/v85-ingest/ingest-corpus.mjs oastl
   ```
   Each run wipes existing rows for that corpus and re-inserts. Run from this repo (encyclopedia) since that's where the deps live; the script reads source files from the ASTL and OASTL repos directly via the `ASTL_REPO` and `OASTL_REPO` env vars (defaults to `/home/drdav/schooltrustlands` and `/home/drdav/oastl-oregon`).

5. **Wire the frontend endpoint** (or it stays in placeholder mode):
   - Set `PUBLIC_ASK_ENDPOINT_URL=https://mbdfvdevisdbpgrqtzqz.supabase.co/functions/v1/ask_v1` in both ASTL and OASTL Cloudflare project environments.
   - Trigger a redeploy on each (push an empty commit or use the Cloudflare dashboard "Retry deploy" button).

## Verifying the deploy

After steps 1-5, the frontend `/ask/` pages on both properties should work end-to-end. Test queries (per handoff Wave 7):

- Substrate-only: "What is the cohort principle?" — should cite a substrate URL.
- On-topic recent: "What's happening with Oregon's school trust litigation right now?" — substrate + web search.
- Off-topic: "Who won the Super Bowl?" — should fire the exact refusal phrase from the system prompt.
- Oregon standing ruling: should never be framed as "first of its kind in the field."

## Notes

- The script is char-based-chunked (~600 tokens per chunk, ~100 overlap). If you want token-exact chunking, add a `tiktoken` dependency.
- Anthropic's native tool version strings (`web_search_20250305`, `web_fetch_20250619`) are pinned in the Edge Function. Verify against current Anthropic API docs at deploy time; they update periodically.
- The Edge Function has a `MAX_TOOL_TURNS = 5` guard so a runaway tool-use loop is bounded. Raise if you see legitimate research needing more turns.
- The Library Reference Desk (`librarian_answer_v0`) is unchanged and continues to work because the migration is additive and the old function doesn't pass `corpus_filter`.
