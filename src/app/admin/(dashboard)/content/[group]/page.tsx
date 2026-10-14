import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import ContentEditor from "@/components/admin/content/ContentEditor";
import SetupCard from "@/components/admin/content/SetupCard";
import { DEFAULT_MESSAGES } from "@/lib/content/defaults";
import { getPath, type ContentValue } from "@/lib/content/model";
import { GROUPS, groupFor } from "@/lib/content/registry";
import type { EditorSection } from "@/lib/content/editor-types";
import { ContentSetupError, listOverrides, type OverrideRow } from "@/lib/content/store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const group = groupFor((await params).group);
  return { title: group ? `Edit: ${group.title}` : "Website content" };
}

export default async function ContentGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const group = groupFor((await params).group);
  if (!group) notFound();

  let rows: OverrideRow[];
  try {
    rows = await listOverrides();
  } catch (error) {
    if (error instanceof ContentSetupError) {
      return (
        <AdminShell title={group.title}>
          <SetupCard />
        </AdminShell>
      );
    }
    throw error;
  }
  const byId = new Map(rows.map((r) => [`${r.key}|${r.locale}`, r]));

  const sections: EditorSection[] = group.sections.map((section) => ({
    id: section.id,
    title: section.title,
    where: section.where,
    fields: section.fields.map((f) => {
      const row = (locale: "nl" | "en") => byId.get(`${f.key}|${locale}`);
      const meta = (locale: "nl" | "en") => {
        const r = row(locale);
        return r ? { at: r.updatedAt, by: r.updatedBy } : undefined;
      };
      return {
        key: f.key,
        label: f.label,
        kind: f.kind,
        hint: f.hint,
        max: f.max,
        maxItems: f.maxItems,
        seo: f.seo,
        defaults: {
          nl: getPath(DEFAULT_MESSAGES.nl, f.key) as ContentValue,
          en: getPath(DEFAULT_MESSAGES.en, f.key) as ContentValue,
        },
        saved: {
          nl: (row("nl")?.value as ContentValue | undefined) ?? null,
          en: (row("en")?.value as ContentValue | undefined) ?? null,
        },
        meta: { nl: meta("nl"), en: meta("en") },
      };
    }),
  }));

  return (
    <AdminShell title={group.title}>
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/content"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-heading"
        >
          <ChevronLeft size={16} />
          All website content
        </Link>
        <p className="mb-5 max-w-3xl text-sm text-muted">{group.description}</p>
        <ContentEditor sections={sections} viewPath={group.path} />
      </div>
    </AdminShell>
  );
}
