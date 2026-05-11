-- Site Update v30.1 — Cleanup pass: patron-number backfill + ticket function
-- hardening.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- This migration bundles two unrelated fixes that landed in the v30.1 wave:
--   (Fix 3) Backfill profiles.patron_number for any rows that still have
--           a null value. v29's migration created the column and a sequence
--           but did not retroactively assign numbers to rows whose
--           created_at predated the sequence default. Pre-v29 patrons
--           (Dave, Margaret) therefore render "00 000" on their library
--           cards.
--   (Fix 4) Harden public.next_ticket_number — mark it security definer
--           with a pinned search_path, then enable RLS on
--           public.feedback_sequences with a default-deny client policy.
--           The function continues to operate (security definer bypasses
--           RLS) while direct client writes to the helper table are
--           refused.

-- ----------------------------------------------------------------------
-- Fix 3 — Backfill profiles.patron_number for null rows.
-- ----------------------------------------------------------------------
-- Order by created_at (then id as a tiebreak) so the earliest accounts
-- get the lowest numbers. nextval() on the v29 sequence advances the
-- shared counter, so new signups land after the backfill.

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

-- Verification helper. The output of this select goes to the SQL editor
-- result pane; nothing in the migration depends on the row count.
select id, display_name, patron_number, created_at
  from public.profiles
 order by patron_number nulls last, created_at asc;

-- ----------------------------------------------------------------------
-- Fix 4 — Harden next_ticket_number + lock feedback_sequences with RLS.
-- ----------------------------------------------------------------------
-- The function is recreated with `security definer` (so callers do not
-- need RLS privileges on feedback_sequences) and a pinned search_path
-- (so a malicious caller cannot shadow `public` with a hostile schema).

create or replace function public.next_ticket_number(p_prefix text, p_year int)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
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

-- Lock direct client access to the helper table. The trigger function
-- still operates because security-definer functions run with the
-- function owner's privileges and bypass RLS.

alter table public.feedback_sequences enable row level security;

drop policy if exists "Deny all client access to feedback_sequences"
  on public.feedback_sequences;

create policy "Deny all client access to feedback_sequences"
  on public.feedback_sequences
  for all
  to authenticated, anon
  using (false)
  with check (false);
