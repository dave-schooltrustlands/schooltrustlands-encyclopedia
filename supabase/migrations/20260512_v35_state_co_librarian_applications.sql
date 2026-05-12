-- Site Update v35 — State Co-Librarian Applications.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds:
--   state_co_librarian_applications — applications to become a state co-librarian
--                                     (SCL-YYYY-NNNNN). Accepts anonymous and
--                                     authenticated submissions both.
--
-- Plus:
--   * is_head_librarian_or_admin() helper (forward-declared in section 0 so
--     that policies referencing it in section 4 resolve cleanly — see the
--     v32 forward-reference bug for why this matters).
--   * state_co_lib_applications_assign_ticket_number trigger
--   * notify_on_state_co_lib_decision trigger (auto-writes a notifications
--     row when an application is accepted or declined)
--   * RLS enabled with four policies (own-read / submit / head-read /
--     head-update).
--
-- Pre-requisite: v31..v33 must already be applied (this migration assumes
-- librarian_roles, notifications, and the next_ticket_number helper already
-- exist).

-- ----------------------------------------------------------------------
-- 0. Forward declarations.
-- ----------------------------------------------------------------------
-- The is_head_librarian_or_admin() helper has to come BEFORE the policies
-- that reference it. v32 originally declared is_moderator() in section 4
-- but section 3's discussion policies used it, which Postgres caught as a
-- forward reference. We avoid the same mistake here by forward-declaring.

create or replace function public.is_head_librarian_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.librarian_roles
     where user_id = auth.uid()
       and role in ('head_librarian','admin')
  );
$$;

-- ----------------------------------------------------------------------
-- 1. state_co_librarian_applications — the table.
-- ----------------------------------------------------------------------
-- Column is named `references_text` because `references` is a Postgres
-- reserved word and using it bare requires quoting on every read.
-- preferred_contact is the channel the applicant wants us to use; usually
-- an email but free-form so we can accept a phone or mailing address too.

create table if not exists public.state_co_librarian_applications (
  id                  uuid         primary key default gen_random_uuid(),
  ticket_number       text         unique not null,
  user_id             uuid         references auth.users(id) on delete set null,
  name                text         not null,
  pseudonym_requested boolean      not null default false,
  affiliation         text,
  states              text[]       not null default '{}',
  background          text,
  sample_corrections  text,
  references_text     text,
  preferred_contact   text         not null,
  library_card_number text,
  status              text         not null default 'pending'
                                   check (status in ('pending','in_review','accepted','declined')),
  reviewer_notes      text,
  reviewer_user_id    uuid         references auth.users(id) on delete set null,
  submitted_at        timestamptz  not null default now(),
  reviewed_at         timestamptz
);

create index if not exists state_co_lib_applications_user_idx
  on public.state_co_librarian_applications (user_id);
create index if not exists state_co_lib_applications_status_idx
  on public.state_co_librarian_applications (status);
create index if not exists state_co_lib_applications_submitted_at_idx
  on public.state_co_librarian_applications (submitted_at desc);

-- ----------------------------------------------------------------------
-- 2. Ticket-number trigger — assigns SCL-YYYY-NNNNN.
-- ----------------------------------------------------------------------
-- Mirrors the v32 corrections / v31 librarian_applications shape: the
-- trigger only fires when ticket_number is null, so a manual override
-- (e.g. test fixtures) stays intact.

create or replace function public.state_co_lib_applications_assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := public.next_ticket_number('SCL', extract(year from now())::int);
  end if;
  return new;
end;
$$;

drop trigger if exists state_co_lib_applications_assign_ticket_number_trigger
  on public.state_co_librarian_applications;
create trigger state_co_lib_applications_assign_ticket_number_trigger
  before insert on public.state_co_librarian_applications
  for each row execute function public.state_co_lib_applications_assign_ticket_number();

-- ----------------------------------------------------------------------
-- 3. Decision-notification trigger.
-- ----------------------------------------------------------------------
-- When status flips from a non-decided value to 'accepted' or 'declined',
-- insert a notifications row addressed to user_id (when user_id is not
-- null — anonymous submissions have no inbox). Mirrors v33's notify
-- triggers; security definer so it bypasses RLS on notifications.

create or replace function public.notify_on_state_co_lib_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if old.status is distinct from new.status
     and new.status in ('accepted','declined')
     and coalesce(old.status, 'pending') not in ('accepted','declined') then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, kind, title, body, link_url)
      values (
        new.user_id,
        'application_approved',
        format('Your state co-librarian application was accepted (%s).', new.ticket_number),
        new.reviewer_notes,
        '/my-library/'
      );
    else
      insert into public.notifications (user_id, kind, title, body, link_url)
      values (
        new.user_id,
        'application_declined',
        format('Your state co-librarian application was reviewed (%s).', new.ticket_number),
        new.reviewer_notes,
        '/my-library/'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_on_state_co_lib_decision_trigger
  on public.state_co_librarian_applications;
create trigger notify_on_state_co_lib_decision_trigger
  after update on public.state_co_librarian_applications
  for each row execute function public.notify_on_state_co_lib_decision();

-- ----------------------------------------------------------------------
-- 4. RLS — own-read / submit / head-read / head-update.
-- ----------------------------------------------------------------------

alter table public.state_co_librarian_applications enable row level security;

drop policy if exists "Own SCL application read"   on public.state_co_librarian_applications;
drop policy if exists "SCL application insert"     on public.state_co_librarian_applications;
drop policy if exists "Head librarian SCL read"    on public.state_co_librarian_applications;
drop policy if exists "Head librarian SCL update"  on public.state_co_librarian_applications;

-- An authenticated submitter can read their own applications.
create policy "Own SCL application read"
  on public.state_co_librarian_applications for select to authenticated
  using (user_id = auth.uid());

-- Anonymous and authenticated submission both allowed. (Anonymous: user_id
-- null. Authenticated: user_id must be self OR null — we let the API
-- decide which to record.)
create policy "SCL application insert"
  on public.state_co_librarian_applications for insert to authenticated, anon
  with check (user_id is null or user_id = auth.uid());

-- Head librarians and admins can read every application.
create policy "Head librarian SCL read"
  on public.state_co_librarian_applications for select to authenticated
  using (public.is_head_librarian_or_admin());

-- Head librarians and admins can update applications (status / reviewer
-- fields). The decision trigger reads the row's new state from this
-- update, so RLS on the trigger function isn't needed — definer bypass.
create policy "Head librarian SCL update"
  on public.state_co_librarian_applications for update to authenticated
  using (public.is_head_librarian_or_admin())
  with check (public.is_head_librarian_or_admin());

-- ----------------------------------------------------------------------
-- 5. Verification SELECTs. Output goes to the SQL editor result pane.
-- ----------------------------------------------------------------------

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'state_co_librarian_applications'
 order by ordinal_position;

select trigger_name, event_object_table
  from information_schema.triggers
 where event_object_table = 'state_co_librarian_applications'
 order by trigger_name;

select count(*) as state_co_librarian_application_count
  from public.state_co_librarian_applications;
