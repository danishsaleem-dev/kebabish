import "server-only";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";

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

async function findByEmailWithHash(email: string) {
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("id, email, name, phone, password_hash")
    .ilike("email", email.trim())
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
    .ilike("customer_email", email.trim())
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
  if (!customer) return null;

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
