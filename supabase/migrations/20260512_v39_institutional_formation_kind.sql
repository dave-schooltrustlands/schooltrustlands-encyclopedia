-- Site Update v39 — Institutional-Formation feedback kind.
--
-- Apply in the Supabase SQL editor. Idempotent; safe to run repeatedly.
--
-- Adds:
--   * feedback.kind text column (default 'general'; check constraint accepts
--     'general' and 'institutional_formation' at v39; the vocabulary is
--     intentionally closed so the librarian dashboard can switch on it).
--   * feedback_kind_idx index, since the dashboard's Institutional-Formation
--     tab filters by kind.
--   * notify_on_institutional_formation_feedback() trigger that writes a
--     notification row to each founding officer when a feedback row arrives
--     with kind='institutional_formation'. Founding officers are read from
--     librarian_roles where role in ('head_librarian','admin'). With only
--     Dave seated today the trigger writes one notification per submission;
--     when Margaret is restored to head_librarian both will receive one.
--
-- Pre-requisite: v30 (feedback) + v31 (librarian_roles) + v33 (notifications)
-- must already be applied. v35 forward-declared is_head_librarian_or_admin()
-- which we re-use unchanged.

-- ----------------------------------------------------------------------
-- 1. feedback.kind column + check constraint.
-- ----------------------------------------------------------------------

alter table public.feedback
  add column if not exists kind text not null default 'general';

-- Drop-and-recreate the check so re-running the migration is idempotent
-- and the vocabulary can be widened cleanly in future migrations.
alter table public.feedback
  drop constraint if exists feedback_kind_check;
alter table public.feedback
  add constraint feedback_kind_check
  check (kind in ('general','institutional_formation'));

create index if not exists feedback_kind_idx on public.feedback (kind);

-- ----------------------------------------------------------------------
-- 2. Founding-officers notification trigger.
-- ----------------------------------------------------------------------
-- When a feedback row arrives with kind='institutional_formation', insert a
-- notifications row for each founding officer (head_librarian / admin) so
-- the submission surfaces in their inbox in addition to the dashboard tab.
-- Security definer so the trigger bypasses notifications RLS.

create or replace function public.notify_on_institutional_formation_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_officer record;
begin
  if new.kind <> 'institutional_formation' then
    return new;
  end if;

  for v_officer in
    select user_id from public.librarian_roles
     where role in ('head_librarian','admin')
  loop
    insert into public.notifications (user_id, kind, title, body, link_url)
    values (
      v_officer.user_id,
      'institutional_formation_feedback',
      format('Institutional-formation feedback (%s)', new.ticket_number),
      coalesce(new.subject, left(new.body, 200)),
      format('/librarian/institutional-formation/%s/', new.id)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_on_institutional_formation_feedback_trigger
  on public.feedback;
create trigger notify_on_institutional_formation_feedback_trigger
  after insert on public.feedback
  for each row execute function public.notify_on_institutional_formation_feedback();

-- ----------------------------------------------------------------------
-- 3. Verification SELECTs. Output lands in the SQL editor result pane.
-- ----------------------------------------------------------------------

select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'feedback'
   and column_name = 'kind';

select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conname = 'feedback_kind_check';

select trigger_name
  from information_schema.triggers
 where event_object_table = 'feedback'
   and trigger_name = 'notify_on_institutional_formation_feedback_trigger';

select kind, count(*) as n
  from public.feedback
 group by kind
 order by kind;
