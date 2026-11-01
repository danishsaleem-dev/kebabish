"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import ReferralShare from "@/components/rewards/ReferralShare";

/**
 * The hero's buttons, which everyone (and every crawler) gets from the server, swapped for the
 * visitor's own link when they turn out to be a signed-in customer.
 */
export default function ReferralHeroActions({ children }: { children: ReactNode }) {
  const t = useTranslations("referral");
  const locale = useLocale();
  const [share, setShare] = useState<{ link: string; shareText: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/account/referral?locale=${locale}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live && data) setShare(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [locale]);

  if (!share) return <>{children}</>;

  return (
    <div className="mt-8 max-w-md">
      <p className="mb-2 text-sm font-medium text-cream-200/75">{t("yourLink")}</p>
      <ReferralShare link={share.link} shareText={share.shareText} />
    </div>
  );
}
