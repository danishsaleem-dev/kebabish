-- Admin panel accounts (owner + staff logins for /admin).
--
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New
-- query) before signing in to the admin panel for the first time. Nothing in
-- the app runs migrations automatically — this is intentionally a manual,
-- reviewable step against your production database.
--
-- RLS is enabled with NO policies attached. That's deliberate: every query
-- against this table goes through the server-role Supabase client
-- (src/lib/supabase/server.ts), which bypasses RLS entirely. The anon key
-- used by the browser can never read or write this table, policy or not.

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  last_signed_in_at timestamptz
);

alter table admin_users enable row level security;

-- Case-insensitive lookups on sign-in without a second index.
create unique index if not exists admin_users_email_lower_idx
  on admin_users (lower(email));
