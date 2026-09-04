import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { buildSeed } from "@/lib/admin/store/seed";
import type { StoreAdapter, StoreShape } from "@/lib/admin/store/types";

/**
 * Interim JSON-file store.
 *
 * ⚠️ LOCAL DEVELOPMENT ONLY. Vercel's filesystem is read-only at runtime, so
 * writes will fail once deployed — this exists so the admin panel is fully
 * functional before the Supabase project is created. Swapping backends means
 * writing one more StoreAdapter and changing the export in ./index.ts.
 *
 * Reads hit disk every time rather than caching in module scope: server
 * actions and page renders can run in different contexts, and a stale cache
 * would show the user their edit "not saving".
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "admin-store.json");

let writeQueue: Promise<unknown> = Promise.resolve();

export const jsonAdapter: StoreAdapter = {
  async read(): Promise<StoreShape> {
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      return JSON.parse(raw) as StoreShape;
    } catch {
      // First run (or the file was deleted) — seed it.
      const seed = buildSeed();
      await this.write(seed);
      return seed;
    }
  },

  async write(data: StoreShape): Promise<void> {
    // Serialise writes so two quick actions can't interleave and lose one.
    writeQueue = writeQueue.then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      // Write to a temp file then rename, so an interrupted write can't leave
      // a half-written JSON file that fails to parse on next read.
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await rename(tmp, DATA_FILE);
    });

    await writeQueue;
  },
};
