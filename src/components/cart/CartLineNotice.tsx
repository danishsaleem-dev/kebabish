"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { CartIssue } from "@/components/cart/CartProvider";

/**
 * The warning under a cart line: it can't be ordered any more (sold out,
 * taken off the menu, its extras changed), or its price was just updated to
 * match the menu. Shared by the cart page, the drawer and the checkout
 * summary so the wording is identical everywhere.
 */
export default function CartLineNotice({
  issue,
  repriced,
}: {
  issue?: CartIssue;
  repriced?: boolean;
}) {
  const t = useTranslations("cart");

  if (issue) {
    const label =
      issue === "soldOut"
        ? t("soldOutBadge")
        : issue === "insufficient"
          ? t("insufficientBadge")
          : issue === "optionsChanged"
            ? t("optionsChangedBadge")
            : t("unavailableBadge");
    return (
      <p
        role="alert"
        className="mt-2 inline-flex items-start gap-1.5 rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-semibold leading-snug text-red-800"
      >
        <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
        <span>
          {label}
          <span className="block font-normal">
            {issue === "soldOut"
              ? t("soldOutHint")
              : issue === "insufficient"
                ? t("insufficientHint")
                : t("removeToContinue")}
          </span>
        </span>
      </p>
    );
  }

  if (repriced) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-ember-600/10 px-2.5 py-1 text-xs font-medium text-ember-700">
        <RefreshCw size={12} aria-hidden="true" />
        {t("priceUpdated")}
      </p>
    );
  }

  return null;
}
