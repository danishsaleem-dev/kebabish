"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { toggleHandled } from "@/lib/feedback/data";

/**
 * Mark a piece of feedback as followed up (or undo it). The role is checked
 * here, not just on the page: a server action is a public POST endpoint.
 */
export async function toggleFeedbackHandledAction(id: string): Promise<{ ok: boolean; handled?: boolean }> {
  await requireRole(OWNER_STAFF);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };

  try {
    const handled = await toggleHandled(id);
    if (handled === null) return { ok: false };
    revalidatePath("/admin/feedback");
    return { ok: true, handled };
  } catch (error) {
    console.error("[feedback] could not toggle handled:", error);
    return { ok: false };
  }
}
