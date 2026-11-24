-- Table privileges for the API roles.
--
-- Newer hosted Supabase projects no longer grant anon/authenticated/service_role access to new
-- tables in `public` by default (the local stack still does), so without this every query on the
-- live project fails with "permission denied for table ...". Row-level security still decides
-- which rows each role sees; these grants only let the roles reach the tables at all.
--
-- Least privilege:
--   anon           read-only on the public menu tables and the public settings view.
--   authenticated  full table access, gated by RLS (staff policies use is_staff()).
--   service_role   full access (server-side only; bypasses RLS).
-- Function EXECUTE grants are left exactly as earlier migrations set them.

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.sections, public.items, public.delivery_areas, public.public_settings
  to anon;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Tables and sequences added by later migrations get the same access automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
