-- Add table_number column to registrations
-- Run in Supabase SQL Editor
alter table registrations add column if not exists table_number text;
