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

export async function createCustomer(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<Customer> {
  const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .insert({
      email: input.email.trim(),
      password_hash,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
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
