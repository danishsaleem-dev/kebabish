import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import StoreStatusBanner from "@/components/StoreStatusBanner";
import { getSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";

// Revalidate at most every minute — status can flip on its own (opening
// hours boundary) without anyone touching /admin/settings. A save there
// also calls revalidatePath for an immediate update; see settings/actions.ts.
export const revalidate = 60;

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
  const settings = await getSettings();
  const status = getStoreStatus(settings);

  return (
    <>
      <Header
        isOpen={status.isOpen}
        banner={<StoreStatusBanner status={status} locale={locale} />}
      />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton isOpen={status.isOpen} />
    </>
  );
}
