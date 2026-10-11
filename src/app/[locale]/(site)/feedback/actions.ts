"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { getOrderByReference } from "@/lib/orders";
import { isValidOrderToken } from "@/lib/order-token";
import { readStore } from "@/lib/admin/store";
import { sendLowFeedbackEmail } from "@/lib/email/feedback";
import { insertFeedback, orderHasFeedback } from "@/lib/feedback/data";
import { allowFeedbackSubmission } from "@/lib/feedback/throttle";
import {
  COMMENT_MAX,
  HEARD_FROM_OPTIONS,
  ORDERED_BEFORE_OPTIONS,
  RECOMMEND_ID,
  SCALE_QUESTION_IDS,
  UNHAPPY_AT_OR_BELOW,
  parseSource,
  type FeedbackPayload,
} from "@/lib/feedback/questions";

export type SubmitFeedbackResult =
  | { ok: true; recommend: number }
  | { ok: false; error: "invalid" | "duplicate" | "tooMany" | "failed" };

const payloadSchema = z.object({
  reference: z.string().trim().max(40).optional(),
  token: z.string().trim().max(80).optional(),
  source: z.string().max(20),
  locale: z.string().max(5),
  orderedBefore: z.string().max(10).optional(),
  dishes: z.array(z.string().max(120)).max(30),
  favourite: z.string().max(120).optional(),
  answers: z.record(z.string(), z.number().int().min(1).max(5)),
  heardFrom: z.string().max(20).optional(),
  comment: z.string().max(COMMENT_MAX * 2).optional(),
  contactOk: z.boolean(),
  contactName: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().max(160).optional(),
  quoteOk: z.boolean(),
  website: z.string().max(200).optional(),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Save one feedback submission.
 *
 * It is a public endpoint (a server action is a POST anyone can call), so
 * nothing the form sent is believed: question ids and values are checked
 * against the real question list, dishes against the real menu, the order link
 * against its signed token, and free text is trimmed and capped. Anything
 * unknown is dropped rather than stored, so a hand-built request can't put
 * arbitrary keys in the answers or a made-up dish in the results.
 */
export async function submitFeedbackAction(raw: FeedbackPayload): Promise<SubmitFeedbackResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  // Honeypot. A person never sees this field; a form-filling bot fills it. Answer
  // as if it worked so the bot learns nothing, and store nothing.
  if (input.website) return { ok: true, recommend: 0 };

  const recommend = input.answers[RECOMMEND_ID];
  if (!recommend) return { ok: false, error: "invalid" };

  const requestHeaders = await headers();
  const visitor =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (!allowFeedbackSubmission(visitor)) return { ok: false, error: "tooMany" };

  // ---- the order link, if there is one -------------------------------------
  let orderId: string | null = null;
  let orderReference: string | null = null;
  let customerId: string | null = null;
  let orderedBefore: string | null = null;
  let orderDishes: { slug: string; name: string }[] = [];
  let orderEmail: string | null = null;
  let orderName: string | null = null;

  if (input.reference) {
    // Both halves or neither: a reference with a bad token is treated as general
    // feedback rather than as a way to probe which references exist.
    if (isValidOrderToken(input.reference, input.token)) {
      const order = await getOrderByReference(input.reference);
      if (order && (order.paymentStatus === "paid" || order.paymentStatus === "refunded")) {
        if (await orderHasFeedback(order.id)) return { ok: false, error: "duplicate" };
        orderId = order.id;
        orderReference = order.reference;
        customerId = order.customerId;
        orderedBefore = "order";
        orderDishes = order.lines.map((l) => ({ slug: l.slug, name: l.name }));
        orderEmail = order.customerEmail || null;
        orderName = order.customerName || null;
      }
    }
  }

  // Deliberately NO "attach the signed-in customer" fallback. Feedback is tied to a
  // person only through an order link (which the customer chose to open), exactly as
  // the privacy policy says; feedback given from the footer or a QR code is anonymous
  // even if the visitor happens to be logged in.

  if (!orderedBefore) {
    orderedBefore = (ORDERED_BEFORE_OPTIONS as readonly string[]).includes(input.orderedBefore ?? "")
      ? (input.orderedBefore as string)
      : null;
  }

  // ---- answers: only real questions, only 1..5 -----------------------------
  const known = new Set<string>([...SCALE_QUESTION_IDS, RECOMMEND_ID]);
  const answers: Record<string, number> = {};
  for (const [id, value] of Object.entries(input.answers)) {
    if (known.has(id)) answers[id] = value;
  }

  // ---- dishes: only ones that exist (on the menu, or on this very order) ----
  const store = await readStore();
  const menuDishes = new Map(store.items.map((i) => [i.slug, i.name]));
  const orderDishBySlug = new Map(orderDishes.map((d) => [d.slug, d.name]));
  const nameFor = (slug: string) => orderDishBySlug.get(slug) ?? menuDishes.get(slug);

  const dishes = [...new Set(input.dishes)].flatMap((slug) => {
    const name = nameFor(slug);
    return name ? [{ slug, name }] : [];
  });
  const favouriteSlug =
    input.favourite && dishes.some((d) => d.slug === input.favourite) ? input.favourite : null;

  const heardFrom = (HEARD_FROM_OPTIONS as readonly string[]).includes(input.heardFrom ?? "")
    ? (input.heardFrom as string)
    : null;

  const comment = input.comment?.replace(/\r\n/g, "\n").trim().slice(0, COMMENT_MAX) || null;

  // ---- contact: kept only if they said we may use it ------------------------
  let contactName: string | null = null;
  let contactEmail: string | null = null;
  if (input.contactOk) {
    const email = (input.contactEmail || orderEmail || "").trim();
    if (!EMAIL.test(email)) return { ok: false, error: "invalid" };
    contactEmail = email;
    contactName = (input.contactName || orderName || "").trim() || null;
  }

  const feedback = {
    orderId,
    orderReference,
    customerId,
    source: parseSource(input.source),
    locale: input.locale === "en" ? "en" : "nl",
    orderedBefore,
    answers,
    recommend,
    dishes,
    favouriteSlug,
    heardFrom,
    comment,
    // A comment can only be quoted if there is one.
    quoteOk: Boolean(comment) && input.quoteOk,
    contactOk: input.contactOk,
    contactName,
    contactEmail,
  };

  const saved = await insertFeedback(feedback);
  if (!saved.ok) {
    return { ok: false, error: saved.reason === "duplicate" ? "duplicate" : "failed" };
  }

  // An unhappy customer is told to staff now, not whenever someone next opens the admin.
  if (recommend <= UNHAPPY_AT_OR_BELOW) {
    after(() => sendLowFeedbackEmail(feedback));
  }

  return { ok: true, recommend };
}
