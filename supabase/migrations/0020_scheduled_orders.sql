-- Orders accepted for a later day get their own status, "scheduled".
-- Run once in the Supabase SQL editor.
--
-- Until now accepting an order always made it "preparing" - even when the customer
-- had booked it for tomorrow or in two days, which told the kitchen (and the
-- customer's tracker) that cooking had started. "scheduled" means: accepted, the
-- customer knows, but nobody should be cooking it yet. The kitchen starts it on the
-- day, which makes it "preparing".
--
-- The app keeps working if this has not been run yet: it falls back to the old
-- behaviour (accept = "preparing") and writes "run migration 0020" to the log.

alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('new', 'scheduled', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'));

-- Orders that were already accepted as "preparing" but are for a later day than
-- today become "scheduled", so they stop showing as being cooked. Anything for today
-- or earlier is left alone.
update orders
   set status = 'scheduled'
 where status = 'preparing'
   and delivery_date is not null
   and delivery_date > (now() at time zone 'Europe/Amsterdam')::date;
