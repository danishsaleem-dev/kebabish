import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supabaseStore } from "@/lib/brevo/settings";
import {
  type AudienceAccount,
  type AudienceGuestOrder,
  type AudienceStats,
  type MarketingContact,
  batched,
  buildAudience,
  buildContactAttributes,
  buildImportRows,
  normalizeEmail,
  BREVO_ATTRIBUTES,
} from "@/lib/brevo/audience";
import { readSuppressed } from "@/lib/brevo/suppressions";
import {
  BrevoError,
  brevoGet,
  brevoPost,
  clearBrevoCache,
  isBrevoConfigured,
} from "@/lib/brevo/client";

/**
 * The bridge between our customer records and Brevo's contacts.
 *
 * Our database stays the source of truth for who exists and who consented;
 * Brevo holds the marketing contact and the suppression list. Nothing here
 * ever reads a contact *out* of Brevo and into our tables — the traffic is
 * one-way, except for suppressions, which arrive by webhook.
 *
 * Everything in this file is written to be harmless when it fails. A Brevo
 * outage, a missing API key or an unrun migration must never fail a checkout
 * or a customer saving their preferences.
 */

/* --------------------------------------------------------------- our side */

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  marketing_opt_in: boolean;
  marketing_consent_at: string | null;
  marketing_withdrawn_at: string | null;
  brevo_contact_id: number | null;
  brevo_synced_at: string | null;
}

/** Only the order fields the audience and its attributes need. */
interface MarketingOrderRow {
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  marketing_opt_in: boolean;
  locale: string | null;
  created_at: string;
  total_cents: number;
  refunded_cents: number | null;
  status: string;
  payment_status: string;
  order_items: { name: string; quantity: number }[] | null;
}

const CUSTOMER_COLUMNS =
  "id, email, name, phone, marketing_opt_in, marketing_consent_at, marketing_withdrawn_at, brevo_contact_id, brevo_synced_at";

function columnMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    /brevo_contact_id|brevo_synced_at|could not find the table|does not exist/i.test(
      error.message ?? ""
    )
  );
}

let warnedAt = 0;
function warnMigration(): void {
  const now = Date.now();
  if (now - warnedAt < 60_000) return;
  warnedAt = now;
  console.warn(
    "[brevo] the marketing columns aren't there — run supabase/migrations/0032_marketing_contacts.sql"
  );
}

/** Whether migration 0032 has been run. The admin section's "not set up yet" card reads this. */
export async function isMarketingSchemaReady(): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("customers")
    .select("brevo_synced_at")
    .limit(1);

  if (error) {
    if (columnMissing(error)) {
      warnMigration();
      return false;
    }
    console.error("[brevo] could not check the marketing schema:", error.message);
    return false;
  }
  return true;
}

async function readAccounts(): Promise<CustomerRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("marketing_opt_in", true);

  if (error) {
    // Before 0032 the two brevo_* columns don't exist. Fall back to the
    // columns that do, so the audience is still countable and the admin can
    // show real numbers next to its "run the migration" card.
    if (columnMissing(error)) {
      warnMigration();
      const retry = await supabaseAdmin()
        .from("customers")
        .select("id, email, name, phone, marketing_opt_in, marketing_consent_at, marketing_withdrawn_at")
        .eq("marketing_opt_in", true);
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data ?? []).map((row) => ({
        ...(row as Omit<CustomerRow, "brevo_contact_id" | "brevo_synced_at">),
        brevo_contact_id: null,
        brevo_synced_at: null,
      }));
    }
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as CustomerRow[];
}

/**
 * Every order, for stats and for guest consent.
 *
 * A separate query rather than `listOrders()`: that one carries twenty-odd
 * columns this never needs and, more to the point, carries neither `locale`
 * nor `marketing_opt_in`, which are the two fields this feature turns on.
 * Widening `ORDER_SELECT` would change the hot path every admin screen uses.
 */
const MARKETING_ORDER_COLUMNS =
  "customer_id, customer_email, customer_name, customer_phone, marketing_opt_in, locale, created_at, total_cents, refunded_cents, status, payment_status, order_items(name, quantity)";

async function readMarketingOrders(): Promise<MarketingOrderRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(MARKETING_ORDER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MarketingOrderRow[];
}

/** The same, for one address only — see `readOneContact` for why that matters. */
async function readOrdersForEmail(email: string): Promise<MarketingOrderRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(MARKETING_ORDER_COLUMNS)
    // ilike with no wildcards is an exact, case-insensitive match — the same
    // comparison `customerIdForEmail()` makes when it links an order.
    .ilike("customer_email", email)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MarketingOrderRow[];
}

function isSaleRow(row: MarketingOrderRow): boolean {
  return row.payment_status === "paid" && row.status !== "cancelled";
}

/**
 * Per-person attributes, keyed by `customers.id` for an account and by
 * lowercased email for a guest — the two keys `buildAudience` looks up.
 *
 * Only paid, uncancelled orders count towards the figures, the same rule
 * `isSale()` applies in the dashboard and reports, so "total spent" in a
 * Brevo email agrees with "lifetime value" in the admin.
 */
function buildStats(orders: MarketingOrderRow[]): Map<string, AudienceStats> {
  const grouped = new Map<string, MarketingOrderRow[]>();

  for (const order of orders) {
    const key = order.customer_id ?? normalizeEmail(order.customer_email);
    if (!key) continue;
    const list = grouped.get(key);
    if (list) list.push(order);
    else grouped.set(key, [order]);
  }

  const stats = new Map<string, AudienceStats>();

  for (const [key, own] of grouped) {
    const sales = own.filter(isSaleRow);

    // Orders come back newest first, so the first one has the latest language.
    const latestLocale = own.find((order) => order.locale)?.locale;

    const dishes = new Map<string, number>();
    for (const order of sales) {
      for (const line of order.order_items ?? []) {
        dishes.set(line.name, (dishes.get(line.name) ?? 0) + line.quantity);
      }
    }
    const favourite = [...dishes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    stats.set(key, {
      orderCount: sales.length,
      lastOrderAt: sales[0]?.created_at ?? null,
      totalSpentCents: sales.reduce(
        (sum, order) => sum + order.total_cents - (order.refunded_cents ?? 0),
        0
      ),
      favouriteDish: favourite,
      language: latestLocale === "en" ? "en" : "nl",
      rewardPoints: null,
    });
  }

  return stats;
}

export interface AudienceSnapshot {
  contacts: MarketingContact[];
  /** null when the suppression list could not be read — nothing may be sent then. */
  suppressed: Set<string> | null;
  /** Everyone who consented but is suppressed, so the admin can see why a count dropped. */
  suppressedCount: number;
  schemaReady: boolean;
}

/**
 * The audience as it stands right now, built from our own tables only.
 *
 * This is what every admin screen counts and what the sync pushes. It makes
 * no Brevo call at all, so it still answers while Brevo is down or
 * unconfigured.
 */
export async function readAudience(): Promise<AudienceSnapshot> {
  const [accounts, orders, suppressed, schemaReady] = await Promise.all([
    readAccounts(),
    readMarketingOrders(),
    readSuppressed(),
    isMarketingSchemaReady(),
  ]);

  const statsByKey = buildStats(orders);

  const audienceAccounts: AudienceAccount[] = accounts.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in,
    marketingWithdrawnAt: row.marketing_withdrawn_at,
    marketingConsentAt: row.marketing_consent_at,
  }));

  const guestOrders: AudienceGuestOrder[] = orders
    .filter((row) => !row.customer_id)
    .map((row) => ({
      email: row.customer_email,
      name: row.customer_name,
      phone: row.customer_phone,
      marketingOptIn: row.marketing_opt_in,
      placedAt: row.created_at,
    }));

  // Built twice on purpose: once with suppressions applied (what may be sent)
  // and once without (so the admin can say "12 of these unsubscribed").
  const withoutSuppression = buildAudience({
    accounts: audienceAccounts,
    guestOrders,
    statsByEmail: statsByKey,
    suppressed: new Set(),
  });

  const contacts =
    suppressed === null
      ? []
      : buildAudience({
          accounts: audienceAccounts,
          guestOrders,
          statsByEmail: statsByKey,
          suppressed,
        });

  return {
    contacts,
    suppressed,
    suppressedCount: suppressed === null ? 0 : withoutSuppression.length - contacts.length,
    schemaReady,
  };
}

/* ------------------------------------------------------------- Brevo side */

interface BrevoList {
  id: number;
  name: string;
  totalSubscribers?: number;
  totalBlacklisted?: number;
}

interface BrevoAttribute {
  name: string;
  category: string;
  type?: string;
}

/** The standing list every consenting contact lives in. */
export const SUBSCRIBERS_LIST_NAME = "Kebabish subscribers";
/** Ad-hoc selection lists are filed here, out of the way of the standing one. */
export const ONE_OFF_FOLDER_NAME = "Kebabish — one-off sends";

/**
 * Create the list, folder and contact attributes if they aren't there, and
 * remember their ids in the store document.
 *
 * Idempotent: it looks before it creates, and a second run is a no-op. Called
 * from the admin settings screen's "Connect" and before the first sync, never
 * on a page render — it is several writes against a 100-per-hour endpoint
 * group.
 */
export async function ensureBrevoSetup(): Promise<{ listId: number; folderId: number }> {
  const settings = await supabaseStore.read();

  let folderId = settings.folderId ?? null;
  if (!folderId) {
    const folders = await brevoGet<{ folders: { id: number; name: string }[] | null }>(
      "/contacts/folders?limit=50&offset=0"
    );
    folderId =
      (folders.folders ?? []).find((folder) => folder.name === ONE_OFF_FOLDER_NAME)?.id ?? null;
    if (!folderId) {
      const created = await brevoPost<{ id: number }>("/contacts/folders", {
        name: ONE_OFF_FOLDER_NAME,
      });
      folderId = created.id;
    }
  }

  let listId = settings.listId ?? null;
  if (!listId) {
    const lists = await brevoGet<{ lists: BrevoList[] | null }>("/contacts/lists?limit=50&offset=0");
    listId = (lists.lists ?? []).find((list) => list.name === SUBSCRIBERS_LIST_NAME)?.id ?? null;
    if (!listId) {
      const created = await brevoPost<{ id: number }>("/contacts/lists", {
        name: SUBSCRIBERS_LIST_NAME,
        folderId,
      });
      listId = created.id;
    }
  }

  await ensureAttributes();
  await supabaseStore.update({ listId, folderId });
  clearBrevoCache();

  return { listId, folderId };
}

/**
 * Create the contact attributes personalisation needs.
 *
 * Brevo rejects an attribute that already exists, so each one is attempted
 * individually and a "already exists" failure is ignored — simpler and more
 * robust than diffing against the current list, and it runs at most once per
 * connect.
 */
async function ensureAttributes(): Promise<void> {
  let existing = new Set<string>();
  try {
    const current = await brevoGet<{ attributes: BrevoAttribute[] | null }>("/contacts/attributes");
    existing = new Set(
      (current.attributes ?? [])
        .filter((attribute) => attribute.category === "normal")
        .map((attribute) => attribute.name.toUpperCase())
    );
  } catch (error) {
    console.error("[brevo] could not read the contact attributes:", error);
  }

  for (const attribute of BREVO_ATTRIBUTES) {
    if (existing.has(attribute.name)) continue;
    try {
      await brevoPost(`/contacts/attributes/normal/${attribute.name}`, { type: attribute.type });
    } catch (error) {
      // A duplicate is fine; anything else is worth a line in the log but is
      // not worth refusing the whole connect over — personalisation degrades
      // to an empty value, it does not break a send.
      if (error instanceof BrevoError && error.status === 400) continue;
      console.error(`[brevo] could not create the ${attribute.name} attribute:`, error);
    }
  }
}

/** How many contacts Brevo holds in the standing list, for the dashboard. */
export async function readListState(): Promise<BrevoList | null> {
  const settings = await supabaseStore.read();
  if (!settings.listId) return null;
  try {
    return await brevoGet<BrevoList>(`/contacts/lists/${settings.listId}`);
  } catch (error) {
    console.error("[brevo] could not read the subscribers list:", error);
    return null;
  }
}

/* ------------------------------------------------------------- the sync */

export interface SyncResult {
  ok: boolean;
  /** Contacts sent to Brevo. */
  count: number;
  /** Why it could not run, for the toast. */
  problem?: string;
}

/**
 * Push the whole audience to Brevo in as few requests as possible.
 *
 * `POST /v3/contacts/import` rather than one call per contact: the brief asks
 * not to send thousands of individual requests, and import is asynchronous on
 * Brevo's side, so a few hundred contacts cost one request and return a
 * `processId` straight away.
 *
 * `updateExistingContacts` is true and `emptyContactsAttributes` is false, so
 * a re-sync refreshes names and figures without wiping an attribute we happen
 * not to send. `emailBlacklist` is false — importing must never *un*block
 * somebody, and Brevo keeps an existing blocklist flag untouched.
 */
export async function syncAudienceToBrevo(): Promise<SyncResult> {
  if (!isBrevoConfigured()) return { ok: false, count: 0, problem: "No Brevo API key is set." };

  const snapshot = await readAudience();

  if (snapshot.suppressed === null) {
    return {
      ok: false,
      count: 0,
      problem: "The unsubscribe list could not be read, so the sync was not run.",
    };
  }

  const { listId } = await ensureBrevoSetup();
  const rows = buildImportRows(snapshot.contacts);

  if (rows.length === 0) {
    await supabaseStore.update({ lastSyncAt: new Date().toISOString(), lastSyncCount: 0 });
    return { ok: true, count: 0 };
  }

  for (const batch of batched(rows)) {
    await brevoPost("/contacts/import", {
      listIds: [listId],
      jsonBody: batch,
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      emailBlacklist: false,
      smsBlacklist: false,
      disableNotification: true,
    });
  }

  await supabaseStore.update({
    lastSyncAt: new Date().toISOString(),
    lastSyncCount: rows.length,
  });
  await stampSynced(snapshot.contacts);
  clearBrevoCache();

  return { ok: true, count: rows.length };
}

/** Record on our side who was last pushed, so the admin can show sync age per customer. */
async function stampSynced(contacts: MarketingContact[]): Promise<void> {
  const ids = contacts
    .filter((contact) => contact.customerId)
    .map((contact) => contact.customerId as string);
  if (ids.length === 0) return;

  const { error } = await supabaseAdmin()
    .from("customers")
    .update({ brevo_synced_at: new Date().toISOString() })
    .in("id", ids);

  if (error && !columnMissing(error)) {
    console.error("[brevo] could not record the sync time:", error.message);
  }
}

/**
 * One address, as the audience sees it — or null if that address may not be
 * emailed (no consent, or suppressed). `false` for `suppressed` means the
 * suppression list itself could not be read, and the caller must do nothing.
 *
 * Why this exists rather than filtering `readAudience()`: this runs after
 * every checkout that carried the marketing tick, and `readAudience()` reads
 * **every order in the database** to work out everybody's figures. Doing that
 * to sync one person would get slower every week the shop trades. Here the
 * orders query is filtered to the one address, which is an index hit.
 */
async function readOneContact(
  email: string
): Promise<{ contact: MarketingContact | null; suppressed: boolean } | null> {
  const address = normalizeEmail(email);
  if (!address) return null;

  const [accountResult, orders, suppressedSet] = await Promise.all([
    supabaseAdmin().from("customers").select(CUSTOMER_COLUMNS).ilike("email", address).maybeSingle(),
    readOrdersForEmail(address),
    readSuppressed(),
  ]);

  // Can't prove they haven't unsubscribed, so do nothing at all.
  if (suppressedSet === null) return null;

  if (accountResult.error && !columnMissing(accountResult.error)) {
    throw new Error(accountResult.error.message);
  }

  const row = accountResult.data as unknown as CustomerRow | null;

  const accounts: AudienceAccount[] = row
    ? [
        {
          id: row.id,
          email: row.email,
          name: row.name,
          phone: row.phone,
          marketingOptIn: row.marketing_opt_in,
          marketingWithdrawnAt: row.marketing_withdrawn_at,
          marketingConsentAt: row.marketing_consent_at,
        },
      ]
    : [];

  const contacts = buildAudience({
    accounts,
    guestOrders: orders
      .filter((order) => !order.customer_id)
      .map((order) => ({
        email: order.customer_email,
        name: order.customer_name,
        phone: order.customer_phone,
        marketingOptIn: order.marketing_opt_in,
        placedAt: order.created_at,
      })),
    statsByEmail: buildStats(orders),
    suppressed: suppressedSet,
  });

  return {
    contact: contacts.find((candidate) => candidate.email === address) ?? null,
    suppressed: suppressedSet.has(address),
  };
}

/* ------------------------------------------------- one contact at a time */

/**
 * Push or blacklist a single contact, for the moment somebody's consent
 * changes rather than waiting for the nightly pass.
 *
 * **Never throws.** Every caller runs it through `after()` from a checkout or
 * a preference save, so a Brevo problem logs a line and the customer's own
 * action succeeds regardless. The catch-up sync fixes whatever this missed.
 */
export async function syncOneContact(email: string): Promise<void> {
  if (!isBrevoConfigured()) return;

  const address = normalizeEmail(email);
  if (!address) return;

  try {
    const found = await readOneContact(address);
    if (!found) return; // the suppression list couldn't be read — do nothing

    const contact = found.contact;

    if (!contact) {
      // They are no longer in the audience: they withdrew consent, or Brevo
      // suppressed them. Either way Brevo must stop sending — and blacklisting
      // rather than deleting keeps the record of the unsubscribe on both sides.
      await blacklistContact(address);
      return;
    }

    const settings = await supabaseStore.read();
    await brevoPost("/contacts", {
      email: contact.email,
      attributes: buildContactAttributes(contact),
      listIds: settings.listId ? [settings.listId] : undefined,
      updateEnabled: true,
    });

    if (contact.customerId) {
      const { error } = await supabaseAdmin()
        .from("customers")
        .update({ brevo_synced_at: new Date().toISOString() })
        .eq("id", contact.customerId);
      if (error && !columnMissing(error)) {
        console.error("[brevo] could not record the sync time:", error.message);
      }
    }
  } catch (error) {
    console.error(`[brevo] could not sync ${address}:`, error);
  }
}

/**
 * Stop Brevo emailing an address.
 *
 * `emailBlacklisted: true` is Brevo's own suppression flag, so the contact is
 * excluded from every campaign automatically, by Brevo, without us having to
 * remember to filter. A contact Brevo has never heard of returns a 404, which
 * is success as far as we are concerned.
 */
export async function blacklistContact(email: string): Promise<void> {
  const address = normalizeEmail(email);
  if (!address || !isBrevoConfigured()) return;

  try {
    await brevoPost("/contacts", {
      email: address,
      emailBlacklisted: true,
      updateEnabled: true,
    });
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return;
    console.error(`[brevo] could not blacklist ${address}:`, error);
  }
}

/* ---------------------------------------------------------- the daily pass */

/** The catch-up sync runs at most once a day; this is where that is remembered. */
const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;
let lastAttemptAt = 0;

/**
 * The catch-up pass, called from `/api/cron/housekeeping`.
 *
 * Per-contact syncs cover the normal case; this exists for the ones that
 * didn't land — a Brevo outage during a checkout, a consent change made while
 * the key was missing, or figures (order count, total spent) that moved
 * because somebody ordered rather than because they changed a preference.
 *
 * The in-memory gate is per server instance, so a few instances may each run
 * it once a day. That costs a handful of import requests against a limit of
 * 10 per second, and the alternative — a row to hold a timestamp — is a table
 * for something this cheap.
 */
export async function syncContactsDaily(): Promise<number> {
  if (!isBrevoConfigured()) return 0;

  const now = Date.now();
  if (now - lastAttemptAt < SYNC_EVERY_MS) return 0;
  lastAttemptAt = now;

  const settings = await supabaseStore.read();
  if (settings.lastSyncAt && now - Date.parse(settings.lastSyncAt) < SYNC_EVERY_MS) return 0;

  const result = await syncAudienceToBrevo();
  if (!result.ok) console.warn("[brevo] the daily contact sync did not run:", result.problem);
  return result.count;
}
