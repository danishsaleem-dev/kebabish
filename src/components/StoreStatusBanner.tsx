import { getTranslations } from "next-intl/server";
import { Clock, Info } from "lucide-react";
import type { StoreStatus } from "@/lib/store-status";

/**
 * Sits between the header and page content on every normal public page.
 * Closed (owner toggle off, or outside today's hours): a firm notice.
 * Open but with a custom notice set (e.g. "busy tonight"): a lighter,
 * non-alarming one. Otherwise renders nothing.
 */
export default async function StoreStatusBanner({
  status,
  locale,
}: {
  status: StoreStatus;
  locale: string;
}) {
  if (status.isOpen && !status.orderNotice) return null;

  const t = await getTranslations({ locale, namespace: "status" });

  if (!status.isOpen) {
    return (
      <div className="bg-charcoal-600 px-5 py-3 text-center text-sm text-cream-100 sm:px-6">
        <span className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Clock size={16} className="shrink-0 text-cream-100/80" aria-hidden="true" />
          <span className="font-semibold">{t("closedTitle")}</span>
          <span className="text-cream-100/75">
            {status.orderNotice || t("closedDefault")}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="bg-ember-600/10 px-5 py-3 text-center text-sm text-ember-700 sm:px-6">
      <span className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Info size={16} className="shrink-0" aria-hidden="true" />
        <span>{status.orderNotice}</span>
      </span>
    </div>
  );
}
