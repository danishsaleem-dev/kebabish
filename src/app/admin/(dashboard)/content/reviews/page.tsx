import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ReviewsEditor from "@/components/admin/content/ReviewsEditor";
import SetupCard from "@/components/admin/content/SetupCard";
import { REVIEWS_KEY } from "@/lib/content/registry";
import { cleanReviews } from "@/lib/content/site";
import { ContentSetupError, listOverrides, type OverrideRow } from "@/lib/content/store";
import { reviews as shippedReviews } from "@/lib/reviews-data";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function ReviewsContentPage() {
  let rows: OverrideRow[];
  try {
    rows = await listOverrides();
  } catch (error) {
    if (error instanceof ContentSetupError) {
      return (
        <AdminShell title="Reviews">
          <SetupCard />
        </AdminShell>
      );
    }
    throw error;
  }

  const stored = rows.find((r) => r.key === REVIEWS_KEY && r.locale === "*")?.value;
  const reviews = cleanReviews(stored) ?? shippedReviews;

  return (
    <AdminShell title="Reviews">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin/content"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-heading"
        >
          <ChevronLeft size={16} />
          All website content
        </Link>
        <ReviewsEditor initial={reviews} />
      </div>
    </AdminShell>
  );
}
