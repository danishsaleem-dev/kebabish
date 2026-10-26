"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/admin/ui/Toast";
import { deleteShiftAction, updateShiftAction } from "@/app/admin/(dashboard)/riders/actions";
import { compareToEstimate, formatKm, type MileageEstimate } from "@/lib/rider-mileage";
import type { RiderShift } from "@/lib/rider-shifts";

export interface ShiftRowData {
  shift: RiderShift;
  deliveries: number;
  estimate: MileageEstimate | null;
}

const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** "17:30" in Amsterdam time, or "" — the same on the server and in the browser. */
function timeOf(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

const inputClass =
  "h-9 w-full rounded-lg border border-hairline bg-panel px-2.5 text-sm text-heading tabular-nums focus:border-ember-500 focus:outline-none";

/**
 * The rounds table on /admin/riders, with a pencil to correct every value of a round and a
 * two-step bin to delete it. Edits happen inline in the row, so the figures around it stay in
 * view while a number is being put right.
 */
export default function RiderShiftTable({
  rows,
  showRider = false,
  today,
}: {
  rows: ShiftRowData[];
  showRider?: boolean;
  /** Today's Amsterdam date — the latest day a round can be moved to. */
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteShiftAction(id);
      toast(result.message, result.ok ? "success" : "error");
      setArmed(null);
      if (result.ok) router.refresh();
    });
  }

  const columns = showRider ? 9 : 8;

  return (
    <div className="overflow-x-auto border-t border-hairline">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Day</th>
            {showRider && <th className="px-5 py-3">Rider</th>}
            <th className="px-5 py-3 text-right">Start</th>
            <th className="px-5 py-3 text-right">End</th>
            <th className="px-5 py-3 text-right">Driven</th>
            <th className="px-5 py-3 text-right">Deliveries</th>
            <th className="px-5 py-3">Straight-line check</th>
            <th className="px-5 py-3 print:hidden">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ shift, deliveries, estimate }) => {
            if (editing === shift.id) {
              return (
                <tr key={shift.id} className="border-b border-hairline bg-canvas/60 last:border-0">
                  <td colSpan={columns} className="px-5 py-4">
                    <EditRound
                      shift={shift}
                      today={today}
                      pending={pending}
                      onCancel={() => setEditing(null)}
                      onSave={(input) =>
                        startTransition(async () => {
                          const result = await updateShiftAction(input);
                          toast(result.message, result.ok ? "success" : "error");
                          if (result.ok) {
                            setEditing(null);
                            router.refresh();
                          }
                        })
                      }
                    />
                  </td>
                </tr>
              );
            }

            const verdict = compareToEstimate(shift.drivenKm, estimate);
            return (
              <tr key={shift.id} className="border-b border-hairline last:border-0">
                <td className="px-5 py-3 text-body-text">{dayLabel(shift.shiftDate)}</td>
                {showRider && (
                  <td className="px-5 py-3 text-body-text">{shift.riderName ?? "—"}</td>
                )}
                <td className="px-5 py-3 text-right tabular-nums text-body-text">
                  {shift.startKm?.toLocaleString("en-GB") ?? "—"}
                  {shift.startAt && (
                    <span className="block text-xs text-faint">{timeOf(shift.startAt)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-body-text">
                  {shift.endKm?.toLocaleString("en-GB") ?? "—"}
                  {shift.endAt && (
                    <span className="block text-xs text-faint">{timeOf(shift.endAt)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-heading">
                  {shift.drivenKm === null ? "—" : formatKm(shift.drivenKm)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-body-text">{deliveries}</td>
                <td className="px-5 py-3 text-muted">
                  {estimate ? (
                    <span
                      className={
                        verdict === "belowStraightLine"
                          ? "inline-flex items-center gap-1.5 font-semibold text-warn"
                          : undefined
                      }
                    >
                      {verdict === "belowStraightLine" && (
                        <TriangleAlert size={13} className="shrink-0" />
                      )}
                      at least {formatKm(estimate.lowKm)}
                      {estimate.unlocated > 0 && (
                        <span className="text-faint"> (+{estimate.unlocated} unplaced)</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                  {shift.note && <span className="block text-xs text-faint">{shift.note}</span>}
                </td>
                <td className="px-3 py-2 print:hidden">
                  <div className="flex items-center justify-end gap-1">
                    {armed === shift.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(shift.id)}
                          disabled={pending}
                          className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60"
                        >
                          Delete for good
                        </button>
                        <button
                          type="button"
                          onClick={() => setArmed(null)}
                          className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-body-text hover:bg-canvas"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setArmed(null);
                            setEditing(shift.id);
                          }}
                          aria-label={`Edit the round on ${dayLabel(shift.shiftDate)}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setArmed(shift.id)}
                          aria-label={`Delete the round on ${dayLabel(shift.shiftDate)}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditRound({
  shift,
  today,
  pending,
  onCancel,
  onSave,
}: {
  shift: RiderShift;
  today: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (input: Parameters<typeof updateShiftAction>[0]) => void;
}) {
  const [shiftDate, setShiftDate] = useState(shift.shiftDate);
  const [startKm, setStartKm] = useState(shift.startKm === null ? "" : String(shift.startKm));
  const [endKm, setEndKm] = useState(shift.endKm === null ? "" : String(shift.endKm));
  const [startTime, setStartTime] = useState(timeOf(shift.startAt));
  const [endTime, setEndTime] = useState(timeOf(shift.endAt));
  const [note, setNote] = useState(shift.note ?? "");

  const s = startKm.trim() === "" ? null : Number(startKm);
  const e = endKm.trim() === "" ? null : Number(endKm);
  const driven = s !== null && e !== null && Number.isFinite(s) && Number.isFinite(e) ? e - s : null;

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        onSave({ id: shift.id, shiftDate, startKm, endKm, startTime, endTime, note });
      }}
      className="space-y-3"
    >
      <p className="text-sm font-semibold text-heading">
        Correct this round{shift.riderName ? ` — ${shift.riderName}` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Day</span>
          <input
            type="date"
            value={shiftDate}
            max={today}
            onChange={(ev) => setShiftDate(ev.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Start reading (km)</span>
          <input
            inputMode="numeric"
            value={startKm}
            onChange={(ev) => setStartKm(ev.target.value)}
            placeholder="48210"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Start time</span>
          <input
            type="time"
            value={startTime}
            onChange={(ev) => setStartTime(ev.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">End reading (km)</span>
          <input
            inputMode="numeric"
            value={endKm}
            onChange={(ev) => setEndKm(ev.target.value)}
            placeholder="48242"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">End time</span>
          <input
            type="time"
            value={endTime}
            onChange={(ev) => setEndTime(ev.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex flex-col justify-end">
          <span className="mb-1 block text-xs font-medium text-muted">Driven</span>
          <span
            className={`flex h-9 items-center font-display text-base font-semibold tabular-nums ${
              driven !== null && driven < 0 ? "text-danger" : "text-heading"
            }`}
          >
            {driven === null ? "—" : driven < 0 ? "End is below start" : formatKm(driven)}
          </span>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Note</span>
        <input
          value={note}
          maxLength={500}
          onChange={(ev) => setNote(ev.target.value)}
          placeholder="Why it was corrected, a vehicle swap…"
          className={inputClass}
        />
      </label>
      <p className="text-xs text-muted">
        Leave a reading empty to clear it. An end time earlier than the start time is read as
        after midnight.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ember-600 px-4 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save round"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-body-text hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
