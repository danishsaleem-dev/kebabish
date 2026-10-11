-- Orders that staff enter by hand (a phone call, a WhatsApp message).
-- Run once in the Supabase SQL editor, after 0011_marketing_consent_and_saved_address.sql
-- — and BEFORE deploying the code that uses it.

-- Where the order came from. Website and WhatsApp already existed; phone and
-- "other" (with a short free-text note) are new.
alter table orders drop constraint if exists orders_channel_check;
alter table orders
  add constraint orders_channel_check
  check (channel in ('website', 'whatsapp', 'phone', 'other'));

alter table orders add column if not exists channel_note text;

-- How the order is being paid. 'mollie' is every online checkout (and the
-- default, so every existing order keeps meaning what it meant). The rest are
-- for manual orders: cash on delivery, a bank transfer, or settled later.
-- Anything other than 'mollie' has no payment provider to report back, so a
-- person marks it paid; the stale-checkout sweep must leave those alone.
alter table orders
  add column if not exists payment_method text not null default 'mollie'
    check (payment_method in ('mollie', 'cash', 'bank_transfer', 'unpaid'));

-- Which staff member entered it (null for website orders).
alter table orders
  add column if not exists created_by uuid references admin_users (id) on delete set null;
