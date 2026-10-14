import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import LayoutEditor from "@/components/admin/content/LayoutEditor";
import SetupCard from "@/components/admin/content/SetupCard";
import { getMediaByIds, getSettings } from "@/lib/admin/store";
import { LAYOUT_KEY, REVIEWS_KEY } from "@/lib/content/registry";
import { isDefaultLayout, resolveLayout } from "@/lib/content/model";
import { cleanReviews } from "@/lib/content/site";
import { ContentSetupError, listOverrides, type OverrideRow } from "@/lib/content/store";
import { reviews as shippedReviews } from "@/lib/reviews-data";

export const metadata = { title: "Homepage sections" };
export const dynamic = "force-dynamic";

export default async function HomepageLayoutPage() {
  let rows: OverrideRow[];
  try {
    rows = await listOverrides();
  } catch (error) {
    if (error instanceof ContentSetupError) {
      return (
        <AdminShell title="Homepage sections">
          <SetupCard />
        </AdminShell>
      );
    }
    throw error;
  }

  const shared = (key: string) => rows.find((r) => r.key === key && r.locale === "*")?.value;
  const layout = resolveLayout(shared(LAYOUT_KEY));

  // Sections that would render nothing right now, so the editor can say so
  // instead of letting "Shown" mislead.
  const empty: string[] = [];
  const settings = await getSettings();
  const photoIds = settings.galleryMediaIds ?? [];
  const photos = photoIds.length ? await getMediaByIds(photoIds) : [];
  if (photos.length === 0) empty.push("showcase");
  const reviewList = cleanReviews(shared(REVIEWS_KEY)) ?? shippedReviews;
  if (reviewList.length === 0) empty.push("testimonials");

  return (
    <AdminShell title="Homepage sections">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin/content"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-heading"
        >
          <ChevronLeft size={16} />
          All website content
        </Link>
        <LayoutEditor initial={layout} empty={empty} custom={!isDefaultLayout(layout)} />
      </div>
    </AdminShell>
  );
}
