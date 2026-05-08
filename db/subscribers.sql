-- ============================================================================
-- Subscribers table for WhatsApp / SMS marketing
-- ============================================================================
-- Stores phone numbers separately from open_bar_signups so you can build a
-- long-term marketing list (event promos, ladies night announcements, etc.)
-- without tying numbers to a specific event.
--
-- Phones are normalized to E.164-ish format on insert (digits + leading +).
-- ============================================================================

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  opted_in boolean not null default true,
  source text not null default 'manual', -- 'manual' | 'open_bar' | 'reservation' | 'csv_import'
  last_messaged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscribers_phone_idx on subscribers(phone);
create index if not exists subscribers_opted_in_idx on subscribers(opted_in);
create index if not exists subscribers_source_idx on subscribers(source);
create index if not exists subscribers_created_at_idx on subscribers(created_at desc);

alter table subscribers enable row level security;
-- (admin endpoints use service role key — no public policies needed)

-- ============================================================================
-- Optional: backfill existing Open Bar phone numbers as subscribers
-- ============================================================================
-- Run this ONCE to import all your existing guests' phone numbers into the
-- subscribers list. Skips duplicates and missing/empty phones.
--
-- Comment out / re-run safe (uses ON CONFLICT DO NOTHING).
-- ============================================================================

insert into subscribers (phone, source, opted_in)
select distinct
  trim(phone) as phone,
  'open_bar' as source,
  true as opted_in
from open_bar_signups
where phone is not null
  and trim(phone) <> ''
on conflict (phone) do nothing;

-- Backfill from registrations (reservations) too
insert into subscribers (phone, source, opted_in)
select distinct
  trim(phone) as phone,
  'reservation' as source,
  true as opted_in
from registrations
where phone is not null
  and trim(phone) <> ''
on conflict (phone) do nothing;
