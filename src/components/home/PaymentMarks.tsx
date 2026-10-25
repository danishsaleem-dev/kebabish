/**
 * The payment methods checkout offers through Mollie — the same list as the FAQ, the
 * Terms and the schema.org `paymentAccepted`. Shown as quiet monochrome wordmarks
 * rather than the brands' own colours, so they sit inside the site's palette.
 * "Card" is the only one that is translated; the rest are brand names.
 */
export const PAYMENT_METHODS = ["iDEAL", "Apple Pay", "Google Pay", "card", "Klarna"] as const;

export default function PaymentMarks({
  cardLabel,
  tone = "light",
  size = "md",
  className = "",
}: {
  cardLabel: string;
  /** "light" = on cream; "dark" = on charcoal. */
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PAYMENT_METHODS.map((method) => (
        <li
          key={method}
          className={`rounded-lg border font-display font-bold tracking-tight ${
            size === "sm" ? "px-2 py-1 text-[0.65rem]" : "px-2.5 py-1.5 text-xs"
          } ${
            tone === "dark"
              ? "border-cream-100/15 bg-cream-50/[0.06] text-cream-100/90"
              : "border-charcoal-600/12 bg-cream-50 text-charcoal-600"
          }`}
        >
          {method === "card" ? cardLabel : method}
        </li>
      ))}
    </ul>
  );
}
