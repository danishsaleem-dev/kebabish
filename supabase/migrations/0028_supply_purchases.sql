-- Supplies purchases: one row each time boxes, bags, gloves and the like are bought. Run once in
-- the Supabase SQL editor, after 0027.
--
-- Safe to deploy the code first: until this is run, the Supplies screen says purchases aren't set
-- up and everything else (the supplies list, reports, ordering) works as before. The supplies
-- themselves live in the store document and need no migration.
--
-- Why a table and not the store document: purchases only ever grow, and the document is read
-- and written whole, so a purchase logged at the same moment as a menu edit would overwrite it.
--
-- supply_id is a plain text copy of the supply's id, not a foreign key, and supply_name is
-- copied alongside it: deleting or renaming a supply must never rewrite what was bought.

create table if not exists supply_purchases (
  id uuid primary key default gen_random_uuid(),
  supply_id text not null,
  supply_name text not null,
  -- The day it was bought, as a calendar-date label (Amsterdam), not an instant.
  purchased_on date not null,
  quantity numeric not null check (quantity > 0 and quantity <= 10000000),
  -- Integer cents, like every other amount of money here.
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 100000000),
  note text,
  created_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table supply_purchases enable row level security;

create index if not exists supply_purchases_date_idx on supply_purchases (purchased_on desc);
create index if not exists supply_purchases_supply_idx on supply_purchases (supply_id, purchased_on desc);
