"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { setRequestStatusAction, deleteRequestAction } from "@/app/admin/(dashboard)/requests/actions";
import { telHref, whatsappDigits } from "@/lib/phone";
import type { StockRequest, StockRequestStatus } from "@/lib/stock-requests/data";

const STATUS_LABEL: Record<StockRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  done: "Done",
  declined: "Declined",
};

const STATUS_TONE: Record<StockRequestStatus, string> = {
  new: "bg-ember-600/10 text-ember-700",
  contacted: "bg-warn-soft text-warn",
  done: "bg-success-soft text-success",
  declined: "bg-canvas text-muted ring-1 ring-inset ring-hairline",
};

type Filter = "open" | "all";

function wantedLabel(r: StockRequest): string {
  if (!r.wantedDate) return "No date given";
  const day = new Date(`${r.wantedDate}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return r.wantedTime ? `${day}, ${r.wantedTime}` : day;
}

export default function StockRequestsList({ items }: { items: StockRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const open = items.filter((r) => r.status === "new" || r.status === "contacted");
  const shown = filter === "open" ? open : items;

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? "That didn't work.");
      setConfirmingId(null);
      router.refresh();
    });
  }

  const tab = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-ember-600 text-white" : "border border-hairline bg-panel text-body-text hover:bg-canvas"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={tab(filter === "open")} onClick={() => setFilter("open")}>
          To follow up ({open.length})
        </button>
        <button type="button" className={tab(filter === "all")} onClick={() => setFilter("all")}>
          All ({items.length})
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <Card className="py-14 text-center text-sm text-muted">
          {filter === "open" ? "No requests waiting for you." : "No requests yet."}
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Card className="h-full space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-heading">
                      {r.quantity}× {r.itemName}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <CalendarClock size={14} />
                      {wantedLabel(r)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-heading">{r.customerName}</p>
                  <a href={telHref(r.phone)} className="flex items-center gap-2 text-body-text hover:text-ember-700">
                    <Phone size={14} className="shrink-0 text-faint" />
                    <span className="tabular-nums">{r.phone}</span>
                  </a>
                  <a
                    href={`https://wa.me/${whatsappDigits(r.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-body-text hover:text-ember-700"
                  >
                    <MessageCircle size={14} className="shrink-0 text-success" />
                    WhatsApp
                  </a>
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="flex items-center gap-2 text-body-text hover:text-ember-700">
                      <Mail size={14} className="shrink-0 text-faint" />
                      <span className="truncate">{r.email}</span>
                    </a>
                  )}
                </div>

                {r.note && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-body-text">“{r.note}”</p>}

                <p className="text-xs text-faint">
                  Sent{" "}
                  {new Date(r.createdAt).toLocaleString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3 print:hidden">
                  {r.status === "new" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setRequestStatusAction(r.id, "contacted"))}
                      className="rounded-lg bg-ember-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-ember-500 disabled:opacity-60"
                    >
                      I contacted them
                    </button>
                  )}
                  {(r.status === "new" || r.status === "contacted") && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setRequestStatusAction(r.id, "done"))}
                        className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text hover:bg-canvas disabled:opacity-60"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setRequestStatusAction(r.id, "declined"))}
                        className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text hover:bg-canvas disabled:opacity-60"
                      >
                        Can&apos;t do it
                      </button>
                    </>
                  )}
                  {(r.status === "done" || r.status === "declined") && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setRequestStatusAction(r.id, "new"))}
                      className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text hover:bg-canvas disabled:opacity-60"
                    >
                      Reopen
                    </button>
                  )}

                  {confirmingId === r.id ? (
                    <span className="ml-auto flex items-center gap-2 text-sm">
                      <span className="text-muted">Delete for good?</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deleteRequestAction(r.id))}
                        className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg px-2 py-2 text-sm font-semibold text-muted hover:text-heading"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(r.id)}
                      aria-label={`Delete request for ${r.itemName}`}
                      className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-canvas hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
