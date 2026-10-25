import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Leaf, Lock, ShieldCheck } from "lucide-react";
import PaymentMarks from "@/components/home/PaymentMarks";

/**
 * A slim reassurance strip: how you can pay, and the three things people ask before
 * they order from a kitchen they don't know yet. One row on a laptop, two short rows
 * on a phone — it is meant to be read in a glance, not to take up a screen.
 *
 * Only claims that are true elsewhere on the site: the payment methods are the ones
 * checkout offers, "100% halal" is Danish's own seal, the 14 allergens are listed on
 * every dish page, and "freshly made" is the Why section's own first point.
 */
export default async function TrustStrip({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  const assurances = [
    {
      icon: (
        <Image src="/halal.png" alt="" width={28} height={28} sizes="28px" className="h-7 w-7" />
      ),
      label: t("home.trustHalal"),
    },
    { icon: <ShieldCheck size={18} aria-hidden="true" />, label: t("home.trustAllergens") },
    { icon: <Leaf size={18} aria-hidden="true" />, label: t("home.trustFresh") },
  ];

  return (
    <section aria-label={t("home.trustLabel")} className="border-b border-charcoal-600/10 bg-cream-100">
      <div
        data-reveal
        className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal-600 text-cream-50">
              <Lock size={14} aria-hidden="true" />
            </span>
            {t("home.paySecure")}
          </span>
          <PaymentMarks cardLabel={t("home.payCard")} />
        </div>

        <ul className="grid grid-cols-3 gap-2 lg:flex lg:items-center lg:gap-6">
          {assurances.map((a) => (
            <li
              key={a.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-cream-50 px-2 py-2.5 text-center text-[0.72rem] font-semibold leading-tight text-charcoal-600 ring-1 ring-charcoal-600/8 lg:flex-row lg:gap-2 lg:bg-transparent lg:p-0 lg:text-left lg:text-sm lg:ring-0"
            >
              <span className="flex h-7 items-center text-ember-600">{a.icon}</span>
              {a.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
