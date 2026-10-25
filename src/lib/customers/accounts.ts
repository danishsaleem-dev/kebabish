import "server-only";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";
import { UNUSED_ACCOUNT_DAYS, type AccountForRules } from "@/lib/customers/account-rules";

/**
 * Customer-facing accounts — deliberately a separate table from
 * `admin_users`, not a shared "users" table with a role column. Customers
 * self-register (anyone can create one via /signup); staff accounts are
 * only ever created by an owner from /admin/team. Mixing the two would mean
 * every customer signup landing in the same table the Team screen lists as
 * "who has dashboard access."
 */

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

const SALT_ROUNDS = 12;

/**
 * `ilike` treats `_` and `%` as wildcards, and a perfectly valid address can contain an
 * underscore (a_b@x.nl would match aab@x.nl). Escaped, it is an exact, case-insensitive match.
 */
const exactEmail = (email: string) => email.trim().replace(/[\\%_]/g, (c) => `\\${c}`);

async function findByEmailWithHash(email: string) {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("id, email, name, phone, password_hash")
    .ilike("email", exactEmail(email))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Attach any guest orders placed under this email to the now-authenticated
 * account, so a customer who checked out before creating an account still
 * sees that order history the moment they sign in. Safe to call on every
 * login — it only ever touches orders with no customer_id yet, so it can
 * never steal an order that already belongs to someone.
 */
async function claimGuestOrders(customerId: string, email: string) {
  const { error } = await supabaseAdmin()
    .from("orders")
    .update({ customer_id: customerId })
    .ilike("customer_email", exactEmail(email))
    .is("customer_id", null);

  if (error) {
    // Never block a sign-in over this — it's a nice-to-have, not the point
    // of authenticating.
    console.error("[customers] could not claim guest orders:", error.message);
  }
}

export async function verifyCustomerCredentials(
  email: string,
  password: string
): Promise<Customer | null> {
  const customer = await findByEmailWithHash(email);
  // An account created at checkout has no password until its owner chooses one from the
  // emailed link — nothing typed here can ever match it.
  if (!customer || !customer.password_hash) return null;

  const valid = await bcrypt.compare(password, customer.password_hash);
  if (!valid) return null;

  await supabaseAdmin()
    .from("customers")
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq("id", customer.id);

  await claimGuestOrders(customer.id, customer.email);

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
  };
}

export type ConsentSource = "signup" | "checkout" | "dashboard";

export interface SavedAddress {
  street: string;
  houseNumber: string;
  addition: string;
  postcode: string;
  city: string;
}

/** Everything the checkout form and the account page need about a customer. */
export interface CustomerProfile extends Customer {
  marketingOptIn: boolean;
  marketingConsentAt: string | null;
  savedAddress: SavedAddress | null;
}

export async function getCustomerProfile(id: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select(
      "id, email, name, phone, marketing_opt_in, marketing_consent_at, saved_street, saved_house_number, saved_addition, saved_postcode, saved_city"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const hasAddress = Boolean(data.saved_street && data.saved_postcode && data.saved_city);
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.phone,
    marketingOptIn: data.marketing_opt_in,
    marketingConsentAt: data.marketing_consent_at,
    savedAddress: hasAddress
      ? {
          street: data.saved_street,
          houseNumber: data.saved_house_number ?? "",
          addition: data.saved_addition ?? "",
          postcode: data.saved_postcode,
          city: data.saved_city,
        }
      : null,
  };
}

/**
 * Record a change of marketing consent. Turning it on stamps when and where;
 * turning it off stamps the withdrawal. Switching it *on* when it already is
 * is a no-op, so ticking the box again at a later checkout doesn't overwrite
 * the date of the original consent.
 */
export async function setMarketingConsent(
  customerId: string,
  optIn: boolean,
  source: ConsentSource
): Promise<void> {
  const supabase = supabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("customers")
    .select("marketing_opt_in")
    .eq("id", customerId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current || current.marketing_opt_in === optIn) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customers")
    .update(
      optIn
        ? {
            marketing_opt_in: true,
            marketing_consent_at: now,
            marketing_consent_source: source,
            marketing_withdrawn_at: null,
          }
        : { marketing_opt_in: false, marketing_withdrawn_at: now }
    )
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

export async function saveCustomerAddress(
  customerId: string,
  address: SavedAddress
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("customers")
    .update({
      saved_street: address.street,
      saved_house_number: address.houseNumber,
      saved_addition: address.addition || null,
      saved_postcode: address.postcode,
      saved_city: address.city,
      saved_address_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

export async function clearCustomerAddress(customerId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("customers")
    .update({
      saved_street: null,
      saved_house_number: null,
      saved_addition: null,
      saved_postcode: null,
      saved_city: null,
      saved_address_at: null,
    })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

export async function createCustomer(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  /** Only true when the customer ticked the box on the sign-up form. */
  marketingOptIn?: boolean;
}): Promise<Customer> {
  const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .insert({
      email: input.email.trim(),
      password_hash,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      ...(input.marketingOptIn
        ? {
            marketing_opt_in: true,
            marketing_consent_at: new Date().toISOString(),
            marketing_consent_source: "signup",
          }
        : {}),
    })
    .select("id, email, name, phone")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw new Error(error.message);
  }

  return data;
}

/* ------------------------------------------------ accounts created at checkout */

/** What the rules, the dashboard and the sign-in checks need to know about an account. */
export interface CustomerAccountState extends AccountForRules {
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  sessionsValidAfterMs: number | null;
}

const STATE_COLUMNS =
  "id, email, name, phone, password_hash, created_at, created_via, sessions_valid_after";

interface StateRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  password_hash: string | null;
  created_at: string;
  created_via?: string | null;
  sessions_valid_after?: string | null;
}

function toState(row: StateRow): CustomerAccountState {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    passwordless: !row.password_hash,
    createdVia: row.created_via === "checkout" ? "checkout" : "signup",
    createdAt: row.created_at,
    sessionsValidAfterMs: row.sessions_valid_after ? Date.parse(row.sessions_valid_after) : null,
  };
}

let warnedMigration = 0;
/** One line a minute, not one per request, when migration 0027 hasn't been run. */
function warnMigration(where: string, message: string) {
  if (Date.now() - warnedMigration < 60_000) return;
  warnedMigration = Date.now();
  console.error(`[customers] ${where}: ${message} — has migration 0027 been run?`);
}

/**
 * One account by id, or null when it doesn't exist. Reads the checkout-account columns
 * (migration 0027) and, if they aren't there yet, falls back to the old columns — so the
 * site keeps working in the gap between deploying and running the migration.
 */
export async function getCustomerAccountState(id: string): Promise<CustomerAccountState | null> {
  const first = await supabaseAdmin().from("customers").select(STATE_COLUMNS).eq("id", id).maybeSingle();
  if (!first.error) return first.data ? toState(first.data as StateRow) : null;

  warnMigration("reading an account", first.error.message);
  const old = await supabaseAdmin()
    .from("customers")
    .select("id, email, name, phone, password_hash, created_at")
    .eq("id", id)
    .maybeSingle();
  if (old.error) throw new Error(old.error.message);
  return old.data ? toState(old.data as StateRow) : null;
}

export async function findCustomerStateByEmail(email: string): Promise<CustomerAccountState | null> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select(STATE_COLUMNS)
    .ilike("email", exactEmail(email))
    .maybeSingle();
  if (error) {
    warnMigration("looking up an account", error.message);
    const old = await supabaseAdmin()
      .from("customers")
      .select("id, email, name, phone, password_hash, created_at")
      .ilike("email", exactEmail(email))
      .maybeSingle();
    if (old.error) throw new Error(old.error.message);
    return old.data ? toState(old.data as StateRow) : null;
  }
  return data ? toState(data as StateRow) : null;
}

export type CheckoutAccountResult =
  | { status: "skipped" }
  /** The order already belongs to an account (a signed-in customer ordered). */
  | { status: "linked"; customerId: string; passwordless: boolean }
  /** This order created the account, and it now belongs to the order. */
  | { status: "created"; customerId: string; passwordless: true }
  /** The address already had an account. Nothing is linked or signed in — see account-rules.ts. */
  | { status: "existing"; customerId: string; passwordless: boolean };

/**
 * When an order is paid: make sure the person has an account. No password is set, and
 * nobody is signed in here — that is a separate, checked step (`canEnterWithOrder`).
 *
 * Safe to call more than once, and from the webhook and the return page at the same
 * moment: the order is re-read first, and the unique email index decides a race.
 * Never throws — an order that is paid is paid, whatever happens to the account.
 */
export async function ensureCheckoutAccount(orderId: string): Promise<CheckoutAccountResult> {
  try {
    const supabase = supabaseAdmin();
    const read = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_id, customer_email, customer_name, customer_phone, marketing_opt_in, payment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    };

    const order = await read();
    if (!order || order.payment_status !== "paid") return { status: "skipped" };

    if (order.customer_id) {
      const state = await getCustomerAccountState(order.customer_id);
      return state
        ? { status: "linked", customerId: state.id, passwordless: state.passwordless }
        : { status: "skipped" };
    }

    const email = String(order.customer_email ?? "").trim();
    if (!email || !email.includes("@")) return { status: "skipped" };

    const existing = await findCustomerStateByEmail(email);
    if (existing) {
      return { status: "existing", customerId: existing.id, passwordless: existing.passwordless };
    }

    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        email,
        name: String(order.customer_name ?? "").trim() || email,
        phone: String(order.customer_phone ?? "").trim() || null,
        password_hash: null,
        created_via: "checkout",
        // Opt-in is the only thing that turns marketing on, and it is carried over exactly
        // as the customer ticked it on this order — never inferred.
        ...(order.marketing_opt_in
          ? { marketing_opt_in: true, marketing_consent_at: now, marketing_consent_source: "checkout" }
          : {}),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        // Someone else created it a moment ago (the webhook and the return page both ran).
        const again = await read();
        if (again?.customer_id) {
          const state = await getCustomerAccountState(again.customer_id);
          if (state) return { status: "linked", customerId: state.id, passwordless: state.passwordless };
        }
        const other = await findCustomerStateByEmail(email);
        if (other) return { status: "existing", customerId: other.id, passwordless: other.passwordless };
        return { status: "skipped" };
      }
      warnMigration("creating a checkout account", error.message);
      return { status: "skipped" };
    }

    // Link only if the order is still unlinked: never overwrite.
    const { error: linkError } = await supabase
      .from("orders")
      .update({ customer_id: created.id })
      .eq("id", orderId)
      .is("customer_id", null);
    if (linkError) console.error("[customers] could not link the order to its new account:", linkError.message);

    return { status: "created", customerId: created.id, passwordless: true };
  } catch (error) {
    console.error("[customers] could not create the checkout account:", error);
    return { status: "skipped" };
  }
}

/** Change name and phone. Email is the account's identity and is never edited here. */
export async function updateCustomerProfile(
  id: string,
  input: { name: string; phone: string | null }
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("customers")
    .update({ name: input.name.trim(), phone: input.phone })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Change the password of a signed-in customer who knows the current one. */
export async function changeCustomerPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<"ok" | "wrong" | "none"> {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("password_hash")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.password_hash) return "none";
  if (!(await bcrypt.compare(currentPassword, data.password_hash))) return "wrong";

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const { error: updateError } = await supabaseAdmin().from("customers").update({ password_hash }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  return "ok";
}

/**
 * Delete accounts nobody ever confirmed (no password after UNUSED_ACCOUNT_DAYS). Their
 * orders are kept: the foreign key just lets go of them, and each order carries its own
 * copy of the name and address. Run from the housekeeping endpoint.
 */
export async function purgeUnusedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - UNUSED_ACCOUNT_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .delete()
    .is("password_hash", null)
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    warnMigration("clearing unused accounts", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
