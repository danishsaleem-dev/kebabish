import "server-only";
import { siteConfig } from "@/lib/site-config";
import { orderAccessToken } from "@/lib/order-token";

/** The customer's own order page, where an unpaid order can be paid. */
export function orderPaymentUrl(reference: string, locale: string): string {
  const prefix = locale === "en" ? "/en" : "";
  return `${siteConfig.website}${prefix}/checkout/complete?ref=${encodeURIComponent(reference)}&t=${orderAccessToken(reference)}`;
}
