import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import ForgotPasswordForm from "@/components/shared/ForgotPasswordForm";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));
  return <ForgotPasswordForm />;
}
