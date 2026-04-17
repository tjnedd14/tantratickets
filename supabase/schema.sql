-- ============================================================
-- Tantra Ticket System — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Registrations: one row per group submission
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  group_size int not null check (group_size between 1 and 5),
  event_name text default 'Tantra',
  event_date date,
  created_at timestamptz default now(),
  ip_address text,
  user_agent text
);

-- Tickets: one row per individual person in the group
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  ticket_code text unique not null,   -- short human-readable code (e.g. TNT-AB12CD)
  guest_name text not null,
  phone text not null,
  person_number int not null,         -- 1, 2, 3... within the group
  checked_in boolean default false,
  checked_in_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_tickets_code on tickets(ticket_code);
create index if not exists idx_tickets_registration on tickets(registration_id);
create index if not exists idx_registrations_phone on registrations(phone);
create index if not exists idx_registrations_created on registrations(created_at desc);

-- Row Level Security
alter table registrations enable row level security;
alter table tickets enable row level security;

-- Allow anonymous inserts from the public registration form (via anon key)
create policy "anyone can register"
  on registrations for insert
  to anon, authenticated
  with check (true);

create policy "anyone can create tickets during registration"
  on tickets for insert
  to anon, authenticated
  with check (true);

-- Allow anonymous read of tickets by ticket_code (for download link)
create policy "anyone can read their own ticket by code"
  on tickets for select
  to anon, authenticated
  using (true);

-- Admin uses service role key (bypasses RLS) for dashboard + exports
