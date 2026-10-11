"use server";

import { validPaymentLinkUrl } from "@/lib/payment-link";
import { validReviewUrl } from "@/lib/feedback/review-url";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OWNER_STAFF, OWNER_STAFF_MANAGER, requireRole } from "@/lib/admin/guard";
import { updateSettings } from "@/lib/admin/store";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import {
  DEFAULT_SLOT_MINUTES,
  MAX_BOOKING_WINDOW_DAYS,
  MAX_SLOT_MINUTES,
  MIN_SLOT_MINUTES,
} from "@/lib/delivery-slots";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const settingsSchema = z.object({
  deliveryRadiusKm: z.coerce.number().min(1).max(50),
  deliveryFee: z.coerce.number().min(0).max(50),
  freeDeliveryOver: z
    .union([z.literal(""), z.coerce.number().min(0)])
    .transform((v) => (v === "" ? null : Number(v))),
  minimumOrder: z.coerce.number().min(0).max(200),
  averagePrepMinutes: z.coerce.number().int().min(5).max(180),
  acceptingOrders: z.boolean(),
  orderNotice: z.string().trim().max(200, "Keep the notice under 200 characters."),
  vatRatePercent: z
    .union([
      z.literal(""),
      z.coerce.number().min(0, "VAT can't be negative.").max(25, "That looks too high for a VAT rate."),
    ])
    .transform((v) => (v === "" ? null : Number(v))),
  vatNumber: z
    .string()
    .transform((v) => v.replace(/[\s.]/g, "").toUpperCase())
    .refine((v) => v === "" || /^NL\d{9}B\d{2}$/.test(v), "Use the Dutch format, e.g. NL123456789B01."),
  showLegalNameOnInvoice: z.boolean(),
  showLaunchBadge: z.boolean(),
  googleReviewUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || validReviewUrl(v) !== null,
      "That isn't a Google review link \u2014 it should start with https:// and be a google.com, g.page or goo.gl address."
    ),
  paymentLinkUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || validPaymentLinkUrl(v) !== null,
      "That isn't a Mollie payment link — it should start with https://payment-links.mollie.com/"
    ),
  slotMinutes: z.coerce
    .number()
    .int("Whole minutes only.")
    .min(MIN_SLOT_MINUTES, `At least ${MIN_SLOT_MINUTES} minutes — a slot keeps 15 for the kitchen and rider.`)
    .max(MAX_SLOT_MINUTES, `At most ${MAX_SLOT_MINUTES} minutes.`)
    .refine((v) => v % 5 === 0, "Use a multiple of 5 minutes."),
  slotCapacity: z.coerce.number().int("Whole orders only.").min(1, "At least 1.").max(100, "That looks too high."),
  bookingWindowDays: z.coerce
    .number()
    .int("Whole days only.")
    .min(1, "At least 1 day.")
    .max(MAX_BOOKING_WINDOW_DAYS, `At most ${MAX_BOOKING_WINDOW_DAYS} days.`),
});

/** A per-day override: blank means "use the default", anything else must be a sensible whole number. */
function readOverride(raw: string | undefined, min: number, max: number, multipleOf = 1): number | undefined | "invalid" {
  const text = (raw ?? "").trim();
  if (text === "") return undefined;
  const n = Number(text);
  if (!Number.isInteger(n) || n < min || n > max || n % multipleOf !== 0) return "invalid";
  return n;
}

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole(OWNER_STAFF);
  const parsed = settingsSchema.safeParse({
    deliveryRadiusKm: formData.get("deliveryRadiusKm"),
    deliveryFee: formData.get("deliveryFee"),
    freeDeliveryOver: formData.get("freeDeliveryOver") ?? "",
    minimumOrder: formData.get("minimumOrder"),
    averagePrepMinutes: formData.get("averagePrepMinutes"),
    acceptingOrders: formData.get("acceptingOrders") === "on",
    orderNotice: formData.get("orderNotice") ?? "",
    vatRatePercent: formData.get("vatRatePercent") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
    showLegalNameOnInvoice: formData.get("showLegalNameOnInvoice") === "on",
    showLaunchBadge: formData.get("showLaunchBadge") === "on",
    paymentLinkUrl: formData.get("paymentLinkUrl") ?? "",
    googleReviewUrl: formData.get("googleReviewUrl") ?? "",
    slotMinutes: formData.get("slotMinutes") ?? DEFAULT_SLOT_MINUTES,
    slotCapacity: formData.get("slotCapacity") ?? 10,
    bookingWindowDays: formData.get("bookingWindowDays") ?? 7,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  // Opening hours arrive as parallel arrays, one entry per weekday.
  const days = formData.getAll("hourDay").map(Number);
  const closed = formData.getAll("hourClosed").map((v) => v === "true");
  const opens = formData.getAll("hourOpens").map(String);
  const closes = formData.getAll("hourCloses").map(String);

  // Per-day slot length and capacity, as parallel arrays like the rest.
  // Always submitted (even for a closed day) so positions never drift.
  const dayMinutes = formData.getAll("hourSlotMinutes").map(String);
  const dayCapacity = formData.getAll("hourSlotCapacity").map(String);

  const hours: {
    day: number;
    closed: boolean;
    opens: string;
    closes: string;
    slotMinutes?: number;
    slotCapacity?: number;
  }[] = [];
  for (let i = 0; i < days.length; i++) {
    const minutes = readOverride(dayMinutes[i], MIN_SLOT_MINUTES, MAX_SLOT_MINUTES, 5);
    const capacity = readOverride(dayCapacity[i], 1, 100);
    if (minutes === "invalid" || capacity === "invalid") {
      return {
        ok: false,
        message: `Check the slot length and capacity on ${DAY_NAMES[days[i]] ?? "that day"}: length ${MIN_SLOT_MINUTES}–${MAX_SLOT_MINUTES} minutes in steps of 5, capacity 1–100 — or leave them empty for the default.`,
      };
    }
    hours.push({
      day: days[i],
      closed: closed[i] ?? false,
      opens: TIME.test(opens[i]) ? opens[i] : "16:00",
      closes: TIME.test(closes[i]) ? closes[i] : "22:00",
      ...(minutes !== undefined ? { slotMinutes: minutes } : {}),
      ...(capacity !== undefined ? { slotCapacity: capacity } : {}),
    });
  }

  const badDay = hours.find(
    (h) => !h.closed && h.opens >= h.closes
  );
  if (badDay) {
    return {
      ok: false,
      message: "Closing time has to be after opening time on every open day.",
    };
  }

  // An open day has to be long enough for at least one full slot, or it
  // would silently offer nothing to book.
  const tooShort = hours.find((h) => {
    if (h.closed) return false;
    const length = h.slotMinutes ?? parsed.data.slotMinutes;
    const [oh, om] = h.opens.split(":").map(Number);
    const [ch, cm] = h.closes.split(":").map(Number);
    return ch * 60 + cm - (oh * 60 + om) < length;
  });
  if (tooShort) {
    return {
      ok: false,
      message: `${DAY_NAMES[tooShort.day]} is open for less than one delivery slot — shorten the slot length or open longer.`,
    };
  }

  // Ordered list, so it arrives as repeated fields like the hours do. Kept
  // out of the zod object above because that parses a flat record of single
  // values; `getAll` is what preserves the order Danish dragged them into.
  const galleryMediaIds = formData
    .getAll("galleryMediaIds")
    .map(String)
    .filter((id) => id.trim() !== "");

  await updateSettings({ ...parsed.data, hours, galleryMediaIds });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  // The public site reads the same settings (open/closed banner, live
  // hours, per-dish ordering) — push the change out immediately rather
  // than waiting on the 60s ISR window on (site)/layout.tsx.
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
  return { ok: true, message: "Settings saved." };
}
