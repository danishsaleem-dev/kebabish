import { redirect } from "next/navigation";

// Unreachable in normal operation: the next-intl middleware rewrites "/"
// to the default-locale route (src/app/[locale]/page.tsx) before Next's
// router ever gets here. This is just a safety-net fallback.
export default function RootPage() {
  redirect("/");
}
