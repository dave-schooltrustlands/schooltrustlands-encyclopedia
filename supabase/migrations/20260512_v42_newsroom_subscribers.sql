-- Site Update v42 — Newsroom subscribers table for the monthly digest list.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds:
--   * public.newsroom_subscribers (id, name, email unique, opt_in_at,
--     unsubscribed_at, notes) — internal list for the forthcoming monthly
--     email digest. The list moves to Buttondown once subscriber count
--     crosses ~50; until then it lives here.
--   * RLS: anonymous insert allowed (so the public subscribe form on
--     /newsroom/ submits without auth); only head_librarian / admin can
--     read. No anonymous select, update, or delete.
--   * A unique index on lower(email) so case-variant duplicates collide.
--
-- Pre-requisite: v31 (librarian_roles) + v35 (is_head_librarian_or_admin())
-- must already be applied. v35 forward-declared the helper this migration's
-- read policy re-uses.

-- ----------------------------------------------------------------------
-- 1. Table.
-- ----------------------------------------------------------------------

create table if not exists public.newsroom_subscribers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  opt_in_at       timestamptz not null default now(),
  unsubscribed_at timestamptz,
  notes           text
);

-- Case-insensitive uniqueness on email. The Buttondown migration will
-- normalise the same way, so adopt the convention now.
create unique index if not exists newsroom_subscribers_email_lower_idx
  on public.newsroom_subscribers ((lower(email)));

-- ----------------------------------------------------------------------
-- 2. RLS — anonymous insert; admin / head-librarian read.
-- ----------------------------------------------------------------------

alter table public.newsroom_subscribers enable row level security;

drop policy if exists newsroom_subscribers_anon_insert
  on public.newsroom_subscribers;
create policy newsroom_subscribers_anon_insert
  on public.newsroom_subscribers
  for insert
  to anon, authenticated
  with check (
    -- Inserts cannot pre-set unsubscribed_at. opt_in_at is fine to default;
    -- name / email are required by NOT NULL.
    unsubscribed_at is null
    and length(trim(name)) between 1 and 200
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and length(email) <= 320
  );

drop policy if exists newsroom_subscribers_admin_read
  on public.newsroom_subscribers;
create policy newsroom_subscribers_admin_read
  on public.newsroom_subscribers
  for select
  to authenticated
  using (public.is_head_librarian_or_admin());

-- No update/delete policies — admin maintenance happens via service-role
-- access in the SQL editor or future librarian-dashboard tooling.

-- ----------------------------------------------------------------------
-- 3. Verification SELECTs. Output lands in the SQL editor result pane.
-- ----------------------------------------------------------------------

select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'newsroom_subscribers'
 order by ordinal_position;

select policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename = 'newsroom_subscribers'
 order by policyname;

select count(*) as subscriber_count from public.newsroom_subscribers;
