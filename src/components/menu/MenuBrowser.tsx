"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  EyeOff,
  Flame,
  Leaf,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/public-menu";
import SpiceMeter from "@/components/menu/SpiceMeter";
import ReorderCard from "@/components/reorder/ReorderCard";

type Toggle = "vegetarian" | "spicy" | "hideSoldOut";

/**
 * The full menu with client-side filtering. Everything renders unfiltered
 * on the server first, so a crawler still sees every dish (SEO is priority
 * #1) — the filters only ever narrow what's already in the HTML.
 *
 * Two presentations of the same state, chosen by width:
 *
 * - **Desktop (lg+)** gets a sticky sidebar — search, categories as a list
 *   with live counts, dietary toggles — with the dishes alone on the right.
 *   The filters used to sit in dropdowns beside the search bar, which hid
 *   the categories behind a click and wasted the whole left gutter.
 * - **Narrower** keeps the compact row: search plus one filters button that
 *   opens a panel of chips, so the dishes stay near the top of a phone
 *   screen rather than being pushed below a tall column of controls.
 *
 * Categories arrive with their labels already resolved by the server,
 * since the six original ones are translated while any category Danish
 * adds in /admin has only the label he typed.
 */
export default function MenuBrowser({
  categories,
  isOpen,
}: {
  categories: PublicMenuCategory[];
  isOpen: boolean;
}) {
  const t = useTranslations("menu");
  const tStatus = useTranslations("status");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [toggles, setToggles] = useState<Record<Toggle, boolean>>({
    vegetarian: false,
    spicy: false,
    hideSoldOut: false,
  });

  const toggle = (key: Toggle) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  /** Everything except the category filter, so each category can be counted. */
  const passesToggles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (item: PublicMenuItem) => {
      if (q && !matches(item, q)) return false;
      if (toggles.vegetarian && !item.vegetarian) return false;
      if (toggles.spicy && !item.spicy) return false;
      if (toggles.hideSoldOut && item.soldOut) return false;
      return true;
    };
  }, [query, toggles]);

  const filtered = useMemo(
    () =>
      categories
        .filter((c) => category === "all" || c.id === category)
        .map((c) => ({ ...c, items: c.items.filter(passesToggles) }))
        .filter((c) => c.items.length > 0),
    [categories, category, passesToggles]
  );

  // The number each category would show under the *other* filters — so the
  // sidebar can say "Kebabs 4" and grey out one that nothing matches,
  // instead of letting someone click into an empty result.
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) {
      counts.set(c.id, c.items.filter(passesToggles).length);
    }
    return counts;
  }, [categories, passesToggles]);

  const count = filtered.reduce((sum, c) => sum + c.items.length, 0);
  const totalShown = [...countsByCategory.values()].reduce((a, b) => a + b, 0);
  const isFiltered =
    query.trim() !== "" ||
    category !== "all" ||
    toggles.vegetarian ||
    toggles.spicy ||
    toggles.hideSoldOut;

  const clear = () => {
    setQuery("");
    setCategory("all");
    setToggles({ vegetarian: false, spicy: false, hideSoldOut: false });
  };

  const toggleOptions: { key: Toggle; label: string; icon: typeof Leaf }[] = [
    { key: "vegetarian", label: t("vegetarian"), icon: Leaf },
    { key: "spicy", label: t("spicy"), icon: Flame },
    { key: "hideSoldOut", label: t("hideSoldOut"), icon: EyeOff },
  ];

  // Drives the little count badge on the collapsed button, so the number of
  // hidden-away active filters is visible without opening it.
  const activeToggleCount = Object.values(toggles).filter(Boolean).length;
  const mobileBadge = activeToggleCount + (category === "all" ? 0 : 1);

  const searchField = (
    <label className="relative block">
      <span className="sr-only">{t("searchLabel")}</span>
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-12 w-full rounded-full border border-charcoal-600/15 bg-cream-50 pl-11 pr-4 text-base text-ink placeholder:text-ink/40 focus:border-ember-600 focus:outline-none"
      />
    </label>
  );

  return (
    <div className="mt-10 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      {/* ---- desktop sidebar -------------------------------------------- */}
      <aside className="hidden lg:sticky lg:top-28 lg:block">
        <div className="rounded-3xl border border-charcoal-600/12 bg-cream-50 p-5">
          {searchField}

          <nav className="mt-6" aria-label={t("categoryLabel")}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-charcoal-600/55">
              {t("categoryLabel")}
            </p>
            <ul role="radiogroup" aria-label={t("categoryLabel")} className="mt-3 space-y-0.5">
              <li>
                <CategoryRow
                  label={t("allCategories")}
                  count={totalShown}
                  active={category === "all"}
                  onSelect={() => setCategory("all")}
                />
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <CategoryRow
                    label={c.label}
                    count={countsByCategory.get(c.id) ?? 0}
                    active={category === c.id}
                    onSelect={() => setCategory(c.id)}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6 border-t border-charcoal-600/10 pt-5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-charcoal-600/55">
              {t("filtersLabel")}
            </p>
            <div role="group" aria-label={t("filtersLabel")} className="mt-3 space-y-0.5">
              {toggleOptions.map(({ key, label, icon: Icon }) => (
                <FilterRow
                  key={key}
                  label={label}
                  icon={<Icon size={15} aria-hidden="true" />}
                  checked={toggles[key]}
                  onToggle={() => toggle(key)}
                />
              ))}
            </div>
          </div>

          <SpiceLegend className="mt-6 border-t border-charcoal-600/10 pt-5" />

          {isFiltered && (
            <button
              type="button"
              onClick={clear}
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-charcoal-600/15 py-2.5 text-sm font-semibold text-charcoal-600 transition-colors hover:border-ember-600/50 hover:text-ember-700"
            >
              <X size={14} aria-hidden="true" />
              {t("clearFilters")}
            </button>
          )}
        </div>
      </aside>

      {/* ---- results (and the compact controls above them) -------------- */}
      <div className="min-w-0">
        <ReorderCard variant="compact" className="mb-5" />

        <div className="space-y-4 lg:hidden">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">{searchField}</div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="menu-filter-panel"
              className={`relative flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 font-display text-sm font-semibold transition-colors ${
                mobileFiltersOpen || mobileBadge > 0
                  ? "border-ember-600 bg-ember-600 text-cream-50"
                  : "border-charcoal-600/20 bg-cream-50 text-charcoal-600/80"
              }`}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span className="hidden sm:inline">{t("filtersLabel")}</span>
              {mobileBadge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cream-50 px-1 text-xs font-bold text-ember-700">
                  {mobileBadge}
                </span>
              )}
            </button>
          </div>

          {mobileFiltersOpen && (
            <div
              id="menu-filter-panel"
              className="rounded-2xl border border-charcoal-600/15 bg-cream-50 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-charcoal-600/60">
                {t("categoryLabel")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Chip active={category === "all"} onClick={() => setCategory("all")}>
                  {t("allCategories")}
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    active={category === c.id}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-charcoal-600/60">
                {t("filtersLabel")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {toggleOptions.map(({ key, label, icon: Icon }) => (
                  <Chip key={key} active={toggles[key]} onClick={() => toggle(key)} accent>
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </Chip>
                ))}
              </div>

              <SpiceLegend className="mt-5" />

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-5 w-full rounded-full bg-charcoal-600 py-2.5 font-display text-sm font-semibold text-cream-100"
              >
                {t("closeFilters")}
              </button>
            </div>
          )}
        </div>

        <div
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink/60 lg:mt-0"
        >
          <span>{t("resultCount", { count })}</span>
          {isFiltered && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 font-semibold text-ember-600 hover:text-ember-500 lg:hidden"
            >
              <X size={14} aria-hidden="true" />
              {t("clearFilters")}
            </button>
          )}
        </div>

        {count === 0 ? (
          <p className="mt-16 text-center text-base text-ink/60">{t("noResults")}</p>
        ) : (
          <div className="mt-6 space-y-14">
            {filtered.map((c) => (
              // scroll-mt clears the sticky header when the homepage's
              // category cards link straight to one of these anchors.
              <section key={c.id} id={c.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl font-semibold text-charcoal-600">
                  {c.label}
                </h2>
                {c.description && (
                  <p className="mt-1.5 text-sm text-ink/55">{c.description}</p>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {c.items.map((item) => (
                    <FeaturedDishCard
                      key={item.slug}
                      item={item}
                      addLabel={t("addToOrder")}
                      priceOnRequestLabel={t("priceOnRequest")}
                      vegetarianLabel={t("vegetarian")}
                      soldOutLabel={t("soldOut")}
                      lowStockLabel={t("lowStock")}
                      isOpen={isOpen}
                      unavailableLabel={tStatus("menuUnavailable")}
                      reveal={false}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The spice scale in one glance, so the chillies on the cards mean something. */
function SpiceLegend({ className = "" }: { className?: string }) {
  const t = useTranslations("menu");
  return (
    <div className={className}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-charcoal-600/55">
        {t("spiceScale")}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 lg:flex-col">
        {[1, 2, 3].map((level) => (
          <li key={level}>
            <SpiceMeter level={level} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function matches(item: PublicMenuItem, q: string) {
  if (item.name.toLowerCase().includes(q)) return true;
  return item.variants.some((v) => v.toLowerCase().includes(q));
}

/** One category in the sidebar: name, how many it would show, selected state. */
function CategoryRow({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const empty = count === 0;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      disabled={empty && !active}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-ember-600/10 font-semibold text-ember-700"
          : empty
            ? "cursor-not-allowed text-ink/30"
            : "text-ink/75 hover:bg-charcoal-600/5 hover:text-charcoal-600"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span
        className={`shrink-0 text-xs tabular-nums ${
          active ? "text-ember-700" : "text-ink/40"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** One dietary toggle in the sidebar, as a real checkbox for assistive tech. */
function FilterRow({
  label,
  icon,
  checked,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink/75 transition-colors hover:bg-charcoal-600/5 hover:text-charcoal-600"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "border-ember-600 bg-ember-600 text-cream-50"
            : "border-charcoal-600/25 text-transparent"
        }`}
      >
        <Check size={13} strokeWidth={3} />
      </span>
      <span
        className={`flex min-w-0 items-center gap-2 ${
          checked ? "font-semibold text-charcoal-600" : ""
        }`}
      >
        <span className="text-ink/45">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}

function Chip({
  children,
  active,
  accent,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 font-display text-sm font-semibold transition-colors duration-300 ${
        active
          ? accent
            ? "border-ember-600 bg-ember-600 text-cream-50"
            : "border-charcoal-600 bg-charcoal-600 text-cream-100"
          : "border-charcoal-600/20 bg-cream-50 text-charcoal-600/80 hover:border-charcoal-600/45"
      }`}
    >
      {children}
    </button>
  );
}
