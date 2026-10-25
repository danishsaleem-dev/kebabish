-- Accounts that are created for you when you check out, with no password yet.
-- Run once in the Supabase SQL editor, after 0026. Safe to deploy the code first: until
-- this is run no account is created at checkout (orders and everything else work as before)
-- and the log says "run migration 0027".
--
-- How it fits together (see "Accounts created at checkout" in CLAUDE.md):
--   * When an order is paid, an account is created from the checkout details (name, email,
--     phone) with NO password. The customer is taken to their dashboard, and an email lets
--     them choose a password, which is what "confirms" the account.
--   * An account with no password can never sign in with one, so it cannot be used by
--     anyone who merely typed the email address.
--   * `sessions_valid_after`: the moment a password is chosen (or reset), every sign-in
--     issued before it stops working. That is what stops whoever typed somebody else's
--     email at checkout from keeping a login on the real owner's account.

alter table customers alter column password_hash drop not null;

-- 'signup' = they filled in /signup themselves; 'checkout' = created when an order was paid.
alter table customers
  add column if not exists created_via text not null default 'signup'
    check (created_via in ('signup', 'checkout'));

-- When the owner of the email address proved it (by choosing a password from the emailed link).
alter table customers add column if not exists email_confirmed_at timestamptz;

-- Sign-ins issued before this moment are no longer valid.
alter table customers add column if not exists sessions_valid_after timestamptz;

-- Everyone who already has a password signed up deliberately: count them as confirmed.
update customers
   set email_confirmed_at = created_at
 where password_hash is not null
   and email_confirmed_at is null;

-- Finds old, never-confirmed checkout accounts for the 90-day clean-up.
create index if not exists customers_unconfirmed_idx
  on customers (created_at)
  where password_hash is null;
