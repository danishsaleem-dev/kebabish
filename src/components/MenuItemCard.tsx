"use client";

import { useTranslations } from "next-intl";
import { Leaf, Plus } from "lucide-react";
import type { MenuItem } from "@/lib/menu-data";
import { whatsappOrderLink } from "@/lib/site-config";

export default function MenuItemCard({
  item,
  isOpen,
}: {
  item: MenuItem;
  isOpen: boolean;
}) {
  const t = useTranslations("menu");
  const tWhatsapp = useTranslations("whatsapp");
  const tStatus = useTranslations("status");

  const orderHref = whatsappOrderLink(
    item.variants
      ? tWhatsapp("orderItemVariant", { item: item.name })
      : tWhatsapp("orderItem", { item: item.name })
  );

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-cream-400/40 bg-cream-50 p-5 shadow-sm shadow-charcoal-950/5 transition-[transform,box-shadow] duration-500 ease-brand hover:-translate-y-1 hover:shadow-lg hover:shadow-charcoal-950/10">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug text-charcoal-600">
            {item.name}
          </h3>
          {item.vegetarian && (
            <span title={t("vegetarian")} className="mt-1 shrink-0 text-green-700">
              <Leaf size={16} />
            </span>
          )}
        </div>

        {item.variants && (
          <p className="mt-1.5 text-sm leading-snug text-ink/55">
            {item.variants.join(" · ")}
          </p>
        )}

        {item.soldOut && (
          <p className="mt-2.5 inline-block rounded-full bg-charcoal-600/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-charcoal-500">
            {t("soldOut")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="font-display text-sm font-semibold text-charcoal-500">
          {item.price != null
            ? `€ ${item.price.toFixed(2)}`
            : t("priceOnRequest")}
        </span>

        {!item.soldOut &&
          (isOpen ? (
            <a
              href={orderHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-charcoal-600 px-4 py-2.5 text-xs font-semibold text-cream-100 transition-colors duration-300 hover:bg-ember-600"
            >
              <Plus size={14} />
              {t("addToOrder")}
            </a>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-charcoal-600/10 px-4 py-2.5 text-xs font-semibold text-charcoal-500">
              {tStatus("menuUnavailable")}
            </span>
          ))}
      </div>
    </div>
  );
}
