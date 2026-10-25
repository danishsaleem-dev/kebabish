import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * "You've paid — here is your account." The confirmation page sends the buyer here when
 * their order has just created their account; this signs them in through the
 * `order-access` sign-in (which re-checks every rule — a wrong or stale link simply
 * isn't accepted) and lands them on the dashboard with the new order in view.
 *
 * Whatever goes wrong, they go back to the confirmation page with `e=1`, which tells it
 * not to try again — so there is never a loop, and the order page always works.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const back = url.searchParams.get("locale") === "en" ? "/en" : "";
  const fallback = new URL(
    `${back}/checkout/complete?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}&e=1`,
    url.origin
  );

  try {
    // Throws a redirect (rethrown below) once the sign-in cookie is set.
    await signIn("order-access", {
      ref,
      token,
      redirectTo: `/dashboard?order=${encodeURIComponent(ref)}`,
    });
    return NextResponse.redirect(fallback);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.redirect(fallback);
    throw error; // the redirect itself
  }
}
