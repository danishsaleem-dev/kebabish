-- Referrals: give a friend money off their first order, get points when it is delivered. Run
-- once in the Supabase SQL editor, after 0029_rewards.sql.
--
-- Safe to deploy the code first: the referral switch in /admin/rewards stays off until this is
-- run, and everything else works as before.
--
-- A referral row is made when a friend places an order with someone's code. It holds no details
-- about the friend: their order already does, and the customer who invited them only ever sees
-- counts, never who it was.

create table if not exists customer_referral_codes (
  customer_id uuid primary key references customers (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table customer_referral_codes enable row level security;

-- status:
--   pending    the friend's order isn't delivered yet
--   rewarded   delivered and paid; the points were paid out
--   capped     delivered, but the customer had reached this month's limit, so no points
--   cancelled  the friend's order was cancelled or refunded in full
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references customers (id) on delete cascade,
  order_id uuid not null unique references orders (id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'capped', 'cancelled')),
  points integer not null default 0,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

alter table referrals enable row level security;

create index if not exists referrals_referrer_idx on referrals (referrer_id, created_at desc);

-- Referral points are a kind of their own in the ledger.
alter table reward_ledger drop constraint if exists reward_ledger_kind_check;
alter table reward_ledger add constraint reward_ledger_kind_check
  check (kind in ('earn', 'welcome', 'redeem', 'restore', 'clawback', 'adjust', 'referral'));
