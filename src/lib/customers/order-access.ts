import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isValidOrderToken } from "@/lib/order-token";
import { getCustomerAccountState, type Customer, type CustomerAccountState } from "@/lib/customers/accounts";
import { canEnterWithOrder } from "@/lib/customers/account-rules";

/**
 * The buyer's way straight into the account their order just created.
 *
 * Holding the order link (the `?ref=…&t=…` the payment return and the confirmation email
 * carry) is not, on its own, enough: `canEnterWithOrder` also needs the account to have
 * been **created by this very order** (so it holds nothing but this order), still to have
 * no password, the order to be paid and recent. An address that already had an account
 * is never signed in this way — that person signs in with their password.
 *
 * Kept lean on purpose (own queries, no `orders.ts`): the sign-in config imports this.
 */
export async function checkOrderAccess(ref: string, token: string): Promise<CustomerAccountState | null> {
  if (!ref || ref.length > 40 || !isValidOrderToken(ref, token)) return null;

  const { data: order, error } = await supabaseAdmin()
    .from("orders")
    .select("payment_status, created_at, customer_id")
    .eq("reference", ref)
    .maybeSingle();
  if (error || !order) return null;

  const account = order.customer_id ? await getCustomerAccountState(order.customer_id) : null;
  const allowed = canEnterWithOrder({
    order: {
      paid: order.payment_status === "paid",
      customerId: order.customer_id,
      placedAtMs: Date.parse(order.created_at),
    },
    account,
    nowMs: Date.now(),
  });
  return allowed ? account : null;
}

/** The same check, then the sign-in itself: used by the `order-access` provider. */
export async function customerForOrderAccess(ref: string, token: string): Promise<Customer | null> {
  const account = await checkOrderAccess(ref, token);
  if (!account) return null;

  await supabaseAdmin()
    .from("customers")
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq("id", account.id);

  return { id: account.id, email: account.email, name: account.name, phone: account.phone };
}
