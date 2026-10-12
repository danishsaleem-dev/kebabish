import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import MenuBrowser from "@/components/menu/MenuBrowser";
import MenuStructuredData from "@/components/MenuStructuredData";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { pageMetadata } from "@/lib/seo";
import PageSchema from "@/components/schema/PageSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { getPublicMenu } from "@/lib/public-menu";
import { resolveCategoryLabel } from "@/lib/category-labels";
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

export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const [settings, menu] = await Promise.all([
    getPublicSettings(),
    getPublicMenu(locale),
  ]);
  const { isOpen } = getStoreStatus(settings);

  const categories = menu.map((category) => ({
    ...category,
    label: category.labelIsCustom
      ? category.label
      : resolveCategoryLabel(category.id, category.label, t),
  }));

  return (
    <>
      <div className="mx-auto max-w-6xl px-5 pb-6 pt-16 sm:px-6 sm:pt-20">
        <MenuStructuredData categories={categories} locale={locale} />
        <PageSchema
          locale={locale}
          path="/menu"
          type="CollectionPage"
          name={tSeo("menuTitle")}
          description={tSeo("menuDescription")}
        />
        <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/menu" }]} />

        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold text-charcoal-600 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-ink/70">
            {t("intro")}
          </p>
        </div>

        <MenuBrowser categories={categories} isOpen={isOpen} />
      </div>
      <FeedbackCta locale={locale} />
    </>
  );
}
