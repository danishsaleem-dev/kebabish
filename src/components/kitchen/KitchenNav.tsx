"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, History } from "lucide-react";

/** The kitchen's two screens: what is being cooked now, and what went out before. */
export default function KitchenNav() {
  const pathname = usePathname();
  const onHistory = pathname.startsWith("/kitchen/history");

  const tab = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-ember-600 text-white" : "text-body-text hover:bg-canvas"
    }`;

  return (
    <nav aria-label="Kitchen" className="flex items-center gap-1">
      <Link href="/kitchen" className={tab(!onHistory)} aria-current={!onHistory ? "page" : undefined}>
        <ChefHat size={15} />
        Live orders
      </Link>
      <Link href="/kitchen/history" className={tab(onHistory)} aria-current={onHistory ? "page" : undefined}>
        <History size={15} />
        History
      </Link>
    </nav>
  );
}
