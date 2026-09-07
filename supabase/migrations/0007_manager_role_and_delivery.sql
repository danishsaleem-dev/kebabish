-- Adds a fourth admin_users role ("manager") and a delivered_at timestamp
-- on orders. Run this once in the Supabase SQL editor, after
-- 0006_rider_role.sql.
--
-- Manager gets the same /admin shell as owner/staff (no separate route,
-- unlike rider) but a narrower nav: Dashboard, Orders, Menu (food items
-- only), Customers. The narrower access is enforced in the app (route
-- guards on the owner/staff-only subtrees), not in the database — this
-- migration only needs to let the role exist.

alter table admin_users drop constraint if exists admin_users_role_check;
alter table admin_users
  add constraint admin_users_role_check check (role in ('owner', 'staff', 'rider', 'manager'));

-- Set once, when a status update actually lands on "delivered" — see
-- updateOrderStatus() in orders-data.ts. Distinct from updated_at, which
-- changes on every edit to the row for any reason.
alter table orders
  add column if not exists delivered_at timestamptz;
