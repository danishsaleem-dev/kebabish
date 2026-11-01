import "server-only";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { formatEuro, fromCents } from "@/lib/money";
import { getRewardsConfig } from "@/lib/rewards";
import { valueOfPoints } from "@/lib/rewards-math";
import type { AuthPanel } from "@/components/shared/AuthShell";

/**
 * /login and /signup sit outside the locale routing, so the language is chosen here: an explicit
 * `?lang=`, else the English site if that's where the visitor came from, else Dutch.
 */
export async function authLocale(lang?: string): Promise<"nl" | "en"> {
  if (lang === "en" || lang === "nl") return lang;
  const referer = (await headers()).get("referer");
  if (!referer) return "nl";
  try {
    return /^\/en(\/|$)/.test(new URL(referer).pathname) ? "en" : "nl";
  } catch {
    return "nl";
  }
}

/** What an account is worth, from the live rules, for the brand panel. */
export async function authPanel(locale: "nl" | "en"): Promise<AuthPanel> {
  const t = await getTranslations({ locale, namespace: "auth" });
  const fmt = (value: number) => value.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
  const config = await getRewardsConfig().catch(() => null);
  const everyone = [t("perkTrack"), t("perkReorder")];

  if (!config?.enabled) return { title: t("panelTitlePlain"), perks: everyone };

  return {
    eyebrow: t("panelEyebrow"),
    title: t("panelTitle"),
    perks: [
      t("perkEarn", { points: fmt(config.pointsPerEuro) }),
      ...(config.referralEnabled
        ? [t("perkReferral", { amount: formatEuro(fromCents(config.referralFriendCents)) })]
        : []),
      ...everyone,
    ],
    ...(config.welcomePoints > 0
      ? {
          card: {
            label: t("panelCardLabel"),
            value: t("panelCardValue", { points: fmt(config.welcomePoints) }),
            note: t("panelCardNote", {
              worth: formatEuro(fromCents(valueOfPoints(config.welcomePoints, config))),
            }),
          },
        }
      : {}),
  };
}
