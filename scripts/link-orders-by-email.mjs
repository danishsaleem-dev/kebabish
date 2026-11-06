#!/usr/bin/env node
/**
 * Attach past guest orders to the registered account that has the same email.
 *
 *   node scripts/link-orders-by-email.mjs            dry run: lists what it WOULD link, writes nothing
 *   node scripts/link-orders-by-email.mjs --apply    really link them
 *
 * Why: until Nov 2026 an order placed while logged out stayed a guest order even when its
 * email belonged to an account, so the admin's Customers list showed the same person twice.
 * New orders now link on their own (createOrder / ensureCheckoutAccount); this catches up the
 * ones already in the database.
 *
 * What it does and does not touch:
 *  - only orders with NO account (customer_id is null) and an email that matches exactly one
 *    account, ignoring upper/lower case. It never moves an order off an account it already has.
 *  - it sets customer_id and nothing else: no points are awarded or taken, no email is sent.
 *    Points for an already-delivered order are NOT back-filled — say if you want that.
 *  - orders with no email (phone orders) are left alone: a phone number alone isn't proof.
 *
 * It talks to whatever project NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * (.env / .env.local) point at, and prints that first. Re-running is safe.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

const env = { ...process.env };
for (const path of [".env", ".env.local"]) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

console.log(`Project: ${new URL(url).host}`);
console.log(apply ? "Mode: APPLY (will write)\n" : "Mode: dry run (nothing is written)\n");

async function all(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const customers = await all("customers", "id, name, email");
const byEmail = new Map();
for (const c of customers) {
  const e = String(c.email ?? "").trim().toLowerCase();
  if (!e) continue;
  byEmail.set(e, [...(byEmail.get(e) ?? []), c]);
}

const orders = await all(
  "orders",
  "id, reference, customer_email, customer_name, payment_status, status, created_at",
  (q) => q.is("customer_id", null)
);

const plan = [];
let ambiguous = 0;
for (const o of orders) {
  const e = String(o.customer_email ?? "").trim().toLowerCase();
  if (!e) continue;
  const matches = byEmail.get(e);
  if (!matches) continue;
  if (matches.length > 1) {
    ambiguous++;
    continue;
  }
  plan.push({ order: o, customer: matches[0] });
}

console.log(`${orders.length} orders have no account; ${plan.length} of them match a registered email.`);
if (ambiguous) console.log(`${ambiguous} matched more than one account and are skipped.`);

const perCustomer = new Map();
for (const { order, customer } of plan) {
  const entry = perCustomer.get(customer.id) ?? { customer, orders: [] };
  entry.orders.push(order);
  perCustomer.set(customer.id, entry);
}
for (const { customer, orders: list } of perCustomer.values()) {
  console.log(`\n${customer.name} <${customer.email}> — ${list.length} order(s)`);
  for (const o of list) {
    const date = new Date(o.created_at).toISOString().slice(0, 10);
    console.log(`   ${o.reference}  ${date}  ${o.status} / payment ${o.payment_status}  (typed as "${o.customer_name}")`);
  }
}

if (!apply) {
  console.log(plan.length ? "\nDry run only. Re-run with --apply to link these." : "\nNothing to do.");
  process.exit(0);
}

let linked = 0;
for (const { order, customer } of plan) {
  // `is null` again on the write: if an account got attached in the meantime, this does nothing.
  const { data, error } = await db
    .from("orders")
    .update({ customer_id: customer.id })
    .eq("id", order.id)
    .is("customer_id", null)
    .select("id");
  if (error) {
    console.error(`  could not link ${order.reference}: ${error.message}`);
    continue;
  }
  linked += data.length;
}
console.log(`\nLinked ${linked} of ${plan.length} orders.`);
