import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  MessageCircle,
  Phone,
  UtensilsCrossed,
  Truck,
  Cake,
  Briefcase,
  Users,
  Sparkles,
} from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catering" });
  return { title: t("title"), description: t("intro") };
}

export default async function CateringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "catering" });
  const tWhatsapp = await getTranslations({ locale, namespace: "whatsapp" });

  const whatsappHref = whatsappOrderLink(tWhatsapp("cateringInquiry"));

  const steps = [
    { icon: Phone, title: t("step1Title"), text: t("step1Text") },
    { icon: UtensilsCrossed, title: t("step2Title"), text: t("step2Text") },
    { icon: Truck, title: t("step3Title"), text: t("step3Text") },
  ];

  const occasions = [
    { icon: Cake, title: t("occasion1Title"), text: t("occasion1Text") },
    { icon: Briefcase, title: t("occasion2Title"), text: t("occasion2Text") },
    { icon: Users, title: t("occasion3Title"), text: t("occasion3Text") },
    { icon: Sparkles, title: t("occasion4Title"), text: t("occasion4Text") },
  ];

  return (
    <div className="bg-cream-200">
      <Motion />

      {/* ---- intro ---------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p
            data-reveal
            className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600"
          >
            {t("title")}
          </p>
          <h1
            data-reveal-mask
            className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl"
          >
            <MaskedWords text={t("intro")} />
          </h1>
          <p
            data-reveal
            className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink/70 sm:text-lg"
          >
            {t("introText")}
          </p>
        </div>
      </div>

      {/* ---- steps ------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="justify-center">{t("stepsEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
          >
            <MaskedWords text={t("stepsTitle")} />
          </h2>
        </div>

        <ul data-reveal-group className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} data-reveal className="relative rounded-3xl border border-charcoal-600/10 bg-cream-50 p-7 text-center">
              <span className="font-display text-xs font-semibold tracking-[0.2em] text-ember-600/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                <Icon size={22} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-charcoal-600">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{text}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- occasions ---------------------------------------------------- */}
      <div className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_85%_0%,rgba(169,80,38,0.28),transparent_70%)]" />
        <div className="grain absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("occasionsEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-100 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("occasionsTitle")} />
            </h2>
          </div>

          <ul
            data-reveal-group
            className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-cream-200/12 bg-cream-200/12 sm:grid-cols-2 lg:grid-cols-4"
          >
            {occasions.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                data-reveal
                className="group relative bg-charcoal-900 p-7 transition-colors duration-500 hover:bg-charcoal-800 sm:p-8"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-ember-500/30 bg-ember-600/12 text-ember-400 transition-[background-color,color] duration-500 group-hover:bg-ember-600 group-hover:text-cream-50">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream-100">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-200/65">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---- cta ------------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div
          data-reveal="scale"
          className="rounded-[2rem] bg-ember-600 px-8 py-14 text-center sm:px-16 sm:py-20"
        >
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-cream-100/85 sm:text-lg">
            {t("ctaText")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-cream-50 px-8 py-4 text-sm font-semibold text-ember-700 shadow-lg shadow-charcoal-950/10 transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <MessageCircle size={18} />
              {t("ctaWhatsapp")}
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-cream-100/40 bg-cream-50/10 px-8 py-4 text-sm font-semibold text-cream-50 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <Phone size={18} />
              {t("ctaCall")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
