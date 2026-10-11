-- Orders paid through a shared Mollie Payment Link (the interim, manual payment
-- mode — see src/lib/payment-link.ts). Run once in the Supabase SQL editor,
-- after 0016_order_numbers.sql, and BEFORE turning the mode on in
-- Admin -> Settings (an order with this method would otherwise be rejected).

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders
  add constraint orders_payment_method_check
  check (payment_method in ('mollie', 'cash', 'bank_transfer', 'unpaid', 'payment_link'));
