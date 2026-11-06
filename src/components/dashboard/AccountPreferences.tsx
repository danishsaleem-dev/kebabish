"use client";

import { useActionState } from "react";
import { Check, Mail, MapPin, Trash2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { removeSavedAddressAction, updateMarketingAction } from "@/app/dashboard/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { SavedAddress } from "@/lib/customers/accounts";

const EMPTY: FormState = { ok: false };

export type PreferenceLabels = {
  emailsTitle: string;
  optIn: string;
  /** Already carries the consent date when there is one. */
  consentNote: string;
  save: string;
  addressTitle: string;
  addressRemove: string;
  addressNone: string;
};

/**
 * Email preference and saved address. Lived in components/shared before the
 * dashboard was split into pages, but it has always imported the dashboard's
 * own server actions, so it belongs here.
 *
 * The opt-in checkbox is the only thing that can turn marketing on, and it
 * is never pre-ticked beyond what is already stored — consent is given, not
 * defaulted.
 */
export default function AccountPreferences({
  locale,
  marketingOptIn,
  savedAddress,
  labels,
}: {
  locale: string;
  marketingOptIn: boolean;
  savedAddress: SavedAddress | null;
  labels: PreferenceLabels;
}) {
  const [marketing, marketingAction] = useActionState(updateMarketingAction, EMPTY);
  const [removal, removeAction] = useActionState(removeSavedAddressAction, EMPTY);

  return (
    <>
      <Card>
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-ember-600" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-heading">{labels.emailsTitle}</h2>
        </div>
        <form action={marketingAction} className="mt-4 space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body-text">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={marketingOptIn}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-hairline accent-ember-600"
            />
            <span>
              {labels.optIn}
              <span className="mt-0.5 block text-xs text-muted">{labels.consentNote}</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-xl border border-hairline px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-canvas"
            >
              {labels.save}
            </button>
            {marketing.message && (
              <span
                role="status"
                className={`inline-flex items-center gap-1.5 text-sm ${
                  marketing.ok ? "text-success" : "text-danger"
                }`}
              >
                {marketing.ok && <Check size={14} aria-hidden="true" />}
                {marketing.message}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-ember-600" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-heading">{labels.addressTitle}</h2>
        </div>
        {savedAddress ? (
          <form
            action={removeAction}
            className="mt-4 flex flex-wrap items-center justify-between gap-3"
          >
            <input type="hidden" name="locale" value={locale} />
            <p className="text-sm text-body-text">
              {savedAddress.street} {savedAddress.houseNumber}
              {savedAddress.addition ? ` ${savedAddress.addition}` : ""}
              <br />
              {savedAddress.postcode} {savedAddress.city}
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
            >
              <Trash2 size={14} aria-hidden="true" />
              {labels.addressRemove}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">{labels.addressNone}</p>
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
