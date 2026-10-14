/**
 * Everything the owner can edit from /admin/content, and nothing else.
 *
 * This file is the allow-list. The server action refuses any key that is not in
 * here, and the loader ignores any stored key that is not in here, so the
 * database can never be used to change checkout wording, the legal pages or any
 * system message — only what is listed below.
 *
 * It describes *fields*; the default text of each one is NOT repeated here. It
 * stays in `messages/nl.json` / `messages/en.json`, found by `key` (a dotted
 * path into that file). That is deliberate: those files remain the one source of
 * the shipped copy, and an edit is just a row that overrides one path.
 *
 * Kept free of imports (type-only ones aside) so it can be loaded by scripts and
 * by Client Components alike.
 *
 * What is NOT editable, on purpose:
 *  - privacy / terms — they name the legal entity and carry legal claims; a
 *    wrong edit is the owner's liability and the "last updated" date would not
 *    follow it.
 *  - checkout, cart, item panel, feedback form, error and 404 text — system
 *    wording that the code relies on being there and being accurate.
 *  - any string with a plural/select rule (`{count, plural, …}`) — a one-character
 *    slip there throws at render time.
 */

export type FieldKind =
  /** One line. */
  | "text"
  /** A paragraph. */
  | "longtext"
  /** A list of short strings (the marquee). The owner adds, removes and reorders. */
  | "strings"
  /** A list of question/answer pairs (the FAQ). */
  | "faq";

export interface FieldDef {
  /** Dotted path into messages/*.json, e.g. "home.whyTitle". Also the DB key. */
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown under the field: where it appears, or what to watch for. */
  hint?: string;
  /** Maximum characters per string (per question / per answer for a FAQ). */
  max?: number;
  /** Lists only: the most entries allowed. */
  maxItems?: number;
  /** Search-result copy: the editor shows a length guide and a Google preview. */
  seo?: "title" | "description";
}

export interface SectionDef {
  id: string;
  title: string;
  /** Where on the page this block appears — helps the owner find the right one. */
  where?: string;
  fields: FieldDef[];
}

export interface GroupDef {
  id: string;
  title: string;
  description: string;
  /** Public path (Dutch, no locale prefix) so the editor can link "View page". */
  path?: string;
  sections: SectionDef[];
}

const text = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: "text",
  max: 120,
  ...o,
});
const long = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: "longtext",
  max: 700,
  ...o,
});
const strings = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: "strings",
  max: 60,
  maxItems: 8,
  ...o,
});
const faq = (key: string, label: string, o: Partial<FieldDef> = {}): FieldDef => ({
  key,
  label,
  kind: "faq",
  max: 900,
  maxItems: 20,
  ...o,
});

const SEO_TITLE = { seo: "title", max: 90 } as const;
const SEO_DESC = { seo: "description", max: 200 } as const;

export const GROUPS: GroupDef[] = [
  {
    id: "home",
    title: "Homepage",
    description: "Every block on the homepage, from the headline to the closing call to action.",
    path: "/",
    sections: [
      {
        id: "hero",
        title: "Top banner",
        where: "The big video banner at the very top.",
        fields: [
          text("hero.eyebrow", "Small label above the headline", {
            hint: "Hidden when “New in Hoogkarspel badge” is off in Settings.",
            max: 40,
          }),
          text("hero.title", "Headline", { max: 80 }),
          text("hero.subtitle", "Tagline", { max: 80 }),
          long("hero.description", "Description under the tagline", { max: 200 }),
          text("hero.ctaOrder", "Main button", { max: 30, hint: "Opens the menu." }),
          text("hero.badge", "Delivery badge", { max: 40 }),
          text("hero.scrollCue", "“Scroll” cue", { max: 16 }),
        ],
      },
      {
        id: "marquee",
        title: "Scrolling strip",
        where: "The orange strip of short phrases under the banner.",
        fields: [
          strings("home.marquee", "Phrases", {
            hint: "Short and punchy — they scroll past in a loop. Three to six works best.",
          }),
        ],
      },
      {
        id: "story",
        title: "Our story",
        where: "The video + text block after the strip.",
        fields: [
          text("home.aboutEyebrow", "Small label", { max: 40 }),
          text("home.aboutTitle", "Heading", { max: 80 }),
          long("home.aboutText", "Paragraph", { max: 500 }),
          text("home.storyStat1Label", "Figure 1 caption (the delivery radius)", { max: 40 }),
          text("home.storyStat2Label", "Figure 2 caption (100%)", { max: 40 }),
          text("home.storyStat3Label", "Figure 3 caption (number of categories)", { max: 40 }),
          text("home.storyVideoLabel", "Video description (for screen readers)", { max: 100 }),
        ],
      },
      {
        id: "categories",
        title: "Menu categories",
        where: "The grid of category cards.",
        fields: [
          text("home.categoriesEyebrow", "Small label", { max: 40 }),
          text("home.categoriesTitle", "Heading", { max: 80 }),
          text("home.categoriesCta", "Link under the grid", { max: 40 }),
        ],
      },
      {
        id: "popular",
        title: "Popular dishes",
        where: "The featured dishes (which dishes: Menu → tick “Featured”).",
        fields: [
          text("home.popularEyebrow", "Small label", { max: 40 }),
          text("home.popularTitle", "Heading", { max: 80 }),
          text("home.popularCta", "Link under the dishes", { max: 40 }),
        ],
      },
      {
        id: "why",
        title: "Why Kebabish",
        where: "The dark band with four reasons.",
        fields: [
          text("home.whyEyebrow", "Small label", { max: 40 }),
          text("home.whyTitle", "Heading", { max: 80 }),
          text("home.why1Title", "Reason 1 — title", { max: 50 }),
          long("home.why1Text", "Reason 1 — text", { max: 200 }),
          text("home.why2Title", "Reason 2 — title", { max: 50 }),
          long("home.why2Text", "Reason 2 — text", { max: 200 }),
          text("home.why3Title", "Reason 3 — title", { max: 50 }),
          long("home.why3Text", "Reason 3 — text", { max: 200 }),
          text("home.why4Title", "Reason 4 — title", { max: 50 }),
          long("home.why4Text", "Reason 4 — text", { max: 200 }),
        ],
      },
      {
        id: "showcase",
        title: "Photo gallery",
        where: "The mosaic of kitchen photos (pick the photos in Settings → Homepage photos).",
        fields: [
          text("home.showcaseEyebrow", "Small label", { max: 40 }),
          text("home.showcaseTitle", "Heading", { max: 80 }),
          long("home.showcaseText", "Paragraph", { max: 200 }),
        ],
      },
      {
        id: "reviews",
        title: "Customer quotes",
        where: "The dark band of quotes (add them in Website content → Reviews). Only shows once there are reviews.",
        fields: [
          text("home.reviewsEyebrow", "Small label", { max: 40 }),
          text("home.reviewsTitle", "Heading", { max: 80 }),
          text("home.reviewsCta", "Link under the quotes", { max: 40 }),
        ],
      },
      {
        id: "delivery",
        title: "Delivery area",
        where: "The map block.",
        fields: [
          text("home.deliveryEyebrow", "Small label", { max: 40 }),
          text("home.deliveryTitle", "Heading", {
            max: 90,
            hint: "If you change the delivery radius in Settings, change “10 km” here too.",
          }),
          long("home.deliveryText", "Paragraph", { max: 300 }),
          text("home.deliveryCta", "Button", { max: 40 }),
          text("home.deliveryTownsLabel", "“We deliver to” label", { max: 40 }),
        ],
      },
      {
        id: "faq",
        title: "Questions & answers",
        where: "The FAQ accordion. Google also reads these as FAQ rich results.",
        fields: [
          text("home.faqEyebrow", "Small label", { max: 50 }),
          text("home.faqTitle", "Heading", { max: 80 }),
          long("home.faqText", "Paragraph", { max: 300 }),
          faq("home.faq", "Questions", {
            hint: "Only write things that are true — Google shows these answers in search results.",
          }),
        ],
      },
      {
        id: "cta",
        title: "Closing call to action",
        where: "The orange band above the footer.",
        fields: [
          text("home.ctaBannerTitle", "Heading", { max: 80 }),
          long("home.ctaBannerText", "Paragraph", { max: 220 }),
        ],
      },
    ],
  },
  {
    id: "about",
    title: "About page",
    description: "The About page, from the video banner to the “at a glance” facts.",
    path: "/about",
    sections: [
      {
        id: "banner",
        title: "Video banner",
        where: "The full-width video at the top.",
        fields: [
          text("about.title", "Page heading", { max: 60 }),
          text("about.intro", "Line under the heading", { max: 120 }),
          long("about.bannerText", "Banner text", { max: 200 }),
          text("about.bannerVideoLabel", "Video description (for screen readers)", { max: 100 }),
        ],
      },
      {
        id: "story",
        title: "Our story",
        fields: [
          text("about.storyEyebrow", "Small label", { max: 40 }),
          text("about.storyTitle", "Heading", { max: 80 }),
          long("about.storyText1", "Paragraph 1", { max: 600 }),
          long("about.storyText2", "Paragraph 2", { max: 600 }),
          text("about.statsLabel1", "Figure 1 caption", { max: 40 }),
          text("about.statsLabel2", "Figure 2 caption", { max: 40 }),
          text("about.statsLabel3", "Figure 3 caption", { max: 40 }),
        ],
      },
      {
        id: "values",
        title: "What we stand for",
        fields: [
          text("about.valuesEyebrow", "Small label", { max: 40 }),
          text("about.valuesTitle", "Heading", { max: 80 }),
        ],
      },
      {
        id: "facts",
        title: "At a glance",
        fields: [
          text("about.factsEyebrow", "Small label", { max: 40 }),
          text("about.factsTitle", "Heading", { max: 80 }),
          text("about.factCuisine", "Label: cuisine", { max: 30 }),
          text("about.factCuisineValue", "Value: cuisine", { max: 60 }),
          text("about.factLocation", "Label: location", { max: 30 }),
          text("about.factService", "Label: how we work", { max: 30 }),
          text("about.factServiceValue", "Value: how we work", { max: 60 }),
          text("about.factRadius", "Label: delivery area", { max: 30 }),
          text("about.factRadiusValue", "Value: delivery area", {
            max: 60,
            hint: "If you change the delivery radius in Settings, change it here too.",
          }),
        ],
      },
      {
        id: "cta",
        title: "Closing call to action",
        fields: [
          text("about.ctaTitle", "Heading", { max: 80 }),
          long("about.ctaText", "Paragraph", { max: 220 }),
          text("about.ctaMenu", "Button", { max: 40 }),
        ],
      },
    ],
  },
  {
    id: "delivery-areas",
    title: "Delivery area page",
    description: "The page that lists every town we deliver to.",
    path: "/delivery-areas",
    sections: [
      {
        id: "intro",
        title: "Heading",
        fields: [
          text("deliveryAreas.title", "Page heading", { max: 60 }),
          text("deliveryAreas.intro", "Line under the heading", {
            max: 120,
            hint: "If you change the delivery radius in Settings, change “10 km” here too.",
          }),
        ],
      },
      {
        id: "map",
        title: "The map",
        fields: [
          text("deliveryAreas.mapEyebrow", "Small label", { max: 40 }),
          text("deliveryAreas.mapTitle", "Heading", { max: 80 }),
        ],
      },
      {
        id: "towns",
        title: "Towns list",
        fields: [
          text("deliveryAreas.townsEyebrow", "Small label", { max: 40 }),
          text("deliveryAreas.townsTitle", "Heading", { max: 80 }),
          long("deliveryAreas.townsIntro", "Paragraph", { max: 250 }),
          text("deliveryAreas.townDistance", "Word next to each distance", { max: 20 }),
          text("deliveryAreas.factFee", "Label: delivery fee", { max: 30 }),
          text("deliveryAreas.factMinimum", "Label: minimum order", { max: 30 }),
          text("deliveryAreas.factFreeOver", "Label: free delivery from", { max: 30 }),
          text("deliveryAreas.factRadius", "Label: delivery radius", { max: 30 }),
          text("deliveryAreas.noFreeDelivery", "Shown when there is no free-delivery threshold", { max: 40 }),
          long("deliveryAreas.outsideNote", "Note for people just outside the area", { max: 250 }),
        ],
      },
      {
        id: "cta",
        title: "Closing call to action",
        fields: [
          text("deliveryAreas.ctaTitle", "Heading", { max: 80 }),
          long("deliveryAreas.ctaText", "Paragraph", { max: 250 }),
          text("deliveryAreas.ctaWhatsapp", "WhatsApp button", { max: 40 }),
          text("deliveryAreas.ctaMenu", "Menu button", { max: 40 }),
        ],
      },
    ],
  },
  {
    id: "catering",
    title: "Catering page",
    description: "The page for parties, events and gatherings.",
    path: "/catering",
    sections: [
      {
        id: "intro",
        title: "Heading",
        fields: [
          text("catering.title", "Page heading", { max: 60 }),
          text("catering.intro", "Line under the heading", { max: 120 }),
          long("catering.introText", "Paragraph", { max: 400 }),
        ],
      },
      {
        id: "steps",
        title: "How it works",
        fields: [
          text("catering.stepsEyebrow", "Small label", { max: 40 }),
          text("catering.stepsTitle", "Heading", { max: 80 }),
          text("catering.step1Title", "Step 1 — title", { max: 50 }),
          long("catering.step1Text", "Step 1 — text", { max: 220 }),
          text("catering.step2Title", "Step 2 — title", { max: 50 }),
          long("catering.step2Text", "Step 2 — text", { max: 220 }),
          text("catering.step3Title", "Step 3 — title", { max: 50 }),
          long("catering.step3Text", "Step 3 — text", { max: 220 }),
        ],
      },
      {
        id: "occasions",
        title: "Occasions",
        fields: [
          text("catering.occasionsEyebrow", "Small label", { max: 40 }),
          text("catering.occasionsTitle", "Heading", { max: 80 }),
          text("catering.occasion1Title", "Occasion 1 — title", { max: 50 }),
          long("catering.occasion1Text", "Occasion 1 — text", { max: 220 }),
          text("catering.occasion2Title", "Occasion 2 — title", { max: 50 }),
          long("catering.occasion2Text", "Occasion 2 — text", { max: 220 }),
          text("catering.occasion3Title", "Occasion 3 — title", { max: 50 }),
          long("catering.occasion3Text", "Occasion 3 — text", { max: 220 }),
          text("catering.occasion4Title", "Occasion 4 — title", { max: 50 }),
          long("catering.occasion4Text", "Occasion 4 — text", { max: 220 }),
        ],
      },
      {
        id: "cta",
        title: "Closing call to action",
        fields: [
          text("catering.ctaTitle", "Heading", { max: 80 }),
          long("catering.ctaText", "Paragraph", { max: 250 }),
          text("catering.ctaWhatsapp", "WhatsApp button", { max: 40 }),
          text("catering.ctaCall", "Call button", { max: 40 }),
        ],
      },
    ],
  },
  {
    id: "contact",
    title: "Contact page",
    description: "Headings and notes on the contact page. The address, phone and hours are real business details, edited in Settings.",
    path: "/contact",
    sections: [
      {
        id: "all",
        title: "Contact page",
        fields: [
          text("contact.title", "Page heading", { max: 60 }),
          long("contact.intro", "Line under the heading", { max: 200 }),
          text("contact.addressTitle", "Heading: address", { max: 40 }),
          text("contact.hoursTitle", "Heading: hours", { max: 50 }),
          text("contact.hoursNote", "Note under the hours", { max: 100 }),
          text("contact.deliveryCheckTitle", "Heading: delivery check", { max: 60 }),
          long("contact.deliveryCheckText", "Text: delivery check", {
            max: 220,
            hint: "If you change the delivery radius in Settings, change “10 km” here too.",
          }),
          text("contact.socialsTitle", "Heading: social media", { max: 40 }),
        ],
      },
    ],
  },
  {
    id: "reviews-page",
    title: "Reviews page",
    description: "The wording on the Reviews page. The reviews themselves are added under Website content → Reviews.",
    path: "/reviews",
    sections: [
      {
        id: "all",
        title: "Reviews page",
        fields: [
          text("reviews.title", "Page heading", { max: 60 }),
          text("reviews.intro", "Line under the heading", { max: 120 }),
          text("reviews.emptyTitle", "Heading while there are no reviews", { max: 80 }),
          long("reviews.emptyText", "Text while there are no reviews", { max: 250 }),
          text("reviews.ctaTitle", "Closing heading", { max: 80 }),
          long("reviews.ctaText", "Closing text", { max: 220 }),
          text("reviews.ctaMenu", "Button", { max: 40 }),
        ],
      },
    ],
  },
  {
    id: "menu-page",
    title: "Menu page",
    description: "The heading on the menu page. Dishes, prices and categories are edited under Menu.",
    path: "/menu",
    sections: [
      {
        id: "all",
        title: "Menu page",
        fields: [
          text("menu.title", "Page heading", { max: 60 }),
          long("menu.intro", "Line under the heading", { max: 200 }),
        ],
      },
    ],
  },
  {
    id: "chrome",
    title: "Header, footer & banners",
    description: "Text that appears on every page: the navigation, the footer and the feedback invitation above it.",
    sections: [
      {
        id: "nav",
        title: "Navigation",
        where: "The menu bar at the top.",
        fields: [
          text("nav.home", "Home", { max: 20 }),
          text("nav.menu", "Menu", { max: 20 }),
          text("nav.about", "About", { max: 20 }),
          text("nav.contact", "Contact", { max: 20 }),
          text("common.orderNow", "“Order now” button", { max: 24, hint: "Opens the menu." }),
          text("common.closedNow", "Button while orders are paused", { max: 30 }),
        ],
      },
      {
        id: "footer",
        title: "Footer",
        fields: [
          text("footer.tagline", "Tagline", { max: 80 }),
          text("footer.deliveryOnly", "Delivery badge", { max: 30 }),
          text("footer.quickLinks", "Heading: quick links", { max: 30 }),
          text("footer.more", "Heading: more info", { max: 30 }),
          text("footer.followUs", "Heading: social media", { max: 30 }),
          text("footer.catering", "Link: catering", { max: 30 }),
          text("footer.deliveryAreas", "Link: delivery area", { max: 30 }),
          text("footer.reviews", "Link: reviews", { max: 30 }),
          text("footer.feedback", "Link: feedback", { max: 30 }),
          text("footer.rights", "Copyright line ending", { max: 40 }),
        ],
      },
      {
        id: "feedback",
        title: "Feedback invitation",
        where: "The dark card above the footer, with the QR code.",
        fields: [
          text("feedback.siteCta.eyebrow", "Small label", { max: 40 }),
          text("feedback.siteCta.title", "Heading", { max: 80 }),
          long("feedback.siteCta.text", "Paragraph", { max: 300 }),
          strings("feedback.siteCta.points", "Ticked points", { max: 90, maxItems: 5 }),
          text("feedback.siteCta.cta", "Button", { max: 40 }),
          text("feedback.siteCta.qr", "Caption under the QR code", { max: 60 }),
        ],
      },
      {
        id: "status",
        title: "Orders-paused banner",
        where: "The strip under the header when orders are switched off.",
        fields: [
          text("status.closedTitle", "Heading", { max: 60 }),
          text("status.closedDefault", "Default message", {
            max: 120,
            hint: "Shown when you haven't written a custom notice in Settings.",
          }),
        ],
      },
    ],
  },
  {
    id: "coming-soon",
    title: "Coming-soon page",
    description: "The holding page shown while the launch gate is on.",
    sections: [
      {
        id: "all",
        title: "Coming-soon page",
        fields: [
          text("comingSoon.eyebrow", "Small label", { max: 40 }),
          text("comingSoon.title", "Heading", { max: 80 }),
          long("comingSoon.description", "Paragraph", { max: 400 }),
          text("comingSoon.badge", "Delivery badge", { max: 40 }),
          text("comingSoon.ctaWhatsapp", "WhatsApp button", { max: 40 }),
          text("comingSoon.deliveryNote", "Delivery note", { max: 80 }),
          text("comingSoon.followTitle", "Heading: follow us", { max: 50 }),
          text("comingSoon.contactTitle", "Heading: contact", { max: 50 }),
        ],
      },
    ],
  },
  {
    id: "seo",
    title: "Search results (SEO)",
    description:
      "The title and description Google shows for each page. High impact — keep titles under about 60 characters and descriptions between 110 and 160. The homepage title always ends with “| Kebabish”.",
    sections: [
      {
        id: "home",
        title: "Homepage",
        fields: [
          text("seo.homeTitle", "Title", SEO_TITLE),
          long("seo.homeDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "menu",
        title: "Menu page",
        fields: [
          text("seo.menuTitle", "Title", SEO_TITLE),
          long("seo.menuDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "about",
        title: "About page",
        fields: [
          text("seo.aboutTitle", "Title", SEO_TITLE),
          long("seo.aboutDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "contact",
        title: "Contact page",
        fields: [
          text("seo.contactTitle", "Title", SEO_TITLE),
          long("seo.contactDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "catering",
        title: "Catering page",
        fields: [
          text("seo.cateringTitle", "Title", SEO_TITLE),
          long("seo.cateringDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "delivery",
        title: "Delivery area page",
        fields: [
          text("seo.deliveryTitle", "Title", SEO_TITLE),
          long("seo.deliveryDescription", "Description", {
            ...SEO_DESC,
            hint: "{radius} and {towns} are filled in automatically — keep them, or remove them, but don't change them.",
          }),
        ],
      },
      {
        id: "reviews",
        title: "Reviews page",
        fields: [
          text("seo.reviewsTitle", "Title", SEO_TITLE),
          long("seo.reviewsDescription", "Description", SEO_DESC),
        ],
      },
      {
        id: "dish",
        title: "Dish pages (every dish)",
        where: "Used for any dish that has no description of its own.",
        fields: [
          text("seo.dishTitle", "Title pattern", {
            ...SEO_TITLE,
            hint: "{name} is the dish name and {category} its category.",
          }),
          long("seo.dishFallback", "Description when the dish has none", {
            ...SEO_DESC,
            hint: "{name} is the dish name.",
          }),
          long("seo.dishTail", "Sentence added after a short dish description", { max: 140 }),
        ],
      },
    ],
  },
];

/** Every editable field, flat — used as the allow-list. */
export const ALL_FIELDS: FieldDef[] = GROUPS.flatMap((g) => g.sections.flatMap((s) => s.fields));

const BY_KEY = new Map(ALL_FIELDS.map((f) => [f.key, f]));

export function fieldFor(key: string): FieldDef | undefined {
  return BY_KEY.get(key);
}

export function groupFor(id: string): GroupDef | undefined {
  return GROUPS.find((g) => g.id === id);
}

/** Keys with locale "*": not language-specific, not text fields. */
export const LAYOUT_KEY = "layout.home";
export const REVIEWS_KEY = "reviews.items";
export const MEDIA_KEY_PREFIX = "media.";
