import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

/**
 * Letterhead shown only in print output (`hidden print:flex` — invisible
 * on screen, where the order page's own header already covers this). Gives
 * the printed ticket a logo and business details instead of just the bare
 * dashboard card. Uses the "Kebabish" trading name only, not the legal
 * entity — this can end up in a customer's hand at the door, same reason
 * the public site never names it outside Privacy/Terms.
 */
export default function OrderInvoiceHeader({
  reference,
  placedAt,
}: {
  reference: string;
  placedAt: string;
}) {
  return (
    <div className="mb-6 hidden items-start justify-between gap-6 border-b-2 border-heading pb-4 print:flex">
      <div className="flex items-center gap-3">
        <Image
          src="/logo/Kebabish-light.png"
          alt="Kebabish"
          width={300}
          height={225}
          className="h-16 w-auto"
        />
        <div>
          <p className="font-display text-lg font-semibold text-heading">
            {siteConfig.brandName}
          </p>
          <p className="text-xs text-body-text">
            {siteConfig.address.street}, {siteConfig.address.postalCode}{" "}
            {siteConfig.address.city}
          </p>
          <p className="text-xs text-body-text">
            {siteConfig.contact.phone} · {siteConfig.contact.email}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-display text-2xl font-semibold text-heading">
          Order invoice
        </p>
        <p className="text-sm font-medium text-body-text">{reference}</p>
        <p className="text-xs text-muted">
          {new Date(placedAt).toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
