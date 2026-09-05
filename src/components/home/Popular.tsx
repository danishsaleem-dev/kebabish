import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import { getPublicMenu } from "@/lib/public-menu";

/** The dishes shown on the homepage, in order, when they're on the menu. */
const FEATURED = [
  "chicken-biryani",
  "chicken-chapli-kebab",
  "chicken-shoarma",
  "zinger-burger",
  "qeema-naan",
  "milk-shake",
];

export default async function Popular({
  locale,
  isOpen,
}: {
  locale: string;
  isOpen: boolean;
}) {
  const t = await getTranslations({ locale });
  const menu = await getPublicMenu();
  const all = menu.flatMap((c) => c.items);

  // Fall back to whatever's on the menu if a featured dish was renamed or
  // removed in /admin — an empty section would look broken.
  const dishes = FEATURED.map((slug) => all.find((i) => i.slug === slug))
    .filter((item) => item != null)
    .concat(all.filter((i) => !FEATURED.includes(i.slug)))
    .slice(0, 6);

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

          <p data-reveal className="mt-4 text-base text-ink/65">
            {t("home.popularNote")}
          </p>
        </div>

        <div
          data-reveal-group
          className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
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
