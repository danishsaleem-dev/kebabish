-- Rider mileage: one row per rider per day, holding the odometer reading they took at the
-- start of their round and the one they took at the end. Run once in the Supabase SQL editor,
-- after 0022_stock.sql.
--
-- Safe to deploy the code first: until this is run the rider screen says the mileage log
-- isn't set up yet and everything else works exactly as before.
--
-- Why the odometer and not a computed figure: the number on the dashboard is the one the
-- rider can point at, it covers the whole round (wrong turns, a second trip for a forgotten
-- drink, the ride home), and it needs no tracking of anybody's phone. The site's own
-- straight-line estimate from the delivery addresses is kept purely as a cross-check and is
-- never written into this table.
--
-- distance_km is deliberately NOT a stored column: end_km - start_km is the whole rule, and a
-- stored copy could disagree with it after a correction.

create table if not exists rider_shifts (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references admin_users (id) on delete cascade,
  -- The Amsterdam calendar day the round belongs to, as a label. A round that runs past
  -- midnight stays on the day it started, which is how the rider thinks of it.
  shift_date date not null,
  -- Kilometres, whole numbers: that is what a dashboard shows. A reading is never negative
  -- and no vehicle this business uses reads past a million.
  start_km integer check (start_km >= 0 and start_km <= 1000000),
  start_at timestamptz,
  end_km integer check (end_km >= 0 and end_km <= 1000000),
  end_at timestamptz,
  -- The rider's own words — a detour, a vehicle swap, why the reading looks odd.
  note text,
  -- Who last touched the row: the rider themselves, or an owner/staff member correcting it.
  updated_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The end reading can never be before the start one. Enforced here as well as in the app,
  -- because a typo is the most likely thing to happen to this table.
  constraint rider_shifts_end_after_start check (end_km is null or start_km is null or end_km >= start_km),
  -- One round per rider per day. The rider screen upserts on this, so pressing "start" twice
  -- updates the reading instead of opening a second round.
  constraint rider_shifts_one_per_day unique (rider_id, shift_date)
);

alter table rider_shifts enable row level security;

-- The admin lists shifts by day across all riders, and a rider reads their own history.
create index if not exists rider_shifts_date_idx on rider_shifts (shift_date desc);
create index if not exists rider_shifts_rider_date_idx on rider_shifts (rider_id, shift_date desc);
