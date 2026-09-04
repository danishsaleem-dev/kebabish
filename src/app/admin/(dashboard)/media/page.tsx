import { TriangleAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import MediaLibrary from "@/components/admin/media/MediaLibrary";
import { listCategories, listItems, listMedia } from "@/lib/admin/store";

export const metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const [media, items, categories] = await Promise.all([
    listMedia(),
    listItems(),
    listCategories(),
  ]);

  // Where each image is used, so the detail panel can warn before deleting.
  const usage: Record<string, string[]> = {};
  for (const item of items) {
    for (const id of item.imageIds ?? []) {
      (usage[id] ??= []).push(item.name);
    }
  }
  for (const category of categories) {
    if (category.imageId) {
      (usage[category.imageId] ??= []).push(category.label);
    }
  }

  return (
    <AdminShell title="Media">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex items-start gap-3 border-warn/30 bg-warn-soft">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-sm leading-relaxed text-warn">
            <span className="font-semibold">Uploads are stored on disk</span> in{" "}
            <code className="rounded bg-warn/10 px-1">public/uploads</code>. That
            works locally but not on Vercel, whose filesystem is read-only —
            this moves to Supabase Storage alongside the rest of the data.
          </p>
        </Card>

        <MediaLibrary media={media} usage={usage} />
      </div>
    </AdminShell>
  );
}
