"use server";

import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { loadCloseDayState } from "@/lib/admin/close-day";
import { deleteLatestClosedDay, insertClosedDay } from "@/lib/business-days-data";
import { canClose } from "@/lib/business-day";

function refresh() {
  for (const path of ["/admin", "/admin/close-day", "/admin/reports"]) revalidatePath(path);
}

/**
 * Close the open business day now. Everything the page showed is checked again here from
 * scratch — the checklist, the audit tick, and that the day being closed is still the one the
 * page was showing (`openedAt`), so a second person closing at the same moment can't close
 * the next day by accident.
 */
export async function closeDayAction(input: {
  openedAt: string;
  auditDone: boolean;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  const session = await requireRole(OWNER_STAFF);
  const now = new Date();
  const state = await loadCloseDayState(now);

  if (!state.ready) return { ok: false, message: "Run migration 0027 in Supabase first." };
  if (state.open.openedAt !== input?.openedAt) {
    return { ok: false, message: "This day was closed from another screen. Reload the page." };
  }
  if (!canClose(state.items)) {
    return { ok: false, message: "The checklist isn't clear yet — reload to see what's left." };
  }
  if (input.auditDone !== true) {
    return { ok: false, message: "Tick “Audit done” once the cash is counted." };
  }

  const note = String(input.note ?? "").trim().slice(0, 1000);
  const result = await insertClosedDay({
    businessDate: state.open.businessDate,
    openedAt: state.open.openedAt,
    closedAt: now.toISOString(),
    closedBy: /^[0-9a-f-]{36}$/i.test(session.user.id ?? "") ? session.user.id : null,
    closedByName: session.user.name || session.user.email || null,
    auditNote: note || null,
    summary: state.summary,
  });

  if (!result.ok) {
    const message = {
      notSetUp: "Run migration 0027 in Supabase first.",
      alreadyClosed: "This day has just been closed by someone else. Reload the page.",
      failed: "Couldn't close the day — try again.",
    }[result.reason];
    return { ok: false, message };
  }

  refresh();
  return { ok: true, message: "Day closed. The next day starts now." };
}

/** Owner only: undo the most recent closing, when a day was closed by mistake. */
export async function reopenDayAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requireRole(["owner"]);
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) return { ok: false, message: "Unknown day." };

  const result = await deleteLatestClosedDay(id);
  if (!result.ok) {
    const message = {
      notLatest: "Only the most recently closed day can be reopened.",
      missing: "That day is no longer closed.",
      failed: "Couldn't reopen it — try again.",
    }[result.reason];
    return { ok: false, message };
  }

  refresh();
  return { ok: true, message: "Day reopened. Orders since then belong to it again." };
}
