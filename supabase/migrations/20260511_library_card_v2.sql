-- Library Card v2 — extend profiles with patron card fields.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
-- Companion to Site Update v29 (Library Card v2).
--
-- Adds:
--   patron_number bigint  — sequential, zero-padded for display; never changes
--   tier          text    — Reader | Friend | Patron | Benefactor | Founding Circle
--   standing      text    — Active | Lapsed | Honorary
--   pages_read    int     — incremented per substantive page view (Phase 1: 0)
--
-- Patron numbers are assigned by a sequence on signup, and existing rows are
-- backfilled at the end of this script. The handle_new_user() trigger is
-- replaced so newly-created profiles receive the next patron number atomically.

alter table public.profiles
  add column if not exists patron_number bigint,
  add column if not exists tier text not null default 'Reader',
  add column if not exists standing text not null default 'Active',
  add column if not exists pages_read int not null default 0;

create unique index if not exists profiles_patron_number_key
  on public.profiles(patron_number)
  where patron_number is not null;

create sequence if not exists public.patron_number_seq start 1;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, patron_number)
    values (new.id, nextval('public.patron_number_seq'));
  return new;
end;
$$;

-- Backfill any existing rows that predate the patron_number column. Order
-- by created_at so the earliest accounts get the lowest numbers.
do $$
declare
  r record;
begin
  for r in
    select id from public.profiles
    where patron_number is null
    order by created_at asc, id asc
  loop
    update public.profiles
      set patron_number = nextval('public.patron_number_seq')
      where id = r.id;
  end loop;
end$$;
