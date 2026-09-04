"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bike,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  X,
} from "lucide-react";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import { formatMoney } from "@/lib/admin/units";
import type { MockOrder } from "@/lib/admin/mock-data";

/** Slide-over summary opened by the eye icon — the "is this ready?" glance. */
export default function OrderQuickView({
  order,
  onClose,
}: {
  order: MockOrder | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [order, onClose]);

  if (!order) return null;

  const placed = new Date(order.placedAt);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close quick view"
        onClick={onClose}
        className="absolute inset-0 bg-heading/40 backdrop-blur-[2px]"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-hairline p-5">
          <div>
            <p className="font-display text-lg font-semibold text-heading">
              {order.reference}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {placed.toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-body-text">
              {order.channel === "whatsapp" ? (
                <MessageCircle size={13} className="text-success" />
              ) : (
                <Globe size={13} className="text-ember-600" />
              )}
              {order.channel === "whatsapp" ? "WhatsApp" : "Website"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-body-text">
              {order.fulfilment === "delivery" ? (
                <Bike size={13} className="text-muted" />
              ) : (
                <ShoppingBag size={13} className="text-muted" />
              )}
              {order.fulfilment === "delivery" ? "Delivery" : "Takeaway"}
            </span>
          </div>

          <div className="rounded-xl bg-canvas p-4">
            <p className="text-sm font-semibold text-heading">
              {order.customerName}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Phone size={13} />
              {order.phone}
            </p>
            {order.fulfilment === "delivery" && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {order.address}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Items
            </p>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {order.lines.map((line, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-body-text">
                    <span className="font-semibold text-heading">
                      {line.quantity}×
                    </span>{" "}
                    {line.name}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-heading">
                    {formatMoney(line.quantity * line.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {order.note && (
            <div className="rounded-xl border border-warn/30 bg-warn-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn">
                Customer note
              </p>
              <p className="mt-1 text-sm text-warn">{order.note}</p>
            </div>
          )}

          <dl className="space-y-2 border-t border-hairline pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-heading">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="text-heading">
                {order.deliveryFee ? formatMoney(order.deliveryFee) : "Free"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2">
              <dt className="font-semibold text-heading">Total</dt>
              <dd className="font-display text-lg font-semibold text-heading">
                {formatMoney(order.total)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-hairline p-5">
          <Link
            href={`/admin/orders/${order.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ember-600 px-4 py-3 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            Open full order
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
