import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The owner's "I saved this number in my phone" ticks (migration 0026). Written to **degrade,
 * not throw, when the table isn't there yet**: the Customers screen must still load, it just
 * shows every contact as not saved.
 */

function tableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

export async function listSavedContactKeys(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin().from("customer_contact_saved").select("customer_key");
  if (error) {
    if (!tableMissing(error)) console.error("[customers] could not read saved contacts:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.customer_key as string));
}

export async function setContactSaved(
  key: string,
  saved: boolean,
  userId: string | null
): Promise<{ ok: true } | { ok: false; reason: "not_ready" | "failed" }> {
  const db = supabaseAdmin();
  const { error } = saved
    ? await db
        .from("customer_contact_saved")
        .upsert({ customer_key: key, saved_at: new Date().toISOString(), saved_by: userId })
    : await db.from("customer_contact_saved").delete().eq("customer_key", key);
  if (error) {
    if (tableMissing(error)) {
      console.error("[customers] run migration 0026 to remember saved contacts:", error.message);
      return { ok: false, reason: "not_ready" };
    }
    console.error("[customers] could not update saved contact:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
