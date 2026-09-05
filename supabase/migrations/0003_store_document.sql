-- The admin/menu store, moved off the local JSON file so it survives on
-- Vercel (whose filesystem is read-only at runtime). Run this once in the
-- Supabase SQL editor.
--
-- Why a single JSONB document rather than a table per entity:
-- StoreAdapter (src/lib/admin/store/types.ts) is a whole-document
-- read/write interface, and the ~40 functions in store/index.ts are all
-- written against an in-memory object. A document row satisfies that
-- contract exactly, so the backend swap touches one file instead of
-- rewriting every query. At this size — one kitchen, ~25 dishes — the
-- whole document is a few KB, so rewriting it per save costs nothing.
--
-- Orders deliberately do NOT live here (see 0004_orders.sql): they grow
-- without bound and get filtered/sorted in /admin/orders, which is what
-- real columns are for.
--
-- Known limitation, unchanged from the JSON file it replaces: writes are
-- last-write-wins. Two staff saving different screens at the same instant
-- means one edit is lost. With a handful of staff that's an acceptable
-- trade; revisit with an optimistic-concurrency version column if the
-- team grows.
--
-- RLS is enabled with no policies, same as 0001/0002: every query goes
-- through the service-role client (src/lib/supabase/server.ts), which
-- bypasses RLS. The anon key the browser holds can never read this.

create table if not exists store_document (
  id text primary key default 'singleton',
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  -- Belt and braces: makes it impossible to end up with two "current"
  -- documents if something ever inserts without specifying the id.
  constraint store_document_singleton check (id = 'singleton')
);

alter table store_document enable row level security;
