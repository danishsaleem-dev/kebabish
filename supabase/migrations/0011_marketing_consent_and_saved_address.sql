-- Marketing consent and a saved delivery address for customer accounts.
-- Run once in the Supabase SQL editor, after 0010_kitchen_and_order_lifecycle.sql
-- — and BEFORE deploying the code that uses it.

-- Marketing consent. Off by default and only ever switched on by the
-- customer ticking a box; the app never infers it. We keep *when* and *where*
-- it was given (and when it was withdrawn) because consent has to be provable.
alter table customers
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text
    check (marketing_consent_source in ('signup', 'checkout', 'dashboard')),
  add column if not exists marketing_withdrawn_at timestamptz;

-- A guest has no customers row, so the consent they give while checking out
-- is recorded on the order itself (the order's own created_at is the time,
-- and the source is always the checkout).
alter table orders
  add column if not exists marketing_opt_in boolean not null default false;

-- The saved delivery address. Stored in the parts the checkout form uses
-- (rather than one combined line) so it can be put straight back into the
-- form. Only written when the customer ticks "save this address".
alter table customers
  add column if not exists saved_street text,
  add column if not exists saved_house_number text,
  add column if not exists saved_addition text,
  add column if not exists saved_postcode text,
  add column if not exists saved_city text,
  add column if not exists saved_address_at timestamptz;
