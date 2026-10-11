-- Customer feedback from the /feedback page.
-- Run once in the Supabase SQL editor, after 0017_payment_link_method.sql.
-- Safe to deploy the code first: until this is run, the feedback page says it
-- can't save right now and everything else (dashboard prompts, the admin
-- screen) simply shows nothing, rather than failing.
--
-- One row per submission. The questions are defined in code
-- (src/lib/feedback/questions.ts) and their answers live in the `answers`
-- JSON, keyed by question id, so adding or retiring a question never needs a
-- migration — an old row just doesn't have the newer key.
--
-- `recommend` is its own column, not only inside `answers`, because it is the
-- one headline number the admin sorts, filters and alerts on.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Set when the customer arrived through the link in their delivered email,
  -- their account, or their order page (a signed token proves they hold the
  -- order). `unique` means one feedback per order, and Postgres lets any number
  -- of rows have a NULL here, so general feedback is unrestricted. If the order
  -- is ever deleted the feedback stays, just unlinked.
  order_id uuid unique references orders (id) on delete set null,
  order_reference text,
  customer_id uuid references customers (id) on delete set null,

  -- Where they came from: email / dashboard / confirmation / footer / contact /
  -- packaging / direct. A fixed whitelist enforced by the app, so a stray query
  -- string can't put arbitrary text in this column.
  source text not null default 'direct',
  locale text not null default 'nl',

  -- 'order' (arrived with an order link), 'many', 'once' or 'never'.
  ordered_before text,

  -- {"fresh":4,"taste":5,...} — each value 1..5.
  answers jsonb not null default '{}'::jsonb,
  recommend smallint check (recommend between 1 and 5),

  -- [{"slug":"chicken-biryani","name":"Chicken Biryani"}] — name is a snapshot,
  -- like order lines, so a renamed or deleted dish still reads correctly.
  dishes jsonb not null default '[]'::jsonb,
  favourite_slug text,

  heard_from text,
  comment text check (comment is null or char_length(comment) <= 1000),

  -- Consents, both opt-in and unticked by default in the form:
  --  contact_ok  -> we may get in touch about this feedback; only then are a
  --                 name and email kept on this row.
  --  quote_ok    -> we may show the comment (first name only) on the website.
  contact_ok boolean not null default false,
  contact_name text,
  contact_email text,
  quote_ok boolean not null default false,

  -- Staff: has someone followed this up? (Set on "Mark as handled".)
  handled_at timestamptz
);

create index if not exists feedback_created_at_idx on feedback (created_at desc);
create index if not exists feedback_recommend_idx on feedback (recommend);

-- Server-only, like every table here: reached with the service-role key.
alter table feedback enable row level security;
