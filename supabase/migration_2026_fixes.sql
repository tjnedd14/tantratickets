-- ============================================================
-- Tantra Tickets — May 2026 fixes migration
--
-- Run this in Supabase SQL Editor AFTER pulling the new code.
-- Each statement is idempotent (safe to re-run).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Widen group_size cap to 100 per reservation
-- ------------------------------------------------------------
alter table registrations drop constraint if exists registrations_group_size_check;
alter table registrations
  add constraint registrations_group_size_check
  check (group_size between 1 and 100);

-- ------------------------------------------------------------
-- 2. Ensure is_vip column exists on both tables
-- ------------------------------------------------------------
alter table registrations    add column if not exists is_vip boolean not null default false;
alter table open_bar_signups add column if not exists is_vip boolean not null default false;

-- ------------------------------------------------------------
-- 3. Indexes that speed up the dashboard's filters
-- ------------------------------------------------------------
create index if not exists idx_registrations_event_datetime    on registrations(event_datetime);
create index if not exists idx_open_bar_signups_event_datetime on open_bar_signups(event_datetime);
create index if not exists idx_registrations_is_vip            on registrations(is_vip) where is_vip = true;
create index if not exists idx_open_bar_signups_is_vip         on open_bar_signups(is_vip) where is_vip = true;

-- ============================================================
-- 4. RECOVERY: redistribute clustered reservations from May 23
-- ============================================================
--
-- Background: a frontend bug defaulted event_datetime to "today at
-- 9pm" instead of "the next Tantra night". Reservations entered Mon–Sat
-- of one week were ALL tagged with the day they were entered, even
-- though the customer was actually coming on the upcoming Friday/Saturday.
--
-- Recovery strategy: use `created_at` (which is reliable — it's just a
-- timestamp of when the row was inserted) to figure out which event
-- night a reservation was for, then rewrite event_datetime.
--
-- Most-common pattern at Tantra:
--   Reservations made Mon → Fri are for the upcoming Friday or Saturday
--   Reservations made on Sat are for Sat itself
--   Reservations made on Sun are for the following Fri/Sat
--
-- The block below is COMMENTED OUT on purpose — you must inspect the
-- data and uncomment / adjust the WHERE clauses before running. Run
-- each block in a transaction, check the row count, then commit.
--
-- ----- Step A: see what's in the cluster -----
--
-- select
--   to_char(event_datetime at time zone 'America/Aruba', 'YYYY-MM-DD Dy') as event_aruba,
--   count(*) as n
-- from registrations
-- where event_datetime >= '2026-05-15T00:00:00-04:00'
--   and event_datetime <  '2026-05-30T00:00:00-04:00'
-- group by 1
-- order by 1;
--
-- ----- Step B: see what's in the May 23 cluster, with created_at -----
--
-- select
--   id,
--   full_name,
--   group_size,
--   table_number,
--   to_char(created_at   at time zone 'America/Aruba', 'YYYY-MM-DD HH24:MI Dy') as made_at_aruba,
--   to_char(event_datetime at time zone 'America/Aruba', 'YYYY-MM-DD Dy')        as event_aruba
-- from registrations
-- where event_datetime::date = '2026-05-23'
-- order by created_at;
--
-- ----- Step C: re-assign by created_at week -----
-- Adjust the date ranges to match what you actually have. Each block
-- moves reservations entered in a given week to a specific Sat night.
-- (Switch the target date to whichever event night was actually planned.)
--
-- Example: reservations entered between Mon May 11 and Sat May 16 (Aruba)
-- that got tagged May 23 were probably meant for Sat May 16 at 9pm.
--
-- begin;
-- update registrations
-- set event_datetime = '2026-05-16T21:00:00-04:00'
-- where event_datetime::date = '2026-05-23'
--   and created_at >= '2026-05-11T00:00:00-04:00'
--   and created_at <  '2026-05-17T00:00:00-04:00';
-- -- verify count, then either commit or rollback:
-- -- select count(*) from registrations where event_datetime = '2026-05-16T21:00:00-04:00';
-- commit;
--
-- Example: reservations entered between Mon May 18 and Sat May 23 → meant for Sat May 23 at 9pm:
-- begin;
-- update registrations
-- set event_datetime = '2026-05-23T21:00:00-04:00'
-- where event_datetime::date = '2026-05-23'
--   and created_at >= '2026-05-18T00:00:00-04:00'
--   and created_at <  '2026-05-24T00:00:00-04:00';
-- commit;
--
-- Example: stragglers entered Sun May 24 onwards that were intended for the NEXT Friday May 29:
-- begin;
-- update registrations
-- set event_datetime = '2026-05-29T21:00:00-04:00'
-- where event_datetime::date = '2026-05-23'
--   and created_at >= '2026-05-24T00:00:00-04:00';
-- commit;
--
-- After running, re-run Step A to confirm the distribution looks right.
-- The admin Reservations tab has a new "Reassign date" bulk action you
-- can use for any stragglers without writing SQL.
