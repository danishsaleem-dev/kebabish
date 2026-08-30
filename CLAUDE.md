# Kebabish — Project Context for Claude Code

Read this first. This is a real client project, not a demo. Follow it precisely.

## The business

**Kebabish** (trading name / brand) is run by **Marfah Enterprise** (legal
company name), an authentic Pakistani food kitchen in **Hoogkarspel,
Netherlands**. Delivery and takeaway only — there is no dine-in, and that
fact must stay visible/consistent everywhere on the site (nav, footer,
hero, metadata). All real business facts (KVK number, address, phone/
WhatsApp, email, socials, delivery radius) already live in
`src/lib/site-config.ts` — treat that file as the single source of truth,
don't hardcode business details anywhere else.

Owner: Danish. He is non-technical-ish but hands-on and wants to be able to
manage the menu himself eventually (see admin dashboard, below).

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
  `@theme` config in `src/app/globals.css`, no `tailwind.config.js`)
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

## Design direction

"Warm & homestyle" — chosen deliberately over "bold street food" or
"premium minimal". Palette (provisional, defined as Tailwind v4 custom
colors in `globals.css`, swap here once the real logo is available):

- `terracotta` #c4522a (primary/CTA), `mustard` #e8a33d (accent),
  `maroon` #6b1e23 (dark sections/headers), `cream` #fbf3e7 (background),
  `charcoal` #2b2320 (text)
- Fonts: Fraunces (display/headings) + Inter (body), via `next/font/google`
- **Logo**: not yet integrated — the brand name currently renders as
  styled text in the header/footer. Ask Danish for the logo file if it
  hasn't been added to `public/` yet; once you have it, consider pulling
  the palette from it directly instead of the provisional colors.
- **Hero background**: `src/app/[locale]/page.tsx` has a commented-out
  `<video>` tag and a gradient fallback. Danish wants a free stock "desi
  food making" video there — source one from Pexels/Pixabay/Coverr
  (royalty-free, no attribution required) if it hasn't been added yet.

## What's already built (working, committed to git)

- Bilingual routing/middleware, full site chrome (`Header`, `Footer`,
  `WhatsAppButton`)
- Homepage, `/menu` (all 6 categories, every dish from the finalized
  menu list), `/contact` (address, hours, socials, embedded map)
- SEO plumbing: `sitemap.ts`, `robots.ts`, per-page metadata, hreflang
  alternates, `FoodEstablishment` JSON-LD
- WhatsApp ordering: floating button site-wide + per-dish "Add" button
  that opens a pre-filled WhatsApp message

## What's NOT built yet — do these next, in this order

1. **Get it running.** `npm install` just had a peer-dependency conflict
   (next-intl v3 doesn't support Next 16) — already fixed in the latest
   commit (bumped to `next-intl@^4.14.1`, renamed `middleware.ts` →
   `proxy.ts`). Run `npm install` fresh, then `npm run dev`, and fix
   anything else that surfaces before building new features. `node_modules`
   was deleted before this handoff so you're starting from a clean slate.
2. **Menu prices.** `src/lib/menu-data.ts` has every dish with `price:
   null` — Danish never provided prices. The UI shows "price on request"
   as a fallback. Ask him for the price list before this can be
   considered launch-ready.
3. **On-site cart + Mollie checkout.** This is the biggest remaining
   feature. Needs a Supabase project (menu items, orders table) and a
   Mollie account (Danish said accounts/domain are ready, but confirm he's
   actually created these and get the API keys before starting). Keep
   WhatsApp ordering working alongside it, not replaced by it.
4. **Admin dashboard** — simple password-protected `/admin` route (nest
   it under `src/app/[locale]/admin/` so it inherits the locale layout's
   `<html>/<body>`, or give it its own layout if you deliberately want it
   locale-independent) backed by Supabase, so Danish can edit menu items,
   prices, photos, and sold-out status without touching code.
5. **Google Maps delivery-radius check** on the contact/checkout flow —
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` placeholder is in `.env.example`.
6. **Geocode the real kitchen coordinates** — `siteConfig.coordinates` in
   `src/lib/site-config.ts` is currently an approximate Hoogkarspel-center
   placeholder, not the exact address.
7. **Confirm `siteConfig.deliveryAreaTowns`** (draft list for local-SEO
   pages) against the real 10km driving radius from the kitchen — it was
   estimated from general geography, not verified driving distances.
8. Once real food photography is available, replace stock/placeholder
   imagery throughout.

## Working style Danish expects

He wants to be asked before big architectural decisions (payment provider,
CMS approach, etc. were already decided via explicit Q&A — don't redo
that), but is comfortable with you moving fast on implementation within
that agreed direction. He's engaged and responsive — if something is
ambiguous or you're about to invent business data (prices, coordinates,
copy) that he hasn't provided, stop and ask rather than guessing.
