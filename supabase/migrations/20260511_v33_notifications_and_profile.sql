-- Site Update v33 — Notifications + Public-profile opt-in.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds:
--   notifications     — patron-visible inbox rows (every email-send path
--                       also writes a row here in v33+)
--   profiles.is_public_profile  — opt-in flag for the /p/[patron-number]/ page
--   profiles.bio                — optional 500-char public bio
--   Three security-definer triggers that write notifications rows:
--     notify_on_ticket_response   — librarian responds to a ticket
--     notify_on_review_publish    — a review flips to is_published=true
--     notify_on_badge_granted     — a member_badges row is inserted
--
-- Application-decision notifications (approve/decline) and discussion-reply
-- notifications are handled in the API layer (see decide.ts and
-- discussion-post.ts) because they have per-recipient business logic
-- (one of two emails / per-thread mute filter).
--
-- Pre-requisite: v32 must already be applied (this migration assumes the
-- tables `feedback`, `corrections`, `librarian_applications`,
-- `ticket_responses`, `reviews`, `works`, `member_badges`, `profiles`
-- and the helper `public.is_moderator()` already exist).

-- ----------------------------------------------------------------------
-- 1. notifications table
-- ----------------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null check (kind in (
                   'response_received','review_published','application_approved',
                   'application_declined','discussion_reply','badge_granted',
                   'ticket_status_changed'
                 )),
  title       text        not null,
  body        text,
  link_url    text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Own notifications read"          on public.notifications;
drop policy if exists "Own notifications update"        on public.notifications;
drop policy if exists "Librarians insert notifications" on public.notifications;

-- A patron can read their own notifications.
create policy "Own notifications read"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- A patron can mark their own notifications read (and only that — the
-- with-check keeps them on their own row).
create policy "Own notifications update"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Notifications are written either by triggers (security definer; bypasses
-- RLS) or by server-side endpoints running as the authenticated librarian.
-- This policy gates the librarian path: only moderators / librarians /
-- head_librarian / admin can insert notifications for other users.
create policy "Librarians insert notifications"
  on public.notifications for insert to authenticated
  with check (public.is_moderator());

-- ----------------------------------------------------------------------
-- 2. profiles — is_public_profile + bio
-- ----------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_public_profile boolean not null default false,
  add column if not exists bio text;

-- Public profiles read policy — separate from the patron's own read
-- policy from earlier migrations; this adds the anyone-can-read side
-- gated on the opt-in flag.
drop policy if exists "Public profiles read" on public.profiles;
create policy "Public profiles read"
  on public.profiles for select to authenticated, anon
  using (is_public_profile);

-- ----------------------------------------------------------------------
-- 3. Triggers that auto-insert notifications
-- ----------------------------------------------------------------------

-- 3a. Ticket-response trigger — when a librarian inserts a ticket_responses
-- row, write a notification to the submitter of the parent ticket. We
-- key off author_role = 'librarian' so the patron-followup endpoint
-- (which writes author_role = 'patron') does not fire this.

create or replace function public.notify_on_ticket_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submitter    uuid;
  v_ticket_label text;
begin
  if new.author_role <> 'librarian' then return new; end if;

  if new.ticket_type = 'feedback' then
    select user_id, ticket_number into v_submitter, v_ticket_label
      from public.feedback where id = new.ticket_id;
  elsif new.ticket_type = 'correction' then
    select user_id, ticket_number into v_submitter, v_ticket_label
      from public.corrections where id = new.ticket_id;
  elsif new.ticket_type = 'librarian_application' then
    select user_id, ticket_number into v_submitter, v_ticket_label
      from public.librarian_applications where id = new.ticket_id;
  else
    return new;
  end if;

  if v_submitter is null then return new; end if;

  insert into public.notifications (user_id, kind, title, body, link_url)
  values (
    v_submitter,
    'response_received',
    format('A librarian responded to %s', coalesce(v_ticket_label, 'your ticket')),
    substring(new.body from 1 for 200),
    format('/my-library/tickets/%s/', new.ticket_id)
  );

  return new;
end;
$$;

drop trigger if exists notify_on_ticket_response_trigger on public.ticket_responses;
create trigger notify_on_ticket_response_trigger
  after insert on public.ticket_responses
  for each row execute function public.notify_on_ticket_response();

-- 3b. Review-publish trigger — when reviews.is_published flips from
-- false to true, notify the author.

create or replace function public.notify_on_review_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_work_title text;
  v_work_slug  text;
begin
  if new.is_published and (old.is_published is distinct from new.is_published) then
    select title, slug into v_work_title, v_work_slug
      from public.works where id = new.work_id;
    insert into public.notifications (user_id, kind, title, link_url)
    values (
      new.user_id,
      'review_published',
      format('Your review of "%s" is now published.', coalesce(v_work_title, 'a work')),
      format('/reading/%s/reviews/', coalesce(v_work_slug, ''))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_review_publish_trigger on public.reviews;
create trigger notify_on_review_publish_trigger
  after update on public.reviews
  for each row execute function public.notify_on_review_publish();

-- 3c. Badge-granted trigger — when a member_badges row is inserted,
-- notify the recipient.

create or replace function public.notify_on_badge_granted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, kind, title, body)
  values (
    new.user_id,
    'badge_granted',
    'A new badge was added to your patron card.',
    new.badge || coalesce(' (' || new.attribution || ')', '')
  );
  return new;
end;
$$;

drop trigger if exists notify_on_badge_granted_trigger on public.member_badges;
create trigger notify_on_badge_granted_trigger
  after insert on public.member_badges
  for each row execute function public.notify_on_badge_granted();

-- ----------------------------------------------------------------------
-- 4. Verification SELECTs
-- ----------------------------------------------------------------------

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'notifications'
 order by ordinal_position;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('is_public_profile','bio')
 order by column_name;

select trigger_name, event_object_table
  from information_schema.triggers
 where trigger_name in (
   'notify_on_ticket_response_trigger',
   'notify_on_review_publish_trigger',
   'notify_on_badge_granted_trigger'
 )
 order by trigger_name;
