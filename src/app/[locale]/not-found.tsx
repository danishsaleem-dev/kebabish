import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** A real, on-brand 404 for a page that doesn't exist — with a way back to the menu. */
export default async function NotFoundPage() {
  const t = await getTranslations("notFoundPage");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ember-600">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-charcoal-600">{t("title")}</h1>
      <p className="mt-4 text-base text-ink/70">{t("text")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/menu"
          className="rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
        >
          {t("menu")}
        </Link>
        <Link
          href="/"
          className="rounded-full border border-charcoal-600/25 px-7 py-3.5 font-display text-sm font-semibold text-charcoal-600 transition-colors hover:border-charcoal-600"
        >
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
