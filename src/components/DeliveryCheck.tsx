"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import PostcodeField from "@/components/cart/PostcodeField";
import { checkDeliveryAction } from "@/app/[locale]/(site)/delivery-actions";

/**
 * "Do you deliver to me?" — the postcode box on the contact page. Same lookup as checkout
 * (PDOK, pick a suggestion) and the same rule: the server measures how far that postcode is
 * from the kitchen and compares it with the delivery radius (`assessDelivery()`), instead of
 * checking the town against a list — a village that simply isn't on the list is still
 * deliverable if it is close enough.
 */
export default function DeliveryCheck({ whatsappHref }: { whatsappHref: string }) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [result, setResult] = useState<{ city: string; deliverable: boolean; km: number | null } | null>(null);
  const [failed, setFailed] = useState(false);

  async function check(postcode: string, city: string) {
    setFailed(false);
    try {
      const r = await checkDeliveryAction({ postcode });
      if (r.ok) setResult({ city: r.city || city, deliverable: r.deliverable, km: r.km });
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }

  const km = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  return (
    <div className="mt-4">
      <label htmlFor="delivery-check-postcode" className="sr-only">
        {t("deliveryCheckLabel")}
      </label>
      <PostcodeField
        id="delivery-check-postcode"
        name="deliveryCheckPostcode"
        placeholder={t("deliveryCheckPlaceholder")}
        onResolved={({ postcode, city }) => void check(postcode, city)}
        onEdit={() => {
          setResult(null);
          setFailed(false);
        }}
      />

      {failed && (
        <p role="status" className="mt-4 rounded-2xl bg-ember-600/25 px-4 py-3.5 text-sm text-cream-50">
          {t("deliveryCheckFailed")}
        </p>
      )}

      {result && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
            result.deliverable ? "bg-cream-50/10 text-cream-50" : "bg-ember-600/25 text-cream-50"
          }`}
        >
          {result.deliverable ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-cream-50" />
          ) : (
            <XCircle size={20} className="mt-0.5 shrink-0 text-ember-400" />
          )}
          <div>
            <p className="font-semibold">
              {result.deliverable
                ? t("deliveryCheckYes", { town: result.city })
                : t("deliveryCheckNo", { town: result.city })}
            </p>
            {result.km != null && (
              <p className="mt-0.5 text-cream-200/75">{t("deliveryCheckDistance", { km: km(result.km) })}</p>
            )}
            {!result.deliverable && (
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
