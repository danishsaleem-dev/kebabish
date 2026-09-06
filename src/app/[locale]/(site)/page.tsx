import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHeroVideoAvailability } from "@/lib/hero-video";
import Motion from "@/components/motion/Motion";
import Hero from "@/components/home/Hero";
import Marquee from "@/components/home/Marquee";
import Story from "@/components/home/Story";
import Popular from "@/components/home/Popular";
import Why from "@/components/home/Why";
import DeliveryArea from "@/components/home/DeliveryArea";
import FinalCta from "@/components/home/FinalCta";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const marqueeItems = t.raw("home.marquee") as string[];
  const settings = await getPublicSettings();
  const { isOpen } = getStoreStatus(settings);

  return (
    <>
      {/* Every section below is a server component; Motion is the single
          client island that drives the GSAP timelines and smooth scrolling. */}
      <Motion />

      <Hero locale={locale} heroVideo={getHeroVideoAvailability()} isOpen={isOpen} />
      <Marquee items={marqueeItems} />
      <Story locale={locale} />
      <Popular locale={locale} isOpen={isOpen} />
      <Why locale={locale} />
      <DeliveryArea locale={locale} />
      <FinalCta locale={locale} isOpen={isOpen} />
    </>
  );
}
