-- Staff can reopen an unpaid order so the customer can still pay it.
--
-- Run once in the Supabase SQL editor, after 0032_marketing_contacts.sql. Safe to re-run.
-- Safe to deploy the code first: until this is run, customers still get their normal 24
-- hours to pay again, and only the admin "Reopen payment" button says it isn't set up.
--
-- One row per order (reopening again replaces it). `delivery_date` / `delivery_slot_start`
-- are the time staff approved: for exactly that time the ordering cutoff is not applied.

create table if not exists order_payment_reopens (
  order_id uuid primary key references orders (id) on delete cascade,
  open_until timestamptz not null,
  delivery_date date,
  delivery_slot_start text,
  opened_by uuid references admin_users (id) on delete set null,
  opened_at timestamptz not null default now()
);

alter table order_payment_reopens enable row level security;
