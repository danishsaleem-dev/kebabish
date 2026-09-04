-- Customer accounts (self-registered via /signup), separate from
-- admin_users. Run this once in the Supabase SQL editor.
--
-- Same reasoning as 0001_admin_users.sql: RLS is enabled with no policies.
-- Every query goes through the service-role Supabase client
-- (src/lib/supabase/server.ts), which bypasses RLS entirely — the anon key
-- the browser holds can never read this table, policy or not.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  last_signed_in_at timestamptz
);

alter table customers enable row level security;

create unique index if not exists customers_email_lower_idx
  on customers (lower(email));
