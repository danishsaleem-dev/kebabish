"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import PostcodeField, { type ResolvedAddress } from "@/components/cart/PostcodeField";

/**
 * "Do you deliver to me?" — the postcode box on the contact page. It is the
 * same lookup checkout uses (PDOK, pick a suggestion) and the same rule: delivery
 * is decided by the town the postcode belongs to, matched against the towns on
 * the delivery list (`isDeliverableTown()` on the server does this at checkout).
 */
export default function DeliveryCheck({
  towns,
  whatsappHref,
}: {
  towns: string[];
  whatsappHref: string;
}) {
  const t = useTranslations("contact");
  const [address, setAddress] = useState<ResolvedAddress | null>(null);

  const normalise = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");
  const deliverable = address
    ? towns.some((town) => normalise(town) === normalise(address.city))
    : null;

  return (
    <div className="mt-4">
      <label htmlFor="delivery-check-postcode" className="sr-only">
        {t("deliveryCheckLabel")}
      </label>
      <PostcodeField
        id="delivery-check-postcode"
        name="deliveryCheckPostcode"
        placeholder={t("deliveryCheckPlaceholder")}
        onResolved={setAddress}
        onEdit={() => setAddress(null)}
      />

      {address && deliverable !== null && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
            deliverable ? "bg-cream-50/10 text-cream-50" : "bg-ember-600/25 text-cream-50"
          }`}
        >
          {deliverable ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-cream-50" />
          ) : (
            <XCircle size={20} className="mt-0.5 shrink-0 text-ember-400" />
          )}
          <div>
            <p className="font-semibold">
              {deliverable
                ? t("deliveryCheckYes", { town: address.city })
                : t("deliveryCheckNo", { town: address.city })}
            </p>
            {!deliverable && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                <MessageCircle size={15} />
                {t("deliveryCheckAsk")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
