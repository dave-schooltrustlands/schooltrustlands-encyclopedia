-- Site Update v36 — Margaret-pullback database migration.
-- =====================================================================
-- Two idempotent statements:
--
--   1. Remove the bootstrap `librarian_roles` row that v31 seeded for
--      Margaret Bird (email match: margaretraybird@gmail.com). She no
--      longer holds a librarian role on the Library; the public Library
--      attributes the institution to OASTL and to Dave Sullivan as the
--      sole founding officer. Removing the bootstrap row prevents the
--      role being assumed if she signs in.
--
--   2. Narrow the `works` row for `the-eighth-anchor` to Sullivan-only
--      authorship. The companion `schools-of-the-republic` row keeps its
--      Bird-and-Sullivan authorship unchanged — co-authorship of SoR is
--      retained.
--
-- Both statements are safe to re-run.

delete from public.librarian_roles
 where user_id in (
   select id from auth.users
    where lower(email) = lower('margaretraybird@gmail.com')
 )
   and role in ('librarian','head_librarian','admin','discussion_moderator');

update public.works
   set authors = 'Dave Sullivan'
 where slug = 'the-eighth-anchor';
