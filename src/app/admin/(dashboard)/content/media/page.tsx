import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import MediaSlots, { type SlotView } from "@/components/admin/content/MediaSlots";
import SetupCard from "@/components/admin/content/SetupCard";
import { listMedia } from "@/lib/admin/store";
import { MEDIA_SLOTS, mediaKey, type SlotValue } from "@/lib/content/model";
import { shippedSlot } from "@/lib/content/site";
import { ContentSetupError, listOverrides, type OverrideRow } from "@/lib/content/store";

export const metadata = { title: "Images & videos" };
export const dynamic = "force-dynamic";

export default async function MediaContentPage() {
  let rows: OverrideRow[];
  try {
    rows = await listOverrides();
  } catch (error) {
    if (error instanceof ContentSetupError) {
      return (
        <AdminShell title="Images & videos">
          <SetupCard />
        </AdminShell>
      );
    }
    throw error;
  }
  const library = await listMedia();

  const slots: SlotView[] = MEDIA_SLOTS.map((slot) => {
    const stored = rows.find((r) => r.key === mediaKey(slot.id) && r.locale === "*")?.value;
    const override = stored && typeof stored === "object" ? (stored as SlotValue) : null;
    return {
      id: slot.id,
      label: slot.label,
      where: slot.where,
      kind: slot.kind,
      shape: slot.shape,
      advice: slot.advice,
      override,
      shipped: shippedSlot(slot.id),
      followsNote:
        slot.id === "aboutBanner"
          ? "Until you upload one, the About page plays the homepage's wide banner video."
          : undefined,
    };
  });

  return (
    <AdminShell title="Images & videos">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/content"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-heading"
        >
          <ChevronLeft size={16} />
          All website content
        </Link>
        <p className="mb-5 max-w-3xl text-sm text-muted">
          The videos and photos that dress the site. Upload a new one and it replaces the old one on the website within
          a minute; &ldquo;Go back to the original&rdquo; restores the file that came with the site. Dish photos, category
          photos and the homepage gallery are managed under Media and Settings.
        </p>
        <MediaSlots slots={slots} library={library} />
      </div>
    </AdminShell>
  );
}
