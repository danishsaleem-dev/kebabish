"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import {
  deleteFeedback,
  forgetHomepageQuotes,
  setShowOnHomepage,
  toggleHandled,
} from "@/lib/feedback/data";

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

/**
 * One-click: show (or stop showing) a customer's comment as a quote on the public site.
 * Only possible for a response that has a comment and whose author ticked "you may quote my
 * comment" — enforced in `setShowOnHomepage`, so a hand-made POST can't get around it.
 */
export async function setFeedbackHomepageAction(
  id: string,
  on: boolean
): Promise<{ ok: boolean; message: string }> {
  await requireRole(OWNER_STAFF);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Unknown response." };

  const result = await setShowOnHomepage(id, Boolean(on));
  if (!result.ok) {
    const message = {
      missing: "That response no longer exists.",
      no_consent: "This customer didn't tick “you may quote my comment”, so it can't go on the site.",
      not_ready: "Run migration 0025 in Supabase first, then try again.",
      failed: "Couldn't change it — try again.",
    }[result.reason];
    return { ok: false, message };
  }

  forgetHomepageQuotes();
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/feedback");
  return {
    ok: true,
    message: on ? "Now on the homepage — live within a minute." : "Removed from the homepage.",
  };
}
