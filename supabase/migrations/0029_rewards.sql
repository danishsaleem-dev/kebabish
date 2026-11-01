-- Kebabish Punten (rewards): a points ledger for signed-in customers. Run once in the Supabase
-- SQL editor, after 0028_supply_purchases.sql.
--
-- Safe to deploy the code first: until this is run the rewards switch in /admin/rewards says the
-- tables aren't set up, checkout and the dashboard show no points, and nothing else changes.
--
-- The ledger is the whole truth: a balance is the sum of a customer's rows, never a stored number
-- that could drift from the history behind it. Every earn, spend, take-back and manual change is
-- one row. A row that must never happen twice (points for an order, a welcome bonus, a refund
-- clawback) carries a dedupe_key; the app inserts with "do nothing on conflict", so a repeated
-- webhook or a double click cannot pay anyone twice.
--
-- kind:
--   earn      points for a delivered, paid order
--   welcome   one-off bonus with the customer's first rewarded order
--   redeem    points spent at checkout (negative), recorded when the order is paid
--   restore   points handed back because a paid order was cancelled or refunded in full
--   clawback  earned points taken back because the order was refunded (negative)
--   adjust    staff added or removed points by hand, with a reason in note

create table if not exists reward_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  -- Deleting an order must not delete the points it paid out.
  order_id uuid references orders (id) on delete set null,
  kind text not null check (kind in ('earn', 'welcome', 'redeem', 'restore', 'clawback', 'adjust')),
  points integer not null check (points <> 0),
  note text not null default '',
  dedupe_key text unique,
  created_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table reward_ledger enable row level security;

create index if not exists reward_ledger_customer_idx on reward_ledger (customer_id, created_at desc);
create index if not exists reward_ledger_order_idx on reward_ledger (order_id);

-- Points a checkout is spending. They are "held" while the order waits for its payment, so the
-- same points cannot pay for two baskets, and are written to the ledger once the order is paid.
alter table orders add column if not exists points_redeemed integer not null default 0
  check (points_redeemed >= 0);

create or replace function reward_balance(p_customer uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(points), 0)::integer from reward_ledger where customer_id = p_customer;
$$;

-- Totals per kind, for the owner's overview ("how many points are out there").
create or replace function reward_totals()
returns table (kind text, total bigint)
language sql
stable
as $$
  select kind, coalesce(sum(points), 0)::bigint from reward_ledger group by kind;
$$;
