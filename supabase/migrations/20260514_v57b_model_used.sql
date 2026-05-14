-- v57b migration — add model_used column to librarian_query_log.
--
-- Why:
--   The v57b Reference Desk page exposes two models — Standard
--   (claude-sonnet-4-6) and Deep Research (claude-opus-4-6). The Edge
--   Function librarian_answer_v0 now records which model answered each
--   query so the run cost mix is observable and so future analysis can
--   correlate model choice with response quality.
--
-- How to apply:
--   Paste into the Supabase SQL Editor for the production project, or
--   run via `supabase db push` if migrations are wired up locally.
--   Re-run-safe: the alter uses `if not exists`.

alter table public.librarian_query_log
  add column if not exists model_used text not null default 'sonnet';

comment on column public.librarian_query_log.model_used is
  'Which Claude model answered this query: ''sonnet'' (Standard) or ''opus'' (Deep Research). Added in v57b.';
