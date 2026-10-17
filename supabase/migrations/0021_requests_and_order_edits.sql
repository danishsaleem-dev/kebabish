-- Two features in one migration. Run once in the Supabase SQL editor, after
-- 0020_scheduled_orders.sql.
--
-- Safe to deploy the code first: until this is run the "request this dish" form says it
-- couldn't be saved, the admin screens say the table isn't set up, and an order's
-- edit history and compensation notes simply don't show (nothing else changes).
--
-- 1. stock_requests - a customer who finds a dish sold out can ask for it: how many, and
--    for when. Staff see these under Requests in the admin and get back to the customer.
-- 2. order_edits / order_line_extra - staff can change an order after it was placed (swap a
--    dish that turned out to be unavailable, change a price). `order_edits` keeps what the
--    order looked like before each change; `order_line_extra` remembers, per line, what
--    it replaced and the dish's normal price when the customer was charged less (a
--    compensation) so the bill can say so. Kept in their own tables, not as columns on
--    orders / order_items, so every existing order query keeps working untouched.

create table if not exists stock_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  item_slug text not null,
  -- A snapshot, like order lines, so a renamed or deleted dish still reads correctly.
  item_name text not null,
  quantity integer not null check (quantity between 1 and 100),

  -- When they would like it. The date is optional ("whenever you have it").
  wanted_date date,
  wanted_time text check (wanted_time is null or char_length(wanted_time) <= 5),

  customer_name text not null,
  phone text not null,
  email text not null default '',
  note text not null default '' check (char_length(note) <= 500),
  locale text not null default 'nl',

  -- new -> contacted (we called/messaged) -> done (they ordered / got it) | declined
  status text not null default 'new'
    check (status in ('new', 'contacted', 'done', 'declined')),
  handled_at timestamptz,
  handled_by uuid references admin_users (id) on delete set null
);

create index if not exists stock_requests_created_at_idx on stock_requests (created_at desc);
create index if not exists stock_requests_status_idx on stock_requests (status);

alter table stock_requests enable row level security;

-- What an edited order line replaced, and what the dish normally costs.
create table if not exists order_line_extra (
  order_item_id uuid primary key references order_items (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  -- The dish's normal price per portion (extras included) when the customer is charged
  -- less - the difference is the compensation printed on the bill. Null = no difference.
  list_unit_price_cents integer check (list_unit_price_cents is null or list_unit_price_cents >= 0),
  -- The name of what the customer originally ordered, when this line replaces it.
  replaces text
);

create index if not exists order_line_extra_order_idx on order_line_extra (order_id);
alter table order_line_extra enable row level security;

-- One row per change made to an order: who, when, why, and what it looked like before.
create table if not exists order_edits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  edited_at timestamptz not null default now(),
  edited_by uuid references admin_users (id) on delete set null,
  note text not null default '' check (char_length(note) <= 500),
  -- [{name, quantity, unitPriceCents, options, instructions}] as they were before.
  before_lines jsonb not null,
  before_total_cents integer not null,
  after_total_cents integer not null
);

create index if not exists order_edits_order_idx on order_edits (order_id, edited_at desc);
alter table order_edits enable row level security;
