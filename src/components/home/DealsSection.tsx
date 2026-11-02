import DealsBand from "@/components/deals/DealsBand";
import { getPublicDeals } from "@/lib/public-deals";

/** The homepage's deals. Nothing at all while there are none, so no empty gap either. */
export default async function DealsSection({ locale }: { locale: string }) {
  if ((await getPublicDeals(locale)).length === 0) return null;
  return (
    <section id="deals" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-12 sm:px-6 sm:py-16">
      <DealsBand locale={locale} />
    </section>
  );
}
