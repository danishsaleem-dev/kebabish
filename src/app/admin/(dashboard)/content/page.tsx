import Link from "next/link";
import { ArrowRight, FileText, Film, LayoutList, Lightbulb, Search, Star } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import SetupCard from "@/components/admin/content/SetupCard";
import { GROUPS, LAYOUT_KEY, MEDIA_KEY_PREFIX, REVIEWS_KEY } from "@/lib/content/registry";
import { ContentSetupError, listOverrides, type OverrideRow } from "@/lib/content/store";

export const metadata = { title: "Website content" };
export const dynamic = "force-dynamic";

export default async function ContentOverviewPage() {
  let rows: OverrideRow[];
  try {
    rows = await listOverrides();
  } catch (error) {
    if (error instanceof ContentSetupError) {
      return (
        <AdminShell title="Website content">
          <SetupCard />
        </AdminShell>
      );
    }
    throw error;
  }

  // How many fields of a group have been changed. A row per language counts
  // once per field, so "3 edited" means three fields, not six boxes.
  const editedFields = (groupId: string) => {
    const keys = new Set(
      GROUPS.find((g) => g.id === groupId)!.sections.flatMap((s) => s.fields.map((f) => f.key))
    );
    return new Set(rows.filter((r) => keys.has(r.key)).map((r) => r.key)).size;
  };

  const customLayout = rows.some((r) => r.key === LAYOUT_KEY);
  const customMedia = rows.filter((r) => r.key.startsWith(MEDIA_KEY_PREFIX)).length;
  const reviewRow = rows.find((r) => r.key === REVIEWS_KEY);
  const reviewCount = Array.isArray(reviewRow?.value) ? (reviewRow.value as unknown[]).length : 0;

  const tools = [
    {
      href: "/admin/content/homepage",
      icon: LayoutList,
      title: "Homepage sections",
      text: "Choose which sections appear on the homepage, and in what order.",
      badge: customLayout ? "Customised" : undefined,
    },
    {
      href: "/admin/content/media",
      icon: Film,
      title: "Images & videos",
      text: "Swap the homepage banner video, the story video and the About banner.",
      badge: customMedia ? `${customMedia} changed` : undefined,
    },
    {
      href: "/admin/content/reviews",
      icon: Star,
      title: "Reviews",
      text: "Add the quotes customers gave you. They appear on the homepage and the Reviews page.",
      badge: reviewCount ? `${reviewCount} added` : undefined,
    },
  ];

  const cardClass =
    "group flex h-full flex-col rounded-2xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-ember-500/40";
  const badgeClass = "rounded-full bg-ember-600/10 px-2.5 py-1 text-xs font-semibold text-ember-700";

  return (
    <AdminShell title="Website content">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="bg-canvas/60">
          <div className="flex items-start gap-3">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-ember-600" />
            <div className="max-w-3xl text-sm text-body-text">
              <h2 className="font-display text-base font-semibold text-heading">How this works</h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                <li>
                  Pick a page below. Every text on it has a Dutch box and an English box, with the original shown so
                  you can always see what you changed.
                </li>
                <li>
                  <strong>Save &amp; publish</strong> puts your changes on the website, usually within seconds and always within a minute. Each field keeps
                  a history, and <strong>Reset to default</strong> brings the original back.
                </li>
                <li>
                  If you only change the Dutch text, the English page keeps its own text (and the other way round).
                  Nothing is translated automatically.
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-heading">Page text</h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {GROUPS.map((group) => {
              const edited = editedFields(group.id);
              const Icon = group.id === "seo" ? Search : FileText;
              return (
                <Link key={group.id} href={`/admin/content/${group.id}`} className={cardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ember-600">
                      <Icon size={19} />
                    </span>
                    {edited > 0 && <span className={badgeClass}>{edited} edited</span>}
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-heading">{group.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted">{group.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ember-700">
                    Edit
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-heading">Layout, media &amp; reviews</h2>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {tools.map(({ href, icon: Icon, title, text, badge }) => (
              <Link key={href} href={href} className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ember-600">
                    <Icon size={19} />
                  </span>
                  {badge && <span className={badgeClass}>{badge}</span>}
                </div>
                <h3 className="mt-3 font-display text-base font-semibold text-heading">{title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ember-700">
                  Open
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
