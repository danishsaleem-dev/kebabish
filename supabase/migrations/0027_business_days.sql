-- Closing the day by hand: one row per closed business day.
-- Run once in the Supabase SQL editor, after 0026. Safe to deploy the code first: until this is
-- run, /admin/close-day says it isn't set up and reports keep using calendar days.
--
-- A business day is the stretch between two presses of "Close the day", not a calendar day:
-- the kitchen sometimes starts early and orders come in after midnight. Each day opens at the
-- moment the previous one was closed (the app sets opened_at = the last closed_at), so the
-- days are back to back. The open day is never stored — it is "since the last closing".
--
-- business_date is the label reports file the day under. It is unique, which is also what stops
-- two people closing the same day at the same instant: the second insert fails.

create table if not exists business_days (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  opened_at timestamptz not null,
  closed_at timestamptz not null unique,
  closed_by uuid references admin_users (id) on delete set null,
  -- Kept as text too, so the history still says who closed it after that account is removed.
  closed_by_name text,
  -- "Audit done": the person closing confirmed the cash and that nothing is pending.
  audit_done boolean not null default true,
  audit_note text check (audit_note is null or char_length(audit_note) <= 1000),
  -- The day's figures at the moment it was closed (orders, revenue, cash expected, ...), so the
  -- history shows what was signed off even if an order is edited or refunded later.
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint business_days_closes_after_opening check (closed_at > opened_at)
);

create index if not exists business_days_closed_at_idx on business_days (closed_at desc);

-- Server-only, like every table here: reached with the service-role key.
alter table business_days enable row level security;
