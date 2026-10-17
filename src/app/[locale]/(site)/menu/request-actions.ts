"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { readStore } from "@/lib/admin/store";
import { amsterdamDateAhead, amsterdamNow } from "@/lib/delivery-slots";
import { normalizeDutchPhone } from "@/lib/phone";
import { sendStockRequestEmail } from "@/lib/email/stock-request";
import { insertStockRequest } from "@/lib/stock-requests/data";
import { allowStockRequest } from "@/lib/stock-requests/throttle";

export interface RequestDishState {
  ok: boolean;
  /** A message key under `stockRequest.errors.*`, for something not tied to one field. */
  error?: string;
  /** Field name -> message key under `stockRequest.errors.*`. */
  errors?: Record<string, string>;
}

/** How far ahead a request may ask for a date. */
const MAX_DAYS_AHEAD = 60;

/**
 * "This dish is sold out — can you get it in for me?" Open to anyone (no account), so
 * it trusts nothing: the dish is looked up in the real menu (the form only sends its
 * slug), quantity and date are bounded, the phone number must look like one, free text
 * is trimmed, and a honeypot plus a per-visitor throttle keep a script from filling the
 * inbox. A request only adds a row for staff to read — it reserves nothing and charges
 * nothing.
 */
export async function requestDishAction(
  _prev: RequestDishState,
  formData: FormData
): Promise<RequestDishState> {
  // Honeypot: invisible to people, filled in by form-filling bots. Answer as if it
  // worked so the bot learns nothing, and store nothing.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  const errors: Record<string, string> = {};

  const slug = String(formData.get("slug") ?? "");
  const locale = String(formData.get("locale") ?? "nl");
  const store = await readStore();
  const item = store.items.find((i) => i.slug === slug && i.visible);
  if (!item) return { ok: false, error: "unknownDish" };

  const quantity = Math.trunc(Number(formData.get("quantity")));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) errors.quantity = "quantity";

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) errors.name = "name";

  const phone = normalizeDutchPhone(String(formData.get("phone") ?? ""));
  if (!phone) errors.phone = "phone";

  const email = String(formData.get("email") ?? "").trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "email";

  const wantedDate = String(formData.get("date") ?? "").trim();
  if (wantedDate) {
    const today = amsterdamNow().dateKey;
    const last = amsterdamDateAhead(MAX_DAYS_AHEAD).dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wantedDate) || wantedDate < today || wantedDate > last) {
      errors.date = "date";
    }
  }
  const wantedTime = String(formData.get("time") ?? "").trim();
  if (wantedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(wantedTime)) errors.time = "time";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const requestHeaders = await headers();
  const visitor =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (!allowStockRequest(visitor)) return { ok: false, error: "tooMany" };

  const request = {
    itemSlug: item.slug,
    // The default (Dutch) name, like order lines: it is what the kitchen reads.
    itemName: item.name,
    quantity,
    wantedDate: wantedDate || null,
    wantedTime: wantedDate && wantedTime ? wantedTime : null,
    customerName: name,
    phone: phone as string,
    email,
    note: String(formData.get("note") ?? "").trim().slice(0, 500),
    locale,
  };

  if (!(await insertStockRequest(request))) return { ok: false, error: "saveFailed" };

  after(() => sendStockRequestEmail(request));
  return { ok: true };
}
