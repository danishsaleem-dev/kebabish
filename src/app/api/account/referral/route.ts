import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRewardsConfig } from "@/lib/rewards";
import { getReferralCode, referralLink, referralShareText } from "@/lib/referrals";
import { formatEuro, fromCents } from "@/lib/money";

/** The signed-in customer's own referral link. Anyone else gets a 404. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "customer") return new NextResponse(null, { status: 404 });

  const config = await getRewardsConfig();
  if (!config.enabled || !config.referralEnabled) return new NextResponse(null, { status: 404 });

  const code = await getReferralCode(session.user.id);
  if (!code) return new NextResponse(null, { status: 404 });

  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "nl";
  return NextResponse.json(
    {
      link: referralLink(code, locale),
      shareText: referralShareText(code, formatEuro(fromCents(config.referralFriendCents)), locale),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
