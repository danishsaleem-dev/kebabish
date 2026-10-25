-- Invoice and order numbers now go up in steps of 7 (…, 8, 15, 22 …) instead of by 1.
-- Run once in the Supabase SQL editor. Safe to deploy the code first; nothing in the app
-- depends on the step.
--
-- Counters carry on from wherever they are: if the last invoice was INV-2026-000012 the next
-- is INV-2026-000019. A year with no counter row yet starts at 000001 and then steps by 7.
-- Credit-note numbers (CN-…) are unchanged.
--
-- Note for the accountant: Dutch invoicing rules ask for a unique, consecutive series. A fixed
-- step is still a predictable series, but if the bookkeeper wants every number accounted for,
-- tell them the step is 7.

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

  select extract(year from (coalesce(paid_at, now()) at time zone 'Europe/Amsterdam'))::integer
    into v_year
  from orders where id = p_order;
  if v_year is null then
    return null; -- no such order
  end if;

  -- One atomic statement: the first number of a year is 1, every later one is +7.
  insert into invoice_counters as c (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = c.last_number + 7
  returning c.last_number into v_next;

  v_number := 'INV-' || v_year || '-' || lpad(v_next::text, 6, '0');

  update orders set invoice_number = v_number where id = p_order;
  return v_number;
end;
$$;

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
  on conflict (year) do update set last_number = c.last_number + 7
  returning c.last_number into v_next;

  return 'KBB-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;
