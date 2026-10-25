import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Clock, Flame, Leaf, Smartphone } from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

/**
 * Why Kebabish — five reasons as a bento grid: "100% halal" as the large tile (with
 * Danish's own seal), the four original reasons around it. Each small tile has one
 * small, quiet animated detail that illustrates it (steam over "fresh", the radar ring
 * over "delivery", a tap ripple over "easy ordering"), paused under reduced motion.
 *
 * The four original reasons keep their keys (`home.why1…4`), so text the owner has
 * already edited in Website content stays exactly as he left it.
 */
export default async function Why({
  locale,
  eyebrow,
  title,
}: {
  locale: string;
  /** Another page (About) can keep its own heading over the same tiles. */
  eyebrow?: string;
  title?: string;
}) {
  const t = await getTranslations({ locale });

  const tiles = [
    {
      icon: Flame,
      title: t("home.why1Title"),
      text: t("home.why1Text"),
      detail: (
        <span aria-hidden="true" className="absolute right-6 top-5 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="why-steam h-7 w-1 rounded-full bg-linear-to-t from-ember-500/0 to-ember-500/50"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </span>
      ),
    },
    {
      icon: Leaf,
      title: t("home.why2Title"),
      text: t("home.why2Text"),
      detail: null,
    },
    {
      icon: Clock,
      title: t("home.why3Title"),
      text: t("home.why3Text"),
      detail: (
        <span aria-hidden="true" className="absolute right-5 top-5 flex h-14 w-14 items-center justify-center">
          <svg viewBox="0 0 56 56" className="absolute inset-0">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="text-ember-600/20" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="radar-ring text-ember-600/50" />
          </svg>
          <span className="font-display text-[0.65rem] font-bold text-ember-700">
            {siteConfig.deliveryRadiusKm} km
          </span>
        </span>
      ),
    },
    {
      icon: Smartphone,
      title: t("home.why4Title"),
      text: t("home.why4Text"),
      detail: (
        <span aria-hidden="true" className="absolute right-7 top-7 h-3 w-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-ember-500/40 [animation-duration:2.4s]" />
          <span className="absolute inset-0.5 rounded-full bg-ember-600" />
        </span>
      ),
    },
  ];

  return (
    <section className="grain bg-cream-100 py-20 sm:py-28 lg:py-32">
      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <SectionEyebrow>{eyebrow ?? t("home.whyEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={title ?? t("home.whyTitle")} />
          </h2>
        </div>

        <ul
          data-reveal-group
          className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-14 lg:grid-cols-4 lg:grid-rows-2"
        >
          {/* ---- the big tile: 100% halal -------------------------------- */}
          <li
            data-reveal
            className="group relative col-span-2 overflow-hidden rounded-3xl bg-charcoal-800 p-7 text-cream-100 sm:p-9 lg:row-span-2"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_15%,rgba(169,80,38,0.45),transparent_70%)]"
            />
            <div className="grain absolute inset-0 opacity-50" />
            <div className="relative flex h-full flex-col gap-8 sm:flex-row sm:items-center lg:flex-col lg:items-start lg:justify-between">
              <div className="relative h-32 w-32 shrink-0 sm:h-36 sm:w-36 lg:mt-4 lg:h-60 lg:w-60 lg:self-center">
                <span
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-full border border-dashed border-ember-400/35 motion-safe:animate-[spin_40s_linear_infinite]"
                />
                <Image
                  src="/halal.png"
                  alt={t("common.halalBadge")}
                  fill
                  sizes="(min-width: 1024px) 15rem, 9rem"
                  className="object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-transform duration-700 ease-brand group-hover:rotate-[-8deg] group-hover:scale-105"
                />
              </div>
              <div>
                <h3 className="font-display text-2xl font-semibold text-cream-50 sm:text-3xl">
                  {t("home.why5Title")}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream-200/70 sm:text-base">
                  {t("home.why5Text")}
                </p>
              </div>
            </div>
          </li>

          {tiles.map(({ icon: Icon, title, text, detail }) => (
            <li
              key={title}
              data-reveal
              className="group relative overflow-hidden rounded-3xl border border-charcoal-600/10 bg-cream-50 p-5 shadow-sm shadow-charcoal-950/5 transition-[translate,box-shadow,border-color] duration-500 ease-brand hover:-translate-y-1 hover:border-ember-600/25 hover:shadow-xl hover:shadow-charcoal-950/8 sm:p-7"
            >
              {detail}
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600 transition-[background-color,color,transform] duration-500 group-hover:-rotate-6 group-hover:bg-ember-600 group-hover:text-cream-50">
                <Icon size={20} />
              </span>
              <h3 className="mt-5 font-display text-base font-semibold leading-snug text-charcoal-600 sm:text-lg">
                {title}
              </h3>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink/60 sm:text-sm">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
