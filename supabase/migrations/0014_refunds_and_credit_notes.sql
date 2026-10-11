-- Partial refunds and credit notes.
-- Run once in the Supabase SQL editor, after 0013_slot_default_capacity.sql —
-- and BEFORE deploying the code that uses it.
--
-- Until now an order could only be refunded in full, as a single flag on the
-- order. A refund is now a record of its own: how much, when, by whom, an
-- optional reason the customer may see, and an internal note they may not. Each
-- refund gets a credit note number (CN-2026-000001) and a credit note PDF; the
-- original invoice is never changed.

create table if not exists order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  credit_note_number text not null unique,
  -- Null when the money was handed back by a person (a cash or bank-transfer
  -- order has no Mollie payment to refund).
  mollie_refund_id text,
  -- Printed on the credit note and sent in the email. Only filled in when the
  -- staff member chooses to give the customer a reason.
  reason_customer text,
  -- Never shown to the customer.
  note_internal text,
  -- The VAT contained in this refund, frozen at the moment it was made so the
  -- credit note doesn't change if the VAT rate setting does later.
  vat_rate numeric,
  vat_cents integer,
  created_by uuid references admin_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_refunds_order_idx on order_refunds (order_id);

-- Server-only, like every table here: the app uses the service-role key.
alter table order_refunds enable row level security;

-- One counter row per year, locked while it is incremented — the same
-- gap-free scheme as invoice numbers (see 0009).
create table if not exists credit_note_counters (
  year integer primary key,
  last_number integer not null default 0
);
alter table credit_note_counters enable row level security;

-- Records a refund and gives it its credit note number in ONE transaction, so
-- a failed insert can never leave a number used and unaccounted for.
create or replace function record_refund(
  p_order uuid,
  p_amount integer,
  p_mollie_refund_id text,
  p_reason text,
  p_note text,
  p_vat_rate numeric,
  p_vat_cents integer,
  p_created_by uuid
) returns table (id uuid, credit_note_number text)
language plpgsql
as $$
declare
  v_year integer;
  v_next integer;
  v_number text;
  v_id uuid;
begin
  -- The year of the credit note date (today), in Dutch time.
  v_year := extract(year from (now() at time zone 'Europe/Amsterdam'))::integer;

  insert into credit_note_counters (year, last_number)
  values (v_year, 0)
  on conflict (year) do nothing;

  update credit_note_counters
  set last_number = last_number + 1
  where year = v_year
  returning last_number into v_next;

  v_number := 'CN-' || v_year || '-' || lpad(v_next::text, 6, '0');

  insert into order_refunds (
    order_id, amount_cents, credit_note_number, mollie_refund_id,
    reason_customer, note_internal, vat_rate, vat_cents, created_by
  )
  values (
    p_order, p_amount, v_number, p_mollie_refund_id,
    nullif(p_reason, ''), nullif(p_note, ''), p_vat_rate, p_vat_cents, p_created_by
  )
  returning order_refunds.id into v_id;

  return query select v_id, v_number;
end;
$$;

-- Orders that were already fully refunded before this existed have only the
-- flag, not a record. Give each one a credit note so the books are complete.
do $$
declare
  r record;
begin
  for r in
    select id, refunded_cents, refunded_at from orders
    where payment_status = 'refunded' and refunded_cents > 0
      and not exists (select 1 from order_refunds f where f.order_id = orders.id)
    order by refunded_at nulls last
  loop
    perform record_refund(r.id, r.refunded_cents, null, null, 'Backfilled from an earlier full refund', null, null, null);
  end loop;
end;
$$;
