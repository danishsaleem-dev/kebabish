import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, homeForRole } from "@/lib/auth";
import { authLocale, authPanel } from "@/lib/auth-page";
import AuthShell from "@/components/shared/AuthShell";
import SignupForm from "@/components/shared/SignupForm";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string; phone?: string; lang?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));
  const { name, email, phone, lang } = await searchParams;

  const locale = await authLocale(lang);
  const t = await getTranslations({ locale, namespace: "auth" });
  const panel = await authPanel(locale);
  const languages = (code: string) =>
    `/signup?${new URLSearchParams({
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      lang: code,
    })}`;

  return (
    <AuthShell
      locale={locale}
      title={t("signupTitle")}
      subtitle={panel.card ? t("signupSubtitle") : t("signupSubtitlePlain")}
      panel={panel}
      backLabel={t("backToSite")}
      languages={{ nl: languages("nl"), en: languages("en") }}
    >
      <SignupForm
        locale={locale}
        defaultName={name}
        defaultEmail={email}
        defaultPhone={phone}
        labels={{
          name: t("name"),
          email: t("email"),
          phone: t("phone"),
          phoneHint: t("phoneHint"),
          password: t("password"),
          passwordHint: t("passwordHint"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          marketing: t("marketing"),
          marketingHint: t("marketingHint"),
          createAccount: t("createAccount"),
          haveAccount: t("haveAccount"),
          signInLink: t("signInLink"),
        }}
      />
    </AuthShell>
  );
}
