// One-off generator — run manually if brand copy/colours change. Produces
// public/og-image.jpg, the 1200x630 preview card social platforms (and
// StructuredData.tsx's FoodEstablishment.image) use. Rendered once here
// rather than at request time so it never depends on font availability on
// the build machine — what's committed is exactly what ships.
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `
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

  <!-- logo mark -->
  <g transform="translate(${WIDTH / 2 - 90}, 96)">
    <rect width="180" height="180" rx="34" fill="#3d3831" />
    <text x="90" y="132" font-family="Georgia, 'Times New Roman', serif" font-size="118" font-weight="700" fill="#f4efe0" text-anchor="middle">K</text>
    <path d="M90 96 C82 108 76 118 76 128 C76 140 82 148 90 148 C98 148 104 140 104 128 C104 118 98 108 90 96 Z" fill="#a95026" />
  </g>

  <text x="${WIDTH / 2}" y="345" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700" fill="#f4efe0" text-anchor="middle">Kebabish</text>
  <text x="${WIDTH / 2}" y="400" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-style="italic" fill="#f4efe0" fill-opacity="0.9" text-anchor="middle">De Smaak van Thuis</text>

  <text x="${WIDTH / 2}" y="470" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="1" fill="#f4efe0" fill-opacity="0.85" text-anchor="middle">Authentic Pakistani food, delivered in Hoogkarspel</text>

  <g transform="translate(${WIDTH / 2 - 190}, 505)" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#f4efe0" fill-opacity="0.75">
    <text x="0" y="0">Fresh, homemade &#8226; Delivery only &#8226; 10 km radius</text>
  </g>
</svg>
`;

await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile("public/og-image.jpg");
console.log("wrote public/og-image.jpg");
