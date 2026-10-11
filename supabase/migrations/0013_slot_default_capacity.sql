-- Lets the owner set how many orders a delivery slot takes (a shop-wide default
-- and a per-weekday override) instead of it being fixed at 10.
-- Run once in the Supabase SQL editor, after 0012_manual_orders.sql.
--
-- The capacity setting lives in the JSON settings document, which Postgres
-- can't read, so the app works out the limit and *passes it in*. This adds a
-- second version of reserve_delivery_slot() that takes it as p_default_max.
-- The original three-argument version is left in place on purpose: the app
-- falls back to it if this one is missing, so deploying before running this
-- never breaks checkout (it just keeps the old limit of 10 until it is run).
--
-- Behaviour is otherwise identical: a limit set on one exact weekday + time in
-- delivery_slot_config still wins; the default only applies where no such row
-- exists. Locking and the check-then-increment are unchanged.

create or replace function reserve_delivery_slot(
  p_date date,
  p_weekday integer,
  p_slot_start text,
  p_default_max integer
) returns boolean
language plpgsql
as $$
declare
  v_max integer;
  v_enabled boolean;
  v_count integer;
begin
  select max_orders, enabled into v_max, v_enabled
  from delivery_slot_config
  where weekday = p_weekday and slot_start = p_slot_start;

  if not found then
    v_max := p_default_max;
    v_enabled := true;
  end if;

  if not v_enabled then
    return false;
  end if;

  insert into delivery_slot_bookings (delivery_date, slot_start, booked_count)
  values (p_date, p_slot_start, 0)
  on conflict (delivery_date, slot_start) do nothing;

  select booked_count into v_count
  from delivery_slot_bookings
  where delivery_date = p_date and slot_start = p_slot_start
  for update;

  if v_count >= v_max then
    return false;
  end if;

  update delivery_slot_bookings
  set booked_count = booked_count + 1
  where delivery_date = p_date and slot_start = p_slot_start;

  return true;
end;
$$;
