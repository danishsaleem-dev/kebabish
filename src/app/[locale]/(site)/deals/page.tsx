import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublicDeals } from "@/lib/public-deals";
import { pageMetadata } from "@/lib/seo";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import PageSchema from "@/components/schema/PageSchema";
import DealCard from "@/components/deals/DealCard";
import SectionEyebrow from "@/components/home/SectionEyebrow";
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
    path: "/deals",
    title: t("dealsTitle"),
    description: t("dealsDescription"),
  });
}

/** Every live deal. The page only exists while there is at least one. */
export default async function DealsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const deals = await getPublicDeals(locale);
  if (deals.length === 0) notFound();

  const t = await getTranslations({ locale });
  const labels = {
    save: t.raw("deals.save") as string,
    was: t("deals.was"),
    view: t("deals.view"),
    soldOut: t("deals.soldOut"),
  };
  const [lead, ...rest] = deals;

  return (
    <>
      <PageSchema
        locale={locale}
        path="/deals"
        type="CollectionPage"
        name={t("seo.dealsTitle")}
        description={t("seo.dealsDescription")}
      />
      <BreadcrumbSchema locale={locale} items={[{ name: t("nav.deals"), path: "/deals" }]} />

      <section className="relative overflow-hidden bg-charcoal-800 pb-24 pt-12 sm:pb-32 sm:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(169,80,38,0.42),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
          <SectionEyebrow tone="light" reveal={false}>{t("deals.eyebrow")}</SectionEyebrow>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.05] text-cream-50 sm:text-6xl">
            {t("deals.title")}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-cream-200/75">{t("deals.intro")}</p>
        </div>
      </section>

      <div className="relative mx-auto -mt-16 max-w-6xl px-5 pb-16 sm:-mt-20 sm:px-6 sm:pb-24">
        <DealCard deal={lead} labels={labels} lead heading="h2" />
        {rest.length > 0 && (
          <ul className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((deal) => (
              <li key={deal.slug}>
                <DealCard deal={deal} labels={labels} heading="h2" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-ink/60">{t("deals.removeNote")}</p>
      </div>

      <FeedbackCta locale={locale} />
    </>
  );
}
