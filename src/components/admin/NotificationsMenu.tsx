"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  MessageSquareHeart,
  PackageSearch,
  ReceiptText,
  Settings2,
} from "lucide-react";
import {
  notifications as seedNotifications,
  relativeTime,
  type NotificationKind,
} from "@/lib/admin/mock-data";

const ICON: Record<NotificationKind, typeof Bell> = {
  order: ReceiptText,
  review: MessageSquareHeart,
  stock: PackageSearch,
  system: Settings2,
};

const TONE: Record<NotificationKind, string> = {
  order: "bg-ember-600/10 text-ember-700",
  review: "bg-success-soft text-success",
  stock: "bg-warn-soft text-warn",
  system: "bg-canvas text-muted",
};

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(seedNotifications);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-body-text transition-colors hover:bg-canvas"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-600 px-1 text-[10px] font-bold text-cream-50 ring-2 ring-panel">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-hairline bg-panel shadow-lg sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-heading">
              Notifications
              {unread > 0 && (
                <span className="ml-1.5 text-muted">({unread} new)</span>
              )}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-600 hover:underline"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-96 divide-y divide-hairline overflow-y-auto">
            {items.map((item) => {
              const Icon = ICON[item.kind];

              const content = (
                <span className="flex gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE[item.kind]}`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span
                        className={`block flex-1 text-sm ${
                          item.read
                            ? "font-medium text-body-text"
                            : "font-semibold text-heading"
                        }`}
                      >
                        {item.title}
                      </span>
                      {!item.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember-600" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {item.body}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">
                      {relativeTime(item.minutesAgo)}
                    </span>
                  </span>
                </span>
              );

              return (
                <li key={item.id} className={item.read ? "" : "bg-ember-600/[0.03]"}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => {
                        markRead(item.id);
                        setOpen(false);
                      }}
                      className="block px-4 py-3 transition-colors hover:bg-canvas"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="block w-full px-4 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
              You&apos;re all caught up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
