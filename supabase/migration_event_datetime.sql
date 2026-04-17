-- Add event_datetime column for the date/time the reservation is FOR
-- (separate from created_at which is when the booking was made)
-- Run in Supabase SQL Editor
alter table registrations add column if not exists event_datetime timestamptz;
create index if not exists idx_registrations_event_datetime on registrations(event_datetime);
