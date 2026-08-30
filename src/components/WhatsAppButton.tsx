"use client";

import { useLocale } from "next-intl";
import { MessageCircle } from "lucide-react";
import { whatsappOrderLink } from "@/lib/site-config";

export default function WhatsAppButton() {
  const locale = useLocale();

  const href = whatsappOrderLink(
    locale === "nl"
      ? "Hallo Kebabish! Ik wil graag een bestelling plaatsen."
      : "Hi Kebabish! I'd like to place an order."
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 md:bottom-6 md:right-6"
    >
      <MessageCircle size={28} fill="white" strokeWidth={0} />
    </a>
  );
}
