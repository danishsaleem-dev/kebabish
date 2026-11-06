import { Check, Languages } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { setAccountLanguageAction } from "@/app/dashboard/language-action";
import type { AccountLocale } from "@/lib/account-page";

/**
 * The NL/EN switch. A form per option rather than a select, so it needs no
 * JavaScript and each choice is one tap on a phone — the action writes the
 * cookie the whole dashboard reads (see lib/account-page.ts) and sends the
 * customer back to this page.
 */
export default function LanguagePicker({
  current,
  back,
  labels,
}: {
  current: AccountLocale;
  /** Where to return after the switch — a path under /dashboard. */
  back: string;
  labels: { title: string; text: string; dutch: string; english: string };
}) {
  const options: { code: AccountLocale; label: string }[] = [
    { code: "nl", label: labels.dutch },
    { code: "en", label: labels.english },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Languages size={18} className="text-ember-600" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-heading">{labels.title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{labels.text}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = option.code === current;
          return (
            <form key={option.code} action={setAccountLanguageAction}>
              <input type="hidden" name="locale" value={option.code} />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "border-ember-600/50 bg-ember-600/10 text-ember-700"
                    : "border-hairline bg-panel text-body-text hover:bg-canvas"
                }`}
              >
                {option.label}
                {active && <Check size={16} aria-hidden="true" />}
              </button>
            </form>
          );
        })}
      </div>
    </Card>
  );
}
