import { redirect } from "next/navigation";
import { DatabaseZap } from "lucide-react";
import { auth, homeForRole } from "@/lib/auth";
import { countAdminUsers } from "@/lib/admin/auth-users";
import LoginForm from "@/components/shared/LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));
  const { email } = await searchParams;

  let userCount: number;
  try {
    userCount = await countAdminUsers();
  } catch {
    // Most likely cause: the admin_users migration hasn't been run against
    // this Supabase project yet. Fail with a clear, actionable message
    // rather than a raw stack trace or (worse) a false "0 users" that would
    // silently show the account-bootstrap form for a table that doesn't
    // exist — createAdminUser() would then fail confusingly on submit.
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="max-w-md rounded-2xl border border-hairline bg-panel p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <DatabaseZap size={22} />
          </span>
          <h1 className="mt-4 font-display text-lg font-semibold text-heading">
            Database isn&apos;t set up yet
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Couldn&apos;t reach the <code className="rounded bg-canvas px-1">admin_users</code>{" "}
            table in Supabase. Run{" "}
            <code className="rounded bg-canvas px-1">
              supabase/migrations/0001_admin_users.sql
            </code>{" "}
            (and{" "}
            <code className="rounded bg-canvas px-1">
              0002_customers.sql
            </code>
            ) in the Supabase SQL editor, then reload this page.
          </p>
        </div>
      </div>
    );
  }

  return <LoginForm isBootstrap={userCount === 0} defaultEmail={email} />;
}
