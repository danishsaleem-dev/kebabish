-- "Did I save this customer's number in my phone?" — a tick per customer on /admin/customers.
-- Run once in the Supabase SQL editor, after 0025. Safe to deploy the code first: until this
-- is run the contact icon shows as not saved and clicking it says the table isn't set up.
--
-- Keyed by the Customers screen's own id: the account uuid for a registered customer, or
-- `guest:<email|tel:digits>` for a guest (guests have no row of their own). Only ticked
-- customers have a row; unticking deletes it.

create table if not exists customer_contact_saved (
  customer_key text primary key,
  saved_at timestamptz not null default now(),
  saved_by uuid references admin_users (id) on delete set null
);

-- Server-only, like every table here: reached with the service-role key.
alter table customer_contact_saved enable row level security;
