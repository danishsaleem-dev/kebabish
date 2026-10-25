import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A sign-in that is no longer valid (its account has since had a password chosen, it
 * expired, or the account is gone) has to be *cleared*, not just refused: /login sends
 * anyone who looks signed in straight back to their dashboard, which would bounce them
 * here again forever. So the dashboard sends them through here, which drops the cookie
 * and shows the sign-in page with a short explanation.
 */
export async function GET(request: Request) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login?notice=session-ended", request.url));
}
