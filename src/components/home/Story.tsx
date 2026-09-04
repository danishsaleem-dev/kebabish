import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { menu } from "@/lib/menu-data";
import { siteConfig } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

export default async function Story({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  const stats = [
    { value: `${siteConfig.deliveryRadiusKm} km`, label: t("home.storyStat1Label") },
    { value: "100%", label: t("home.storyStat2Label") },
    { value: String(menu.length), label: t("home.storyStat3Label") },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ---- image collage ------------------------------------------- */}
        <div className="relative order-2 lg:order-1">
          <div
            data-reveal="scale"
            className="relative aspect-4/5 overflow-hidden rounded-[1.75rem] bg-charcoal-800 sm:aspect-3/4"
          >
            <Image
              src="/images/story/tandoor.jpg"
              alt={t("home.storyImageAlt1")}
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              data-parallax="0.06"
              className="scale-110 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/45 to-transparent" />
          </div>

          {/* Overlapping detail shot, hidden on the narrowest screens where
              it would crowd the main image. */}
          <div
            data-reveal="scale"
            data-reveal-delay="0.12"
            className="absolute -bottom-8 -right-4 hidden aspect-square w-40 overflow-hidden rounded-2xl border-[6px] border-cream-200 bg-charcoal-800 shadow-xl shadow-charcoal-950/10 sm:block sm:w-48 lg:-right-8"
          >
            <Image
              src="/images/story/spices.jpg"
              alt={t("home.storyImageAlt2")}
              fill
              sizes="200px"
              className="object-cover"
            />
          </div>
        </div>

        {/* ---- copy ------------------------------------------------------ */}
        <div className="order-1 lg:order-2">
          <SectionEyebrow>{t("home.aboutEyebrow")}</SectionEyebrow>

          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.aboutTitle")} />
          </h2>

          <p
            data-reveal
            className="mt-6 text-pretty text-base leading-relaxed text-ink/75 sm:text-lg"
          >
            {t("home.aboutText")}
          </p>

          <ul data-reveal-group className="mt-10 grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <li
                key={stat.label}
                data-reveal
                className="border-l-2 border-ember-600/35 pl-4"
              >
                <span className="block font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1 block text-xs leading-snug text-ink/60 sm:text-sm">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>

          <Link
            data-reveal
            href="/contact"
            className="link-underline mt-9 inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-600"
          >
            {t("common.readMore")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
