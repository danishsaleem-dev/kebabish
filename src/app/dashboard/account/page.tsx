import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import { accountLocale } from "@/lib/account-page";
import { customerAccount, customerProfile } from "@/lib/account-data";
import Card from "@/components/admin/ui/Card";
import {
  ConfirmAccountBanner,
  PasswordCard,
  ProfileCard,
} from "@/components/dashboard/AccountCards";
import AccountPreferences from "@/components/dashboard/AccountPreferences";
import LanguagePicker from "@/components/dashboard/LanguagePicker";
import { PageHeading } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

/** Details, emails, saved address, password, language — and the way out. */
export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const locale = await accountLocale(user.id);
  const t = await getTranslations({ locale, namespace: "account" });

  const [profile, account] = await Promise.all([
    customerProfile(user.id),
    customerAccount(user.id),
  ]);
  const passwordless = account?.passwordless ?? false;

  const consentDate = profile?.marketingConsentAt
    ? new Date(profile.marketingConsentAt).toLocaleDateString(
        locale === "nl" ? "nl-NL" : "en-GB",
        { timeZone: "Europe/Amsterdam", day: "numeric", month: "long", year: "numeric" }
      )
    : null;

  return (
    <div className="space-y-4">
      <PageHeading title={t("accountTitle")} subtitle={t("accountSubtitle")} />

      {passwordless && (
        <ConfirmAccountBanner
          locale={locale}
          title={t("confirmTitle")}
          text={t("confirmText", { email: user.email })}
          resend={t("confirmResend")}
        />
      )}

      <ProfileCard
        locale={locale}
        name={profile?.name ?? user.name ?? ""}
        email={user.email}
        phone={profile?.phone ?? ""}
        labels={{
          title: t("detailsTitle"),
          name: t("fieldName"),
          phone: t("fieldPhone"),
          phoneHint: t("fieldPhoneHint"),
          email: t("fieldEmail"),
          emailHint: t("fieldEmailHint"),
          save: t("saveDetails"),
        }}
      />

      {profile && (
        <AccountPreferences
          locale={locale}
          marketingOptIn={profile.marketingOptIn}
          savedAddress={profile.savedAddress}
          labels={{
            emailsTitle: t("emailsTitle"),
            optIn: t("emailsOptIn"),
            consentNote:
              profile.marketingOptIn && consentDate
                ? t("emailsConsentOn", { date: consentDate })
                : t("emailsConsentOff"),
            save: t("save"),
            addressTitle: t("addressTitle"),
            addressRemove: t("addressRemove"),
            addressNone: t("addressNone"),
          }}
        />
      )}

      {/* An account still waiting for its first password changes it from the
          email link, not here. */}
      {!passwordless && (
        <PasswordCard
          locale={locale}
          labels={{
            title: t("passwordTitle"),
            current: t("passwordCurrent"),
            next: t("passwordNew"),
            nextHint: t("passwordNewHint"),
            repeat: t("passwordRepeat"),
            save: t("passwordChange"),
          }}
        />
      )}

      <LanguagePicker
        current={locale}
        back="/dashboard/account"
        labels={{
          title: t("languageTitle"),
          text: t("languageText"),
          dutch: t("languageDutch"),
          english: t("languageEnglish"),
        }}
      />

      {/* The sidebar has a sign-out too, but it is off screen on a phone —
          the bottom bar has no room for it, so this is the one that matters. */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-heading">{t("signOutTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("signOutText")}</p>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <LogOut size={15} aria-hidden="true" />
            {t("signOut")}
          </button>
        </form>
      </Card>
    </div>
  );
}
