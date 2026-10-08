// One-off generator — run manually if brand copy/colours change. Produces
// public/og-image.jpg, the 1200x630 preview card social platforms (and
// StructuredData.tsx's FoodEstablishment.image) use. Rendered once here
// rather than at request time so it never depends on font availability on
// the build machine — what's committed is exactly what ships.
//
// The mark is composited from the real logo file. It used to be *drawn*
// in SVG — a rounded rect with a "K" set in Georgia and a hand-written
// flame path — which came out as an inverted, off-brand imitation of the
// actual mark (dark tile, cream letter; the real one is the reverse). Per
// CLAUDE.md the supplied logo image is always the brand mark, never
// something re-typeset. kebabish-dark.png is the variant drawn for dark
// backgrounds, which is what this gradient is, and it's a stacked lockup
// that already includes the wordmark — so there's no separate "Kebabish"
// line underneath it.
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const LOGO_WIDTH = 400;

const background = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c401d" />
      <stop offset="45%" stop-color="#a95026" />
      <stop offset="100%" stop-color="#c9713e" />
    </linearGradient>
    <radialGradient id="glow" cx="15%" cy="100%" r="75%">
      <stop offset="0%" stop-color="#3d3831" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#3d3831" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />

  <text x="${WIDTH / 2}" y="445" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-style="italic" fill="#f4efe0" fill-opacity="0.92" text-anchor="middle">De Smaak van Thuis</text>

  <text x="${WIDTH / 2}" y="505" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="1" fill="#f4efe0" fill-opacity="0.85" text-anchor="middle">Authentic Pakistani food, delivered in Hoogkarspel</text>

  <text x="${WIDTH / 2}" y="556" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#f4efe0" fill-opacity="0.7" text-anchor="middle">Fresh, homemade &#8226; Delivery only &#8226; 10 km radius</text>
</svg>
`;

const base = await sharp(Buffer.from(background)).png().toBuffer();

const logo = await sharp("public/logo/kebabish-dark.png")
  .resize({ width: LOGO_WIDTH })
  .toBuffer();
const { height: logoHeight } = await sharp(logo).metadata();

await sharp(base)
  .composite([
    {
      input: logo,
      left: Math.round((WIDTH - LOGO_WIDTH) / 2),
      // Sits above the tagline at y=445, with breathing room either side.
      top: Math.round((440 - (logoHeight ?? 0)) / 2),
    },
  ])
  .jpeg({ quality: 90 })
  .toFile("public/og-image.jpg");

console.log("wrote public/og-image.jpg");
