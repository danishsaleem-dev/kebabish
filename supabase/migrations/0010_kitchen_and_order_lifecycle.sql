-- Kitchen acceptance timing, a "ready" order status, the customer's language
-- and refund bookkeeping. Run once in the Supabase SQL editor, after
-- 0009_invoice_numbers.sql — and BEFORE deploying the code that uses it,
-- since the admin order queries read these columns.

-- "ready" sits between preparing and on_the_way: the food is done and
-- waiting for the rider. Optional in the app (preparing -> on_the_way is
-- still allowed), so a small kitchen isn't forced through an extra tap.
alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('new', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'));

-- When the kitchen accepted the order (new -> preparing). Lets reports show
-- how long customers' orders waited for a decision.
alter table orders add column if not exists accepted_at timestamptz;

-- Set once when the "nobody has accepted this order" escalation email has
-- gone out, so it is sent a single time rather than every minute.
alter table orders add column if not exists escalated_at timestamptz;

-- The language the customer ordered in, so later emails (preparing, out for
-- delivery, ...) are in the same language as the site they used.
alter table orders add column if not exists locale text not null default 'nl';

-- Money handed back through Mollie. `payment_status` becomes 'refunded'
-- when a full refund is issued; the amount is kept for the record.
alter table orders add column if not exists refunded_cents integer not null default 0;
alter table orders add column if not exists refunded_at timestamptz;
