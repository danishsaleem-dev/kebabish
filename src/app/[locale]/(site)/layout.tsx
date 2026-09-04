import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

/**
 * The normal site chrome (header nav, footer, floating WhatsApp button) —
 * split out from `[locale]/layout.tsx` into this route group so
 * `[locale]/coming-soon` can sit as a sibling and skip it entirely. A
 * "coming soon" page showing nav links to gated pages would look broken;
 * this way it's a clean standalone page while still sharing the parent
 * layout's <html>/<body>, fonts and NextIntlClientProvider.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
