"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { deleteFeedback, toggleHandled } from "@/lib/feedback/data";

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

/**
 * Permanently delete one response. Owner or staff, like the rest of this screen:
 * a response is customer feedback, not a financial record, and the customer may
 * well have asked for it to be removed.
 */
export async function deleteFeedbackAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_STAFF);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Unknown response." };

  try {
    const removed = await deleteFeedback(id);
    if (!removed) return { ok: false, message: "That response was already deleted." };
    revalidatePath("/admin/feedback");
    return { ok: true, message: "Response deleted." };
  } catch (error) {
    console.error("[feedback] could not delete:", error);
    return { ok: false, message: "Couldn't delete it — try again." };
  }
}
