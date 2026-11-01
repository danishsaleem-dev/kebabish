import type { ReactNode } from "react";
import NextLink from "next/link";
import { ArrowLeft, Check, Gift } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";

export interface AuthPanel {
  eyebrow?: string;
  title: string;
  perks: string[];
  /** The welcome bonus, shown only while the programme is on and it has one. */
  card?: { label: string; value: string; note: string };
}

/**
 * The sign-in and sign-up page: the form on cream beside a dark brand panel saying what an
 * account is worth. On a phone the panel shrinks to a band above the form, so the fields are
 * still reached without scrolling past a sales pitch.
 */
export default function AuthShell({
  locale,
  title,
  subtitle,
  panel,
  backLabel,
  languages,
  children,
}: {
  locale: string;
  title: string;
  subtitle?: string;
  panel: AuthPanel;
  backLabel: string;
  /** The same page in each language. */
  languages: { nl: string; en: string };
  children: ReactNode;
}) {
  const language = (code: "nl" | "en") => (
    <NextLink
      href={languages[code]}
      aria-current={locale === code ? "true" : undefined}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
        locale === code ? "bg-charcoal-600 text-cream-50" : "text-charcoal-600/70 hover:text-ember-700"
      }`}
    >
      {code}
    </NextLink>
  );

  return (
    <div lang={locale} className="min-h-screen bg-cream-200 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative overflow-hidden bg-charcoal-900 text-cream-100">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_20%,rgba(169,80,38,0.4),transparent_70%),radial-gradient(45%_50%_at_0%_100%,rgba(169,80,38,0.22),transparent_70%)]" />
        <div className="grain absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col px-5 py-6 sm:px-10 lg:p-12 xl:p-16">
          <NextLink href={locale === "en" ? "/en" : "/"} className="inline-flex w-fit">
            <BrandLogo
              src="/logo/kebabish-dark.png"
              alt="Kebabish"
              width={300}
              height={225}
              priority
              className="h-11 w-auto lg:h-14"
            />
          </NextLink>

          <div className="mt-6 lg:my-auto lg:py-10">
            {panel.eyebrow && (
              <p className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-ember-400 lg:block">
                {panel.eyebrow}
              </p>
            )}
            <p className="text-balance font-display text-2xl font-semibold leading-[1.12] text-cream-50 lg:mt-4 lg:text-5xl">
              {panel.title}
            </p>

            {panel.card && (
              <div className="mt-5 flex items-center gap-4 rounded-2xl bg-linear-to-br from-ember-500 via-ember-600 to-ember-800 p-4 shadow-xl shadow-charcoal-950/40 lg:mt-9 lg:max-w-md lg:-rotate-1 lg:rounded-[1.75rem] lg:p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-50/15 lg:h-12 lg:w-12">
                  <Gift size={21} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-cream-50/80">{panel.card.label}</p>
                  <p className="font-display text-xl font-semibold text-cream-50 lg:text-3xl">{panel.card.value}</p>
                  <p className="mt-0.5 text-xs text-cream-50/80 lg:text-sm">{panel.card.note}</p>
                </div>
              </div>
            )}

            <ul className="mt-8 hidden space-y-3 lg:block">
              {panel.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-base text-cream-200/85">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember-600/25 text-ember-400">
                    <Check size={14} aria-hidden="true" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-12 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <NextLink
            href={locale === "en" ? "/en" : "/"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-600/75 transition-colors hover:text-ember-700"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {backLabel}
          </NextLink>
          <div className="flex items-center gap-1">
            {language("nl")}
            {language("en")}
          </div>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-8">
          <h1 className="font-display text-3xl font-semibold text-charcoal-600 sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink/65 sm:text-base">{subtitle}</p>}
          <div className="mt-7 rounded-3xl bg-cream-50 p-5 shadow-xl shadow-charcoal-950/5 ring-1 ring-charcoal-600/8 sm:p-7">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
