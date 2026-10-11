// One-off: re-run if the logo changes. Writes src/lib/invoice/logo.ts, the copy of
// the logo the invoice PDF generator embeds (it can't read /public on Vercel).
import sharp from "sharp";
import fs from "node:fs";

const buf = await sharp("public/logo/Kebabish-light.png")
  .resize({ width: 320 })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();
const meta = await sharp(buf).metadata();

fs.writeFileSync(
  "src/lib/invoice/logo.ts",
  `/**
 * The Kebabish logo for invoices, as a ${meta.width}px-wide PNG embedded in the code.
 * On Vercel a function cannot reliably read files out of /public at runtime,
 * so the PDF generator carries its own copy instead of reading the file.
 * Regenerate with: node scripts/generate-invoice-logo.mjs
 */
export const LOGO_PNG_BASE64 =
  "${buf.toString("base64")}";
export const LOGO_WIDTH = ${meta.width};
export const LOGO_HEIGHT = ${meta.height};
`
);
console.log(`wrote src/lib/invoice/logo.ts (${meta.width}x${meta.height}, ${Math.round(buf.length / 1024)}KB)`);
