import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * What staff changed on an order after it was placed (migration 0021).
 *
 * An edited line can remember two things the order lines themselves have no
 * column for: what it **replaced** ("Chicken Biryani" was swapped for "Boneless
 * Biryani") and the dish's **regular price** when the customer is being charged
 * less — a compensation, which the bill then shows. They live in `order_line_extra`,
 * keyed by the line, and the history of changes in `order_edits`.
 *
 * Every read here **degrades, not throws, when the tables don't exist yet** (the
 * migration is run by hand): an order simply has no extras, and its pages, receipts
 * and invoices render exactly as before.
 */

export interface LineExtra {
  /** What the customer originally ordered, when this line replaces it. */
  replaces: string | null;
  /** The dish's regular price per portion (extras included), when charged less. */
  listUnitPriceCents: number | null;
}

export interface OrderEdit {
  id: string;
  editedAt: string;
  editedByName: string | null;
  note: string;
  beforeTotalCents: number;
  afterTotalCents: number;
  beforeLines: { name: string; quantity: number; unitPriceCents: number }[];
}

const isMissingTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");

/** Per order-line id. Empty when there are none (or the table isn't there yet). */
export async function fetchLineExtras(orderId: string): Promise<Map<string, LineExtra>> {
  const result = new Map<string, LineExtra>();
  const { data, error } = await supabaseAdmin()
    .from("order_line_extra")
    .select("order_item_id, replaces, list_unit_price_cents")
    .eq("order_id", orderId);
  if (error) {
    if (!isMissingTable(error)) console.error("[order-extras] couldn't read line extras:", error.message);
    return result;
  }
  for (const row of data ?? []) {
    result.set(row.order_item_id as string, {
      replaces: (row.replaces as string | null) ?? null,
      listUnitPriceCents: (row.list_unit_price_cents as number | null) ?? null,
    });
  }
  return result;
}

/** Newest first. Empty when there are none (or the table isn't there yet). */
export async function listOrderEdits(orderId: string): Promise<OrderEdit[]> {
  const { data, error } = await supabaseAdmin()
    .from("order_edits")
    .select("id, edited_at, note, before_lines, before_total_cents, after_total_cents, editor:admin_users(name)")
    .eq("order_id", orderId)
    .order("edited_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error)) console.error("[order-extras] couldn't read the edit history:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    editedAt: row.edited_at as string,
    editedByName: (row.editor as unknown as { name: string } | null)?.name ?? null,
    note: (row.note as string) ?? "",
    beforeTotalCents: row.before_total_cents as number,
    afterTotalCents: row.after_total_cents as number,
    beforeLines: (row.before_lines as OrderEdit["beforeLines"]) ?? [],
  }));
}
