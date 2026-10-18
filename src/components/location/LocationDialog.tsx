"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, MapPin, MessageCircle, X } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import PostcodeField from "@/components/cart/PostcodeField";
import { useLocation, type SavedLocation } from "@/components/location/LocationProvider";
import { checkDeliveryAction } from "@/app/[locale]/(site)/delivery-actions";
import { whatsappOrderLink } from "@/lib/site-config";

/**
 * "Where should we deliver?" — a small dialog in the middle of the screen when someone
 * lands on the site without a delivery address on this device. It asks for the same
 * address checkout does (postcode, house number, addition), measures it against the
 * kitchen on the server, says plainly whether we deliver there, and remembers it so
 * checkout is already filled in.
 *
 * Restrained on purpose:
 *  - it waits a moment, and never appears on the cart, checkout or feedback pages, where
 *    someone is already mid-task;
 *  - "Not now" (or Escape, or the backdrop) is remembered for the rest of the visit, so it
 *    never nags — it asks again next visit until an address has been given;
 *  - the promotion popup waits until it has been dealt with (see `PromoPopup`).
 * Nothing renders on the server, so a crawler never sees it.
 */

const SHOW_AFTER_MS = 1200;
const DISMISSED_KEY = "kebabish-location-dismissed";
const QUIET_PATHS = ["/cart", "/checkout", "/feedback"];

function prettyPostcode(p: string): string {
  return /^\d{4}[A-Z]{2}$/.test(p) ? `${p.slice(0, 4)} ${p.slice(4)}` : p;
}

function addressLine(l: { street: string; houseNumber: string; addition: string; postcode: string; city: string }) {
  const street = [l.street, l.houseNumber, l.addition].filter(Boolean).join(" ");
  return `${street}, ${prettyPostcode(l.postcode)} ${l.city}`;
}

export default function LocationDialog() {
  const { ready, location, dialogOpen, openDialog, closeDialog } = useLocation();
  const pathname = usePathname();
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Ask once per page load, after a pause, if we don't know the address yet.
  useEffect(() => {
    if (!ready || location || quiet) return;
    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // No sessionStorage: it may ask again on the next page, which is acceptable.
    }
    const timer = window.setTimeout(openDialog, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [ready, location, quiet, openDialog]);

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Fine — see above.
    }
    closeDialog();
  }, [closeDialog]);

  if (!dialogOpen) return null;
  return <DialogBody onDismiss={dismiss} />;
}

type Outcome =
  | { kind: "yes"; address: string; km: number | null }
  | { kind: "no"; address: string; km: number | null; radiusKm: number }
  | { kind: "error"; code: "invalidPostcode" | "busy" | "failed" };

function DialogBody({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("location");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const { location, save } = useLocation();
  const [pending, startTransition] = useTransition();

  // A remount (the dialog is reopened) starts from the saved address, if there is one.
  const [resolvedStreet, setResolvedStreet] = useState(location?.street ?? "");
  const [resolvedCity, setResolvedCity] = useState(location?.city ?? "");
  const [houseNumber, setHouseNumber] = useState(location?.houseNumber ?? "");
  const [addition, setAddition] = useState(location?.addition ?? "");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onDismiss();
        return;
      }
      if (ev.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], input:not([readonly]):not(:disabled)"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the dialog, not the first field: on a phone that would throw the keyboard
    // up over half of it before the visitor has even read the question.
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      returnTo?.focus?.();
    };
  }, [onDismiss]);

  const km = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const postcode = String(new FormData(ev.currentTarget).get("postcode") ?? "");
    const number = houseNumber.trim();
    setOutcome(null);

    startTransition(async () => {
      let result;
      try {
        result = await checkDeliveryAction({ postcode, houseNumber: number });
      } catch {
        setOutcome({ kind: "error", code: "failed" });
        return;
      }
      if (!result.ok) {
        setOutcome({ kind: "error", code: result.error });
        return;
      }

      const found: SavedLocation = {
        street: result.street || resolvedStreet,
        houseNumber: number,
        addition: addition.trim(),
        postcode: result.postcode,
        city: result.city,
        km: result.km,
      };
      const address = addressLine(found);

      if (result.deliverable) {
        save(found);
        setOutcome({ kind: "yes", address, km: result.km });
      } else {
        setOutcome({ kind: "no", address, km: result.km, radiusKm: result.radiusKm });
      }
    });
  }

  const input =
    "h-12 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 text-[0.95rem] text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none";
  const readOnlyInput = `${input} bg-charcoal-600/5 text-ink/70`;
  const label = "mb-1.5 block text-sm font-medium text-charcoal-600/80";
  const yes = outcome?.kind === "yes";

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-charcoal-950/65 p-4 backdrop-blur-[3px] animate-[media-fade-in_0.25s_ease-out_both] motion-reduce:animate-none"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-title"
        className="relative my-auto w-full max-w-md rounded-3xl bg-cream-50 p-5 shadow-2xl outline-none sm:p-7"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("close")}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-200"
        >
          <X size={20} />
        </button>

        {yes ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ember-600 text-cream-50">
              <Check size={28} strokeWidth={3} />
            </span>
            <h2 id="location-title" className="mt-4 font-display text-2xl font-semibold text-charcoal-600">
              {t("yesTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-ink/70">
              {outcome.km != null
                ? t("yesText", { address: outcome.address, km: km(outcome.km) })
                : t("yesTextNoKm", { address: outcome.address })}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-6 w-full rounded-full bg-ember-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              {t("continue")}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember-600/10 text-ember-700">
              <MapPin size={22} />
            </span>
            <h2
              id="location-title"
              className="mt-3 pr-8 font-display text-xl font-semibold leading-snug text-charcoal-600 sm:text-2xl"
            >
              {t("title")}
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-ink/70">{t("intro")}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={label}>{tc("postcode")}</span>
                <PostcodeField
                  name="postcode"
                  required
                  placeholder={tc("postcodePlaceholder")}
                  initial={
                    location
                      ? { street: location.street, postcode: location.postcode, city: location.city }
                      : undefined
                  }
                  onResolved={({ street, city }) => {
                    setResolvedStreet(street);
                    setResolvedCity(city);
                  }}
                  onEdit={() => setOutcome(null)}
                />
              </label>
              <label className="block">
                <span className={label}>{tc("street")}</span>
                <input
                  readOnly
                  tabIndex={-1}
                  value={resolvedStreet}
                  placeholder={tc("streetPlaceholder")}
                  className={readOnlyInput}
                />
              </label>
              <label className="block">
                <span className={label}>{tc("city")}</span>
                <input
                  readOnly
                  tabIndex={-1}
                  value={resolvedCity}
                  placeholder={tc("cityPlaceholder")}
                  className={readOnlyInput}
                />
              </label>
              <label className="block">
                <span className={label}>{tc("houseNumber")}</span>
                <input
                  name="houseNumber"
                  required
                  inputMode="numeric"
                  autoComplete="address-line2"
                  value={houseNumber}
                  onChange={(ev) => {
                    setHouseNumber(ev.target.value);
                    setOutcome(null);
                  }}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>{tc("addition")}</span>
                <input
                  name="addition"
                  placeholder={tc("additionPlaceholder")}
                  value={addition}
                  onChange={(ev) => setAddition(ev.target.value)}
                  className={input}
                />
              </label>
            </div>

            {outcome?.kind === "error" && (
              <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {t(`errors.${outcome.code}`)}
              </p>
            )}

            {outcome?.kind === "no" && (
              <div role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
                <p className="font-semibold">{t("noTitle")}</p>
                <p className="mt-1">
                  {outcome.km != null
                    ? t("noText", { address: outcome.address, km: km(outcome.km), radius: outcome.radiusKm })
                    : t("noTextNoKm", { address: outcome.address, radius: outcome.radiusKm })}
                </p>
                <a
                  href={whatsappOrderLink(t("whatsapp", { address: outcome.address }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                >
                  <MessageCircle size={15} />
                  {t("noAsk")}
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-5 w-full rounded-full bg-ember-600 px-6 py-4 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
            >
              {pending ? t("checking") : t("submit")}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 w-full rounded-full px-6 py-2.5 text-sm font-medium text-ink/60 transition-colors hover:text-ember-700"
            >
              {t("notNow")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
