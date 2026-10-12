#!/usr/bin/env node
/**
 * Regenerates the QR codes shown in the "leave feedback" section above the
 * footer (src/components/feedback/FeedbackCta.tsx).
 *
 *   node scripts/generate-feedback-qr.mjs
 *
 * A one-off, like scripts/generate-favicons.mjs and generate-og-image.mjs —
 * NOT part of the build. The two SVGs are committed; re-run this only if the
 * URL, the canonical host or the colour ever changes.
 *
 * It shells out to the `qrcode` CLI through `npx -y`, so nothing is added to
 * package.json: a QR encoder would otherwise be a dependency the running site
 * never needs. Light modules are transparent (`#00000000`) so the cream tile
 * the SVG sits on shows through, and the dark modules are charcoal-950 — the
 * same near-black the footer uses, which keeps contrast well inside what a
 * phone camera needs.
 *
 * The URL has to be absolute (a QR is scanned by a different device, so a
 * relative path is meaningless) and must name the canonical host: www
 * redirects to itself, the apex 308-redirects to www, and a redirect in the
 * middle of a camera scan is one more thing to go wrong.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const HOST = "https://www.kebabish.nl";
/** `src=qr` tells /admin/feedback the response came from scanning this code. */
const TARGETS = [
  { file: "public/images/feedback-qr.svg", url: `${HOST}/feedback?src=qr` },
  { file: "public/images/feedback-qr-en.svg", url: `${HOST}/en/feedback?src=qr` },
];

mkdirSync("public/images", { recursive: true });

for (const { file, url } of TARGETS) {
  execFileSync(
    "npx",
    [
      "-y",
      "qrcode@1.5.4",
      "--type", "svg",
      // 2 modules of quiet zone in the file; the tile's own padding supplies
      // the rest of the margin a scanner wants.
      "--qzone", "2",
      "--error", "M",
      "--lightcolor", "#00000000",
      "--darkcolor", "#14120fff",
      "--output", file,
      url,
    ],
    { stdio: "inherit", shell: process.platform === "win32" }
  );
  console.log(`${file}  ->  ${url}`);
}
