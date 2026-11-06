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

// Revalidate at most every five minutes — status can flip on its own (opening
// hours boundary) without anyone touching /admin/settings, so the banner can
// lag a boundary by up to this long. A save there (and any content, menu or
// promo save) also calls revalidatePath for an immediate update; see
// settings/actions.ts.
//
// This is 300 and not 60 on purpose: the value applies to EVERY page under
// this layout (every route, dish and deal, in both languages), and each
// regeneration is one Vercel ISR write. At 60 s, crawler traffic alone burned
// ~72K of the free plan's 200K monthly writes against only ~22K reads.
// Checkout does not depend on it — whether orders are accepted is checked on
// the server — so a late banner is cosmetic.
export const revalidate = 300;

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
