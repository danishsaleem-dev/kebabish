import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-types";

const TONE: Record<OrderStatus, string> = {
  new: "bg-ember-600/10 text-ember-700",
  preparing: "bg-warn-soft text-warn",
  on_the_way: "bg-blue-50 text-blue-700",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
};

const DOT: Record<OrderStatus, string> = {
  new: "bg-ember-600",
  preparing: "bg-warn",
  on_the_way: "bg-blue-600",
  delivered: "bg-success",
  cancelled: "bg-danger",
};

export default function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
