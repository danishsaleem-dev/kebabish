import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/lib/brevo/audience";
import { recordEvent, suppress, type SuppressionReason } from "@/lib/brevo/suppressions";
import { setMarketingConsent } from "@/lib/customers/accounts";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Brevo's marketing webhook.
 *
 * **Brevo does not sign its webhooks** — there is no HMAC. Its documented
 * options are a bearer token, custom headers, basic auth in the URL, or IP
 * allowlisting. We register the webhook with a bearer token
 * (`BREVO_WEBHOOK_SECRET`) and compare it timing-safely, fail-closed when it
 * isn't set, the same shape as `/api/cron/housekeeping`.
 *
 * Beyond the token, the design follows the Mollie route's reasoning: the only
 * state this endpoint can change is **suppression** — stopping somebody's
 * marketing email — which is fail-safe. The worst a forged call achieves is
 * that one person stops receiving campaigns they could opt back into. It
 * cannot reveal anything, change an order, or move money.
 *
 * Only the events that change our own state are handled. Opens and clicks are
 * ignored on purpose: Brevo already reports them per campaign, and storing
 * them would make this the largest table in the database for reporting we
 * already have.
 */

export const dynamic = "force-dynamic";

/** The Brevo event names that mean "stop emailing this address". */
const SUPPRESSING: Record<string, SuppressionReason> = {
  unsubscribe: "unsubscribe",
  hard_bounce: "hard_bounce",
  spam: "spam",
  contact_deleted: "contact_deleted",
};

/**
 * A soft bounce is a temporary failure (a full mailbox, a server having a bad
 * day), so it is logged but never suppresses. Brevo blocks an address itself
 * after enough of them and tells us as a hard bounce.
 */
const LOGGED_ONLY = new Set(["soft_bounce"]);

function authorised(request: Request): boolean {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which is itself a leak of
  // nothing useful — but it has to be guarded or the route 500s on a short header.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface BrevoEventBody {
  event?: string;
  email?: string;
  camp_id?: number;
  campaign_name?: string;
  /** UTC. `date_event` is local time, which is why this is the one used. */
  ts_event?: number;
  date_event?: string;
  reason?: string;
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: BrevoEventBody | BrevoEventBody[];
  try {
    body = (await request.json()) as BrevoEventBody | BrevoEventBody[];
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  // Brevo can batch events into an array when batching is switched on.
  const events = Array.isArray(body) ? body : [body];

  let handled = 0;
  let duplicates = 0;

  try {
    for (const event of events) {
      const name = String(event.event ?? "").toLowerCase();
      const email = normalizeEmail(event.email);
      if (!name || !email) continue;

      const reason = SUPPRESSING[name];
      if (!reason && !LOGGED_ONLY.has(name)) continue; // opens, clicks, deliveries

      const eventAt = event.ts_event
        ? new Date(event.ts_event * 1000).toISOString()
        : new Date().toISOString();

      const isNew = await recordEvent({
        event: name,
        email,
        campaignId: typeof event.camp_id === "number" ? event.camp_id : null,
        campaignName: event.campaign_name ?? null,
        eventAt,
      });

      if (!isNew) {
        duplicates += 1;
        continue;
      }

      if (!reason) {
        handled += 1;
        continue;
      }

      // The suppression is the part that must not be lost. If it can't be
      // written, answer non-2xx below so Brevo retries the whole delivery —
      // the event log row is idempotent, so a retry costs nothing.
      const written = await suppress(email, reason, event.campaign_name ?? null);
      if (!written) {
        return NextResponse.json({ error: "could not record" }, { status: 500 });
      }

      // And, for somebody with an account, flip their own consent flag too, so
      // the dashboard shows the truth and the audience excludes them for both
      // reasons rather than only the mirror.
      await withdrawAccountConsent(email);
      handled += 1;
    }
  } catch (error) {
    console.error("[brevo] webhook failed:", error);
    // A non-200 makes Brevo retry, which is what we want: an unsubscribe we
    // dropped is the one mistake here that cannot be put right afterwards.
    return NextResponse.json({ error: "webhook failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handled, duplicates });
}

/**
 * Turn an account's own marketing flag off.
 *
 * Goes through `setMarketingConsent` so the withdrawal is stamped exactly the
 * way the dashboard's own unsubscribe stamps it — one place decides what
 * "withdrawn" means. The source stays whatever it was; 0011's check
 * constraint only allows signup/checkout/dashboard, and a withdrawal does not
 * rewrite the source anyway.
 */
async function withdrawAccountConsent(email: string): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("customers")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error || !data) return;
    await setMarketingConsent(data.id as string, false, "dashboard");
  } catch (error) {
    // The suppression mirror already covers them, so this is belt-and-braces.
    console.error(`[brevo] could not withdraw consent for ${email}:`, error);
  }
}
