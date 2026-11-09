// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.
//
// The desk mat's felt tile (spec §11.9): src/assets/felt-256.webp.
//
//   node scripts/renders/felt.mjs                  write the tile and print its size and strength
//   node scripts/renders/felt.mjs --preview <dir>  also write 2×2-repeat previews over all three mats
//
// Round 2 (fixer, idc-01). The first tile was 700 discrete strokes, half dark and half light, at up to
// 19% alpha: on screen it read as scattered black-and-white needles over every section and cut through
// 13–14 px body copy. Felt isn't needles; it's a soft, low-frequency mottle with very fine fibre. So:
// - three octaves of tileable value noise (cells of 64, 32 and 16 px), weighted toward the low octaves,
//   gives the cloudy density changes of pressed wool;
// - 560 very short fibres (2–7 px), drawn at low weight and blurred ~0.6 px, give a whisper of nap;
// - one warm-dark tone only (no light fibres), alpha capped at MAX_ALPHA/255 and a mean change ≤ 1%.
// The alpha is baked in (no CSS opacity, no blend mode). Noise lattices wrap and fibres are drawn again
// 256 px over on the other side, so the repeat has no seams. The PRNG is seeded: every run writes the
// same tile. Lossless WebP of an 11-level single-colour field stays well under the 8 KB budget.
//
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../src/assets/felt-256.webp");
const SIZE = 256;
const FIBRES = 560;
const SEED = 0x6b726f6d; // "krom"
const MAX_ALPHA = 10; // out of 255
const TONE = [0x2b, 0x1e, 0x0a]; // warm dark: reads as shadowed wool on yolk and chalk
const MAX_BYTES = 8 * 1024;
const MATS = { yolk: [0xf2, 0xc2, 0x00], chalk: [0xd8, 0xd5, 0xcc], ink: [0x17, 0x17, 0x1a] };
// EXIF ASCII is 7-bit, so the notice is spelled without © and the em dash here.
const EXIF = { IFD0: { Copyright: "(c) 2026 HVNF Studios. All rights reserved. Portfolio sample - do not redistribute." } };

/** mulberry32: small, fast and seedable, which is all a texture needs. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = prng(SEED);
const smooth = (t) => t * t * (3 - 2 * t);

/** Tileable value noise: a (SIZE / cell)² lattice of random values, wrapped, smoothstep-interpolated. */
function octave(cell) {
  const n = SIZE / cell;
  const lattice = Float32Array.from({ length: n * n }, () => r());
  const at = (x, y) => lattice[((y + n) % n) * n + ((x + n) % n)];
  const out = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = smooth(gx - x0), ty = smooth(gy - y0);
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      out[y * SIZE + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/** Short fibres as an SVG, rasterised and blurred: a fine nap on top of the mottle. */
async function nap() {
  const paths = [];
  for (let i = 0; i < FIBRES; i++) {
    const len = 2 + r() * 5;
    const angle = r() * Math.PI * 2;
    const cx = r() * SIZE, cy = r() * SIZE;
    const w = 0.5 + r() * 0.4;
    const o = 0.35 + r() * 0.65;
    const dx = (Math.cos(angle) * len) / 2, dy = (Math.sin(angle) * len) / 2;
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        const x = cx + ox, y = cy + oy;
        if (x + len < 0 || x - len > SIZE || y + len < 0 || y - len > SIZE) continue;
        paths.push(`<path d="M${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)}L${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}" stroke-opacity="${o.toFixed(2)}" stroke-width="${w.toFixed(2)}"/>`);
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
    `<g fill="none" stroke="#000" stroke-linecap="round">${paths.join("")}</g></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().blur(0.6).raw().toBuffer({ resolveWithObject: true });
  return Float32Array.from({ length: SIZE * SIZE }, (_, i) => data[i * 4 + 3] / 255);
}

/** density 0–1 per pixel: mottle (low octaves heavier) plus nap. */
async function density() {
  const o1 = octave(64), o2 = octave(32), o3 = octave(16);
  const fib = await nap();
  const d = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < d.length; i++) {
    const mottle = (o1[i] * 0.55 + o2[i] * 0.3 + o3[i] * 0.15 - 0.5) * 2; // −1…1, centred
    d[i] = Math.max(0, 0.42 + mottle * 0.5) * 0.7 + fib[i] * 0.45;
  }
  return d;
}

/** One warm-dark colour; alpha = density × gain, rounded to whole steps and capped. */
async function tile(d, gain) {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < d.length; i++) {
    const a = Math.min(MAX_ALPHA, Math.round(d[i] * gain));
    px[i * 4] = a ? TONE[0] : 0;
    px[i * 4 + 1] = a ? TONE[1] : 0;
    px[i * 4 + 2] = a ? TONE[2] : 0;
    px[i * 4 + 3] = a;
  }
  return sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } }).webp({ lossless: true, effort: 6 }).withExif(EXIF).toBuffer();
}

/** Mean absolute change of a solid mat once the tile is laid over it, 0–1 (all channels, all pixels). */
async function strength(webp, [cr, cg, cb]) {
  const { data, info } = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: cr, g: cg, b: cb } } })
    .composite([{ input: webp }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const c = info.channels;
  let sum = 0;
  for (let i = 0; i < data.length; i += c) {
    sum += Math.abs(data[i] - cr) + Math.abs(data[i + 1] - cg) + Math.abs(data[i + 2] - cb);
  }
  return sum / ((data.length / c) * 3 * 255);
}

const d = await density();
// Gain such that the yolk mat moves ≤ 1% on average (the cap keeps any single pixel ≤ MAX_ALPHA).
let best = null;
for (const gain of [10, 12, 14, 16, 18, 20, 22]) {
  const webp = await tile(d, gain);
  const s = await strength(webp, MATS.yolk);
  if (s <= 0.01) best = { gain, webp, s };
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, best.webp);
const kb = (best.webp.length / 1024).toFixed(2);
const per = {};
for (const [mat, rgb] of Object.entries(MATS)) per[mat] = `${((await strength(best.webp, rgb)) * 100).toFixed(2)}%`;
console.log(`felt: ${path.relative(process.cwd(), OUT)} ${kb} KB, gain ${best.gain}, max alpha ${MAX_ALPHA}/255, mean change ${JSON.stringify(per)}`);

const previewIdx = process.argv.indexOf("--preview");
if (previewIdx > 0 && process.argv[previewIdx + 1]) {
  const dir = path.resolve(process.argv[previewIdx + 1]);
  mkdirSync(dir, { recursive: true });
  for (const [mat, [r, g, b]] of Object.entries(MATS)) {
    // 2×2 repeats, so a seam would show as a cross through the middle.
    await sharp({ create: { width: SIZE * 2, height: SIZE * 2, channels: 3, background: { r, g, b } } })
      .composite([{ input: best.webp, tile: true }])
      .png()
      .toFile(path.join(dir, `felt-${mat}.png`));
  }
  console.log(`felt: previews in ${dir}`);
}

if (best.webp.length > MAX_BYTES) {
  console.error(`felt: ${kb} KB is over the ${MAX_BYTES / 1024} KB budget`);
  process.exit(1);
}
