import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { verifyResetToken } from "@/lib/password-reset";
import ResetPasswordForm from "@/components/shared/ResetPasswordForm";
import AuthFrame from "@/components/shared/AuthFrame";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const account = token ? await verifyResetToken(token) : null;

  if (!token || !account) {
    return (
      <AuthFrame title="This link doesn't work">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warn-soft text-warn">
            <LinkIcon size={20} />
          </span>
          <p className="text-sm leading-relaxed text-body-text">
            It has expired, was already used, or isn&apos;t complete. Reset links work
            once, for 60 minutes.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            Get a new link
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return <ResetPasswordForm token={token} />;
}
