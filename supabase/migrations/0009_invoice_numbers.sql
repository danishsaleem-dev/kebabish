-- Sequential invoice numbers (INV-2026-000001, INV-2026-000002, ...).
-- Run this once in the Supabase SQL editor, after 0008_delivery_slots.sql.
--
-- Dutch invoicing rules want a unique, consecutive number. The order
-- reference (#KB-123456) is random, so it can't be that — it stays as the
-- customer-facing order number and this is a separate number, handed out
-- only when an order is actually paid (an unpaid checkout never gets one).
--
-- A counter row per year, locked while it is incremented, gives numbers
-- with no gaps: a plain `sequence` skips a value whenever a transaction
-- rolls back, and an unexplained gap is exactly what a tax inspector asks
-- about.

alter table orders
  add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_key
  on orders (invoice_number)
  where invoice_number is not null;

create table if not exists invoice_counters (
  year integer primary key,
  last_number integer not null default 0
);

-- Server-only table, like the rest: the app talks to it with the
-- service-role key, which bypasses RLS.
alter table invoice_counters enable row level security;

-- Gives an order its invoice number if it doesn't have one yet, and
-- returns it. Safe to call repeatedly or concurrently: the conditional
-- update means only one call ever assigns a number to a given order.
create or replace function assign_invoice_number(p_order uuid)
returns text
language plpgsql
as $$
declare
  v_existing text;
  v_year integer;
  v_next integer;
  v_number text;
begin
  select invoice_number into v_existing from orders where id = p_order for update;
  if v_existing is not null then
    return v_existing;
  end if;

  -- The year of the invoice date (the day it was paid), in Dutch time.
  select extract(year from (coalesce(paid_at, now()) at time zone 'Europe/Amsterdam'))::integer
    into v_year
  from orders where id = p_order;
  if v_year is null then
    return null; -- no such order
  end if;

  insert into invoice_counters (year, last_number)
  values (v_year, 0)
  on conflict (year) do nothing;

  update invoice_counters
  set last_number = last_number + 1
  where year = v_year
  returning last_number into v_next;

  v_number := 'INV-' || v_year || '-' || lpad(v_next::text, 6, '0');

  update orders set invoice_number = v_number where id = p_order;
  return v_number;
end;
$$;

-- Number the orders that were already paid, oldest first, so the sequence
-- follows the order in which they were really paid.
do $$
declare
  r record;
begin
  for r in
    select id from orders
    where payment_status = 'paid' and invoice_number is null
    order by paid_at nulls last, created_at
  loop
    perform assign_invoice_number(r.id);
  end loop;
end;
$$;
