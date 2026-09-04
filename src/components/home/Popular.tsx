import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { findMenuItem } from "@/lib/menu-data";
import { whatsappOrderLink } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";

/**
 * The six dishes shown on the homepage, paired with their photo.
 *
 * NOTE: these are royalty-free stock photos (Pexels) standing in until the
 * client's own food photography arrives — see public/images/CREDITS.md.
 * Replacing a photo means dropping a new file at the same path; nothing here
 * needs to change. Once the menu moves to Supabase these belong on the menu
 * item record itself rather than in this component.
 */
const FEATURED: { slug: string; image: string }[] = [
  { slug: "chicken-biryani", image: "/images/dishes/chicken-biryani.jpg" },
  { slug: "chicken-chapli-kebab", image: "/images/dishes/chicken-chapli-kebab.jpg" },
  { slug: "chicken-shoarma", image: "/images/dishes/chicken-shoarma.jpg" },
  { slug: "zinger-burger", image: "/images/dishes/zinger-burger.jpg" },
  { slug: "qeema-naan", image: "/images/dishes/qeema-naan.jpg" },
  { slug: "milk-shake", image: "/images/dishes/milk-shake.jpg" },
];

export default async function Popular({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  const dishes = FEATURED.map(({ slug, image }) => {
    const item = findMenuItem(slug);
    return item ? { item, image } : null;
  }).filter((entry) => entry != null);

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
          {dishes.map(({ item, image }) => (
            <FeaturedDishCard
              key={item.slug}
              item={item}
              image={image}
              orderHref={whatsappOrderLink(
                item.variants
                  ? t("whatsapp.orderItemVariant", { item: item.name })
                  : t("whatsapp.orderItem", { item: item.name })
              )}
              addLabel={t("menu.addToOrder")}
              priceOnRequestLabel={t("menu.priceOnRequest")}
              vegetarianLabel={t("menu.vegetarian")}
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
