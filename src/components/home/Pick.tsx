import { getTranslations } from "next-intl/server";
import { getPublicMenu } from "@/lib/public-menu";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import DishFinder from "@/components/home/DishFinder";
import ReorderCard from "@/components/reorder/ReorderCard";

/**
 * "What are you in the mood for?" — help for someone who doesn't know the dishes yet,
 * with the spice guide built in: the chilli scale is explained here *and* is a filter
 * (tap "Hot" to see the hot dishes), so the guide answers the question it raises.
 *
 * A returning customer sees "the same as last time?" at the top (`ReorderCard`, which
 * renders nothing for anyone else and nothing on the server).
 *
 * The whole menu is server-rendered into the page first (the default "first time here"
 * picks), so the dishes are in the HTML for crawlers; the filters only rearrange them.
 */
export default async function Pick({ locale, isOpen }: { locale: string; isOpen: boolean }) {
  const t = await getTranslations({ locale });
  const items = (await getPublicMenu(locale)).flatMap((c) => c.items);
  if (items.length === 0) return null;

  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-5 py-20 sm:px-6 sm:py-28 lg:overflow-visible lg:py-32">
      <ReorderCard className="mb-14" />

      <div className="max-w-2xl">
        <SectionEyebrow>{t("home.pickEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
        >
          <MaskedWords text={t("home.pickTitle")} />
        </h2>
        <p data-reveal className="mt-5 text-pretty text-base leading-relaxed text-ink/70 sm:text-lg">
          {t("home.pickText")}
        </p>
      </div>

      <div data-reveal>
        <DishFinder items={items} isOpen={isOpen} />
      </div>
    </section>
  );
}
