-- Sequential, readable order numbers: KBB-2026-000001, KBB-2026-000002, ...
-- Run once in the Supabase SQL editor, after 0015_kitchen_role.sql. Safe to
-- deploy the code first: until this is run, new orders fall back to the old
-- random #KB-123456 format.
--
-- A counter row per year, bumped in one atomic statement — two checkouts at the
-- same instant can't be given the same number. Unlike invoice numbers this
-- does not have to be gap-free: a checkout that is abandoned has still used its
-- number, and that is fine for an order number (the invoice number, handed out
-- only when an order is paid, is the one that must have no gaps).
--
-- Existing orders keep their old reference; nothing is renamed.

create table if not exists order_counters (
  year integer primary key,
  last_number integer not null default 0
);

-- Server-only, like the rest: reached with the service-role key.
alter table order_counters enable row level security;

create or replace function next_order_reference()
returns text
language plpgsql
as $$
declare
  v_year integer := extract(year from (now() at time zone 'Europe/Amsterdam'))::integer;
  v_next integer;
begin
  insert into order_counters as c (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = c.last_number + 1
  returning c.last_number into v_next;

  return 'KBB-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;
