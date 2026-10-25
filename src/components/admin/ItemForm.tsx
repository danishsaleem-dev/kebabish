"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Boxes, Scale } from "lucide-react";
import {
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/admin/ui/Form";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import GalleryField from "@/components/admin/media/GalleryField";
import VideoField from "@/components/admin/media/VideoField";
import RecipeForm from "@/components/admin/RecipeForm";
import type {
  StoredAllergen,
  StoredCategory,
  StoredIngredient,
  StoredItem,
  StoredMedia,
  StoredOptionGroup,
  StoredRecipe,
} from "@/lib/admin/store/types";
import { PAIRS_LIMIT } from "@/lib/admin/store/types";
import { DEFAULT_LOW_THRESHOLD, stockLevel, type StockEntry } from "@/lib/stock-status";
import StockBadge from "@/components/admin/StockBadge";

const EMPTY: FormState = { ok: false };

/**
 * One page for everything about a dish — details, images, extras and (once
 * it exists) its recipe — laid out WordPress-style: the wide left column is
 * the dish's actual content, the narrow right column is its metadata
 * (category, allergens, slug, tags, status). Two separate <form>s live on
 * this one page (dish details and recipe save independently — different
 * server actions, different data), not one giant form; visually they read
 * as a single editing surface.
 *
 * This replaced a flow that sent a brand-new dish to a *different* screen
 * just to pick its recipe, and sent every click on an existing dish
 * straight to a recipe-only page with no visible name, price, category or
 * photo — see CLAUDE.md.
 */
export default function ItemForm({
  action,
  categories,
  item,
  library,
  optionGroups,
  allergens,
  dishes = [],
  recipe,
  ingredients,
  recipeAction,
  stock,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categories: StoredCategory[];
  item?: StoredItem;
  library: StoredMedia[];
  optionGroups: StoredOptionGroup[];
  allergens: StoredAllergen[];
  /** The other dishes, for the "often bought with" picker. */
  dishes?: { slug: string; name: string }[];
  recipe?: StoredRecipe;
  ingredients?: StoredIngredient[];
  recipeAction?: (prev: FormState, formData: FormData) => Promise<FormState>;
  /**
   * Stock for this dish: `setUp` is false until migration 0022 has been run (the card then says so),
   * `entry` is its quantity and warning level, or null when it doesn't track stock.
   */
  stock?: { setUp: boolean; entry: StockEntry | null };
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};
  const [trackStock, setTrackStock] = useState(Boolean(stock?.entry));
  const [stockQty, setStockQty] = useState(String(stock?.entry?.quantity ?? ""));
  const [stockLow, setStockLow] = useState(String(stock?.entry?.lowThreshold ?? DEFAULT_LOW_THRESHOLD));
  const liveStock =
    trackStock && /^\d+$/.test(stockQty) && /^\d+$/.test(stockLow)
      ? { quantity: Number(stockQty), lowThreshold: Number(stockLow) }
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* ---- main column -------------------------------------------- */}
      <div className="space-y-5">
        <form id="item-form" action={formAction} className="space-y-5">
          {item && <input type="hidden" name="slug" value={item.slug} />}
          <FormError message={state.message} />

          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Dish name (Dutch)"
                error={e.name}
                hint="The main name. Orders and the kitchen always use this one."
              >
                <Input
                  name="name"
                  defaultValue={item?.name}
                  placeholder="Kip Biryani"
                  invalid={Boolean(e.name)}
                  required
                />
              </Field>
              <Field
                label="Dish name (English)"
                error={e.nameEn}
                hint="Shown on the English site. Leave empty to use the Dutch name."
              >
                <Input
                  name="nameEn"
                  defaultValue={item?.nameEn ?? ""}
                  placeholder="Chicken Biryani"
                  invalid={Boolean(e.nameEn)}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Portion" error={e.portion} hint="Optional, e.g. 500 g or 4 stuks. Shown next to the price.">
                <Input
                  name="portion"
                  defaultValue={item?.portion ?? ""}
                  placeholder="500 g"
                  maxLength={40}
                  invalid={Boolean(e.portion)}
                />
              </Field>

              <Field label="Price (€)" error={e.price} hint='Leave empty to show "price on request".'>
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item?.price ?? ""}
                  placeholder="12.50"
                  invalid={Boolean(e.price)}
                />
              </Field>

              <Field
                label="Variants"
                error={e.variants}
                hint="Comma separated, e.g. Mango, Banana, Strawberry"
              >
                <Input
                  name="variants"
                  defaultValue={item?.variants.join(", ")}
                  placeholder="Mango, Banana, Strawberry"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Description"
              subtitle="Shown on the dish's page and in Google's search result. A sentence or two is plenty."
            />
            <div className="mt-4 space-y-4">
              <Field label="Description (Dutch)" error={e.description}>
                <Textarea
                  name="description"
                  rows={4}
                  maxLength={1500}
                  defaultValue={item?.description ?? ""}
                  placeholder="Langzaam gegaard kippenvlees in een rijke, gekruide saus, geserveerd met…"
                  invalid={Boolean(e.description)}
                />
              </Field>
              <Field
                label="Description (English)"
                error={e.descriptionEn}
                hint="Leave empty to show the Dutch description on the English site."
              >
                <Textarea
                  name="descriptionEn"
                  rows={4}
                  maxLength={1500}
                  defaultValue={item?.descriptionEn ?? ""}
                  placeholder="Slow-cooked chicken in a rich, spiced sauce, served with…"
                  invalid={Boolean(e.descriptionEn)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Gallery" />
            <div className="mt-4">
              <GalleryField library={library} initialIds={item?.imageIds ?? []} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Video"
              subtitle="Optional. Shown under the photo on the dish's page."
            />
            <div className="mt-4">
              <VideoField initialUrl={item?.videoUrl ?? ""} />
              {e.videoUrl && (
                <p className="mt-2 text-xs font-medium text-danger">{e.videoUrl}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Extras" />
            {optionGroups.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No extras groups yet.{" "}
                <Link
                  href="/admin/menu/extras/new"
                  className="font-semibold text-ember-600 hover:text-ember-500"
                >
                  Create one
                </Link>{" "}
                and it can be offered with this dish.
              </p>
            ) : (
              <>
                <p className="mb-3 mt-1 text-sm text-muted">
                  Tick the groups customers can add to this dish.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {optionGroups.map((group) => (
                    <Checkbox
                      key={group.id}
                      name="optionGroupIds"
                      value={group.id}
                      label={`${group.label} (${group.options.length})`}
                      defaultChecked={item?.optionGroupIds?.includes(group.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </Card>

          <div className="flex justify-end">
            <SubmitButton>{item ? "Save dish" : "Create dish"}</SubmitButton>
          </div>
        </form>

        {item && (
          <Card id="recipe">
            <CardHeader
              title="Recipe"
              subtitle="Costs, yield and allergens update live as you type."
              action={
                recipe && (
                  <Link
                    href={`/admin/menu/recipes/${item.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember-600 hover:text-ember-500"
                  >
                    <Scale size={14} />
                    View cost &amp; calculator
                  </Link>
                )
              }
            />
            <div className="mt-4">
              {recipeAction && ingredients ? (
                <RecipeForm
                  action={recipeAction}
                  slug={item.slug}
                  itemName={item.name}
                  sellPrice={item.price}
                  ingredients={ingredients}
                  allergens={allergens}
                  recipe={recipe}
                />
              ) : (
                <p className="text-sm text-muted">Recipe unavailable.</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* ---- sidebar --------------------------------------------------- */}
      <aside className="space-y-5">
        <Card>
          <CardHeader title="Organize" />
          <div className="mt-4 space-y-4">
            <Field label="Category" error={e.categoryId}>
              <Select
                name="categoryId"
                form="item-form"
                defaultValue={item?.categoryId ?? categories[0]?.id}
                invalid={Boolean(e.categoryId)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Spice level"
              hint="Shown on the dish as chillies, and used by the spice guide on the homepage."
            >
              <Select
                name="spiceLevel"
                form="item-form"
                defaultValue={
                  item?.spiceLevel !== undefined
                    ? String(item.spiceLevel)
                    : item?.spicy
                      ? "legacy"
                      : "0"
                }
              >
                <option value="0">Not spicy</option>
                <option value="1">Mild — one chilli</option>
                <option value="2">Medium — two chillies</option>
                <option value="3">Hot — three chillies</option>
                {item?.spicy && item.spiceLevel === undefined && (
                  <option value="legacy">Spicy — pick a level</option>
                )}
              </Select>
            </Field>

            <Field
              label="Tags"
              hint="Comma separated — your own labels, admin-side only. (Chef's pick is a tick under Status.)"
            >
              <Input
                name="tags"
                form="item-form"
                defaultValue={item?.tags.join(", ")}
                placeholder="Chef&apos;s pick, Popular"
              />
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-heading">
                Slug
              </span>
              {item ? (
                <p className="rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-sm text-muted">
                  /menu/{item.slug}
                </p>
              ) : (
                <p className="rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-sm text-muted">
                  Generated from the dish name once saved.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Allergens"
            subtitle="Flag these directly, ahead of or alongside a recipe."
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {allergens.map((allergen) => (
              <Checkbox
                key={allergen.id}
                name="allergenIds"
                form="item-form"
                value={allergen.id}
                label={allergen.label}
                defaultChecked={item?.allergenIds?.includes(allergen.id)}
              />
            ))}
          </div>
        </Card>

        {dishes.length > 0 && (
          <Card>
            <CardHeader
              title="Often bought with"
              subtitle={`Pick up to ${PAIRS_LIMIT} dishes that go well with this one. They are suggested first beside it, in the basket and at checkout; what you leave out is filled in from real orders.`}
            />
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {dishes.map((dish) => (
                <Checkbox
                  key={dish.slug}
                  name="pairsWith"
                  form="item-form"
                  value={dish.slug}
                  label={dish.name}
                  defaultChecked={item?.pairsWith?.includes(dish.slug)}
                />
              ))}
            </div>
            {e.pairsWith && <p className="mt-2 text-xs font-medium text-danger">{e.pairsWith}</p>}
          </Card>
        )}

        <Card>
          <CardHeader title="Status" />
          <div className="mt-4 space-y-2">
            <Checkbox
              name="visible"
              form="item-form"
              label="Show on website"
              defaultChecked={item?.visible ?? true}
            />
            <Checkbox
              name="featured"
              form="item-form"
              label="Featured on the homepage"
              defaultChecked={item?.featured}
            />
            {e.featured && (
              <p className="text-xs font-medium text-danger">{e.featured}</p>
            )}
            <Checkbox
              name="vegetarian"
              form="item-form"
              label="Vegetarian"
              defaultChecked={item?.vegetarian}
            />
            <Checkbox
              name="chefsPick"
              form="item-form"
              label="Chef's pick badge"
              defaultChecked={item?.chefsPick}
            />
            <p className="-mt-1 pl-6 text-xs text-muted">
              The “Bestseller” badge is never set by hand: it goes on the dishes ordered most in the last 30 days.
            </p>
            <Checkbox
              name="soldOut"
              form="item-form"
              label="Sold out"
              defaultChecked={item?.soldOut}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Stock" />
          {stock && !stock.setUp ? (
            <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Stock tracking isn&apos;t set up yet — run <code>supabase/migrations/0022_stock.sql</code> in the
              Supabase SQL editor, then reload.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <input type="hidden" name="stockPresent" value="1" form="item-form" />
              <Checkbox
                name="stockTrack"
                form="item-form"
                label="Track stock for this dish"
                checked={trackStock}
                onChange={(ev) => setTrackStock(ev.target.checked)}
              />
              {trackStock && (
                <>
                  <Field label="In stock now" hint="Portions, or the size of today's batch." error={e.stockQty}>
                    <Input
                      name="stockQty"
                      form="item-form"
                      inputMode="numeric"
                      value={stockQty}
                      onChange={(ev) => setStockQty(ev.target.value)}
                      invalid={Boolean(e.stockQty)}
                    />
                  </Field>
                  <Field
                    label="Warn me when it gets down to"
                    hint="At or below this, customers see “Selling fast” and you get an alert. 0 = no warning."
                    error={e.stockLow}
                  >
                    <Input
                      name="stockLow"
                      form="item-form"
                      inputMode="numeric"
                      value={stockLow}
                      onChange={(ev) => setStockLow(ev.target.value)}
                      invalid={Boolean(e.stockLow)}
                    />
                  </Field>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Boxes size={14} aria-hidden="true" />
                    <StockBadge level={stockLevel(liveStock)} quantity={liveStock?.quantity} />
                  </p>
                </>
              )}
              <p className="text-xs leading-relaxed text-muted">
                Every paid order takes its portions off the number, and a cancelled one puts them back. At 0 the
                dish shows as sold out — it stays on the menu and customers can ask for it. Customers never see
                the number.
              </p>
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
