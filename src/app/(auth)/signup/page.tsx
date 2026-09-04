import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import SignupForm from "@/components/shared/SignupForm";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));

  return <SignupForm />;
}
