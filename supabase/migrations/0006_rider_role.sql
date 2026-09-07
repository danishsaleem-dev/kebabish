-- Adds a third admin_users role ("rider") and lets an order be assigned to
-- one. Run this once in the Supabase SQL editor, after 0005_promo_codes.sql.
--
-- Riders get their own top-level route (src/app/rider/), structurally
-- separate from /admin the same way the customer /dashboard already is —
-- not a role flag bolted onto the admin screens. See CLAUDE.md.

-- 0001_admin_users.sql created this as an unnamed inline check, which
-- Postgres names <table>_<column>_check by default. Drop-if-exists first
-- so this migration can be re-run safely.
alter table admin_users drop constraint if exists admin_users_role_check;
alter table admin_users
  add constraint admin_users_role_check check (role in ('owner', 'staff', 'rider'));

alter table orders
  add column if not exists assigned_rider_id uuid references admin_users(id) on delete set null;

create index if not exists orders_assigned_rider_idx on orders (assigned_rider_id);
