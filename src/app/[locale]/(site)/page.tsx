import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHeroVideoAvailability } from "@/lib/hero-video";
import Motion from "@/components/motion/Motion";
import Hero from "@/components/home/Hero";
import Marquee from "@/components/home/Marquee";
import Story from "@/components/home/Story";
import Categories from "@/components/home/Categories";
import Showcase from "@/components/home/Showcase";
import Testimonials from "@/components/home/Testimonials";
import Faq from "@/components/home/Faq";
import Popular from "@/components/home/Popular";
import Why from "@/components/home/Why";
import DeliveryArea from "@/components/home/DeliveryArea";
import FinalCta from "@/components/home/FinalCta";
import { getPublicSettings } from "@/lib/admin/store";
import { pageMetadata } from "@/lib/seo";
import HomeSchema from "@/components/schema/HomeSchema";
import { getStoreStatus } from "@/lib/store-status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "",
    title: `${t("homeTitle")} | Kebabish`,
    absoluteTitle: true,
    description: t("homeDescription"),
  });
}

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
      <HomeSchema locale={locale} />

      <Hero locale={locale} heroVideo={getHeroVideoAvailability()} isOpen={isOpen} showBadge={settings.showLaunchBadge ?? true} />
      <Marquee items={marqueeItems} />
      <Story locale={locale} />
      <Categories locale={locale} />
      <Popular locale={locale} isOpen={isOpen} />
      <Why locale={locale} />
      {/* Showcase and Testimonials each render nothing until there is real
          content behind them (photos picked in /admin, reviews Danish
          supplied), so the page reads correctly either way. */}
      <Showcase locale={locale} />
      <Testimonials locale={locale} />
      <DeliveryArea locale={locale} />
      <Faq locale={locale} />
      <FinalCta locale={locale} isOpen={isOpen} />
    </>
  );
}
