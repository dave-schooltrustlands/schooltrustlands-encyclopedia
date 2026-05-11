-- Site Update v30 — Feedback Foundation.
--
-- Apply in the Supabase SQL editor (or via the deploy pipeline).
-- Idempotent where possible; safe to re-run.
--
-- Creates:
--   feedback                       table of patron-submitted feedback rows
--   feedback_sequences             helper table for ticket-number generation
--   next_ticket_number(prefix,yr)  sequential ticket-number generator
--   feedback_assign_ticket_number  trigger that fills ticket_number on insert
--   3 indexes on feedback (user_id, status, submitted_at desc)
--   2 RLS policies (own-read, own-insert)
--
-- Librarian read/write policies arrive in v31 with the librarian_roles table.

-- 1. The feedback table -------------------------------------------------------

create table if not exists public.feedback (
  id            uuid          primary key default gen_random_uuid(),
  ticket_number text          unique not null,
  user_id       uuid          not null references auth.users(id) on delete cascade,
  page_url      text          not null,
  subject       text,
  body          text          not null,
  status        text          not null default 'new'
                              check (status in ('new','in_review','responded','archived')),
  submitted_at  timestamptz   not null default now()
);

create index if not exists feedback_user_id_idx      on public.feedback (user_id);
create index if not exists feedback_status_idx       on public.feedback (status);
create index if not exists feedback_submitted_at_idx on public.feedback (submitted_at desc);

-- 2. The ticket-number generator ---------------------------------------------

create table if not exists public.feedback_sequences (
  prefix    text not null,
  year      int  not null,
  next_seq  int  not null default 1,
  primary key (prefix, year)
);

create or replace function public.next_ticket_number(p_prefix text, p_year int)
returns text
language plpgsql
as $$
declare
  v_seq int;
begin
  insert into public.feedback_sequences (prefix, year)
    values (p_prefix, p_year)
    on conflict (prefix, year) do nothing;

  update public.feedback_sequences
     set next_seq = next_seq + 1
   where prefix = p_prefix and year = p_year
  returning next_seq - 1 into v_seq;

  return format('%s-%s-%s', p_prefix, p_year, lpad(v_seq::text, 5, '0'));
end;
$$;

create or replace function public.feedback_assign_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null then
    new.ticket_number := public.next_ticket_number('FB', extract(year from now())::int);
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_assign_ticket_number_trigger on public.feedback;
create trigger feedback_assign_ticket_number_trigger
  before insert on public.feedback
  for each row execute function public.feedback_assign_ticket_number();

-- 3. Row-level security ------------------------------------------------------

alter table public.feedback enable row level security;

drop policy if exists "Patrons read own feedback" on public.feedback;
create policy "Patrons read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Patrons insert own feedback" on public.feedback;
create policy "Patrons insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
