import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Briefcase, Cake, MessageCircle, PartyPopper, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { whatsappOrderLink } from "@/lib/site-config";
import { getPublicMenu } from "@/lib/public-menu";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

/**
 * The catering teaser: parties, company drinks, family gatherings.
 *
 * The plates floating on the right are the menu's own dish photos (the first three
 * that have one), so the section shows Kebabish's food, not stock catering imagery.
 * The occasions and the three steps are the Catering page's own copy (`catering.*`),
 * so the two can never disagree; only the heading, paragraph and buttons are new.
 * "Discuss it on WhatsApp" is the agreed conversation route for catering; the main
 * button goes to the Catering page.
 */
export default async function CateringTeaser({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  // One photo per category first (three biryanis in a row reads as one dish), then
  // anything else that has a photo.
  const menu = await getPublicMenu(locale);
  const withPhoto = (items: (typeof menu)[number]["items"]) => items.filter((i) => i.image);
  const firstOfEach = menu.map((c) => withPhoto(c.items)[0]).filter(Boolean);
  const photos = [...new Set([...firstOfEach, ...withPhoto(menu.flatMap((c) => c.items))])]
    .slice(0, 3)
    .map((i) => ({ src: i!.image as string, alt: i!.name }));

  const occasions = [
    { icon: Cake, label: t("catering.occasion1Title") },
    { icon: Briefcase, label: t("catering.occasion2Title") },
    { icon: Users, label: t("catering.occasion3Title") },
    { icon: PartyPopper, label: t("catering.occasion4Title") },
  ];
  const steps = [t("catering.step1Title"), t("catering.step2Title"), t("catering.step3Title")];

  // Where each plate sits and how it drifts — offset so they never move in step.
  const plates = [
    { box: "left-[6%] top-[4%] h-[58%] w-[58%]", delay: "0s", rotate: "-rotate-6" },
    { box: "right-[2%] top-[22%] h-[46%] w-[46%]", delay: "-2.2s", rotate: "rotate-6" },
    { box: "bottom-[2%] left-[30%] h-[40%] w-[40%]", delay: "-4.1s", rotate: "-rotate-3" },
  ];

  return (
    <section className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_40%,rgba(169,80,38,0.32),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(169,80,38,0.18),transparent_70%)]" />
      <div className="grain absolute inset-0 opacity-70" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <SectionEyebrow tone="light">{t("home.cateringEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.12] text-cream-50 sm:text-4xl lg:text-5xl"
          >
            <MaskedWords text={t("home.cateringTitle")} />
          </h2>
          <p data-reveal className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-200/70 sm:text-lg">
            {t("home.cateringText")}
          </p>

          <ul data-reveal-group className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {occasions.map(({ icon: Icon, label }) => (
              <li
                key={label}
                data-reveal
                className="group flex items-center gap-3 rounded-2xl border border-cream-100/10 bg-cream-50/[0.04] p-3.5 transition-colors duration-500 hover:border-ember-500/40 hover:bg-cream-50/[0.08] sm:flex-col sm:items-start lg:flex-row lg:items-center"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-600/15 text-ember-400 transition-[background-color,color,transform] duration-500 group-hover:-rotate-6 group-hover:bg-ember-600 group-hover:text-cream-50">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold leading-tight text-cream-50">{label}</span>
              </li>
            ))}
          </ul>

          <ol data-reveal className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-cream-200/75">
            {steps.map((step, i) => (
              <li key={step} className="inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-50/10 text-xs font-bold text-ember-400">
                  {i + 1}
                </span>
                {step}
                {i < steps.length - 1 && <ArrowRight size={14} aria-hidden="true" className="ml-1 text-cream-200/30" />}
              </li>
            ))}
          </ol>

          <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/catering"
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
            >
              {t("home.cateringCta")}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href={whatsappOrderLink(t("whatsapp.cateringInquiry"))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/25 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-cream-100/10"
            >
              <MessageCircle size={17} />
              {t("catering.ctaWhatsapp")}
            </a>
          </div>
        </div>

        {/* ---- floating plates ------------------------------------------ */}
        {photos.length > 0 && (
          <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-md lg:max-w-none">
            <div className="absolute inset-[12%] rounded-full border border-dashed border-cream-100/15" />
            <div className="absolute inset-[26%] rounded-full bg-ember-600/20 blur-3xl" />
            {photos.map((photo, i) => (
              <div
                key={photo.src}
                className={`catering-float absolute ${plates[i].box}`}
                style={{ animationDelay: plates[i].delay }}
              >
                <div
                  className={`relative h-full w-full overflow-hidden rounded-full ring-[6px] ring-cream-100/90 shadow-2xl shadow-charcoal-950/60 ${plates[i].rotate}`}
                >
                  <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 18rem, 50vw" className="object-cover" />
                </div>
              </div>
            ))}
            <span className="absolute bottom-[14%] right-[4%] rounded-full bg-cream-50 px-4 py-2 font-display text-xs font-semibold text-charcoal-700 shadow-xl">
              {t("home.cateringBadge")}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
