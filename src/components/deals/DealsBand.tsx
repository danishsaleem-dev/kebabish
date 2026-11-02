import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicDeals } from "@/lib/public-deals";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import DealCard from "@/components/deals/DealCard";

/**
 * The deals, on a dark band: the first one wide, the rest beside it, a swipe row on a phone. Used on
 * the homepage and at the top of /menu, so a deal is the first thing seen on both. Renders nothing
 * while no deal is live.
 */
export default async function DealsBand({ locale }: { locale: string }) {
  const deals = await getPublicDeals(locale);
  if (deals.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "deals" });
  const labels = {
    // Filled in per card, where the amount is known.
    save: t.raw("save") as string,
    was: t("was"),
    view: t("view"),
    soldOut: t("soldOut"),
  };
  const [lead, ...rest] = deals;

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-charcoal-800 p-5 sm:p-8 lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_85%_0%,rgba(169,80,38,0.4),transparent_70%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <SectionEyebrow tone="light" reveal={false}>{t("eyebrow")}</SectionEyebrow>
            <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.1] text-cream-50 sm:text-5xl">
              {t("title")}
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-base text-cream-200/75">{t("intro")}</p>
          </div>
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 rounded-full bg-ember-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            {t("viewAll")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-7">
          <DealCard deal={lead} labels={labels} lead />
        </div>

        {rest.length > 0 && (
          <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
            {rest.slice(0, 3).map((deal) => (
              <li key={deal.slug} className="w-[82%] shrink-0 snap-start md:w-auto">
                <DealCard deal={deal} labels={labels} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
