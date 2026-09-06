import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  Clock,
  Pencil,
  Plus,
  Scale,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import ScaleCalculator from "@/components/admin/ScaleCalculator";
import {
  getItem,
  getRecipe,
  listAllergens,
  listCategories,
  listIngredients,
  listMedia,
} from "@/lib/admin/store";
import { analyseRecipe, indexIngredients } from "@/lib/admin/recipe-math";
import { formatMoney, formatQuantity } from "@/lib/admin/units";
import { GROUP_LABELS } from "@/lib/admin/ingredients";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getItem(slug);
  return { title: item?.name ?? "Recipe" };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, recipe, ingredients, allergenList, categories, media] =
    await Promise.all([
      getItem(slug),
      getRecipe(slug),
      listIngredients(),
      listAllergens(),
      listCategories(),
      listMedia(),
    ]);
  const allergenLabel = (id: string) =>
    allergenList.find((a) => a.id === id)?.label ?? id;
  if (!item) notFound();

  const category = categories.find((c) => c.id === item.categoryId);
  const featuredImage = item.imageIds[0]
    ? media.find((m) => m.id === item.imageIds[0])
    : undefined;

  const lookup = indexIngredients(ingredients);
  const a = recipe ? analyseRecipe(recipe, lookup, item.price) : null;
  const grouped = a
    ? [...new Set(a.lines.map((l) => l.ingredient.group))].map((group) => ({
        group,
        lines: a.lines.filter((l) => l.ingredient.group === group),
      }))
    : [];
  const gains = (a?.yieldFactor ?? 0) >= 1;

  return (
    <AdminShell title={item.name}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/menu"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
          >
            <ArrowLeft size={16} />
            Back to menu
          </Link>
          <Link
            href={`/admin/menu/items/${slug}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
          >
            <Pencil size={15} />
            Edit dish details
          </Link>
        </div>

        <Card className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas">
            {featuredImage ? (
              <Image
                src={featuredImage.url}
                alt={featuredImage.alt || item.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <Scale size={22} className="text-faint" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-heading">
              {item.name}
            </p>
            <p className="text-sm text-muted">
              {category?.label ?? "No category"}
              {item.soldOut && " · Sold out"}
            </p>
          </div>
          <p className="shrink-0 font-display text-lg font-semibold text-heading">
            {item.price != null ? formatMoney(item.price) : "Price not set"}
          </p>
        </Card>

        {!recipe || !a ? (
          <Card className="flex min-h-[380px] flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600">
              <Scale size={26} />
            </span>
            <h2 className="mt-5 font-display text-xl font-semibold text-heading">
              No recipe for {item.name} yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Add the ingredients and portion weight, and this dish joins the
              batch calculator and the production planner.
            </p>
            <Link
              href={`/admin/menu/items/${slug}/edit#recipe`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <Plus size={16} />
              Add recipe
            </Link>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader
                  title="Recipe overview"
                  subtitle={`As written this batch makes ${recipe.batchPortions} portions of ${recipe.portionWeightG} g.`}
                  action={
                    <Link
                      href={`/admin/menu/items/${slug}/edit#recipe`}
                      className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
                    >
                      <Pencil size={15} />
                      Edit
                    </Link>
                  }
                />

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Portion size" value={`${recipe.portionWeightG} g`} />
                  <Stat
                    label="Raw input"
                    value={formatQuantity(a.rawInputG, "mass")}
                    hint="edible ingredients"
                  />
                  <Stat
                    label="Plated total"
                    value={formatQuantity(a.platedWeightG, "mass")}
                    hint={`${recipe.batchPortions} portions`}
                  />
                  <Stat
                    label="Yield"
                    value={`${Math.round(a.yieldFactor * 100)}%`}
                    hint={gains ? "gains weight" : "loses weight"}
                    tone={gains ? "success" : "warn"}
                  />
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
                  <Scale size={15} className="mt-0.5 shrink-0 text-faint" />
                  <span>
                    {gains
                      ? "This dish ends up heavier than its raw ingredients — rice and pulses absorb water while cooking."
                      : "This dish ends up lighter than its raw ingredients — water boils off during cooking."}{" "}
                    Yield is calculated from what you enter, not guessed, so it
                    re-checks itself whenever you change a quantity.
                  </span>
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="text-faint" />
                    {recipe.prepMinutes} min prep
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="text-faint" />
                    {recipe.cookMinutes} min cook
                  </span>
                </div>
              </Card>

              <Card className="h-full">
                <CardHeader title="Cost & margin" />

                <dl className="mt-5 space-y-3">
                  <Row
                    label="Ingredient cost / batch"
                    value={formatMoney(a.costPerBatch)}
                  />
                  <Row
                    label="Ingredient cost / portion"
                    value={formatMoney(a.costPerPortion)}
                    strong
                  />
                  <Row
                    label="Selling price"
                    value={item.price != null ? formatMoney(item.price) : "Not set"}
                    muted={item.price == null}
                  />
                  <Row
                    label="Gross margin"
                    value={a.marginPct != null ? `${a.marginPct.toFixed(0)}%` : "—"}
                    muted={a.marginPct == null}
                    strong
                  />
                </dl>

                {item.price == null && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-xs leading-relaxed text-warn">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                    <span>
                      No selling price set yet, so margin can&apos;t be
                      calculated. Cost per portion is a good starting point for
                      pricing it.
                    </span>
                  </p>
                )}

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                    Allergens
                  </p>
                  {a.allergens.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      None declared by these ingredients.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {a.allergens.map((allergen) => (
                        <li
                          key={allergen}
                          className="rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-body-text"
                        >
                          {allergenLabel(allergen)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">
                    Rolled up automatically from the ingredient library. EU rules
                    require these to be declared to customers.
                  </p>
                </div>
              </Card>
            </div>

            <Card padded={false}>
              <div className="p-5 sm:p-6">
                <CardHeader
                  title="Ingredients"
                  subtitle={`${a.lines.length} lines · quantities for ${recipe.batchPortions} portions`}
                  action={
                    <Link
                      href={`/admin/menu/items/${slug}/edit#recipe`}
                      className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
                    >
                      <Plus size={15} />
                      Add ingredient
                    </Link>
                  }
                />
              </div>

              <div className="border-t border-hairline">
                {grouped.map(({ group, lines }) => (
                  <div key={group}>
                    <p className="bg-canvas/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-faint sm:px-6">
                      {GROUP_LABELS[group]}
                    </p>
                    <ul className="divide-y divide-hairline">
                      {lines.map((line) => (
                        <li
                          key={line.ingredient.id}
                          className="flex items-center gap-4 px-5 py-3.5 sm:px-6"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 truncate text-sm font-medium text-heading">
                              {line.ingredient.name}
                              {line.line.optional && (
                                <span className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
                                  optional
                                </span>
                              )}
                            </p>
                            {line.line.note && (
                              <p className="truncate text-xs text-muted">
                                {line.line.note}
                              </p>
                            )}
                          </div>
                          <p className="w-24 shrink-0 text-right font-display text-sm font-semibold text-heading">
                            {line.display}
                          </p>
                          <p className="hidden w-20 shrink-0 text-right text-sm text-muted sm:block">
                            {formatMoney(line.cost)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-ember-600" />
                <h2 className="font-display text-lg font-semibold text-heading">
                  Batch calculator
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Scale this recipe to any number of portions.
              </p>

              <div className="mt-5">
                <ScaleCalculator
                  recipe={recipe}
                  ingredients={ingredients}
                  portionLabel={`portions of ${recipe.portionWeightG} g`}
                />
              </div>
            </Card>

            {recipe.steps.length > 0 && (
              <Card>
                <CardHeader title="Method" />
                <ol className="mt-4 space-y-3">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas font-display text-xs font-semibold text-muted">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-body-text">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
                {recipe.notes && (
                  <p className="mt-4 rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
                    {recipe.notes}
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warn";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-heading";

  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`font-display font-semibold ${strong ? "text-lg" : "text-sm"} ${
          muted ? "text-faint" : "text-heading"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
