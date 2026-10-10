import "server-only";

/**
 * Minimal Mollie REST client — just the two calls checkout needs, rather
 * than another dependency for create-payment and read-payment.
 *
 * The key is `test_…` until Danish swaps it for `live_…`; nothing here
 * cares which, so going live is an environment change, not a code change.
 */

const API = "https://api.mollie.com/v2";

export type MolliePaymentStatus =
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "canceled"
  | "expired"
  | "failed";

export interface MolliePayment {
  id: string;
  status: MolliePaymentStatus;
  checkoutUrl: string | null;
  metadata: Record<string, string> | null;
  /** Mollie omits this once a payment is final; only some methods can be cancelled. */
  isCancelable: boolean;
}

function apiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new Error("MOLLIE_API_KEY isn't set.");
  return key;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = body?.detail ?? response.statusText;
    throw new Error(`Mollie ${response.status}: ${detail}`);
  }

  return body;
}

/** Mollie wants amounts as decimal strings: 12 -> "12.00". */
function amountFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function createPayment(input: {
  amountCents: number;
  description: string;
  redirectUrl: string;
  /**
   * Mollie rejects non-public URLs, so this is omitted in local dev. The
   * return page reconciles by polling the payment instead, which means the
   * flow still completes end to end without a tunnel.
   */
  webhookUrl?: string;
  metadata: Record<string, string>;
}): Promise<MolliePayment> {
  const body = await request("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: "EUR", value: amountFromCents(input.amountCents) },
      description: input.description,
      redirectUrl: input.redirectUrl,
      ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
      metadata: input.metadata,
    }),
  });

  return {
    id: body.id,
    status: body.status,
    checkoutUrl: body._links?.checkout?.href ?? null,
    metadata: body.metadata ?? null,
    isCancelable: body.isCancelable === true,
  };
}

export async function getPayment(id: string): Promise<MolliePayment> {
  const body = await request(`/payments/${encodeURIComponent(id)}`);
  return {
    id: body.id,
    status: body.status,
    checkoutUrl: body._links?.checkout?.href ?? null,
    metadata: body.metadata ?? null,
    isCancelable: body.isCancelable === true,
  };
}

/**
 * Cancel a payment that hasn't been completed, so a customer can't pay it
 * after we've given its delivery slot away. Returns false (rather than
 * throwing) when Mollie says it can no longer be cancelled — that's an
 * expected outcome for some methods, not an error.
 */
export async function cancelPayment(id: string): Promise<boolean> {
  try {
    await request(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (error instanceof Error && /Mollie (422|404)/.test(error.message)) return false;
    throw error;
  }
}

/** Mollie's statuses -> the ones stored on an order. */
export function toPaymentStatus(status: MolliePaymentStatus) {
  switch (status) {
    case "paid":
      return "paid" as const;
    case "failed":
      return "failed" as const;
    case "expired":
      return "expired" as const;
    case "canceled":
      return "canceled" as const;
    default:
      // open / pending / authorized are all still in flight.
      return "open" as const;
  }
}
