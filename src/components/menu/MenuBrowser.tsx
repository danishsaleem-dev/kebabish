"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  EyeOff,
  Flame,
  Leaf,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/public-menu";

type Toggle = "vegetarian" | "spicy" | "hideSoldOut";

/**
 * The full menu with client-side filtering. Everything renders unfiltered
 * on the server first, so a crawler still sees every dish (SEO is priority
 * #1) — the filters only ever narrow what's already in the HTML.
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return categories
      .filter((c) => category === "all" || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items.filter((item) => {
          if (q && !matches(item, q)) return false;
          if (toggles.vegetarian && !item.vegetarian) return false;
          if (toggles.spicy && !item.spicy) return false;
          if (toggles.hideSoldOut && item.soldOut) return false;
          return true;
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, category, toggles]);

  const count = filtered.reduce((sum, c) => sum + c.items.length, 0);
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

  // Drives the little count badge on the collapsed mobile button, so the
  // number of hidden-away active filters is visible without opening it.
  const activeToggleCount = Object.values(toggles).filter(Boolean).length;
  const mobileBadge = activeToggleCount + (category === "all" ? 0 : 1);
  const categoryLabel =
    categories.find((c) => c.id === category)?.label ?? t("categoryLabel");

  return (
    <div>
      {/* ---- filters ---------------------------------------------------- */}
      <div className="mt-10 space-y-4">
        {/* One row: search stays compact, the filters sit beside it. On a
            phone they collapse behind a single button so the row never
            wraps and the dishes stay near the top of the screen. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
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

          <div className="hidden items-center gap-2 sm:flex">
            <Dropdown label={categoryLabel} active={category !== "all"}>
              {(close) => (
                <div role="radiogroup" aria-label={t("categoryLabel")}>
                  <OptionRow
                    role="radio"
                    checked={category === "all"}
                    onSelect={() => {
                      setCategory("all");
                      close();
                    }}
                  >
                    {t("allCategories")}
                  </OptionRow>
                  {categories.map((c) => (
                    <OptionRow
                      key={c.id}
                      role="radio"
                      checked={category === c.id}
                      onSelect={() => {
                        setCategory(c.id);
                        close();
                      }}
                    >
                      {c.label}
                    </OptionRow>
                  ))}
                </div>
              )}
            </Dropdown>

            <Dropdown
              label={t("filtersLabel")}
              active={activeToggleCount > 0}
              badge={activeToggleCount}
              icon={<SlidersHorizontal size={15} aria-hidden="true" />}
            >
              {() => (
                <div role="group" aria-label={t("filtersLabel")}>
                  {toggleOptions.map(({ key, label, icon: Icon }) => (
                    <OptionRow
                      key={key}
                      role="checkbox"
                      checked={toggles[key]}
                      onSelect={() => toggle(key)}
                    >
                      <Icon size={14} aria-hidden="true" className="text-ink/45" />
                      {label}
                    </OptionRow>
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          {/* Mobile: one button for everything, with a count of what's on. */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="menu-filter-panel"
            className={`relative flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 font-display text-sm font-semibold transition-colors sm:hidden ${
              mobileFiltersOpen || mobileBadge > 0
                ? "border-ember-600 bg-ember-600 text-cream-50"
                : "border-charcoal-600/20 bg-cream-50 text-charcoal-600/80"
            }`}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            {t("filtersLabel")}
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
            className="rounded-2xl border border-charcoal-600/15 bg-cream-50 p-4 sm:hidden"
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

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-5 w-full rounded-full bg-charcoal-600 py-2.5 font-display text-sm font-semibold text-cream-100"
            >
              {t("closeFilters")}
            </button>
          </div>
        )}

        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 text-sm text-ink/60"
        >
          <span>{t("resultCount", { count })}</span>
          {isFiltered && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 font-semibold text-ember-600 hover:text-ember-500"
            >
              <X size={14} aria-hidden="true" />
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* ---- results ---------------------------------------------------- */}
      {count === 0 ? (
        <p className="mt-16 text-center text-base text-ink/60">
          {t("noResults")}
        </p>
      ) : (
        <div className="mt-10 space-y-16">
          {filtered.map((c) => (
            <section key={c.id} id={c.id}>
              <h2 className="font-display text-2xl font-semibold text-charcoal-600">
                {c.label}
              </h2>
              {c.description && (
                <p className="mt-1.5 text-sm text-ink/55">{c.description}</p>
              )}
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {c.items.map((item) => (
                  <FeaturedDishCard
                    key={item.slug}
                    item={item}
                    addLabel={t("addToOrder")}
                    priceOnRequestLabel={t("priceOnRequest")}
                    vegetarianLabel={t("vegetarian")}
                    soldOutLabel={t("soldOut")}
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
  );
}

function matches(item: PublicMenuItem, q: string) {
  if (item.name.toLowerCase().includes(q)) return true;
  return item.variants.some((v) => v.toLowerCase().includes(q));
}

/**
 * A small popover menu. Children are a render function so an option can
 * close the panel after picking (the category list does; the toggles
 * deliberately don't, since you often want more than one).
 */
function Dropdown({
  label,
  active,
  badge,
  icon,
  children,
}: {
  label: string;
  active: boolean;
  badge?: number;
  icon?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex h-12 items-center gap-2 whitespace-nowrap rounded-full border px-4 font-display text-sm font-semibold transition-colors ${
          active || open
            ? "border-ember-600 text-ember-700"
            : "border-charcoal-600/20 text-charcoal-600/80 hover:border-charcoal-600/45"
        }`}
      >
        {icon}
        {label}
        {badge ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-600 px-1 text-xs font-bold text-cream-50">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 min-w-56 overflow-hidden rounded-2xl border border-charcoal-600/15 bg-cream-50 py-1.5 shadow-xl shadow-charcoal-950/10">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** One line inside a Dropdown — a radio (pick one) or a checkbox (pick any). */
function OptionRow({
  role,
  checked,
  onSelect,
  children,
}: {
  role: "radio" | "checkbox";
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ember-600/8 ${
        checked ? "font-semibold text-ember-700" : "text-ink/75"
      }`}
    >
      {children}
      <Check
        size={15}
        aria-hidden="true"
        className={`ml-auto shrink-0 ${checked ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}

function Chip({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClasses = accent
    ? "border-ember-600 bg-ember-600 text-cream-50"
    : "border-charcoal-600 bg-charcoal-600 text-cream-100";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 font-display text-sm font-semibold transition-colors duration-300 ${
        active
          ? activeClasses
          : "border-charcoal-600/20 text-charcoal-600/75 hover:border-charcoal-600/45 hover:text-charcoal-600"
      }`}
    >
      {children}
    </button>
  );
}
