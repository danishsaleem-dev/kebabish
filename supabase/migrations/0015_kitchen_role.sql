-- A "kitchen" login: a restricted account for the screen in the kitchen.
-- Run once in the Supabase SQL editor, after 0014_refunds_and_credit_notes.sql —
-- and BEFORE deploying the code that uses it (creating a kitchen user would
-- otherwise be rejected by the old role list).
--
-- A kitchen user lands on /kitchen — the live orders board — and can only
-- accept an order and mark it ready. It cannot open /admin, see revenue,
-- customers or the menu editor, or decline / refund an order. The narrow
-- access is enforced in the app (the layout, the board's API and the action
-- each check the role); this migration only lets the role exist.

alter table admin_users drop constraint if exists admin_users_role_check;
alter table admin_users
  add constraint admin_users_role_check
  check (role in ('owner', 'staff', 'rider', 'manager', 'kitchen'));
