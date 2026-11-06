import type { ReactNode } from "react";

/**
 * The small shared pieces every dashboard page is built from. Server
 * components — none of them need state, and keeping them out of the client
 * bundle means a page's copy stays in the server-rendered HTML.
 */

/** The title block at the top of each page. */
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight text-heading sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** A heading above a group of cards, with an optional link on the right. */
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold text-heading">{title}</h2>
      {action}
    </div>
  );
}

/** One figure, in a row of two or three. */
export function StatTile({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none text-heading">
        {value}
      </p>
      {note && <p className="mt-1.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** A card with nothing in it yet: an icon, a line of explanation, and a way out. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-panel px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
        {icon}
      </span>
      <h3 className="font-display text-lg font-semibold text-heading">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** The dashboard's primary button, as a link. */
export function LinkButton({
  href,
  children,
  tone = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "outline";
  className?: string;
}) {
  const styles =
    tone === "primary"
      ? "bg-ember-600 text-cream-50 hover:bg-ember-500"
      : "border border-hairline bg-panel text-heading hover:bg-canvas";
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      {children}
    </a>
  );
}
