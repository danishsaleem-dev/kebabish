import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Bike, Clock, Tag } from "lucide-react";
import MenuBrowser from "@/components/menu/MenuBrowser";
import MenuStructuredData from "@/components/MenuStructuredData";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { pageMetadata } from "@/lib/seo";
import PageSchema from "@/components/schema/PageSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { getPopularItems, getPublicMenu } from "@/lib/public-menu";
import { resolveCategoryLabel } from "@/lib/category-labels";
import { formatEuro } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import FeedbackCta from "@/components/feedback/FeedbackCta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/menu",
    title: t("menuTitle"),
    description: t("menuDescription"),
  });
}

/**
 * The menu: a compact header with the facts people check before ordering (open now?
 * what does delivery cost? halal? how far?), then the browser — sticky search, filters
 * and category tabs, "popular now", and every section (see MenuBrowser). The header is
 * kept short on purpose so a phone shows dishes on the first screen.
 */
export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const tMenu = await getTranslations({ locale, namespace: "menu" });
  const [settings, menu, popular] = await Promise.all([
    getPublicSettings(),
    getPublicMenu(locale),
    getPopularItems(locale),
  ]);
  const { isOpen } = getStoreStatus(settings);

  const categories = menu.map((category) => ({
    ...category,
    label: category.labelIsCustom
      ? category.label
      : resolveCategoryLabel(category.id, category.label, tMenu),
  }));

  // What delivery costs, straight from Settings — the same rules checkout applies.
  const deliveryFact =
    settings.deliveryFee > 0
      ? settings.freeDeliveryOver != null
        ? t("item.freeOver", { amount: formatEuro(settings.freeDeliveryOver) })
        : t("item.deliveryFee", { fee: formatEuro(settings.deliveryFee) })
      : t("item.deliveryFree");

  return (
    <>
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(55%_70%_at_15%_0%,rgba(169,80,38,0.14),transparent_70%)]"
        />
        <div className="mx-auto max-w-6xl px-5 pb-6 pt-10 sm:px-6 sm:pt-14">
          <MenuStructuredData categories={categories} locale={locale} />
          <PageSchema
            locale={locale}
            path="/menu"
            type="CollectionPage"
            name={t("seo.menuTitle")}
            description={t("seo.menuDescription")}
          />
          <BreadcrumbSchema locale={locale} items={[{ name: tMenu("title"), path: "/menu" }]} />

          <h1 className="font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl">
            {tMenu("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-base text-ink/70">{tMenu("intro")}</p>

          <ul className="mt-5 flex flex-wrap gap-2">
            <li
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                isOpen ? "bg-success-soft text-success" : "bg-charcoal-600/10 text-charcoal-600/80"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-success" : "bg-charcoal-400"}`} />
              {isOpen ? t("status.openNowLabel") : t("status.closedNowLabel")}
            </li>
            <Fact icon={<Bike size={14} aria-hidden="true" className="text-ember-600" />}>{deliveryFact}</Fact>
            {settings.minimumOrder > 0 && (
              <Fact icon={<Tag size={14} aria-hidden="true" className="text-ember-600" />}>
                {t("item.minimumOrder", { amount: formatEuro(settings.minimumOrder) })}
              </Fact>
            )}
            <Fact icon={<Image src="/halal.png" alt="" width={16} height={16} sizes="16px" className="h-4 w-4" />}>
              {t("common.halalBadge")}
            </Fact>
            <Fact icon={<Clock size={14} aria-hidden="true" className="text-ember-600" />}>
              {t("item.deliveredShortTitle", { km: siteConfig.deliveryRadiusKm })}
            </Fact>
          </ul>

          <MenuBrowser categories={categories} popular={popular} isOpen={isOpen} />
        </div>
      </div>
      <FeedbackCta locale={locale} />
    </>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-cream-50 px-3.5 py-1.5 text-xs font-semibold text-charcoal-600/85 ring-1 ring-charcoal-600/8">
      {icon}
      {children}
    </li>
  );
}
