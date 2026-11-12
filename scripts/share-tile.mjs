// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

// share-tile: encodes the Open Graph / Twitter share image, public/share/kl75-share-1200x630.jpg (layout.tsx).
// Input: a screenshot of the built hero at a 1200×630 viewport (2x, so 2400×1260, is best: it is downscaled).
// Output: a 1200×630 progressive JPEG with the EXIF copyright, at the highest quality that fits 120 KB.
// Usage: node scripts/share-tile.mjs <hero-screenshot.png>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "..", "public", "share", "kl75-share-1200x630.jpg");
const BUDGET = 120 * 1000;
const EXIF = { IFD0: { Copyright: "Copyright 2026 HVNF Studios. All rights reserved. Portfolio sample - do not redistribute.", Artist: "HVNF Studios" } };

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/share-tile.mjs <hero-screenshot.png>");
  process.exit(2);
}
const base = await sharp(input).resize(1200, 630, { fit: "cover", position: "top", kernel: "lanczos3" }).png().toBuffer();
const jpeg = (q) => sharp(base).withExif(EXIF).jpeg({ quality: q, progressive: true, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
let best = null;
for (let q = 90; q >= 50 && !best; q -= 4) {
  const buf = await jpeg(q);
  if (buf.length <= BUDGET) best = { q, buf };
}
if (!best) {
  console.error("share-tile: no quality from 90 to 50 fits 120 KB");
  process.exit(1);
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, best.buf);
console.log(`share-tile: ${path.relative(process.cwd(), OUT)} q${best.q} ${(best.buf.length / 1000).toFixed(1)}/120 KB`);
