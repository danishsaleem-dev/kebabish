-- Real customer orders placed through the on-site checkout. Run this once
-- in the Supabase SQL editor, after 0003_store_document.sql.
--
-- Unlike the menu (see 0003), these are real columns: orders grow without
-- bound and /admin/orders filters and sorts them.
--
-- All money is integer cents, never floats — this feeds a payment
-- provider, and 0.1 + 0.2 != 0.3 in float arithmetic.
--
-- Line items snapshot the dish name, price and chosen options at the time
-- of ordering. They deliberately do NOT join back to the menu: when
-- Danish edits a price or renames a dish, past orders must keep saying
-- what the customer actually agreed to pay.
--
-- RLS enabled with no policies, same as every other table here — access
-- is only ever through the service-role client.

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  -- Human-facing, shown to the customer and in the kitchen: #KB-000123
  reference text not null unique,

  -- Set when a signed-in customer ordered; null for guest checkout.
  customer_id uuid references customers (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,

  fulfilment text not null check (fulfilment in ('delivery', 'pickup')),
  -- Null for pickup.
  address_street text,
  address_postcode text,
  address_city text,
  -- Free-text note for the whole order (allergies, door code, …).
  notes text,

  channel text not null default 'website'
    check (channel in ('website', 'whatsapp')),
  status text not null default 'new'
    check (status in ('new', 'preparing', 'on_the_way', 'delivered', 'cancelled')),

  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),

  mollie_payment_id text unique,
  payment_status text not null default 'open'
    check (payment_status in ('open', 'paid', 'failed', 'expired', 'canceled', 'refunded')),
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,

  -- Reference only; the snapshot columns below are the source of truth.
  item_slug text not null,
  name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  -- Chosen extras, snapshotted: [{ groupLabel, optionLabel, priceCents }]
  options jsonb not null default '[]'::jsonb,
  instructions text,
  line_total_cents integer not null check (line_total_cents >= 0),

  created_at timestamptz not null default now()
);

alter table orders enable row level security;
alter table order_items enable row level security;

-- /admin/orders lists newest first and filters by status; the customer
-- dashboard lists a single customer's orders.
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists order_items_order_idx on order_items (order_id);
