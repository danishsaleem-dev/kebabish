// One-off generator, not part of the build — run manually if the source
// mark (public/logo/favicon-kebabish.png) ever changes. Produces the full
// favicon/PWA icon set referenced by src/app/[locale]/layout.tsx and
// public/site.webmanifest, plus the real src/app/favicon.ico that Next's
// App Router file convention auto-serves at "/" regardless of what
// metadata.icons says.
//
// src/app/favicon.ico was still the default create-next-app placeholder
// (the generic Next/Vercel triangle) — Next always injects a <link
// rel="icon" href="/favicon.ico"> from that file convention, so it was
// silently taking priority over the real icons declared in metadata this
// whole time. There's no ICO encoder in the dependency tree (sharp can't
// write ICO), so this hand-builds the container: a plain, well-documented
// binary format — a 6-byte ICONDIR header, one 16-byte ICONDIRENTRY per
// image, then the raw PNG bytes back to back. Every modern browser
// supports PNG-in-ICO.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = "public/logo/favicon-kebabish.png";
const CHARCOAL = "#3d3831";

const targets = [
  { file: "public/favicon-16.png", size: 16, flatten: false },
  { file: "public/favicon-32.png", size: 32, flatten: false },
  { file: "public/favicon-48.png", size: 48, flatten: false },
  { file: "public/icon-192.png", size: 192, flatten: false },
  { file: "public/icon-512.png", size: 512, flatten: false },
  // Apple ignores alpha and can render transparency oddly on older iOS,
  // so this one gets a solid brand-colour backing instead of a see-through
  // corner.
  { file: "public/apple-touch-icon.png", size: 180, flatten: true },
];

const pngBuffers = {};

for (const { file, size, flatten } of targets) {
  let pipeline = sharp(SRC).resize(size, size);
  if (flatten) pipeline = pipeline.flatten({ background: CHARCOAL });
  const buffer = await pipeline.png().toBuffer();
  await writeFile(file, buffer);
  pngBuffers[size] = buffer;
  console.log("wrote", file);
}

// ---- favicon.ico: 16/32/48, the sizes real browsers actually request ----
const icoSizes = [16, 32, 48];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(icoSizes.length, 4); // image count

let offset = 6 + icoSizes.length * 16;
const entries = [];
const images = [];

for (const size of icoSizes) {
  const png = pngBuffers[size];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 means 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image data size
  entry.writeUInt32LE(offset, 12); // offset into file
  entries.push(entry);
  images.push(png);
  offset += png.length;
}

const ico = Buffer.concat([header, ...entries, ...images]);
await writeFile("src/app/favicon.ico", ico);
console.log("wrote src/app/favicon.ico (replaced the default Next.js placeholder)");
