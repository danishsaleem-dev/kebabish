import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A full export of everything the business would be unable to recreate.
 *
 * Why this exists: the project runs on Supabase's free plan, which has no
 * backups at all. Orders and invoices are legally required to be kept for
 * seven years, and a mistaken delete or an outage would otherwise take them for
 * good. This is the free substitute — a file the owner downloads every week
 * (`Settings -> Backup`) and keeps somewhere safe. It is not as good as real
 * point-in-time backups (Supabase Pro), and the page says so.
 *
 * ## What is in it
 * Every table. Each carries its own `pk` and `omit` lists in the file, so the
 * restore script (`scripts/restore-backup.mjs`) is generic and the file stays
 * restorable even if this list later changes.
 *
 * ## What is deliberately NOT in it
 * - **Password hashes** (`customers`, `admin_users`). A backup file gets copied
 *   to laptops and drives; a leaked file must not be a bag of crackable
 *   credentials. They are dropped here, on the server, and never reach the
 *   browser. The cost: after a restore everyone resets their password with
 *   "forgot password" (which works for staff and customers alike). The restore
 *   script inserts an unusable placeholder so the rows can exist.
 * - **Uploaded files** (dish photos, videos). They live in Supabase Storage,
 *   not the database; the export carries their records and URLs so they can be
 *   re-linked, but not the image bytes. Keep the originals.
 * - **Secrets and API keys** — those are environment variables, never in the DB.
 *
 * The file does contain customers' names, addresses, phone numbers and emails,
 * so it is personal data under the GDPR and must be stored accordingly.
 */

export const BACKUP_FORMAT = 1;

export interface BackupTableSpec {
  name: string;
  /** Primary key column(s) — what a restore matches rows on. */
  pk: string[];
  /** Columns never exported. */
  omit?: string[];
  /** Values a restore must invent for omitted NOT NULL columns, so a row can exist. */
  restoreDefaults?: Record<string, unknown>;
}

/**
 * In dependency order: a row is always restored after the rows it points at
 * (orders after customers and admin_users; items, refunds and feedback after
 * orders). Restoring in this order means no foreign key is ever dangling.
 */
export const BACKUP_TABLES: BackupTableSpec[] = [
  { name: "store_document", pk: ["id"] },
  {
    name: "customers",
    pk: ["id"],
    omit: ["password_hash"],
    restoreDefaults: { password_hash: "!restored-reset-your-password" },
  },
  {
    name: "admin_users",
    pk: ["id"],
    omit: ["password_hash"],
    restoreDefaults: { password_hash: "!restored-reset-your-password" },
  },
  { name: "orders", pk: ["id"] },
  { name: "order_items", pk: ["id"] },
  { name: "order_refunds", pk: ["id"] },
  { name: "feedback", pk: ["id"] },
  { name: "delivery_slot_config", pk: ["id"] },
  { name: "delivery_slot_bookings", pk: ["delivery_date", "slot_start"] },
  { name: "invoice_counters", pk: ["year"] },
  { name: "credit_note_counters", pk: ["year"] },
  { name: "order_counters", pk: ["year"] },
];

export interface BackupFile {
  format: number;
  app: "kebabish";
  exportedAt: string;
  exportedBy: string | null;
  /** Reminder printed in the file itself, since it travels without this page. */
  notice: string;
  counts: Record<string, number | "missing">;
  tables: Record<
    string,
    {
      pk: string[];
      omit: string[];
      restoreDefaults: Record<string, unknown>;
      /** Absent when the table doesn't exist in this database (a migration not run). */
      rows: Record<string, unknown>[];
    }
  >;
}

const PAGE = 1000;

function tableMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

/** Every row of a table, paged, in a stable order so no row is skipped or repeated. */
async function fetchAll(spec: BackupTableSpec): Promise<Record<string, unknown>[] | null> {
  const db = supabaseAdmin();
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE) {
    let query = db.from(spec.name).select("*");
    for (const column of spec.pk) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);

    if (error) {
      if (tableMissing(error)) return null;
      throw new Error(`${spec.name}: ${error.message}`);
    }
    rows.push(...(data as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }

  // Dropped here, server-side: the hash is never serialised, so it cannot end up
  // in the file whatever happens downstream.
  if (spec.omit?.length) {
    for (const row of rows) for (const column of spec.omit) delete row[column];
  }
  return rows;
}

export async function buildBackup(exportedBy: string | null): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {};
  const counts: BackupFile["counts"] = {};

  for (const spec of BACKUP_TABLES) {
    const rows = await fetchAll(spec);
    if (rows === null) {
      counts[spec.name] = "missing";
      continue;
    }
    counts[spec.name] = rows.length;
    tables[spec.name] = {
      pk: spec.pk,
      omit: spec.omit ?? [],
      restoreDefaults: spec.restoreDefaults ?? {},
      rows,
    };
  }

  return {
    format: BACKUP_FORMAT,
    app: "kebabish",
    exportedAt: new Date().toISOString(),
    exportedBy,
    notice:
      "Contains customers' personal data (names, addresses, phone numbers, emails). Store it privately and delete old copies. " +
      "Password hashes are NOT included, so after a restore everyone resets their password with 'forgot password'. " +
      "Uploaded photos/videos are not included, only their records. Restore with: node scripts/restore-backup.mjs <file>",
    counts,
    tables,
  };
}

/** Total rows in a backup, for the status line on the page. */
export function totalRows(counts: BackupFile["counts"]): number {
  return Object.values(counts).reduce<number>((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
}
