import type { PaymentStatus } from "@/lib/admin/order-types";

/** Short wording for a table cell. (`PAYMENT_STATUS_LABELS` is the longer, rider-facing one.) */
export const PAYMENT_PILL_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  open: "Pending",
  failed: "Failed",
  expired: "Expired",
  canceled: "Cancelled",
  refunded: "Refunded",
};

const TONE: Record<PaymentStatus, string> = {
  paid: "bg-success-soft text-success",
  open: "bg-warn-soft text-warn",
  failed: "bg-danger-soft text-danger",
  expired: "bg-canvas text-muted ring-1 ring-inset ring-hairline",
  canceled: "bg-canvas text-muted ring-1 ring-inset ring-hairline",
  refunded: "bg-blue-50 text-blue-700",
};

const DOT: Record<PaymentStatus, string> = {
  paid: "bg-success",
  open: "bg-warn",
  failed: "bg-danger",
  expired: "bg-faint",
  canceled: "bg-faint",
  refunded: "bg-blue-600",
};

/**
 * `partlyRefunded` is for an order that is still "paid" but had some money handed back —
 * the order's own status only becomes "refunded" once nothing is left.
 */
export default function PaymentStatusPill({
  status,
  partlyRefunded = false,
}: {
  status: PaymentStatus;
  partlyRefunded?: boolean;
}) {
  const partly = partlyRefunded && status === "paid";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        partly ? TONE.refunded : TONE[status]
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${partly ? DOT.refunded : DOT[status]}`} />
      {partly ? "Part refunded" : PAYMENT_PILL_LABELS[status]}
    </span>
  );
}
