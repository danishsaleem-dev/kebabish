"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDeal, getItem, updateDeal, updateItem } from "@/lib/admin/store";
import { refreshMenuViews } from "@/lib/public-refresh";

export interface AvailabilityResult {
  ok: boolean;
  message?: string;
}

/**
 * Who may switch a dish or a deal off: the kitchen (that is the whole point of the
 * screen) plus the people who can already do it from /admin. A server action is a
 * public POST endpoint, so this is checked here and not only by the page's layout.
 */
async function guard(): Promise<{ ok: true } | { ok: false; message: string }> {
  const role = (await auth())?.user.role;
  if (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Sign in again to do that." };
  }
  return { ok: true };
}

/**
 * The menu is rendered from this same store, so a change has to reach the site too — but only
 * the pages that show availability (home, /menu, /deals and the item's own page). This used to
 * invalidate the whole site on every click of a switch, and a cook flipping a few dishes during
 * service regenerated all ~99 heavy pages each time: see `lib/public-refresh.ts`.
 */
function refresh(opts: { dish?: string; deal?: string }) {
  revalidatePath("/admin/menu");
  revalidatePath("/admin/menu/deals");
  revalidatePath("/kitchen/availability");
  refreshMenuViews({ dishes: opts.dish ? [opts.dish] : [], deals: opts.deal ? [opts.deal] : [] });
}

/**
 * Mark a dish available or not. This is the dish's own `soldOut` flag — the same one
 * the admin's items table sets — so there is one switch, not a second kitchen-only
 * one that could disagree with it. A dish whose *stock* has run out is sold out
 * whatever this says (see `public-menu.ts`), which is why the screen shows that
 * separately and doesn't pretend this switch can bring it back.
 */
export async function setDishAvailabilityAction(
  slug: string,
  available: boolean
): Promise<AvailabilityResult> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const item = await getItem(slug);
  if (!item) return { ok: false, message: "That dish no longer exists." };

  await updateItem(slug, { soldOut: !available });
  refresh({ dish: slug });
  return { ok: true };
}

/** The same for a deal (`StoredDeal.soldOut`). A deal is also unavailable by itself
 * when a part it can't do without has nothing left to serve. */
export async function setDealAvailabilityAction(
  slug: string,
  available: boolean
): Promise<AvailabilityResult> {
  const allowed = await guard();
  if (!allowed.ok) return allowed;

  const deal = await getDeal(slug);
  if (!deal) return { ok: false, message: "That deal no longer exists." };

  await updateDeal(slug, { soldOut: !available });
  refresh({ deal: slug });
  return { ok: true };
}
