"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, MapPin, Pencil } from "lucide-react";
import { useLocation } from "@/components/location/LocationProvider";

/**
 * "Do you deliver to me?" answered in place. With an address already given on this
 * device (the arrival dialog only ever saves one we deliver to), it says so — street,
 * town and distance — with a way to change it. Without one, the button opens the same
 * "Where should we deliver?" dialog, instead of sending the visitor off to /contact.
 *
 * Until storage has been read (and on the server) it renders the plain button, so the
 * first paint never claims anything.
 */
export default function DeliveryAddressStatus({
  checkLabel,
  className = "",
}: {
  /** The button's wording when no address is known yet (the homepage's editable "Check your address"). */
  checkLabel?: string;
  className?: string;
}) {
  const t = useTranslations("location");
  const { ready, location, openDialog } = useLocation();

  if (ready && location) {
    const km =
      location.km != null
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(location.km)
        : null;
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-success/25 bg-success-soft px-4 py-3.5 ${className}`}
      >
        <CheckCircle2 size={22} aria-hidden="true" className="shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-charcoal-600">{t("statusYes", { town: location.city })}</p>
          <p className="truncate text-xs text-ink/60">
            {location.street} {location.houseNumber}
            {location.addition ? ` ${location.addition}` : ""}
            {km ? ` · ${t("statusKm", { km })}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-charcoal-600 transition-colors hover:bg-cream-50"
        >
          <Pencil size={13} aria-hidden="true" />
          {t("statusChange")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openDialog}
      className={`inline-flex items-center gap-2.5 rounded-full bg-charcoal-600 px-8 py-4 font-display text-sm font-semibold text-cream-100 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-600 ${className}`}
    >
      <MapPin size={18} aria-hidden="true" />
      {checkLabel ?? t("statusCheck")}
    </button>
  );
}
