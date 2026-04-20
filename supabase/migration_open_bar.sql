-- Create separate table for Open Bar Pass signups (public promo)
-- Run in Supabase SQL Editor

create table if not exists open_bar_signups (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  date_of_birth date not null,
  ticket_code text not null unique,
  event_datetime timestamptz,
  checked_in boolean default false,
  checked_in_at timestamptz,
  email_sent boolean default false,
  email_sent_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create unique index if not exists idx_open_bar_email_lower
  on open_bar_signups(lower(email));

create index if not exists idx_open_bar_ticket_code
  on open_bar_signups(ticket_code);

create index if not exists idx_open_bar_event_datetime
  on open_bar_signups(event_datetime);

create index if not exists idx_open_bar_created_at
  on open_bar_signups(created_at desc);

-- Enable RLS but allow the service role key to do everything
alter table open_bar_signups enable row level security;

-- Public can read nothing, write nothing via anon key
-- All writes go through our API which uses service_role key (bypasses RLS)
