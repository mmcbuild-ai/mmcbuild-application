-- check-foreign-portfolio-data.sql
--
-- Purpose: before dumping the MMC Build Supabase project for migration into
-- MMC Build's own org, confirm the project contains ONLY mmcbuild data and not
-- data belonging to other portfolio products. A clean result means a full
-- pg_dump is safe; a dirty result means the dump must be schema/table-scoped.
--
-- Run against the SOURCE project in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/<source-ref>/sql/new
--
-- CLI equivalent used during the 2026-05-25 check (no psql needed):
--   supabase inspect db table-stats --linked
-- (the linked project was skyeqimwnyuuozvhubdc "MMC Build", Mumbai — result: clean)

-- 1. Non-system schemas and their table counts.
--    Expect: public (+ supabase-managed auth/storage/realtime). Any unexpected
--    app schema is a red flag.
select n.nspname as schema,
       count(c.oid) filter (where c.relkind = 'r') as tables
from pg_namespace n
left join pg_class c on c.relnamespace = n.oid
where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_temp%'
  and n.nspname not like 'pg_toast_temp%'
group by n.nspname
order by tables desc;

-- 2. Every base table in public with estimated row counts.
--    Eyeball for any table that does NOT belong to an MMC Build module
--    (Comply / Build / Quote / Direct / Train / Billing / R&D / projects / core).
--    Foreign signals would be e.g. lingo_*, kira_*, interview_*, pitch_*,
--    investor_*, tender_*, ndis_*, sda_*.
select schemaname,
       relname as table_name,
       n_live_tup as est_rows
from pg_stat_user_tables
order by schemaname, relname;

-- 3. auth.users footprint by email domain — catches foreign/test users from
--    another product if the auth instance were ever shared.
select split_part(email, '@', 2) as email_domain,
       count(*) as users
from auth.users
group by 1
order by 2 desc;

-- 4. Storage buckets — catches assets belonging to other products.
select id, name, public
from storage.buckets
order by name;
