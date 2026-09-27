-- Delivery time slots: 45-minute booking windows, capped per slot so the
-- kitchen never gets flooded all at once. Run this once in the Supabase
-- SQL editor, after 0007_manager_role_and_delivery.sql.
--
-- Slots themselves are NOT stored — they're generated on the fly from
-- `store_document`'s settings.hours (see src/lib/delivery-slots.ts), the
-- same way the rest of the site already treats opening hours as the
-- single source of truth. Only two things need real rows:
--
-- 1. delivery_slot_config — admin overrides, keyed by weekday + slot
--    start time (recurring: "every Thursday 18:00 slot", not a specific
--    date). Sparse on purpose: a slot with no row here just uses the
--    defaults (max_orders 10, enabled true) baked into
--    reserve_delivery_slot() below, so changing opening hours doesn't
--    require touching this table at all.
--
-- 2. delivery_slot_bookings — the live counter, keyed by the *specific*
--    date + slot start (every Thursday has its own count, not a shared
--    rolling one). A dedicated counter table with row-level locking
--    (`for update` in reserve_delivery_slot) rather than counting
--    `orders` directly — counting rows can't stop a concurrent insert
--    from slipping past the check (the classic phantom-read problem);
--    a locked counter row can.

create table if not exists delivery_slot_config (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6), -- 0 = Sunday, matches StoredSettings.hours
  slot_start text not null, -- "HH:MM"
  max_orders integer not null default 10 check (max_orders > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (weekday, slot_start)
);

create table if not exists delivery_slot_bookings (
  delivery_date date not null,
  slot_start text not null, -- "HH:MM"
  booked_count integer not null default 0 check (booked_count >= 0),
  primary key (delivery_date, slot_start)
);

alter table delivery_slot_config enable row level security;
alter table delivery_slot_bookings enable row level security;

-- Atomically checks capacity and reserves one seat in a single locked
-- transaction, so two customers racing for the last spot in a slot can't
-- both succeed. Returns false (no exception) on a full/disabled slot —
-- checkoutAction turns that into the "slotFull" error the customer sees.
-- p_weekday is passed in rather than derived from p_date so the caller
-- (already computing it from the Amsterdam-local date for the cutoff
-- check) doesn't have to trust Postgres's own date_part("dow", ...),
-- which follows the session's timezone setting, not Amsterdam's.
create or replace function reserve_delivery_slot(
  p_date date,
  p_weekday integer,
  p_slot_start text
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
    v_max := 10;
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

-- The other half of reserve_delivery_slot(): called when a reserved order
-- never actually happens (payment failed/expired/cancelled, or staff
-- cancelled the order) so the seat goes back into the pool instead of
-- silently shrinking the slot's real capacity over time.
create or replace function release_delivery_slot(
  p_date date,
  p_slot_start text
) returns void
language plpgsql
as $$
begin
  update delivery_slot_bookings
  set booked_count = greatest(booked_count - 1, 0)
  where delivery_date = p_date and slot_start = p_slot_start;
end;
$$;

alter table orders
  add column if not exists delivery_date date,
  add column if not exists delivery_slot_start text,
  add column if not exists delivery_slot_end text;

create index if not exists orders_delivery_date_idx on orders (delivery_date);
