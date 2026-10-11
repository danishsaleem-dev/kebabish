/**
 * SEO validator: crawls every URL listed in the sitemap of a RUNNING build and
 * checks metadata + structured data mechanically — unique titles/descriptions,
 * lengths, canonical == og:url, hreflang incl. x-default, one <h1>, heading
 * order, image alts, JSON-LD parses / has no dangling @id / has the properties
 * Google needs, sitemap and robots sanity.
 *
 *   npm run build && npm run start -- -p 3100      (in one terminal)
 *   node scripts/seo-validate.mjs                  (default http://localhost:3100)
 *   node scripts/seo-validate.mjs http://localhost:3000
 *
 * It tests the *local* build, whose canonical URLs still say www.kebabish.nl,
 * which is why SITE below is fixed. Needs SITE_COMING_SOON=false.
 */
const base = process.argv[2] || "http://localhost:3100";
const SITE = "https://www.kebabish.nl";
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const problems = [];
const warn = (url, msg) => problems.push(`${url}  ${msg}`);

async function get(path) {
  const r = await fetch(base + path, { redirect: "manual" });
  return { status: r.status, text: await r.text(), headers: r.headers };
}

// ---- URL list: from the sitemap itself, so we test what we tell Google about
const sm = await get("/sitemap.xml");
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length === 0) warn("/sitemap.xml", "no <loc> entries");
if (new Set(locs).size !== locs.length) warn("/sitemap.xml", "duplicate <loc> entries");
if (/<lastmod>/.test(sm.text)) warn("/sitemap.xml", "has <lastmod> (should be omitted: we have no real per-page date)");
const sitemapAlt = (sm.text.match(/xhtml:link/g) || []).length;
console.log(`sitemap: ${locs.length} urls, ${sitemapAlt} xhtml:link alternates`);

const pages = locs.map((u) => u.replace(SITE, "") || "/");
const extra = ["/checkout", "/cart", "/en/checkout", "/en/cart"];

const seen = { title: new Map(), desc: new Map() };

function checkSchemaTree(url, blocks) {
  const defined = new Set();
  const walk = (node, fn) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, fn));
    if (node && typeof node === "object") {
      fn(node);
      Object.values(node).forEach((v) => walk(v, fn));
    }
  };
  for (const b of blocks) walk(b, (n) => { if (n["@id"] && n["@type"]) defined.add(n["@id"]); });
  for (const b of blocks) {
    walk(b, (n) => {
      const keys = Object.keys(n);
      if (keys.length === 1 && keys[0] === "@id" && !defined.has(n["@id"])) warn(url, `dangling @id reference ${n["@id"]}`);
      for (const [k, v] of Object.entries(n)) {
        if (v === "" || v === null || v === undefined || v === "undefined" || v === "null") warn(url, `empty/invalid value for "${k}"`);
        if (typeof v === "string" && /^(url|image|logo|item|sameAs|target|urlTemplate)$/.test(k) && !/^https?:\/\//.test(v)) warn(url, `non-absolute URL in "${k}": ${v}`);
      }
    });
  }
  const types = [];
  for (const b of blocks) {
    types.push(b["@type"]);
    if (!b["@context"]) warn(url, `${b["@type"]} block has no @context`);
    if (b["@type"] === "Product") {
      if (!b.name) warn(url, "Product without name");
      if (!b.offers && !b.review && !b.aggregateRating) warn(url, "Product without offers/review/aggregateRating (not rich-result eligible)");
      if (b.offers) {
        const o = b.offers;
        if (!/^\d+(\.\d{2})?$/.test(String(o.price))) warn(url, `Offer price not a plain decimal: ${o.price}`);
        if (o.priceCurrency !== "EUR") warn(url, "Offer priceCurrency not EUR");
        if (!/^https:\/\/schema\.org\/(InStock|OutOfStock|SoldOut)$/.test(o.availability || "")) warn(url, `Offer availability odd: ${o.availability}`);
      }
      if (!b.image || !b.image.length) warn(url, "Product has no image");
    }
    if (b["@type"] === "FAQPage") {
      if (!b.mainEntity?.length) warn(url, "FAQPage has no questions");
      for (const q of b.mainEntity || []) if (!q.name || !q.acceptedAnswer?.text) warn(url, "FAQ question missing name or answer text");
    }
    if (b["@type"] === "BreadcrumbList") {
      const items = b.itemListElement || [];
      items.forEach((it, i) => { if (it.position !== i + 1) warn(url, "breadcrumb position out of order"); if (!it.item?.startsWith(SITE)) warn(url, `breadcrumb item not on site: ${it.item}`); });
    }
    if (b["@type"] === "FoodEstablishment") {
      for (const k of ["name", "address", "telephone", "openingHoursSpecification", "geo", "servesCuisine", "image", "url"]) if (!b[k]) warn(url, `FoodEstablishment missing ${k}`);
      if (b.hasDeliveryMethod) warn(url, "FoodEstablishment still has invalid hasDeliveryMethod");
      if (/Marfah/i.test(JSON.stringify(b))) warn(url, "business schema names the legal entity (Marfah) — public site must not");
    }
  }
  return types;
}

const rows = [];
for (const path of [...pages, ...extra]) {
  const { status, text: h } = await get(path);
  const noindexed = /<meta name="robots" content="[^"]*noindex/.test(h);
  if (status !== 200) { warn(path, `HTTP ${status}`); continue; }

  const title = decode((h.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  const desc = decode((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "");
  const canon = decode((h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "");
  const ogUrl = decode((h.match(/<meta property="og:url" content="([^"]*)"/) || [])[1] || "");
  const ogTitle = decode((h.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || "");
  const ogImage = (h.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  const hreflangs = [...h.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map((m) => [m[1], m[2]]);
  const lang = (h.match(/<html[^>]*lang="([^"]*)"/) || [])[1];

  if (!title) warn(path, "no <title>");
  if (title.length > 65) warn(path, `title ${title.length} chars (>65): ${title}`);
  if (!noindexed) {
    if (!desc) warn(path, "no meta description");
    else if (desc.length < 70 || desc.length > 165) warn(path, `description ${desc.length} chars: ${desc}`);
    if (seen.title.has(title)) warn(path, `duplicate title with ${seen.title.get(title)}: ${title}`); else seen.title.set(title, path);
    if (seen.desc.has(desc)) warn(path, `duplicate description with ${seen.desc.get(desc)}`); else seen.desc.set(desc, path);
  }
  if (!canon.startsWith(SITE)) warn(path, `canonical not absolute/on-site: ${canon}`);
  if (canon !== SITE + (path === "/" ? "" : path) && canon !== SITE + path.replace(/\/$/, "")) warn(path, `canonical (${canon}) != own URL`);
  if (ogUrl !== canon) warn(path, `og:url (${ogUrl}) != canonical (${canon})`);
  if (!ogTitle) warn(path, "no og:title");
  if (!ogImage) warn(path, "no og:image");
  if (!/name="twitter:card"/.test(h)) warn(path, "no twitter:card");
  if (!hreflangs.some(([l]) => l === "x-default")) warn(path, "no x-default hreflang");
  if (!hreflangs.some(([l]) => l === "nl") || !hreflangs.some(([l]) => l === "en")) warn(path, "hreflang missing nl or en");
  const expectedLang = path.startsWith("/en") ? "en" : "nl";
  if (lang !== expectedLang) warn(path, `<html lang="${lang}"> but expected "${expectedLang}"`);

  // headings: exactly one h1, never skip a level downwards
  const heads = [...h.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  if (heads.filter((x) => x === 1).length !== 1) warn(path, `${heads.filter((x) => x === 1).length} <h1> tags`);
  for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) { warn(path, `heading level skipped: h${heads[i - 1]} → h${heads[i]}`); break; }

  // images: alt present
  const noAlt = (h.match(/<img(?![^>]*\balt=)[^>]*>/g) || []).length;
  if (noAlt) warn(path, `${noAlt} <img> without alt`);

  // JSON-LD
  const blocks = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { blocks.push(JSON.parse(m[1])); } catch { warn(path, "INVALID JSON-LD"); }
    if (/<\/script/i.test(m[1])) warn(path, "raw </script in JSON-LD");
  }
  const types = checkSchemaTree(path, blocks);
  rows.push(`${String(status)} ${path.padEnd(34)} ${noindexed ? "noindex" : "index  "} t=${String(title.length).padStart(2)} d=${String(desc.length).padStart(3)} ld=[${types.join(",")}]`);
}

console.log(rows.join("\n"));

// ---- robots
const rb = (await get("/robots.txt")).text;
for (const need of ["/admin", "/api", "/dashboard", "/rider", "/kitchen", "/login", "/signup", "/forgot-password", "/reset-password"]) {
  if (!rb.includes(`Disallow: ${need}`)) warn("/robots.txt", `missing Disallow: ${need}`);
}
if (!rb.includes("Sitemap: https://www.kebabish.nl/sitemap.xml")) warn("/robots.txt", "missing Sitemap line");

console.log("\n=== PROBLEMS ===");
console.log(problems.length ? problems.join("\n") : "none");
console.log(`\n${pages.length + extra.length} pages checked, ${problems.length} problem(s)`);
