-- Site Update v57 — AI Librarian Hello World: RAG storage + query log.
--
-- Apply in the Supabase SQL editor (or via the Supabase CLI). Safe to run
-- repeatedly: each statement is guarded with `if not exists` or
-- `or replace` where the dialect allows.
--
-- Adds:
--   * extension `vector` — pgvector. Required for embedding storage and
--     the cosine-distance index. Free on all paid Supabase tiers; if the
--     project is on a tier where it isn't available the migration will
--     stop on the `create extension` line and the run report should
--     surface that as the prerequisite block.
--   * public.librarian_chunks — chunked Library content with 1536-dim
--     OpenAI embeddings (text-embedding-3-small). Populated by
--     _tools/index_library_for_rag.py.
--   * public.librarian_query_log — one row per patron query against the
--     Librarian. Used for the per-day rate-limit count (10 / patron / 24h
--     window) and for v57 forensics on which chunks Sonnet got handed.
--   * public.match_librarian_chunks(query_embedding, match_count) RPC —
--     vector-search helper invoked by the librarian_answer_v0 Edge
--     Function. Returns the top-K chunks ordered by cosine similarity.
--   * RLS on librarian_query_log — patrons see their own rows; service
--     role inserts. Public role gets neither read nor write.

-- ----------------------------------------------------------------------
-- 1. pgvector extension.
-- ----------------------------------------------------------------------

create extension if not exists vector;

-- ----------------------------------------------------------------------
-- 2. librarian_chunks — embedding store.
-- ----------------------------------------------------------------------

create table if not exists public.librarian_chunks (
  id              bigserial primary key,
  source_url      text not null,
  source_title    text not null,
  source_room     text not null,
  chunk_index     int  not null,
  chunk_text      text not null,
  embedding       vector(1536) not null,
  last_indexed_at timestamptz not null default now()
);

-- ivfflat over cosine distance — same operator class the
-- match_librarian_chunks RPC uses below. 100 lists is the conventional
-- starting point for an index expected to hold low thousands of rows.
create index if not exists librarian_chunks_embedding_idx
  on public.librarian_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists librarian_chunks_source_url_idx
  on public.librarian_chunks (source_url);

-- ----------------------------------------------------------------------
-- 3. librarian_query_log — rate-limit + forensics.
-- ----------------------------------------------------------------------

create table if not exists public.librarian_query_log (
  id              bigserial primary key,
  patron_id       uuid not null references auth.users(id) on delete cascade,
  query_text      text not null,
  response_text   text,
  chunks_used     bigint[] not null default '{}',
  tokens_input    int,
  tokens_output   int,
  created_at      timestamptz not null default now()
);

create index if not exists librarian_query_log_patron_day_idx
  on public.librarian_query_log (patron_id, created_at);

alter table public.librarian_query_log enable row level security;

-- Re-run-safe policy creation: drop-then-create rather than `if not
-- exists` because Postgres only added the `if not exists` form for
-- policies recently and not all Supabase Postgres versions ship it.
drop policy if exists "patrons see own queries" on public.librarian_query_log;
create policy "patrons see own queries"
  on public.librarian_query_log
  for select
  using (auth.uid() = patron_id);

drop policy if exists "service role inserts" on public.librarian_query_log;
create policy "service role inserts"
  on public.librarian_query_log
  for insert
  with check (true);

-- ----------------------------------------------------------------------
-- 4. match_librarian_chunks RPC — vector search helper.
-- ----------------------------------------------------------------------
--
-- Called by the librarian_answer_v0 Edge Function. The `<=>` operator is
-- pgvector cosine distance (smaller = closer); the function returns
-- 1 - distance as a conventional similarity score so callers can sort or
-- filter without remembering the inversion.

create or replace function public.match_librarian_chunks(
  query_embedding vector(1536),
  match_count int
)
returns table (
  id            bigint,
  chunk_text    text,
  source_url    text,
  source_title  text,
  source_room   text,
  similarity    float
)
language sql
stable
as $$
  select
    librarian_chunks.id,
    librarian_chunks.chunk_text,
    librarian_chunks.source_url,
    librarian_chunks.source_title,
    librarian_chunks.source_room,
    1 - (librarian_chunks.embedding <=> query_embedding) as similarity
  from public.librarian_chunks
  order by librarian_chunks.embedding <=> query_embedding
  limit match_count;
$$;
