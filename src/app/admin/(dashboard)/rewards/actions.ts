"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import { updateSettings } from "@/lib/admin/store";
import { adjustPoints, findCustomerByEmail } from "@/lib/rewards";
import { DEFAULT_REWARDS, normalizeRewards } from "@/lib/rewards-math";

/**
 * The rewards rules and manual point changes. Both check the role themselves: a server action
 * is a public POST endpoint, so the page guard alone isn't enough.
 */

const PATH = "/admin/rewards";

/** A whole number inside a range, or null so the caller can say which field was wrong. */
function whole(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/** "5" or "5,50" or "5.50" euros -> cents. */
function euroCents(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents >= min && cents <= max ? cents : null;
}

/** Owner only: these numbers decide what the shop gives away. */
export async function saveRewardsRulesAction(formData: FormData): Promise<void> {
  await requireRole(["owner"]);

  const pointsPerEuro = whole(formData.get("pointsPerEuro"), 1, 1000);
  const redeemStepPoints = whole(formData.get("redeemStepPoints"), 1, 1_000_000);
  const redeemStepCents = euroCents(formData.get("redeemStepEuros"), 1, 100_000);
  const maxSharePercent = whole(formData.get("maxSharePercent"), 1, 100);
  const welcomePoints = whole(formData.get("welcomePoints"), 0, 100_000);

  const bad = [
    [pointsPerEuro, "Points per €1 (1–1000)"],
    [redeemStepPoints, "Points per reward (1–1,000,000)"],
    [redeemStepCents, "Money off per reward (€0.01–€1,000)"],
    [maxSharePercent, "Highest share of an order (1–100%)"],
    [welcomePoints, "Welcome bonus (0–100,000)"],
  ].find(([value]) => value === null);
  if (bad) redirect(flashRedirect(PATH, `Check this field: ${bad[1]}.`, "error"));

  await updateSettings({
    rewards: normalizeRewards({
      enabled: formData.get("enabled") === "on",
      pointsPerEuro: pointsPerEuro ?? DEFAULT_REWARDS.pointsPerEuro,
      redeemStepPoints: redeemStepPoints ?? DEFAULT_REWARDS.redeemStepPoints,
      redeemStepCents: redeemStepCents ?? DEFAULT_REWARDS.redeemStepCents,
      maxSharePercent: maxSharePercent ?? DEFAULT_REWARDS.maxSharePercent,
      welcomePoints: welcomePoints ?? DEFAULT_REWARDS.welcomePoints,
    }),
  });

  // The checkout and dashboard read the rules on every request, but pages that are cached say
  // nothing about points, so only the admin screen needs refreshing.
  revalidatePath(PATH);
  redirect(
    flashRedirect(
      PATH,
      formData.get("enabled") === "on" ? "Rewards saved and switched on." : "Rewards saved (switched off)."
    )
  );
}

/** Add or remove points for one customer, with a reason. */
export async function adjustPointsAction(formData: FormData): Promise<void> {
  const session = await requireRole(OWNER_STAFF);

  const email = String(formData.get("email") ?? "").trim();
  const direction = formData.get("direction") === "remove" ? -1 : 1;
  const amount = whole(formData.get("points"), 1, 1_000_000);
  const note = String(formData.get("note") ?? "");

  if (!email) redirect(flashRedirect(PATH, "Enter the customer's email address.", "error"));
  if (amount === null) redirect(flashRedirect(PATH, "Enter a whole number of points.", "error"));

  const customer = await findCustomerByEmail(email);
  if (!customer) {
    redirect(
      flashRedirect(PATH, "No customer account with that email. Guests can't hold points.", "error")
    );
  }

  const result = await adjustPoints({
    customerId: customer.id,
    points: direction * amount,
    note,
    adminId: session.user.id,
  });
  if (!result.ok) redirect(flashRedirect(PATH, result.message, "error"));

  revalidatePath(PATH);
  redirect(
    flashRedirect(
      PATH,
      `${customer.name || customer.email} now has ${result.balance.toLocaleString("en-GB")} points.`
    )
  );
}
