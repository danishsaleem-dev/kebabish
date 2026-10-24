"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DatabaseZap, Gauge, Info, PencilLine, TriangleAlert } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { Input, SubmitButton } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import { saveMileageAction, type MileageResult } from "@/app/rider/mileage-actions";
import { compareToEstimate, formatKm, type MileageEstimate } from "@/lib/rider-mileage";

const EMPTY: MileageResult = { ok: false, message: "" };

/**
 * The rider's own kilometre log for the day: the reading off the dashboard when they set off,
 * and the one when they get back. That difference is the record — it covers the whole round,
 * including the wrong turns and the ride home, which nothing derived from delivery addresses
 * can reconstruct.
 *
 * The site's own straight-line figure is shown underneath as a **cross-check**, with both
 * bounds and the word "straight line" on it, because that is all it is. It flags one thing
 * only: a round that is shorter than the deliveries could physically have been, which means a
 * reading needs looking at. Nothing here calculates money.
 */
export default function MileageCard({
  ready,
  shiftDate,
  startKm,
  endKm,
  drivenKm,
  estimate,
  deliveries,
  locale = "en-GB",
}: {
  /** False until migration 0023 has been run. */
  ready: boolean;
  shiftDate: string;
  startKm: number | null;
  endKm: number | null;
  drivenKm: number | null;
  estimate: MileageEstimate | null;
  /** How many orders the rider has delivered today — what the estimate is built from. */
  deliveries: number;
  locale?: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: MileageResult, formData: FormData) => saveMileageAction(formData),
    EMPTY
  );
  const { toast } = useToast();
  const seenRef = useRef<MileageResult | null>(null);
  // The correction panel closes itself once a save lands, which is *derived* rather than set
  // from the effect below (that would be a cascading render the lint rule refuses): remember
  // which action result was current when it was opened, and treat any later success as "done".
  const [openedWith, setOpenedWith] = useState<MileageResult | null>(null);
  const correcting = openedWith !== null && !(state.ok && state !== openedWith);

  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  if (!ready) {
    return (
      <Card className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
          <DatabaseZap size={17} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-heading">
            Kilometre log not set up yet
          </h2>
          <p className="mt-1 text-sm text-muted">
            The office needs to run migration 0023 once. Your deliveries below work as normal.
          </p>
        </div>
      </Card>
    );
  }

  const verdict = compareToEstimate(drivenKm, estimate);
  const showStartForm = startKm === null || correcting;
  const showEndForm = startKm !== null && (endKm === null || correcting);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <Gauge size={17} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-heading">Today&apos;s round</h2>
            <p className="mt-0.5 text-sm text-muted">
              {drivenKm !== null
                ? "Your kilometres are logged."
                : startKm === null
                  ? "Read the kilometres off your dashboard before you set off."
                  : "Log the reading again when you get back."}
            </p>
          </div>
        </div>

        {drivenKm !== null && (
          <p className="font-display text-2xl font-semibold tabular-nums text-heading">
            {formatKm(drivenKm, locale)}
          </p>
        )}
      </div>

      {/* What is already recorded, and the way back to correct it. */}
      {startKm !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4 text-sm">
          <p className="text-body-text">
            <span className="text-muted">Start</span>{" "}
            <span className="font-semibold tabular-nums text-heading">
              {startKm.toLocaleString(locale)}
            </span>
            {endKm !== null && (
              <>
                {" → "}
                <span className="text-muted">end</span>{" "}
                <span className="font-semibold tabular-nums text-heading">
                  {endKm.toLocaleString(locale)}
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setOpenedWith(correcting ? null : state)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <PencilLine size={13} />
            {correcting ? "Done correcting" : "Correct a reading"}
          </button>
        </div>
      )}

      {(showStartForm || showEndForm) && (
        <div className="space-y-3 border-t border-hairline p-5">
          {showStartForm && (
            <Reading
              action={formAction}
              which="start"
              shiftDate={shiftDate}
              label={startKm === null ? "Kilometres on the dashboard now" : "Correct the start reading"}
              defaultValue={startKm}
              button={startKm === null ? "Start my round" : "Save start"}
            />
          )}
          {showEndForm && (
            <Reading
              action={formAction}
              which="end"
              shiftDate={shiftDate}
              label={endKm === null ? "Kilometres on the dashboard now" : "Correct the end reading"}
              defaultValue={endKm}
              button={endKm === null ? "Finish my round" : "Save end"}
            />
          )}
        </div>
      )}

      {/* The cross-check. Deliberately both bounds, and labelled straight-line. */}
      <div className="border-t border-hairline bg-canvas px-5 py-4">
        {estimate ? (
          <div className="flex items-start gap-2 text-sm">
            <Info size={14} className="mt-0.5 shrink-0 text-faint" />
            <div>
              <p className="text-body-text">
                Your {estimate.stops} {estimate.stops === 1 ? "delivery" : "deliveries"} today
                come to{" "}
                <span className="font-semibold text-heading">
                  {formatKm(estimate.lowKm, locale)}
                </span>{" "}
                at the very least, and{" "}
                <span className="font-semibold text-heading">
                  {formatKm(estimate.highKm, locale)}
                </span>{" "}
                if you drove out and back for each one — measured in straight lines, so real
                roads are longer.
              </p>
              {estimate.unlocated > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {estimate.unlocated} more {estimate.unlocated === 1 ? "address" : "addresses"}{" "}
                  couldn&apos;t be placed on the map, so the real figure is higher.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-faint" />
            {deliveries === 0
              ? "Nothing delivered yet today, so there is nothing to compare against."
              : "Today's addresses couldn't be placed on the map, so there is nothing to compare against."}
          </p>
        )}

        {verdict === "belowStraightLine" && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-body-text">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" />
            <span>
              That is less than the straight-line distance to your deliveries, which can&apos;t
              be right. Check both readings — or add a note if there is a reason.
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}

function Reading({
  action,
  which,
  shiftDate,
  label,
  defaultValue,
  button,
}: {
  action: (formData: FormData) => void;
  which: "start" | "end";
  shiftDate: string;
  label: string;
  defaultValue: number | null;
  button: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="which" value={which} />
      <input type="hidden" name="shiftDate" value={shiftDate} />
      <label className="min-w-[10rem] flex-1">
        <span className="mb-1.5 block text-sm font-medium text-heading">{label}</span>
        <Input
          name="km"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          required
          defaultValue={defaultValue ?? ""}
          placeholder="e.g. 48210"
          // A dashboard shows whole kilometres, and the field is tapped on a phone at the
          // kerb — so: a number pad, no decimals, nothing else to think about.
          className="tabular-nums"
        />
      </label>
      <SubmitButton>{button}</SubmitButton>
    </form>
  );
}
