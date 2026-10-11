"use client";

import { useActionState } from "react";
import { Check, MapPin, Trash2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { removeSavedAddressAction, updateMarketingAction } from "@/app/dashboard/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { SavedAddress } from "@/lib/customers/accounts";

const EMPTY: FormState = { ok: false };

/** Email preference and saved address on the customer's account page. */
export default function AccountPreferences({
  marketingOptIn,
  consentDate,
  savedAddress,
}: {
  marketingOptIn: boolean;
  /** Pre-formatted date the consent was given, if it was. */
  consentDate: string | null;
  savedAddress: SavedAddress | null;
}) {
  const [marketing, marketingAction] = useActionState(updateMarketingAction, EMPTY);
  const [removal, removeAction] = useActionState(removeSavedAddressAction, EMPTY);

  return (
    <>
      <Card>
        <h2 className="font-display text-lg font-semibold text-heading">Emails</h2>
        <form action={marketingAction} className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body-text">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={marketingOptIn}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-hairline accent-ember-600"
            />
            <span>
              I want to receive offers and news from Kebabish.
              <span className="block text-xs text-muted">
                {marketingOptIn && consentDate
                  ? `You agreed on ${consentDate}. Untick it to stop.`
                  : "Off unless you tick it. Order updates are always sent."}
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-canvas"
            >
              Save
            </button>
            {marketing.message && (
              <span
                role="status"
                className={`inline-flex items-center gap-1.5 text-sm ${
                  marketing.ok ? "text-success" : "text-danger"
                }`}
              >
                {marketing.ok && <Check size={14} />}
                {marketing.message}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-ember-600" />
          <h2 className="font-display text-lg font-semibold text-heading">Saved address</h2>
        </div>
        {savedAddress ? (
          <form action={removeAction} className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-body-text">
              {savedAddress.street} {savedAddress.houseNumber}
              {savedAddress.addition ? ` ${savedAddress.addition}` : ""}
              <br />
              {savedAddress.postcode} {savedAddress.city}
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 size={14} />
              Remove
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Nothing saved. Tick &ldquo;Save this address&rdquo; at checkout and it will be
            filled in for you next time.
          </p>
        )}
        {removal.message && (
          <p
            role="status"
            className={`mt-3 text-sm ${removal.ok ? "text-success" : "text-danger"}`}
          >
            {removal.message}
          </p>
        )}
      </Card>
    </>
  );
}
