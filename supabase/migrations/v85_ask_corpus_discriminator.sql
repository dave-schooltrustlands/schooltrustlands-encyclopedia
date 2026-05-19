-- v85 — Extend the existing librarian_chunks table with a `corpus`
-- discriminator so the same table can serve Library, ASTL, and OASTL
-- Ask pages. The Library Reference Desk continues to work unchanged
-- because the discriminator defaults to 'library' for existing rows.
--
-- Apply via the Supabase dashboard SQL editor or `supabase db push`.

alter table public.librarian_chunks
  add column if not exists corpus text not null default 'library';

create index if not exists librarian_chunks_corpus_idx
  on public.librarian_chunks (corpus);

-- Backfill any pre-v85 rows (defensive — DEFAULT handles new rows, but
-- some installations may have inserted nulls historically).
update public.librarian_chunks
   set corpus = 'library'
 where corpus is null;

-- Constrain valid values. Add new values to the check constraint as
-- additional Ask properties come online (e.g. 'eai', 'orww').
alter table public.librarian_chunks
  drop constraint if exists librarian_chunks_corpus_check;
alter table public.librarian_chunks
  add constraint librarian_chunks_corpus_check
  check (corpus in ('library', 'astl', 'oastl'));

-- Update the match RPC to accept a corpus filter. The existing
-- match_librarian_chunks RPC continues to work for Library callers
-- that don't pass a corpus (defaults to 'library'). v85 callers pass
-- the property's corpus to scope the vector search.
create or replace function public.match_librarian_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  corpus_filter text default 'library'
)
returns table (
  id bigint,
  chunk_text text,
  source_url text,
  source_title text,
  source_room text,
  corpus text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.chunk_text,
    c.source_url,
    c.source_title,
    c.source_room,
    c.corpus,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.librarian_chunks c
  where c.corpus = corpus_filter
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
