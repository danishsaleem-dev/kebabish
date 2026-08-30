# Kebabish — kebabish.nl

Next.js (App Router, TypeScript, Tailwind v4) website for **Kebabish**
(Marfah Enterprise), an authentic Pakistani food delivery/takeaway kitchen
in Hoogkarspel, Netherlands.

## Stack

- **Next.js 16** + TypeScript, App Router
- **Tailwind CSS v4** — brand palette defined in `src/app/globals.css` (`@theme`)
- **next-intl** — bilingual routing, `nl` (default, no prefix) + `en` (`/en/...`)
- **Supabase** (planned) — menu data + admin dashboard + orders
- **Mollie** (planned) — iDEAL / cards / Apple & Google Pay / Klarna checkout
- **Google Maps API** (planned) — delivery-radius check, embedded map, distance/ETA
- Hosting target: **Vercel**, domain `kebabish.nl`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the keys as they're created
npm run dev
```

> First-time `npm install` should be run directly on this machine (not
> through a remote/tunneled shell) — it's much faster over a normal
> internet connection.

## Project structure

```
src/
  app/
    [locale]/           # all public, bilingual routes
      layout.tsx         # <html>/<body>, fonts, metadata, JSON-LD, header/footer
      page.tsx            # homepage
      menu/page.tsx        # full menu
      contact/page.tsx     # contact + delivery area + map
    layout.tsx           # minimal pass-through root layout (required by Next.js)
    sitemap.ts / robots.ts
  components/            # Header, Footer, WhatsAppButton, MenuItemCard, StructuredData
  i18n/                  # next-intl routing/navigation/request config
  lib/
    site-config.ts        # single source of truth for business details
    menu-data.ts           # menu items (prices are currently null — TODO)
messages/
  nl.json / en.json      # all UI copy, per locale
```

## Known gaps / next steps

- **Menu prices are missing** — `src/lib/menu-data.ts` has every dish from
  the finalized list with `price: null`. The UI shows "price on request"
  until real prices are filled in.
- **Hero background video** — placeholder gradient is in place in
  `src/app/[locale]/page.tsx`; swap in the sourced "desi food making" stock
  clip at `public/videos/hero-cooking.mp4` (commented-out `<video>` tag is
  ready to uncomment).
- **On-site cart + Mollie checkout** — not built yet. Current ordering path
  is WhatsApp click-to-order (pre-filled message) on every product card and
  a floating button site-wide. Full cart/checkout is the next milestone,
  pending Supabase + Mollie account credentials.
- **Admin dashboard** — not built yet (planned: password-protected route
  backed by Supabase for menu/price/sold-out management).
- **Google Maps delivery-radius check** — contact page has a placeholder;
  needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` wired to the Distance Matrix API.
- **Delivery-area town list** (`siteConfig.deliveryAreaTowns`) is a draft
  based on map geography — confirm against the real 10 km driving radius.
- **Logo** — site currently renders the brand name as text; swap in the
  real logo file once shared.
- **Coordinates** in `siteConfig.coordinates` are an approximate Hoogkarspel
  center — geocode the exact kitchen address once the Maps key is set up.

## Business details reference (`src/lib/site-config.ts`)

KVK 42147417 · De Overstoep 49, 1616RK Hoogkarspel · +31 6 84011572 ·
info@kebabish.nl · @kebabishnl
