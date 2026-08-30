"use client";

import { useTranslations, useLocale } from "next-intl";
import { Leaf } from "lucide-react";
import type { MenuItem } from "@/lib/menu-data";
import { whatsappOrderLink } from "@/lib/site-config";

export default function MenuItemCard({ item }: { item: MenuItem }) {
  const t = useTranslations("menu");
  const locale = useLocale();

  const orderHref = whatsappOrderLink(
    locale === "nl"
      ? `Hallo Kebabish! Ik wil graag bestellen: ${item.name}${
          item.variants ? ` (smaak: ___)` : ""
        }`
      : `Hi Kebabish! I'd like to order: ${item.name}${
          item.variants ? ` (flavor: ___)` : ""
        }`
  );

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white/60 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-neutral-900">{item.name}</h3>
          {item.vegetarian && (
            <span title="Vegetarian" className="mt-1 shrink-0 text-green-700">
              <Leaf size={16} />
            </span>
          )}
        </div>
        {item.variants && (
          <p className="mt-1 text-sm text-neutral-900/70">{item.variants.join(" · ")}</p>
        )}
        {item.soldOut && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-900">
            Sold out
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-base font-semibold text-neutral-900">
          {item.price != null ? `€ ${item.price.toFixed(2)}` : t("priceOnRequest")}
        </span>
        {!item.soldOut && (
          <a
            href={orderHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-50 transition-colors hover:bg-neutral-800"
          >
            {t("addToOrder")}
          </a>
        )}
      </div>
    </div>
  );
}
