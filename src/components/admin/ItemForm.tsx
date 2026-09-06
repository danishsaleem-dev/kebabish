"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import {
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
} from "@/components/admin/ui/Form";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import GalleryField from "@/components/admin/media/GalleryField";
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
  recipe,
  ingredients,
  recipeAction,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categories: StoredCategory[];
  item?: StoredItem;
  library: StoredMedia[];
  optionGroups: StoredOptionGroup[];
  allergens: StoredAllergen[];
  recipe?: StoredRecipe;
  ingredients?: StoredIngredient[];
  recipeAction?: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* ---- main column -------------------------------------------- */}
      <div className="space-y-5">
        <form id="item-form" action={formAction} className="space-y-5">
          {item && <input type="hidden" name="slug" value={item.slug} />}
          <FormError message={state.message} />

          <Card>
            <Field label="Dish name" error={e.name}>
              <Input
                name="name"
                defaultValue={item?.name}
                placeholder="Chicken Biryani"
                invalid={Boolean(e.name)}
                required
              />
            </Field>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <CardHeader title="Gallery" />
            <div className="mt-4">
              <GalleryField library={library} initialIds={item?.imageIds ?? []} />
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
              label="Tags"
              hint="Comma separated — your own labels, e.g. Chef's pick, Spicy favourite."
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
              name="vegetarian"
              form="item-form"
              label="Vegetarian"
              defaultChecked={item?.vegetarian}
            />
            <Checkbox
              name="spicy"
              form="item-form"
              label="Spicy"
              defaultChecked={item?.spicy}
            />
            <Checkbox
              name="soldOut"
              form="item-form"
              label="Sold out"
              defaultChecked={item?.soldOut}
            />
          </div>
        </Card>
      </aside>
    </div>
  );
}
