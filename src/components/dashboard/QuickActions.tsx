import { ArrowUpRight, Gift, RotateCcw, ShoppingBag, Users } from "lucide-react";

/**
 * The four things a customer actually comes here to do. Two per row on a
 * phone, so the whole set is reachable with a thumb without scrolling past
 * the live order.
 */
const ICONS = {
  menu: ShoppingBag,
  reorder: RotateCcw,
  invite: Users,
  rewards: Gift,
} as const;

export type QuickAction = {
  key: keyof typeof ICONS;
  href: string;
  title: string;
  note: string;
};

export default function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => {
        const Icon = ICONS[action.key];
        return (
          <a
            key={action.key}
            href={action.href}
            className="group relative flex flex-col gap-2 rounded-2xl border border-hairline bg-panel p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-ember-600/40 hover:bg-ember-600/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember-600/10 text-ember-600">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="font-display text-sm font-semibold leading-snug text-heading">
              {action.title}
            </span>
            <span className="text-xs leading-snug text-muted">{action.note}</span>
            <ArrowUpRight
              size={15}
              aria-hidden="true"
              className="absolute right-3.5 top-4 text-faint transition-colors group-hover:text-ember-600"
            />
          </a>
        );
      })}
    </div>
  );
}
