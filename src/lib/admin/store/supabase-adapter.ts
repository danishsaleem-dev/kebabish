import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildSeed } from "@/lib/admin/store/seed";
import type { StoreAdapter, StoreShape } from "@/lib/admin/store/types";

/**
 * The production store: one JSONB document row in Supabase.
 *
 * See supabase/migrations/0003_store_document.sql for why it's a document
 * rather than a table per entity. The short version: StoreAdapter is a
 * whole-document interface, so this satisfies it in ~40 lines instead of
 * rewriting every function in ./index.ts as SQL.
 *
 * Reads hit Supabase every time rather than caching in module scope —
 * same reasoning as the JSON adapter it replaces: a stale cache shows the
 * user their edit "not saving". Next's own caching sits above this.
 */

const ROW_ID = "singleton";
const TABLE = "store_document";

/** Postgres/PostgREST codes for "that table doesn't exist". */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

function missingTableError(): Error {
  return new Error(
    `The "${TABLE}" table doesn't exist yet. Run ` +
      `supabase/migrations/0003_store_document.sql in the Supabase SQL editor.`
  );
}

export const supabaseAdapter: StoreAdapter = {
  async read(): Promise<StoreShape> {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("doc")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) {
      if (MISSING_TABLE.has(error.code)) throw missingTableError();
      throw new Error(error.message);
    }

    if (data?.doc) return data.doc as StoreShape;

    // First run against a fresh project — seed it so the panel opens with
    // the same starting content it always had.
    const seed = buildSeed();
    await this.write(seed);
    return seed;
  },

  async write(data: StoreShape): Promise<void> {
    const { error } = await supabaseAdmin()
      .from(TABLE)
      .upsert(
        { id: ROW_ID, doc: data, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );

    if (error) {
      if (MISSING_TABLE.has(error.code)) throw missingTableError();
      throw new Error(error.message);
    }
  },
};
