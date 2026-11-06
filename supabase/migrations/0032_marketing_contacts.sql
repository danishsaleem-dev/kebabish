-- Brevo email marketing: the link to Brevo's contacts, the suppression
-- mirror, and the webhook event log.
--
-- Run once in the Supabase SQL editor, after 0031_deal_stock.sql.
-- Safe to re-run. Until it is run, the Email marketing section of the admin
-- shows a "not set up yet" card and the rest of the site is unaffected —
-- every read in src/lib/brevo/ swallows a missing table on purpose.
--
-- Numbered 0032 because two files already share the 0027 prefix
-- (0027_business_days.sql and 0027_checkout_accounts.sql).

-- 1. Brevo's side of the link.
--
-- `brevo_contact_id` is Brevo's own numeric id for the contact, kept so we
-- never have to look a contact up by email just to know whether it exists.
-- `brevo_synced_at` is what the admin shows as "synced"; it is also how the
-- nightly catch-up pass decides there is nothing to do.
alter table customers
  add column if not exists brevo_contact_id bigint,
  add column if not exists brevo_synced_at  timestamptz;

-- 2. The suppression mirror.
--
-- When somebody unsubscribes, Brevo is the authority — but the eligibility
-- filter has to be answerable from our own database, both because a guest has
-- no `customers` row to flag and because asking Brevo on every page load
-- would blow through its rate limits. So every unsubscribe, bounce and spam
-- complaint Brevo reports is mirrored here, keyed by lowercased email, and
-- the audience filter reads it.
--
-- There is deliberately no way to delete a row from this table in the app: a
-- re-subscribe has to happen in Brevo, by the person themselves.
create table if not exists marketing_suppressions (
  email    text primary key,
  reason   text not null check (reason in (
             'unsubscribe', 'hard_bounce', 'soft_bounce', 'spam', 'manual', 'contact_deleted'
           )),
  at       timestamptz not null default now(),
  -- The campaign the person unsubscribed from, when Brevo names one. Kept as
  -- text (Brevo's campaign name) purely so the admin can say where it came from.
  campaign text
);

-- 3. The webhook event log.
--
-- Only the events that change our own state get a row — unsubscribe, bounces,
-- spam, contact deleted. Opens and clicks stay in Brevo, which already reports
-- them per campaign; storing them here would make this the largest table in
-- the database for no reporting we don't already get.
--
-- Its real job is deduplication. Brevo sends no event id for email events and
-- retries failed deliveries, so the key is composite: the same event, for the
-- same address, from the same campaign, at the same instant is the same event.
create table if not exists marketing_events (
  id            uuid primary key default gen_random_uuid(),
  event         text not null,
  email         text not null,
  campaign_id   bigint,
  campaign_name text,
  event_at      timestamptz not null,
  received_at   timestamptz not null default now()
);

-- coalesce() because a contact event (contact_deleted) carries no campaign,
-- and NULLs would otherwise never collide with each other in a unique index.
create unique index if not exists marketing_events_dedupe_idx
  on marketing_events (event, email, coalesce(campaign_id, 0), event_at);

create index if not exists marketing_events_received_idx
  on marketing_events (received_at desc);

-- Finding everyone who consented is the single most common query in this
-- feature, and it runs on every admin page in the section.
create index if not exists customers_marketing_opt_in_idx
  on customers (marketing_opt_in)
  where marketing_opt_in;

create index if not exists orders_marketing_opt_in_idx
  on orders (marketing_opt_in)
  where marketing_opt_in;
