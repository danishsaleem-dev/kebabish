-- Adds promo-code redemption tracking to orders. Run this once in the
-- Supabase SQL editor, after 0004_orders.sql.
--
-- Promo codes themselves (percentage/fixed discount, minimum order,
-- expiry, single-use flag) live in the store_document JSONB row from
-- 0003 — they're a small, admin-managed list, the same shape as extras
-- or allergens, not a growing table.
--
-- These two columns exist here, on orders, only so "single use per
-- customer" can be enforced: checking whether a promo code was already
-- redeemed means querying past orders, which the JSONB document can't do.

alter table orders
  add column if not exists promo_code text,
  add column if not exists discount_cents integer not null default 0
    check (discount_cents >= 0);

create index if not exists orders_promo_code_idx on orders (promo_code);
