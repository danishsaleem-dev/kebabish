import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SupplyPurchase } from "@/lib/supplies";

/**
 * Reading and writing supply purchases. Needs migration `0028_supply_purchases.sql`.
 *
 * Until it is run every read returns "not set up" instead of throwing — the Supplies list and
 * the reports still work, they just have no purchases — and only a *write* reports the missing
 * table. The same rule the rider-mileage and feedback tables follow.
 */

const MISSING_TABLE = "42P01";

interface PurchaseRow {
  id: string;
  supply_id: string;
  supply_name: string;
  purchased_on: string;
  quantity: number | string;
  amount_cents: number;
  note: string | null;
}

const SELECT = "id, supply_id, supply_name, purchased_on, quantity, amount_cents, note";

function toPurchase(row: PurchaseRow): SupplyPurchase {
  return {
    id: row.id,
    supplyId: row.supply_id,
    supplyName: row.supply_name,
    purchasedOn: row.purchased_on,
    quantity: Number(row.quantity),
    amountCents: row.amount_cents,
    note: row.note,
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error) && (error!.code === MISSING_TABLE || /supply_purchases/.test(error!.message ?? ""));
}

/** Purchases from `from` to `to` (both "YYYY-MM-DD", inclusive), newest first. */
export async function listPurchasesBetween(
  from: string,
  to: string
): Promise<{ ready: boolean; purchases: SupplyPurchase[] }> {
  const { data, error } = await supabaseAdmin()
    .from("supply_purchases")
    .select(SELECT)
    .gte("purchased_on", from)
    .lte("purchased_on", to)
    .order("purchased_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    if (isMissingTable(error)) {
      console.warn("[supplies] listPurchasesBetween: run supabase/migrations/0028_supply_purchases.sql");
      return { ready: false, purchases: [] };
    }
    throw new Error(error.message);
  }
  return { ready: true, purchases: (data as unknown as PurchaseRow[]).map(toPurchase) };
}

export async function insertPurchase(input: {
  supplyId: string;
  supplyName: string;
  purchasedOn: string;
  quantity: number;
  amountCents: number;
  note: string | null;
  createdBy: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("supply_purchases").insert({
    supply_id: input.supplyId,
    supply_name: input.supplyName,
    purchased_on: input.purchasedOn,
    quantity: input.quantity,
    amount_cents: input.amountCents,
    note: input.note,
    created_by: input.createdBy,
  });
  if (error) {
    if (isMissingTable(error)) {
      throw new Error("Purchases aren't set up yet. Run migration 0028_supply_purchases.sql first.");
    }
    throw new Error(error.message);
  }
}

export async function deletePurchase(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("supply_purchases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
