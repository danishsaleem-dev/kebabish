import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * Frequently asked questions.
 *
 * Built on native `<details>`/`<summary>` rather than a JS accordion: it is
 * keyboard-accessible and screen-reader-correct for free, it opens with JS
 * off, and — the reason that matters most here — the answers are real text in
 * the server-rendered HTML even while collapsed, so they are indexable. The
 * `name` attribute makes the group behave as an exclusive accordion in
 * browsers that support it (only one open at a time) and as independent
 * toggles everywhere else, which is a perfectly fine fallback.
 *
 * It also emits FAQPage structured data from the same strings, so the
 * questions can surface directly in Google's results — cheap, and this site's
 * first priority is SEO.
 */
export default async function Faq({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const entries = (t.raw("home.faq") as FaqEntry[] | undefined) ?? [];
  if (entries.length === 0) return null;

  const whatsappHref = whatsappOrderLink(t("whatsapp.orderGeneric"));

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: { "@type": "Answer", text: entry.a },
    })),
  };

  return (
    <section className="grain bg-cream-100 py-20 sm:py-28 lg:py-32">
      <script
        type="application/ld+json"
        // Static, built from our own translation files — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* The heading column sticks on desktop, so the questions scroll
              against it instead of leaving a tall empty gutter. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("home.faqEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("home.faqTitle")} />
            </h2>
            <p data-reveal className="mt-5 text-pretty text-base leading-relaxed text-ink/70">
              {t("home.faqText")}
            </p>

            <div data-reveal className="mt-7 flex flex-wrap gap-3">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full bg-charcoal-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-100 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-600"
              >
                <MessageCircle size={17} />
                {t("common.whatsappUs")}
              </a>
              <a
                href={`tel:${siteConfig.contact.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-2.5 rounded-full border border-charcoal-600/20 px-6 py-3.5 font-display text-sm font-semibold text-charcoal-600 transition-[border-color,translate] duration-300 hover:-translate-y-0.5 hover:border-charcoal-600/50"
              >
                {t("common.callUs")}
              </a>
            </div>
          </div>

          <ul data-reveal-group className="divide-y divide-charcoal-600/12">
            {entries.map((entry, i) => (
              <li key={i} data-reveal>
                <details
                  name="kebabish-faq"
                  className="group py-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-5 font-display text-base font-semibold text-charcoal-600 transition-colors duration-300 marker:content-none hover:text-ember-700 sm:text-lg">
                    {entry.q}
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-[background-color,border-color,color,rotate] duration-300 ease-brand group-hover:border-ember-600/40 group-open:rotate-45 group-open:border-ember-600 group-open:bg-ember-600 group-open:text-cream-50"
                    >
                      <Plus size={15} />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-ink/70">
                    {entry.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
