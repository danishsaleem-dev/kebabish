import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import { getFeaturedItems } from "@/lib/public-menu";

export default async function Popular({
  locale,
  isOpen,
}: {
  locale: string;
  isOpen: boolean;
}) {
  const t = await getTranslations({ locale });
  // The dishes flagged "featured" in /admin (at most four), not a list in code.
  const dishes = await getFeaturedItems(locale);

  return (
    <section className="grain bg-cream-100 py-20 sm:py-28 lg:py-32">
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <SectionEyebrow>{t("home.popularEyebrow")}</SectionEyebrow>

          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.popularTitle")} />
          </h2>

        </div>

        <div
          data-reveal-group
          className={`mt-12 grid grid-cols-2 gap-3 sm:gap-6 ${
            dishes.length >= 4 ? "lg:grid-cols-4" : dishes.length === 3 ? "lg:grid-cols-3" : ""
          }`}
        >
          {dishes.map((item) => (
            <FeaturedDishCard
              key={item.slug}
              item={item}
              addLabel={t("menu.addToOrder")}
              priceOnRequestLabel={t("menu.priceOnRequest")}
              vegetarianLabel={t("menu.vegetarian")}
              soldOutLabel={t("menu.soldOut")}
              isOpen={isOpen}
              unavailableLabel={t("status.menuUnavailable")}
            />
          ))}
        </div>

        <div data-reveal className="mt-12 flex justify-center">
          <Link
            href="/menu"
            className="group inline-flex items-center gap-2.5 rounded-full border border-charcoal-600/25 px-8 py-4 font-display text-sm font-semibold text-charcoal-600 transition-colors duration-300 hover:border-charcoal-600 hover:bg-charcoal-600 hover:text-cream-100"
          >
            {t("home.popularCta")}
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
