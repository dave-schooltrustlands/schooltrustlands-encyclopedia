-- Site Update v31 — Librarian Layer.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds three tables (librarian_roles, ticket_responses, librarian_applications),
-- the is_librarian() helper, RLS on all three plus two new policies on the
-- existing feedback table, and bootstrap inserts for Dave (head_librarian) and
-- Margaret (librarian — conditional on her existing in auth.users).

-- ----------------------------------------------------------------------
-- 1. librarian_roles
-- ----------------------------------------------------------------------

create table if not exists public.librarian_roles (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  role       text        not null check (role in ('librarian','head_librarian','admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid        references auth.users(id) on delete set null
);

create index if not exists librarian_roles_role_idx on public.librarian_roles (role);

-- ----------------------------------------------------------------------
-- 2. ticket_responses (polymorphic ticket_id — application-layer FK)
-- ----------------------------------------------------------------------

create table if not exists public.ticket_responses (
  id            uuid         primary key default gen_random_uuid(),
  ticket_type   text         not null check (ticket_type in ('feedback','correction','librarian_application')),
  ticket_id     uuid         not null,
  author_id     uuid         not null references auth.users(id) on delete cascade,
  author_role   text         not null check (author_role in ('patron','librarian')),
  body          text         not null,
  is_public     boolean      not null default false,
  posted_at     timestamptz  not null default now()
);

create index if not exists ticket_responses_ticket_idx
  on public.ticket_responses (ticket_type, ticket_id, posted_at);
create index if not exists ticket_responses_author_idx
  on public.ticket_responses (author_id, posted_at desc);

-- ----------------------------------------------------------------------
-- 3. librarian_applications (ticket-numbered LA-YYYY-NNNNN via v30 fn)
-- ----------------------------------------------------------------------

create table if not exists public.librarian_applications (
  id                  uuid         primary key default gen_random_uuid(),
  ticket_number       text         unique not null,
  user_id             uuid         not null references auth.users(id) on delete cascade,
  statement           text         not null,
  relevant_experience text,
  time_commitment     text,
  status              text         not null default 'new'
                                   check (status in ('new','in_review','approved','declined','withdrawn')),
  submitted_at        timestamptz  not null default now(),
  reviewed_by         uuid         references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  decision_note       text
);

create index if not exists librarian_applications_user_idx
  on public.librarian_applications (user_id);
create index if not exists librarian_applications_status_idx
  on public.librarian_applications (status);

create or replace function public.librarian_applications_assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := public.next_ticket_number('LA', extract(year from now())::int);
  end if;
  return new;
end;
$$;

drop trigger if exists librarian_applications_assign_ticket_number_trigger
  on public.librarian_applications;
create trigger librarian_applications_assign_ticket_number_trigger
  before insert on public.librarian_applications
  for each row execute function public.librarian_applications_assign_ticket_number();

-- When a patron posts a follow-up response on their own feedback ticket,
-- automatically reset the parent ticket's status to 'in_review' so it
-- reappears on the librarian dashboard. The trigger runs as security
-- definer so it can update feedback even though patrons don't have an
-- UPDATE policy on it.

create or replace function public.ticket_responses_reset_parent_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.ticket_type = 'feedback' and new.author_role = 'patron' then
    update public.feedback
       set status = 'in_review'
     where id = new.ticket_id
       and status <> 'archived';
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_responses_reset_parent_status_trigger
  on public.ticket_responses;
create trigger ticket_responses_reset_parent_status_trigger
  after insert on public.ticket_responses
  for each row execute function public.ticket_responses_reset_parent_status();

-- ----------------------------------------------------------------------
-- 4. is_librarian() — security-definer helper used inside RLS policies.
-- ----------------------------------------------------------------------
-- security definer + set search_path is what prevents a recursion deadlock:
-- policies on librarian_roles call this function; the function queries
-- librarian_roles; because it runs as definer it bypasses RLS for the
-- internal query and there's no recursion.

create or replace function public.is_librarian()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.librarian_roles where user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------
-- 4b. get_user_email(uuid) — security-definer accessor used by the API
--     layer to look up a submitter's email for transactional sends.
-- ----------------------------------------------------------------------
-- The SSR Supabase client uses the anon key; auth.users is not readable
-- via the anon role. This RPC bridges that gap with two guardrails:
--   1. security definer — function runs as owner, can read auth.users.
--   2. caller check — only librarians may invoke it. (Patrons can read
--      their own auth user via supabase.auth.getUser(); the librarian
--      side is the only place we need to resolve someone else's email.)

create or replace function public.get_user_email(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  if not public.is_librarian() then
    return null;
  end if;
  select email into v_email from auth.users where id = p_user_id;
  return v_email;
end;
$$;

-- ----------------------------------------------------------------------
-- 5. RLS on all three new tables.
-- ----------------------------------------------------------------------

alter table public.librarian_roles          enable row level security;
alter table public.ticket_responses         enable row level security;
alter table public.librarian_applications   enable row level security;

-- librarian_roles ------------------------------------------------------

drop policy if exists "Own role read"            on public.librarian_roles;
drop policy if exists "Librarians read all"      on public.librarian_roles;
drop policy if exists "Librarians write"         on public.librarian_roles;

create policy "Own role read"
  on public.librarian_roles for select to authenticated
  using (user_id = auth.uid());

create policy "Librarians read all"
  on public.librarian_roles for select to authenticated
  using (public.is_librarian());

create policy "Librarians write"
  on public.librarian_roles for all to authenticated
  using (public.is_librarian())
  with check (public.is_librarian());

-- ticket_responses -----------------------------------------------------

drop policy if exists "Own ticket responses read"    on public.ticket_responses;
drop policy if exists "Own ticket follow-up write"   on public.ticket_responses;
drop policy if exists "Librarians read all responses" on public.ticket_responses;
drop policy if exists "Librarians write responses"    on public.ticket_responses;

create policy "Own ticket responses read"
  on public.ticket_responses for select to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.feedback
       where feedback.id = ticket_responses.ticket_id
         and feedback.user_id = auth.uid()
    )
    or exists (
      select 1 from public.librarian_applications
       where librarian_applications.id = ticket_responses.ticket_id
         and librarian_applications.user_id = auth.uid()
    )
  );

create policy "Own ticket follow-up write"
  on public.ticket_responses for insert to authenticated
  with check (
    author_id = auth.uid()
    and author_role = 'patron'
    and exists (
      select 1 from public.feedback
       where feedback.id = ticket_responses.ticket_id
         and feedback.user_id = auth.uid()
    )
  );

create policy "Librarians read all responses"
  on public.ticket_responses for select to authenticated
  using (public.is_librarian());

create policy "Librarians write responses"
  on public.ticket_responses for insert to authenticated
  with check (public.is_librarian() and author_role = 'librarian');

-- librarian_applications -----------------------------------------------

drop policy if exists "Own application read"          on public.librarian_applications;
drop policy if exists "Own application insert"        on public.librarian_applications;
drop policy if exists "Librarians read applications"  on public.librarian_applications;
drop policy if exists "Librarians update applications" on public.librarian_applications;

create policy "Own application read"
  on public.librarian_applications for select to authenticated
  using (user_id = auth.uid());

create policy "Own application insert"
  on public.librarian_applications for insert to authenticated
  with check (user_id = auth.uid());

create policy "Librarians read applications"
  on public.librarian_applications for select to authenticated
  using (public.is_librarian());

create policy "Librarians update applications"
  on public.librarian_applications for update to authenticated
  using (public.is_librarian())
  with check (public.is_librarian());

-- ----------------------------------------------------------------------
-- 6. Extend feedback policies — librarians can read all and update status.
-- ----------------------------------------------------------------------

drop policy if exists "Librarians read feedback"    on public.feedback;
drop policy if exists "Librarians update feedback"  on public.feedback;

create policy "Librarians read feedback"
  on public.feedback for select to authenticated
  using (public.is_librarian());

create policy "Librarians update feedback"
  on public.feedback for update to authenticated
  using (public.is_librarian())
  with check (public.is_librarian());

-- ----------------------------------------------------------------------
-- 7. Bootstrap inserts — Dave (head_librarian) and Margaret (librarian).
-- ----------------------------------------------------------------------
-- Email-match pattern so the migration does not need a hard-coded UUID.
-- Margaret's insert is a no-op if she has not signed in yet (the select
-- against auth.users returns zero rows).

insert into public.librarian_roles (user_id, role, granted_by)
select id, 'head_librarian', id
  from auth.users
 where email = 'drdavesullivan@gmail.com'
on conflict (user_id) do update set role = excluded.role;

insert into public.librarian_roles (user_id, role, granted_by)
select u.id,
       'librarian',
       (select id from auth.users where email = 'drdavesullivan@gmail.com')
  from auth.users u
 where u.email = 'margaretraybird@gmail.com'
on conflict (user_id) do nothing;

-- Verification helper. Output goes to the SQL editor result pane.
select lr.user_id, u.email, lr.role, lr.granted_at
  from public.librarian_roles lr
  join auth.users u on u.id = lr.user_id
 order by lr.granted_at asc;
