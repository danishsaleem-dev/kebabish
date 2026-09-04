import { getTranslations } from "next-intl/server";
import { Clock, Flame, Leaf, Smartphone } from "lucide-react";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

export default async function Why({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  const reasons = [
    { icon: Flame, title: t("home.why1Title"), text: t("home.why1Text") },
    { icon: Leaf, title: t("home.why2Title"), text: t("home.why2Text") },
    { icon: Clock, title: t("home.why3Title"), text: t("home.why3Text") },
    { icon: Smartphone, title: t("home.why4Title"), text: t("home.why4Text") },
  ];

  return (
    <section className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28 lg:py-32">
      {/* Ember glow anchored to the top-right so the section reads as lit
          from the same direction as the hero. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_85%_0%,rgba(169,80,38,0.28),transparent_70%)]" />
      <div className="grain absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <SectionEyebrow tone="light">{t("home.whyEyebrow")}</SectionEyebrow>

          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-100 sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.whyTitle")} />
          </h2>
        </div>

        <ul
          data-reveal-group
          className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-cream-200/12 bg-cream-200/12 sm:grid-cols-2 lg:grid-cols-4"
        >
          {reasons.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              data-reveal
              className="group relative bg-charcoal-900 p-7 transition-colors duration-500 hover:bg-charcoal-800 sm:p-8"
            >
              <span className="font-display text-xs font-semibold tracking-[0.2em] text-ember-500">
                {String(i + 1).padStart(2, "0")}
              </span>

              <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-full border border-ember-500/30 bg-ember-600/12 text-ember-400 transition-[background-color,color] duration-500 group-hover:bg-ember-600 group-hover:text-cream-50">
                <Icon size={20} />
              </span>

              <h3 className="mt-5 font-display text-lg font-semibold text-cream-100">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-cream-200/65">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
