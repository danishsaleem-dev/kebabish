import { Suspense, type ReactNode } from "react";
import MobileDock from "@/components/MobileDock";
import ReorderFromUrl from "@/components/reorder/ReorderFromUrl";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import StoreStatusBanner from "@/components/StoreStatusBanner";
import CartProvider from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import PromoPopup from "@/components/PromoPopup";
import PromoWidget from "@/components/PromoWidget";
import RewardsNudge from "@/components/rewards/RewardsNudge";
import LocationProvider from "@/components/location/LocationProvider";
import LocationDialog from "@/components/location/LocationDialog";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { getReviews } from "@/lib/content/site";
import { normalizeRewards } from "@/lib/rewards-math";
import { getPublicDeals } from "@/lib/public-deals";
import { getPromoPopups } from "@/lib/public-promos";

// Nothing this layout renders depends on the clock. `status.isOpen` is the
// owner's "Taking orders" switch, not opening hours (see getStoreStatus:
// ordering is never gated on hours, because customers book a delivery slot at
// checkout); settings, content, menu, deal and promo saves in /admin all call
// revalidatePath("/", "layout") themselves, so an edit is live within a
// minute either way.
//
// So a time-based window buys nothing here and costs a great deal: this value
// applies to EVERY page under this layout — every route, dish and deal, in
// both languages, ~90 pages — and each regeneration is one Vercel ISR write.
// At 60 s it burned ~72K of the free plan's 200K monthly writes; at 300 s it
// was still running at ~168K/200K. A day is the safety net for a
// revalidatePath that never fired, nothing more.
//
// The ONE clock-dependent thing on the public site is the live open/closed
// pill on /contact (`status.openNow`), and that page sets its own shorter
// revalidate. Don't move a clock-dependent value up into this layout — put it
// on the page that needs it, or compute it in the browser.
export const revalidate = 86400;

/**
 * The normal site chrome (header nav, footer, floating WhatsApp button) —
 * split out from `[locale]/layout.tsx` into this route group so
 * `[locale]/coming-soon` can sit as a sibling and skip it entirely. A
 * "coming soon" page showing nav links to gated pages would look broken;
 * this way it's a clean standalone page while still sharing the parent
 * layout's <html>/<body>, fonts and NextIntlClientProvider.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const settings = await getPublicSettings();
  const status = getStoreStatus(settings);
  const [reviews, promos, deals] = await Promise.all([getReviews(), getPromoPopups(), getPublicDeals(locale)]);
  const rewards = normalizeRewards(settings.rewards);

  return (
    <LocationProvider>
    <CartProvider rewards={rewards.enabled ? rewards : null}>
      <Header
        isOpen={status.isOpen}
        showDeals={deals.length > 0}
        showRewards={rewards.enabled}
        showReferral={rewards.enabled && rewards.referralEnabled}
        banner={<StoreStatusBanner status={status} locale={locale} />}
      />
      <main className="flex-1">{children}</main>
      <Footer
        vatNumber={settings.vatNumber || undefined}
        showReviews={reviews.length > 0}
        showDeals={deals.length > 0}
        showRewards={rewards.enabled}
        showReferral={rewards.enabled && rewards.referralEnabled}
      />
      <WhatsAppButton isOpen={status.isOpen} />
      <MobileDock />
      <CartDrawer />
      <LocationDialog />
      <RewardsNudge />
      <PromoPopup promos={promos} />
      <PromoWidget promos={promos} lifted={status.isOpen} />
      {/* Reads the URL, so it needs its own Suspense boundary or every
          statically generated page would fall back to client rendering. */}
      <Suspense fallback={null}>
        <ReorderFromUrl />
      </Suspense>
    </CartProvider>
    </LocationProvider>
  );
}
