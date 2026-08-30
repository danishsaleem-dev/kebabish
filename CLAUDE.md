# Kebabish — Project Context for Claude Code

Read this first. This is a real client project, not a demo. Follow it precisely.

## ⚠️ Read this before touching any visual design

The homepage, menu, and contact pages already exist and are functional,
but they are currently styled in **plain neutral gray/black/white
(Tailwind's default palette) on purpose** — there is no brand color, no
display font, no visual identity applied. An earlier attempt picked a
"warm terracotta/mustard/maroon" palette and a display typeface without
the client's input, and the client explicitly rejected it and had it
stripped back out. Do not repeat that mistake.

**Do not choose colors, fonts, or a visual style yourself, and do not
start implementing/restyling the UI as your first move.** Instead:

1. First, actually read this whole file and the codebase (especially
   `src/lib/site-config.ts`, `messages/nl.json`, and the existing page
   components) so you fully understand the business, the content, and
   what's already built.
2. Then, talk to Danish directly and ask him what design direction he
   wants — mood, palette preference, any reference sites/brands he likes,
   and get the logo file from him if it isn't already in `public/` (check
   first). Ask specific, concrete questions rather than a vague "what do
   you want" — e.g. "should I derive colors from the logo, or do you have
   a palette in mind already?", "any competitor or reference sites whose
   look you like or dislike?", "how bold vs. minimal do you want this?".
3. Wait for his actual answer.
4. Only after he responds should you propose a concrete direction (and
   ideally get his sign-off on that direction) before writing the styling
   into the real pages.

This applies to first-run visual design work. It does not mean re-asking
before every small tweak once a direction is agreed and confirmed.

## The business

**Kebabish** (trading name / brand) is run by **Marfah Enterprise** (legal
company name), an authentic Pakistani food kitchen in **Hoogkarspel,
Netherlands**. Delivery and takeaway only — there is no dine-in, and that
fact must stay visible/consistent everywhere on the site (nav, footer,
hero, metadata). All real business facts (KVK number, address, phone/
WhatsApp, email, socials, delivery radius) already live in
`src/lib/site-config.ts` — treat that file as the single source of truth,
don't hardcode business details anywhere else.

Owner: Danish. He is non-technical-ish but hands-on, responsive, and wants
to be consulted on design/product decisions before you run with them (see
above). He also wants to eventually manage the menu himself (see admin
dashboard, below).

## Priorities, in order

1. **SEO is the top priority.** This is a local business trying to rank
   for searches like "Pakistaans eten bezorgen Hoogkarspel". Every new page
   needs proper `generateMetadata`, and structured data
   (`src/components/StructuredData.tsx`) should stay accurate as the site
   grows (e.g. add `Menu`/`MenuItem` structured data once prices exist).
2. **Mobile-first.** Most customers will be on their phones. Every UI
   decision — tap target size, sticky header, WhatsApp button placement,
   checkout flow — should be designed for mobile first, desktop second.
3. **Two ordering paths, both must stay easy:** a full on-site cart/
   checkout with online payment, AND WhatsApp click-to-order (currently
   the only working path — see "What's not built yet" below).

## Tech stack (already decided, don't relitigate without asking Danish)

- **Next.js 16** (App Router), TypeScript, Tailwind CSS v4 (CSS-based
  `@theme` config in `src/app/globals.css` — currently empty/neutral, see
  the design note above)
- **next-intl v4** for bilingual routing — Dutch is the default locale
  with no URL prefix (`/menu`), English is prefixed (`/en/menu`). Routing
  config: `src/i18n/routing.ts`, `navigation.ts`, `request.ts`,
  `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts` — don't
  rename it back). All UI copy lives in `messages/nl.json` /
  `messages/en.json`, never hardcode user-facing strings in components.
- **Supabase** (Postgres) — planned, not yet wired up. Will back the menu
  data (replacing the static `src/lib/menu-data.ts`) and the admin
  dashboard.
- **Mollie** — planned payment gateway (iDEAL, cards, Apple/Google Pay,
  Klarna). Chosen because iDEAL covers ~70% of Dutch online purchases and
  Mollie is the NL-native provider for it.
- **Google Maps API** — planned, for a delivery-radius check on the
  contact/checkout flow (Distance Matrix API) and a proper embedded map.
  Currently the contact page uses a keyless basic Maps embed as a
  placeholder.
- Hosting target: **Vercel**, domain **kebabish.nl** (already owned, DNS
  access confirmed by Danish).
- All planned service keys have placeholders in `.env.example` — ask
  Danish for real values when you get to that feature, don't invent them.

## Design direction — not yet decided

See the warning at the top of this file. Current state:

- `src/app/globals.css` has no brand palette — just a plain neutral
  background/text color, with a comment explaining why.
- All components use Tailwind's default `neutral-*` gray scale instead of
  named brand colors.
- Only one font (Inter) is loaded, no display/heading typeface.
- No logo is integrated yet — the brand name renders as plain text.

None of this should be treated as a real design — it's intentionally
undressed so nothing presumes an answer Danish hasn't given yet.

## What's already built (functionally working, committed to git)

- Bilingual routing/middleware, full site chrome (`Header`, `Footer`,
  `WhatsAppButton`)
- Homepage, `/menu` (all 6 categories, every dish from the finalized
  menu list), `/contact` (address, hours, socials, embedded map)
- SEO plumbing: `sitemap.ts`, `robots.ts`, per-page metadata, hreflang
  alternates, `FoodEstablishment` JSON-LD
- WhatsApp ordering: floating button site-wide + per-dish "Add" button
  that opens a pre-filled WhatsApp message

All of the above is structurally sound (content, routing, SEO, data) —
it's specifically the visual styling that was stripped and needs your
design conversation with Danish before being redone.

## What's NOT built yet — priority order, after the design conversation

1. **Get it running.** `npm install` had a peer-dependency conflict
   (next-intl v3 doesn't support Next 16) — already fixed (bumped to
   `next-intl@^4.14.1`, renamed `middleware.ts` → `proxy.ts`). Run
   `npm install` fresh, then `npm run dev`, and fix anything else that
   surfaces.
2. **Have the design conversation described at the top of this file**,
   then apply the agreed direction (palette from the logo, typography,
   hero treatment, etc.) across the existing pages.
3. **Menu prices.** `src/lib/menu-data.ts` has every dish with `price:
   null` — Danish never provided prices. The UI shows "price on request"
   as a fallback. Ask him for the price list.
4. **On-site cart + Mollie checkout.** The biggest remaining feature.
   Needs a Supabase project (menu items, orders table) and a Mollie
   account — confirm Danish has actually created these and get the API
   keys before starting. Keep WhatsApp ordering working alongside it.
5. **Admin dashboard** — simple password-protected `/admin` route (nest
   it under `src/app/[locale]/admin/` so it inherits the locale layout's
   `<html>/<body>`, or give it its own layout if you deliberately want it
   locale-independent) backed by Supabase, so Danish can edit menu items,
   prices, photos, and sold-out status without touching code.
6. **Google Maps delivery-radius check** on the contact/checkout flow —
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` placeholder is in `.env.example`.
7. **Geocode the real kitchen coordinates** — `siteConfig.coordinates` in
   `src/lib/site-config.ts` is currently an approximate Hoogkarspel-center
   placeholder, not the exact address.
8. **Confirm `siteConfig.deliveryAreaTowns`** (draft list for local-SEO
   pages) against the real 10km driving radius from the kitchen — it was
   estimated from general geography, not verified driving distances.
9. Once real food photography is available, replace stock/placeholder
   imagery throughout.

## Working style Danish expects

He wants to be consulted before design and architectural decisions, and
reacts strongly (rightly) when something is decided for him without being
asked — see the design section above for exactly why that section exists.
Within an agreed direction he's comfortable with you moving fast. He's
engaged and responsive — if something is ambiguous, or you're about to
invent business data (prices, coordinates, copy) or a design choice he
hasn't actually given you, stop and ask rather than guessing.
