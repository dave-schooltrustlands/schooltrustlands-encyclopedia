-- Site Update v32 — Engagement Breadth.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds:
--   corrections          — patron-submitted structured corrections (CR-YYYY-NNNNN)
--   works                — books / external works that can be reviewed
--   reviews              — patron book reviews (1–5 rating + body), librarian-published
--   discussions          — discussion threads (DI-YYYY-NNNNN)
--   discussion_posts     — replies in a thread
--   discussion_mutes     — per-thread reply-notification opt-out (UI ships in v33)
--   member_badges        — head-librarian-granted member labels
--   file_attachments     — uploads attached to feedback / correction / review rows
--   moderation_audit     — moderator-action ledger
--
-- Plus:
--   * `discussion_moderator` role added to librarian_roles.role
--   * is_moderator() helper
--   * Three triggers (CR + DI ticket assignment, thread-activity bump)
--   * RLS enabled + policies on all eight new tables
--   * Storage policies on the `attachments` bucket (bucket must be created manually)
--   * Bootstrap data — three in-house works, three seed discussion threads
--   * Ticket-responses RLS read policy extended to recognize correction ownership
--
-- Pre-requisite: the Supabase Storage bucket named `attachments` must exist
-- (Dashboard → Storage → New bucket → name "attachments" → Private). The
-- storage policies below assume the bucket has already been created.

-- ----------------------------------------------------------------------
-- 1. corrections — structured page-level corrections
-- ----------------------------------------------------------------------

create table if not exists public.corrections (
  id            uuid         primary key default gen_random_uuid(),
  ticket_number text         unique not null,
  user_id       uuid         not null references auth.users(id) on delete cascade,
  page_url      text         not null,
  claim         text         not null,
  proposed_fix  text         not null,
  source_offered text,
  reasoning     text,
  status        text         not null default 'new'
                             check (status in ('new','in_review','responded','accepted','rejected','archived')),
  submitted_at  timestamptz  not null default now()
);

create index if not exists corrections_user_id_idx     on public.corrections (user_id);
create index if not exists corrections_status_idx      on public.corrections (status);
create index if not exists corrections_submitted_at_idx on public.corrections (submitted_at desc);

create or replace function public.corrections_assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := public.next_ticket_number('CR', extract(year from now())::int);
  end if;
  return new;
end;
$$;
drop trigger if exists corrections_assign_ticket_number_trigger on public.corrections;
create trigger corrections_assign_ticket_number_trigger
  before insert on public.corrections
  for each row execute function public.corrections_assign_ticket_number();

alter table public.corrections enable row level security;

drop policy if exists "Own corrections read"    on public.corrections;
drop policy if exists "Own corrections insert"  on public.corrections;
drop policy if exists "Librarians read corrections"   on public.corrections;
drop policy if exists "Librarians update corrections" on public.corrections;

create policy "Own corrections read"
  on public.corrections for select to authenticated using (user_id = auth.uid());
create policy "Own corrections insert"
  on public.corrections for insert to authenticated with check (user_id = auth.uid());
create policy "Librarians read corrections"
  on public.corrections for select to authenticated using (public.is_librarian());
create policy "Librarians update corrections"
  on public.corrections for update to authenticated using (public.is_librarian())
  with check (public.is_librarian());

-- Extend the v31 ticket_responses read policy to recognize correction
-- ownership, so a correction's submitter can read librarian responses on
-- their own correction ticket the same way a feedback submitter can.

drop policy if exists "Own ticket responses read" on public.ticket_responses;
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
      select 1 from public.corrections
       where corrections.id = ticket_responses.ticket_id
         and corrections.user_id = auth.uid()
    )
    or exists (
      select 1 from public.librarian_applications
       where librarian_applications.id = ticket_responses.ticket_id
         and librarian_applications.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------
-- 2. works + reviews — the book-review surface
-- ----------------------------------------------------------------------

create table if not exists public.works (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        unique not null,
  title       text        not null,
  author      text,
  kind        text        not null check (kind in ('in_house','external')),
  cover_url   text,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.reviews (
  id           uuid         primary key default gen_random_uuid(),
  work_id      uuid         not null references public.works(id) on delete cascade,
  user_id      uuid         not null references auth.users(id) on delete cascade,
  rating       int          not null check (rating between 1 and 5),
  body         text         not null,
  is_published boolean      not null default false,
  submitted_at timestamptz  not null default now(),
  published_at timestamptz,
  published_by uuid         references auth.users(id) on delete set null,
  unique (work_id, user_id)
);

create index if not exists reviews_work_idx      on public.reviews (work_id);
create index if not exists reviews_user_idx      on public.reviews (user_id);
create index if not exists reviews_published_idx on public.reviews (is_published);

insert into public.works (slug, title, author, kind, cover_url, description)
values
  ('schools-of-the-republic', 'Schools of the Republic', 'Margaret Bird and Dave Sullivan', 'in_house',
   '/img/covers/schools-of-the-republic.jpg',
   'A state-by-state evidentiary record of America''s school trust lands.'),
  ('the-eighth-anchor', 'The Eighth Anchor', 'Dave Sullivan and Margaret Bird', 'in_house',
   '/img/covers/the-eighth-anchor.jpg',
   'How the school trust idea was built, how it has drifted, and what the architects of AI-era trusts can learn from it.'),
  ('who-steals-from-children-vol-1', 'Who Steals from Children, Volume I', 'Dave Sullivan', 'in_house',
   '/img/covers/who-steals-vol-1.jpg',
   'The Elliott State Forest case told as a journey of discovery.')
on conflict (slug) do nothing;

alter table public.works   enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Works public read"      on public.works;
create policy "Works public read"
  on public.works for select to authenticated, anon using (true);
drop policy if exists "Works librarian write"  on public.works;
create policy "Works librarian write"
  on public.works for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

drop policy if exists "Own review read"          on public.reviews;
drop policy if exists "Own review write unpublished" on public.reviews;
drop policy if exists "Reviews public read published" on public.reviews;
drop policy if exists "Librarians manage reviews"    on public.reviews;

create policy "Own review read"
  on public.reviews for select to authenticated using (user_id = auth.uid());
create policy "Own review write unpublished"
  on public.reviews for all to authenticated
  using (user_id = auth.uid() and not is_published)
  with check (user_id = auth.uid() and not is_published);
create policy "Reviews public read published"
  on public.reviews for select to authenticated, anon using (is_published);
create policy "Librarians manage reviews"
  on public.reviews for all to authenticated
  using (public.is_librarian()) with check (public.is_librarian());

-- ----------------------------------------------------------------------
-- 3. discussions + discussion_posts + discussion_mutes
-- ----------------------------------------------------------------------

create table if not exists public.discussions (
  id              uuid        primary key default gen_random_uuid(),
  ticket_number   text        unique not null,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  title           text        not null,
  body            text        not null,
  topic           text,
  status          text        not null default 'open' check (status in ('open','closed','hidden')),
  created_at      timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.discussion_posts (
  id            uuid        primary key default gen_random_uuid(),
  discussion_id uuid        not null references public.discussions(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  body          text        not null,
  is_hidden     boolean     not null default false,
  edited_at     timestamptz,
  edit_count    int         not null default 0,
  posted_at     timestamptz not null default now()
);

create table if not exists public.discussion_mutes (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  discussion_id uuid        not null references public.discussions(id) on delete cascade,
  muted_at      timestamptz not null default now(),
  primary key (user_id, discussion_id)
);

create index if not exists discussions_status_idx        on public.discussions (status);
create index if not exists discussions_last_activity_idx on public.discussions (last_activity_at desc);
create index if not exists discussion_posts_thread_idx   on public.discussion_posts (discussion_id, posted_at);

create or replace function public.discussions_assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := public.next_ticket_number('DI', extract(year from now())::int);
  end if;
  return new;
end;
$$;
drop trigger if exists discussions_assign_ticket_number_trigger on public.discussions;
create trigger discussions_assign_ticket_number_trigger
  before insert on public.discussions
  for each row execute function public.discussions_assign_ticket_number();

create or replace function public.discussion_posts_bump_thread_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.discussions
     set last_activity_at = now()
   where id = new.discussion_id;
  return new;
end;
$$;
drop trigger if exists discussion_posts_bump_thread_activity_trigger on public.discussion_posts;
create trigger discussion_posts_bump_thread_activity_trigger
  after insert on public.discussion_posts
  for each row execute function public.discussion_posts_bump_thread_activity();

alter table public.discussions      enable row level security;
alter table public.discussion_posts enable row level security;
alter table public.discussion_mutes enable row level security;

drop policy if exists "Discussions public read"       on public.discussions;
drop policy if exists "Discussions card-holder write" on public.discussions;
drop policy if exists "Discussions moderator write"   on public.discussions;
drop policy if exists "Posts public read"             on public.discussion_posts;
drop policy if exists "Posts card-holder write"       on public.discussion_posts;
drop policy if exists "Posts moderator write"         on public.discussion_posts;
drop policy if exists "Posts own author edit"         on public.discussion_posts;
drop policy if exists "Own mute read"                 on public.discussion_mutes;
drop policy if exists "Own mute write"                on public.discussion_mutes;

create policy "Discussions public read"
  on public.discussions for select to authenticated, anon using (status <> 'hidden');
create policy "Discussions card-holder write"
  on public.discussions for insert to authenticated
  with check (user_id = auth.uid());
create policy "Discussions moderator write"
  on public.discussions for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy "Posts public read"
  on public.discussion_posts for select to authenticated, anon using (not is_hidden);
create policy "Posts card-holder write"
  on public.discussion_posts for insert to authenticated
  with check (user_id = auth.uid());
create policy "Posts own author edit"
  on public.discussion_posts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Posts moderator write"
  on public.discussion_posts for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy "Own mute read"
  on public.discussion_mutes for select to authenticated using (user_id = auth.uid());
create policy "Own mute write"
  on public.discussion_mutes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------
-- 4. discussion_moderator role + is_moderator() helper
-- ----------------------------------------------------------------------
-- Extend the v31 librarian_roles.role check to accept a pure-moderator role.
-- Drops the old constraint first; safe because the constraint name was
-- written explicitly in v31.

alter table public.librarian_roles drop constraint if exists librarian_roles_role_check;
alter table public.librarian_roles add constraint librarian_roles_role_check
  check (role in ('librarian','head_librarian','admin','discussion_moderator'));

-- security definer + pinned search_path mirrors is_librarian(); the function
-- queries librarian_roles, which has RLS, so definer is what prevents a
-- recursion when this is called from inside another policy on that table.

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.librarian_roles
     where user_id = auth.uid()
       and role in ('discussion_moderator','librarian','head_librarian','admin')
  );
$$;

-- ----------------------------------------------------------------------
-- 5. member_badges
-- ----------------------------------------------------------------------

create table if not exists public.member_badges (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  badge       text        not null check (badge in (
    'state_expert','oastl_board','astl_board','friend_of_library',
    'editorial_contributor','citizen_historian'
  )),
  attribution text,
  granted_at  timestamptz not null default now(),
  granted_by  uuid        references auth.users(id) on delete set null,
  unique (user_id, badge, attribution)
);

create index if not exists member_badges_user_idx on public.member_badges (user_id);

alter table public.member_badges enable row level security;
drop policy if exists "Badges public read" on public.member_badges;
drop policy if exists "Badges head librarian write" on public.member_badges;
create policy "Badges public read"
  on public.member_badges for select to authenticated, anon using (true);
create policy "Badges head librarian write"
  on public.member_badges for all to authenticated
  using (
    exists (select 1 from public.librarian_roles where user_id = auth.uid()
              and role in ('head_librarian','admin'))
  )
  with check (
    exists (select 1 from public.librarian_roles where user_id = auth.uid()
              and role in ('head_librarian','admin'))
  );

-- ----------------------------------------------------------------------
-- 6. file_attachments — metadata rows for uploaded files
-- ----------------------------------------------------------------------

create table if not exists public.file_attachments (
  id           uuid        primary key default gen_random_uuid(),
  parent_type  text        not null check (parent_type in ('feedback','correction','review')),
  parent_id    uuid        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  storage_path text        not null,
  file_name    text        not null,
  content_type text        not null,
  byte_size    bigint      not null check (byte_size <= 10485760),
  uploaded_at  timestamptz not null default now()
);

create index if not exists file_attachments_parent_idx on public.file_attachments (parent_type, parent_id);
create index if not exists file_attachments_user_idx   on public.file_attachments (user_id);

alter table public.file_attachments enable row level security;

drop policy if exists "Own attachments read"  on public.file_attachments;
drop policy if exists "Own attachments write" on public.file_attachments;
drop policy if exists "Librarians read attachments" on public.file_attachments;

create policy "Own attachments read"
  on public.file_attachments for select to authenticated using (user_id = auth.uid());
create policy "Own attachments write"
  on public.file_attachments for insert to authenticated with check (user_id = auth.uid());
create policy "Librarians read attachments"
  on public.file_attachments for select to authenticated using (public.is_librarian());

-- Storage policies on the `attachments` bucket. The bucket must be created
-- via the Supabase dashboard before this migration runs (or the policies
-- still install but have nothing to apply to). Path convention is
-- {auth.uid()}/{parent_type}/{parent_id}/{file-uuid}-{file-name}; the first
-- segment scopes ownership.

drop policy if exists "Patron upload own folder" on storage.objects;
create policy "Patron upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Patron read own files" on storage.objects;
create policy "Patron read own files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Librarians read all attachments" on storage.objects;
create policy "Librarians read all attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_librarian());

-- ----------------------------------------------------------------------
-- 7. moderation_audit — write-only ledger of moderator actions
-- ----------------------------------------------------------------------

create table if not exists public.moderation_audit (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        not null references auth.users(id) on delete set null,
  action      text        not null,
  target_type text        not null,
  target_id   uuid        not null,
  reason      text,
  acted_at    timestamptz not null default now()
);

create index if not exists moderation_audit_actor_idx  on public.moderation_audit (actor_id, acted_at desc);
create index if not exists moderation_audit_target_idx on public.moderation_audit (target_type, target_id);

alter table public.moderation_audit enable row level security;
drop policy if exists "Moderators read audit"  on public.moderation_audit;
drop policy if exists "Moderators write audit" on public.moderation_audit;
create policy "Moderators read audit"
  on public.moderation_audit for select to authenticated using (public.is_moderator());
create policy "Moderators write audit"
  on public.moderation_audit for insert to authenticated with check (public.is_moderator());

-- ----------------------------------------------------------------------
-- 8. Bootstrap discussion seed threads, authored by Dave (head librarian).
-- ----------------------------------------------------------------------
-- We use a `not exists` predicate on title so re-runs don't insert duplicates
-- (the trigger assigns a new ticket_number on each insert, which makes the
-- ticket-number unique constraint a poor idempotency anchor).

insert into public.discussions (user_id, title, body, topic)
select id,
       'Methodology — how the substrate is built',
       'How does the substrate get built? What does Cowork-side do, what does Claude Code do, what do Margaret and I do? This thread is for questions and discussion about the working pattern itself.',
       'Methodology'
  from auth.users
 where email = 'drdavesullivan@gmail.com'
   and not exists (
     select 1 from public.discussions
      where title = 'Methodology — how the substrate is built'
   );

insert into public.discussions (user_id, title, body, topic)
select id,
       'Oregon Elliott Forest — latest filings and what they mean',
       'The Elliott State Forest case is the live litigation that grounds the project. Recent filings and developments are tracked here; questions about strategy or doctrine welcome.',
       'Oregon Elliott Forest'
  from auth.users
 where email = 'drdavesullivan@gmail.com'
   and not exists (
     select 1 from public.discussions
      where title = 'Oregon Elliott Forest — latest filings and what they mean'
   );

insert into public.discussions (user_id, title, body, topic)
select id,
       'Trust theory — first principles for forever institutions',
       'What are the design principles that make a multi-generational trust hold? What are the failure modes? This is the theoretical conversation that the books are pursuing; discussion welcome.',
       'Trust theory'
  from auth.users
 where email = 'drdavesullivan@gmail.com'
   and not exists (
     select 1 from public.discussions
      where title = 'Trust theory — first principles for forever institutions'
   );

-- ----------------------------------------------------------------------
-- 9. Verification SELECTs. Output goes to the Supabase SQL editor pane.
-- ----------------------------------------------------------------------

select slug, title from public.works order by slug;
select ticket_number, title, topic, status from public.discussions order by created_at;
select lr.user_id, u.email, lr.role
  from public.librarian_roles lr
  join auth.users u on u.id = lr.user_id
 order by lr.granted_at asc;
