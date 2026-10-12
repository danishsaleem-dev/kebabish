import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, MessageSquareQuote, QrCode } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * The standing invitation to leave feedback: a charcoal card floating above the
 * footer on every normal page. Not on the cart/checkout pages (nothing should
 * compete with finishing an order) and not on the feedback form itself.
 *
 * Two deliberate choices worth keeping:
 *
 * - **No `data-reveal` attributes.** Those are primed to `opacity: 0` in
 *   globals.css under `html.js` and only unhidden by the <Motion /> island,
 *   which most pages (/menu, /contact, the legal pages) never mount — the
 *   whole section would simply be invisible there.
 * - **The QR code is desktop-only.** Nobody scans their own phone with their
 *   own phone, so `hidden lg:block` plus `loading="lazy"` means a phone never
 *   downloads the file at all. Its real use is someone reading on a laptop who
 *   would rather answer on their phone — and a screen Danish can point a
 *   camera at. It's a plain <img>: an SVG through next/image would need
 *   `dangerouslyAllowSVG` turned on for the whole site (same reason
 *   DeliveryMap uses one).
 */
export default async function FeedbackCta({
  locale,
  source = "site",
}: {
  locale: string;
  /**
   * The `?src=` the button carries, so /admin/feedback can tell where a
   * response came from. Must be a value in `FEEDBACK_SOURCES` — anything else
   * is recorded as "direct".
   */
  source?: "site" | "contact";
}) {
  const t = await getTranslations({ locale, namespace: "feedback.siteCta" });
  const points = t.raw("points") as string[];
  // The code is scanned by a phone, which then loads that URL cold: it has to
  // carry the language the reader is actually using, not fall back to Dutch.
  const qrSrc = locale === "en" ? "/images/feedback-qr-en.svg" : "/images/feedback-qr.svg";

  return (
    <section className="bg-cream-200 px-5 py-14 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-charcoal-600 ring-1 ring-inset ring-cream-100/10">
        <div className="grain absolute inset-0" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(201,113,62,0.38),transparent_62%)]"
        />

        <div className="relative z-10 grid gap-10 p-7 sm:p-11 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16 lg:p-14">
          <div>
            <p className="inline-flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ember-400">
              <span aria-hidden="true" className="h-px w-8 bg-ember-400/60" />
              {t("eyebrow")}
            </p>

            <h2 className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl">
              {t("title")}
            </h2>

            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-cream-200/75">
              {t("text")}
            </p>

            <ul className="mt-7 grid gap-2.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-cream-200/80">
                  <Check size={16} className="mt-0.5 shrink-0 text-ember-400" />
                  {point}
                </li>
              ))}
            </ul>

            <Link
              href={`/feedback?src=${source}`}
              className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-charcoal-950/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
            >
              <MessageSquareQuote size={18} />
              {t("cta")}
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl bg-cream-50 p-5 shadow-xl shadow-charcoal-950/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt={t("qrAlt")}
                width={160}
                height={160}
                loading="lazy"
                className="h-40 w-40"
              />
            </div>
            <p className="mt-3.5 flex items-center justify-center gap-2 text-xs font-medium text-cream-200/60">
              <QrCode size={14} className="shrink-0" />
              {t("qr")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
