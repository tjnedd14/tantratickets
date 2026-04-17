-- ============================================================
-- Tantra Ticket System — Supabase Schema v2 (staff-issued)
-- ============================================================
-- If you already ran v1, run the MIGRATION block at the bottom
-- to add the email column without losing data.
-- ============================================================

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text not null,
  group_size int not null check (group_size between 1 and 20),
  event_name text default 'Tantra',
  event_date date,
  notes text,
  issued_by text,                      -- hostess name who issued it
  email_sent boolean default false,
  email_sent_at timestamptz,
  created_at timestamptz default now(),
  ip_address text,
  user_agent text
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  ticket_code text unique not null,
  guest_name text not null,
  phone text not null,
  person_number int not null,
  checked_in boolean default false,
  checked_in_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_tickets_code on tickets(ticket_code);
create index if not exists idx_tickets_registration on tickets(registration_id);
create index if not exists idx_registrations_phone on registrations(phone);
create index if not exists idx_registrations_email on registrations(email);
create index if not exists idx_registrations_created on registrations(created_at desc);

alter table registrations enable row level security;
alter table tickets enable row level security;

-- Note: all writes now go through authenticated API routes using the service role key.
-- No anon policies needed.

-- ============================================================
-- MIGRATION — run ONLY if you already have v1 tables
-- ============================================================
-- alter table registrations add column if not exists email text;
-- alter table registrations add column if not exists notes text;
-- alter table registrations add column if not exists issued_by text;
-- alter table registrations add column if not exists email_sent boolean default false;
-- alter table registrations add column if not exists email_sent_at timestamptz;
-- alter table registrations alter column group_size drop constraint if exists registrations_group_size_check;
-- alter table registrations add constraint registrations_group_size_check check (group_size between 1 and 20);
-- update registrations set email = 'unknown@placeholder.com' where email is null;
-- alter table registrations alter column email set not null;
-- create index if not exists idx_registrations_email on registrations(email);
