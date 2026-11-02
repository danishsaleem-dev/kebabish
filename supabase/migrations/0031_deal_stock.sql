-- Deals take their dishes out of stock. Run once in the Supabase SQL editor, after
-- 0030_referrals.sql.
--
-- Safe to deploy the code first: deals can be created and ordered without this, but a deal's
-- dishes won't leave stock until it has been run. Dishes ordered on their own are unaffected.
--
-- A deal is one order line with the slug 'deal:<slug>'. Each of its dishes is an element of that
-- line's `options` JSON: {"deal": {"item": "<dish slug>", "qty": <portions in one deal>, ...}}. A
-- part the customer took out has "item": null. resync_order_stock and release_order_stock read
-- through consume_order_stock / order_stock_holds, so only this function changes.

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
    select parts.slug, sum(parts.qty)::integer as qty
    from (
      select oi.item_slug as slug, oi.quantity as qty
      from order_items oi
      where oi.order_id = p_order and oi.item_slug not like 'deal:%'
      union all
      select part -> 'deal' ->> 'item', oi.quantity * (part -> 'deal' ->> 'qty')::integer
      from order_items oi
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(oi.options) = 'array' then oi.options else '[]'::jsonb end
      ) as part
      where oi.order_id = p_order
        and oi.item_slug like 'deal:%'
        and part -> 'deal' ->> 'item' is not null
    ) parts
    group by parts.slug
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
