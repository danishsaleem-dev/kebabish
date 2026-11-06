import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, homeForRole } from "@/lib/auth";
import { isCustomerSessionValid } from "@/lib/customers/session";
import { accountLocale } from "@/lib/account-page";
import { customerOrders, customerProfile, customerRewards, liveOrders } from "@/lib/account-data";
import { poppins, bitter } from "@/lib/fonts";
import AppShellBody from "@/components/shared/AppShellBody";
import AccountShell from "@/components/dashboard/AccountShell";
import type { NavItem } from "@/components/dashboard/AccountNav";
import "../globals.css";

export const metadata: Metadata = {
  title: "My account | Kebabish",
  robots: { index: false, follow: false },
};

/**
 * Customer-only. A staff/owner session landing here (e.g. an old bookmark)
 * bounces to /admin instead of seeing the customer view — the two are kept
 * strictly separate, same as the reverse case in
 * admin/(dashboard)/layout.tsx.
 *
 * It also owns the chrome for all four pages (overview, orders, points,
 * account), so each page is just its own content.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "customer") redirect(homeForRole(session.user.role));
  // A sign-in the account has since outlived (a password was chosen, it expired, the account
  // is gone) is cleared, not just refused — see /api/account/session-ended.
  if (!(await isCustomerSessionValid(session))) redirect("/api/account/session-ended");

  const user = session.user;
  const locale = await accountLocale(user.id);
  const t = await getTranslations({ locale, namespace: "account" });

  // Shared with the page below through React's `cache`, so this costs one
  // query each rather than two (see lib/account-data.ts).
  const [orders, profile, rewards] = await Promise.all([
    customerOrders(user.id),
    customerProfile(user.id),
    customerRewards(user.id),
  ]);

  const live = liveOrders(orders).length;
  const items: NavItem[] = [
    { key: "home", href: "/dashboard", label: t("navHome") },
    {
      key: "orders",
      href: "/dashboard/orders",
      label: t("navOrders"),
      // A live order is the one thing worth pulling someone back into the app for.
      ...(live > 0 ? { badge: live } : {}),
    },
    // No points programme, no tab — a section that would only ever say
    // "nothing here" is worse than not being offered.
    ...(rewards
      ? [{ key: "rewards" as const, href: "/dashboard/rewards", label: t("navRewards") }]
      : []),
    { key: "account", href: "/dashboard/account", label: t("navAccount") },
  ];

  return (
    <html lang={locale} className={`${poppins.variable} ${bitter.variable}`}>
      <body className="bg-canvas font-sans text-body-text antialiased">
        <AppShellBody>
          <AccountShell
            items={items}
            name={profile?.name ?? user.name ?? ""}
            email={user.email}
            labels={{
              menu: t("menuLabel"),
              backToSite: t("backToSite"),
              signOut: t("signOut"),
              orderCta: t("orderCta"),
            }}
          >
            {children}
          </AccountShell>
        </AppShellBody>
      </body>
    </html>
  );
}
