-- Add SMS tracking columns to open_bar_signups
-- Run this in Supabase SQL Editor before deploying the SMS feature

ALTER TABLE open_bar_signups
  ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz NULL;

-- Optional: index on phone for faster lookups when sending bulk SMS
CREATE INDEX IF NOT EXISTS idx_open_bar_signups_phone ON open_bar_signups(phone) WHERE phone IS NOT NULL;
