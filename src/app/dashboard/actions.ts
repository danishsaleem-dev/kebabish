"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { clearCustomerAddress, setMarketingConsent } from "@/lib/customers/accounts";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/** The signed-in customer's id, or null — these actions are for customers only. */
async function customerId(): Promise<string | null> {
  const session = await auth();
  return session?.user.role === "customer" ? session.user.id : null;
}

/**
 * The "email me offers" switch on the account page. The checkbox is the only
 * thing that can turn it on, and the customer can always turn it off here —
 * withdrawing is as easy as giving it.
 */
export async function updateMarketingAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  const optIn = formData.get("marketingOptIn") === "on";
  try {
    await setMarketingConsent(id, optIn, "dashboard");
  } catch (error) {
    console.error("[dashboard] could not save the marketing preference:", error);
    return { ok: false, message: "Couldn't save that — please try again." };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: optIn
      ? "Saved — we'll email you news and offers."
      : "Saved — we won't email you news or offers.",
  };
}

export async function removeSavedAddressAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const id = await customerId();
  if (!id) return { ok: false, message: "Sign in again to do that." };

  try {
    await clearCustomerAddress(id);
  } catch (error) {
    console.error("[dashboard] could not remove the saved address:", error);
    return { ok: false, message: "Couldn't remove it — please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Your saved address was removed." };
}
