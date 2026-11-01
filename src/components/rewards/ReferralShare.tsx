"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, MessageCircle } from "lucide-react";

/** A customer's referral link with copy and WhatsApp, for dark cards on the public site. */
export default function ReferralShare({
  link,
  shareText,
  className = "",
}: {
  link: string;
  shareText: string;
  className?: string;
}) {
  const t = useTranslations("referral");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard can be refused; the link stays on screen to select by hand.
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-2xl bg-cream-50/10 py-2 pl-4 pr-2 ring-1 ring-cream-100/15">
        <span className="min-w-0 flex-1 select-all truncate text-sm text-cream-50">{link}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-cream-50/10"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? t("shareCopied") : t("shareCopy")}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <MessageCircle size={16} aria-hidden="true" />
        {t("shareWhatsApp")}
      </a>
    </div>
  );
}
