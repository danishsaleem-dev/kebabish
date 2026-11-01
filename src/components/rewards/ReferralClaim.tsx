"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cleanPromoCode, useCart } from "@/components/cart/CartProvider";

/**
 * Someone opened a friend's link (/referral?code=KB-XXXXXX). The code joins the basket like a
 * promotion's does, so checkout applies it by itself. It lives in the browser so the page itself
 * stays static; nothing here is trusted, checkout checks the code from scratch. The code stays in
 * the address bar: rewriting the URL here interrupts the headline's reveal and leaves it hidden.
 */
export default function ReferralClaim({ amount }: { amount: string }) {
  const t = useTranslations("referral");
  const { ready, setPromoCode } = useCart();
  const [code, setCode] = useState<string | null>(null);

  // Waits for `ready`: the basket reads its own saved code first, and would otherwise
  // overwrite this one a moment later.
  useEffect(() => {
    if (!ready) return;
    const found = cleanPromoCode(new URLSearchParams(window.location.search).get("code")?.toUpperCase());
    if (!found) return;
    setPromoCode(found);
    // On the next tick: the code only exists in the browser.
    const timer = setTimeout(() => setCode(found), 0);
    return () => clearTimeout(timer);
  }, [ready, setPromoCode]);

  if (!code) return null;

  return (
    <div role="status" className="mb-7 flex flex-col gap-4 rounded-3xl bg-ember-600 p-5 text-cream-50 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream-50/15">
          <Gift size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{t("claimTitle", { amount })}</p>
          <p className="mt-0.5 text-sm text-cream-50/85">{t("claimText", { code })}</p>
        </div>
        <Link
          href="/menu"
          className="inline-flex items-center justify-center rounded-full bg-cream-50 px-6 py-3 font-display text-sm font-semibold text-ember-700 transition-colors hover:bg-cream-100"
        >
          {t("claimCta")}
        </Link>
    </div>
  );
}
