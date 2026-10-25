import Image from "next/image";

/**
 * The payment methods checkout offers through Mollie — the same list as the FAQ, the
 * Terms and the schema.org `paymentAccepted`; change them together.
 *
 * The icons are Mollie's own official payment-method marks
 * (`mollie.com/external/icons/payment-methods/*.svg`, the URLs Mollie's Methods API
 * returns for this account), copied into `public/images/payments/` rather than loaded
 * from mollie.com, so a page view never makes the visitor's browser call a third party.
 * They are the brands' own artwork, used to say "we accept this", and are not recoloured.
 * Re-copy them if Mollie updates a mark (iDEAL became "iDEAL | Wero" in 2025).
 */
export const PAYMENT_METHODS = [
  { id: "ideal", name: "iDEAL" },
  { id: "applepay", name: "Apple Pay" },
  { id: "googlepay", name: "Google Pay" },
  { id: "creditcard", name: "card" },
  { id: "klarna", name: "Klarna" },
] as const;

export default function PaymentMarks({
  cardLabel,
  size = "md",
  className = "",
}: {
  /** The words for card payments ("Creditcard" / "Card"), used as that icon's text alternative. */
  cardLabel: string;
  /** Kept for callers that still pass it; the official marks look the same on any ground. */
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}) {
  const height = size === "sm" ? 22 : 28;
  const width = Math.round((height * 32) / 24);

  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PAYMENT_METHODS.map((method) => {
        const label = method.id === "creditcard" ? cardLabel : method.name;
        return (
          <li key={method.id} title={label} className="leading-none">
            <Image
              src={`/images/payments/${method.id}.svg`}
              alt={label}
              width={width}
              height={height}
              unoptimized
              className="rounded-[5px] shadow-[0_0_0_1px_rgba(20,18,15,0.08)]"
              style={{ width, height }}
            />
          </li>
        );
      })}
    </ul>
  );
}
