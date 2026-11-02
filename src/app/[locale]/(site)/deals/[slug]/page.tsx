import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicDeal, getPublicDeals } from "@/lib/public-deals";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { pageMetadata, snippet } from "@/lib/seo";
import { formatEuro } from "@/lib/money";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import DealSchema from "@/components/schema/DealSchema";
import DealBuilder from "@/components/deals/DealBuilder";
import DealCard, { DealPhoto } from "@/components/deals/DealCard";
import ExpandableText from "@/components/menu/ExpandableText";
import ShareButton from "@/components/menu/ShareButton";
import FeedbackCta from "@/components/feedback/FeedbackCta";

export async function generateStaticParams() {
  return (await getPublicDeals()).map((deal) => ({ slug: deal.slug }));
}

/** What the owner wrote, in this language, topped up with the local terms when it is short. */
function dealDescription(
  deal: NonNullable<Awaited<ReturnType<typeof getPublicDeal>>>,
  t: Awaited<ReturnType<typeof getTranslations>>
): string {
  const written = deal.descriptionTranslated ? deal.description.replace(/\s+/g, " ").trim() : "";
  if (!written) return t("dealFallback", { name: deal.name });
  return written.length < 90 ? `${written} ${t("dishTail")}` : written;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const deal = await getPublicDeal(slug, locale);
  if (!deal) return {};

  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: `/deals/${slug}`,
    title: t("dealTitle", { name: deal.name }),
    description: snippet(dealDescription(deal, t)),
    image: deal.image ? { url: deal.image, alt: deal.name } : undefined,
  });
}

export default async function DealPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [deal, all, settings] = await Promise.all([
    getPublicDeal(slug, locale),
    getPublicDeals(locale),
    getPublicSettings(),
  ]);
  if (!deal) notFound();

  const t = await getTranslations({ locale });
  const { isOpen } = getStoreStatus(settings);
  const others = all.filter((d) => d.slug !== slug).slice(0, 3);
  const labels = {
    save: t.raw("deals.save") as string,
    was: t("deals.was"),
    view: t("deals.view"),
    soldOut: t("deals.soldOut"),
  };
  const labelFor = (a: { id: string; label: string }) =>
    t.has(`allergenNames.${a.id}`) ? t(`allergenNames.${a.id}`) : a.label;

  return (
    <>
      <DealSchema
        locale={locale}
        deal={deal}
        description={dealDescription(deal, await getTranslations({ locale, namespace: "seo" }))}
      />
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: t("nav.deals"), path: "/deals" },
          { name: deal.name, path: `/deals/${slug}` },
        ]}
      />

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 transition-colors hover:text-charcoal-600"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {t("deals.back")}
          </Link>
          <ShareButton title={deal.name} label={t("item.share")} copiedLabel={t("item.shareCopied")} />
        </div>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0 lg:sticky lg:top-24">
            <div className="group relative aspect-4/3 overflow-hidden rounded-[2rem] bg-charcoal-700 ring-1 ring-charcoal-600/8">
              <DealPhoto deal={deal} sizes="(min-width: 1024px) 34vw, 100vw" priority />
              {deal.saving > 0 && (
                <span className="absolute left-4 top-4 -rotate-3 rounded-2xl bg-ember-600 px-4 py-2.5 font-display text-xl font-bold text-cream-50 shadow-lg shadow-ember-800/40">
                  {t("deals.save", { amount: formatEuro(deal.saving) })}
                  {deal.savingPercent > 0 && (
                    <span className="ml-2 text-base font-semibold text-cream-100/85">−{deal.savingPercent}%</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-[2rem] bg-cream-50 p-5 shadow-[0_1px_2px_rgba(20,18,15,0.04),0_24px_60px_-30px_rgba(20,18,15,0.25)] ring-1 ring-charcoal-600/8 sm:p-8">
            <p className="inline-block rounded-full bg-ember-600/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ember-700">
              {t("deals.eyebrow")}
            </p>
            <h1 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.1] text-charcoal-600 sm:text-[2.6rem]">
              {deal.name}
            </h1>
            {deal.description && (
              <ExpandableText
                text={deal.description}
                more={t("item.readMore")}
                less={t("item.readLess")}
                className="mt-4"
              />
            )}
            <div className="my-6 h-px bg-charcoal-600/8" />
            <DealBuilder deal={deal} isOpen={isOpen} />
            {(deal.allergens.length > 0 || deal.mayContain.length > 0) && (
              <div id="allergenen" className="mt-6 rounded-2xl bg-cream-100 p-4">
                <p className="flex items-center gap-2 font-display text-base font-semibold text-charcoal-600">
                  <ShieldAlert size={17} aria-hidden="true" className="text-ember-600" />
                  {t("item.allergens")}
                </p>
                {deal.allergens.length > 0 && (
                  <p className="mt-2 text-sm text-ink/70">
                    <span className="font-semibold text-charcoal-600">{t("item.allergensContains")}</span>{" "}
                    {deal.allergens.map(labelFor).join(", ")}
                  </p>
                )}
                {deal.mayContain.length > 0 && (
                  <p className="mt-1 text-sm text-ink/70">
                    {t("deals.mayContain")} {deal.mayContain.map(labelFor).join(", ")}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink/55">{t("deals.allergenNote")}</p>
              </div>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-16" aria-labelledby="more-deals">
            <h2 id="more-deals" className="font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
              {t("deals.more")}
            </h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <li key={other.slug}>
                  <DealCard deal={other} labels={labels} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <FeedbackCta locale={locale} />
    </>
  );
}
