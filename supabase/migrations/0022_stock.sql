-- Stock / batch quantities for dishes. Run once in the Supabase SQL editor, after
-- 0021_requests_and_order_edits.sql.
--
-- Safe to deploy the code first: until this is run no dish can be given a stock quantity
-- (the dish editor says so), and every dish behaves exactly as before.
--
-- Why tables of their own and not a field on the menu: the menu is one JSON document that is
-- read and written whole, so two orders (or an order and a menu edit) at the same moment would
-- overwrite each other's stock. Here every change is one atomic statement.
--
-- 1. item_stock - one row per dish that *tracks* stock (no row = untracked, as before).
--    quantity is portions/batch left; low_threshold is where "selling fast" begins (the
--    customer sees a hurry-up tag, never the number) and where the owner is alerted.
-- 2. order_stock_holds - what an order has taken out of stock, so that taking it twice
--    (a repeated webhook) or giving it back twice (cancelling twice) can't happen.
-- 3. consume_order_stock / release_order_stock / resync_order_stock - the three moves,
--    each reading the order's own lines.

create table if not exists item_stock (
  item_slug text primary key,
  quantity integer not null default 0 check (quantity >= 0),
  low_threshold integer not null default 5 check (low_threshold >= 0),
  updated_at timestamptz not null default now()
);

alter table item_stock enable row level security;

create table if not exists order_stock_holds (
  order_id uuid not null references orders (id) on delete cascade,
  item_slug text not null,
  -- What was actually taken (never more than was in stock).
  quantity integer not null check (quantity >= 0),
  primary key (order_id, item_slug)
);

alter table order_stock_holds enable row level security;

-- Take an order's dishes out of stock - once. Only for dishes that track stock, and never
-- below zero. Returns one row per dish that was changed, so the app can tell the owner when
-- a dish has just run low or run out.
create or replace function consume_order_stock(p_order uuid)
returns table (out_slug text, out_before integer, out_after integer, out_threshold integer)
language plpgsql
as $$
declare
  r record;
  b integer;
  a integer;
  t integer;
begin
  for r in
    select oi.item_slug as slug, sum(oi.quantity)::integer as qty
    from order_items oi
    where oi.order_id = p_order
    group by oi.item_slug
  loop
    -- already taken for this order: nothing to do
    if exists (select 1 from order_stock_holds h where h.order_id = p_order and h.item_slug = r.slug) then
      continue;
    end if;

    select s.quantity, s.low_threshold into b, t
    from item_stock s where s.item_slug = r.slug for update;
    if not found then
      continue; -- this dish doesn't track stock
    end if;

    a := greatest(b - r.qty, 0);
    insert into order_stock_holds (order_id, item_slug, quantity) values (p_order, r.slug, b - a);
    update item_stock s set quantity = a, updated_at = now() where s.item_slug = r.slug;

    out_slug := r.slug;
    out_before := b;
    out_after := a;
    out_threshold := t;
    return next;
  end loop;
end;
$$;

-- Give back what an order took (it was cancelled). Safe to call twice.
create or replace function release_order_stock(p_order uuid)
returns void
language plpgsql
as $$
declare
  h record;
begin
  for h in select oh.item_slug as slug, oh.quantity as qty from order_stock_holds oh where oh.order_id = p_order loop
    update item_stock s set quantity = s.quantity + h.qty, updated_at = now() where s.item_slug = h.slug;
  end loop;
  delete from order_stock_holds where order_id = p_order;
end;
$$;

-- An order that already took its stock was edited (a dish swapped, a quantity changed):
-- give the old lines back and take the new ones. Does nothing for an order that hasn't taken
-- any stock yet.
create or replace function resync_order_stock(p_order uuid)
returns table (out_slug text, out_before integer, out_after integer, out_threshold integer)
language plpgsql
as $$
begin
  if not exists (select 1 from order_stock_holds h where h.order_id = p_order) then
    return;
  end if;
  perform release_order_stock(p_order);
  return query select * from consume_order_stock(p_order);
end;
$$;
