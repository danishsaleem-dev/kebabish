import { redirect } from "next/navigation";

/**
 * "Marketing" used to be a placeholder page promising campaigns and social
 * planning, with nothing behind it. The only real thing under it is promo codes,
 * so this just forwards there — which also keeps an old bookmark working.
 */
export default function MarketingPage() {
  redirect("/admin/marketing/promotions");
}
