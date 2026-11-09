// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

// encode: turns the Blender PNGs in .cache/renders/<shot>/ into the shipped AVIF + WebP files in
// public/renders/, writes the src/data/*.json the page reads, and checks the budgets (spec 11.7–11.8).
//   AVIF: the highest quality from 40 to 60 that fits the file's budget (effort 7, 4:2:0).
//   WebP: the fallback for browsers without AVIF (quality 78, alpha 80, effort 6).
//   Every image carries an EXIF copyright.
// Usage: node scripts/renders/encode.mjs [--only hero,phone,inside,build,brass] [--in <rendersDir>] [--force] [--verify] [--preview]
//        node scripts/renders/encode.mjs --colour <shotDir>   (print the calibration ΔE for one render)
// --verify exits 1 on any missing file, budget miss or colour-calibration miss.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const inArg = process.argv.indexOf("--in");
const IN = inArg > 0 ? path.resolve(process.argv[inArg + 1]) : path.join(here, ".cache", "renders");
const PUB = path.join(ROOT, "public", "renders");
const DATA = path.join(ROOT, "src", "data");
const PREVIEW = path.join(here, ".cache", "preview");
const COPYRIGHT = "© 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.";
const EXIF = { IFD0: { Copyright: "Copyright 2026 HVNF Studios. All rights reserved. Portfolio sample - do not redistribute.", Artist: "HVNF Studios" } };
const KB = 1000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : null);
const ONLY = option("--only")?.split(",") ?? ["hero", "phone", "inside", "build", "brass"];
const FORCE = flag("--force");
const problems = [];
const note = (message) => {
  problems.push(message);
  console.error(`  ✗ ${message}`);
};

// ---------------------------------------------------------------------------------- colour maths
const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(linear);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const [a1p, a2p] = [(1 + G) * a1, (1 + G) * a2];
  const [C1p, C2p] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
  let dhp = 0;
  if (C1p * C2p !== 0) dhp = h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p < -180 ? h2p - h1p + 360 : h2p - h1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Rt = -Math.sin(2 * 30 * Math.exp(-(((hbp - 275) / 25) ** 2)) * rad) * Rc;
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const dCp = C2p - C1p;
  return Math.sqrt(((L2 - L1) / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();

async function raw(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Median colour of the opaque pixels in [x0, y0, x1, y1], shrunk 15% on each side. */
function sampleMedian(img, [x0, y0, x1, y1], scale = 1) {
  const sx = (x1 - x0) * 0.15;
  const sy = (y1 - y0) * 0.15;
  const ch = [[], [], []];
  for (let y = Math.round((y0 + sy) * scale); y < Math.round((y1 - sy) * scale); y++) {
    for (let x = Math.round((x0 + sx) * scale); x < Math.round((x1 - sx) * scale); x++) {
      const i = (y * img.w + x) * 4;
      if (img.data[i + 3] < 250) continue;
      for (let c = 0; c < 3; c++) ch[c].push(img.data[i + c]);
    }
  }
  return ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
}

const TARGETS = { enter: ["#C8341F", 8], alpha: ["#ECE7DB", 6] };
async function colourCheck(imageInput, meta, scale = 1) {
  const img = await raw(imageInput);
  const out = {};
  for (const [name, [target, limit]] of Object.entries(TARGETS)) {
    const got = sampleMedian(img, meta.colour_samples[name], scale);
    const dE = deltaE2000(lab(hex(target)), lab(got));
    out[name] = { got: toHex(got), target, dE: Math.round(dE * 100) / 100, limit, ok: dE <= limit };
  }
  return out;
}

// ------------------------------------------------------------------------- shadow-catcher cleanup
/**
 * The desk is a Cycles shadow catcher: shadow-only pixels are black with partial alpha, and at 40 spp
 * that alpha is speckled. On the page the render sits on a flat CSS mat, so (1) the speckle is
 * smoothed with a blur that only averages shadow pixels (object edges never bleed in), and (2) the
 * shadow fades to exactly zero toward any edge that lands inside the layout, so no faint rectangle
 * shows. `edges` lists which edges fade and over what fraction of the height.
 */
async function cleanShadow(src, edges) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  const mask = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 250 && data[o] + data[o + 1] + data[o + 2] <= 12) {
      mask[i] = 1;
      alpha[i] = data[o + 3];
    }
  }
  const r = Math.max(2, Math.round(w / 400));
  const boxBlur = (src2) => {
    let cur = src2;
    for (let pass = 0; pass < 2; pass++) {
      const tmp = new Float32Array(n);
      for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += cur[y * w + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          tmp[y * w + x] = acc;
          acc += cur[y * w + Math.min(w - 1, x + r + 1)] - cur[y * w + Math.max(0, x - r)];
        }
      }
      const out = new Float32Array(n);
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = acc;
          acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
        }
      }
      cur = out;
    }
    return cur;
  };
  const num = boxBlur(alpha);
  const den = boxBlur(mask);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let v = den[i] > 0 ? num[i] / den[i] : 0;
      if (edges.top) v *= smooth(y / (edges.top * h));
      if (edges.sides) v *= smooth(x / (edges.sides * h)) * smooth((w - 1 - x) / (edges.sides * h));
      if (edges.bottom) v *= smooth((h - 1 - y) / (edges.bottom * h));
      const o = i * 4;
      data[o] = data[o + 1] = data[o + 2] = 0;
      data[o + 3] = Math.round(v);
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } });
}
const HERO_EDGES = { top: 0.15 };                         // the board starts at 0.19 H
const PHONE_EDGES = { top: 0.03, bottom: 0.03 };          // sits between the h1 and the lede
const FIGURE_EDGES = { top: 0.06, sides: 0.06, bottom: 0.06 }; // inside + build figures sit on the mat

// ------------------------------------------------------------------------------------- encoding
function fresh(src, outs) {
  if (FORCE) return false;
  const t = statSync(src).mtimeMs;
  return outs.every((o) => existsSync(o) && statSync(o).mtimeMs >= t);
}

async function encode(name, pipeline, budgetKB, src) {
  const avifPath = path.join(PUB, `${name}.avif`);
  const webpPath = path.join(PUB, `${name}.webp`);
  if (fresh(src, [avifPath, webpPath])) {
    const size = statSync(avifPath).size;
    console.log(`  = ${name}.avif ${(size / KB).toFixed(1)} KB (up to date)`);
    return { name, bytes: size, budget: budgetKB * KB };
  }
  const input = await (await pipeline()).png().toBuffer();
  const avifAt = (q) => sharp(input).withExif(EXIF).avif({ quality: q, effort: 7, chromaSubsampling: "4:2:0" }).toBuffer();
  // Highest quality in 40–60 that fits the budget (binary search; size grows with quality).
  let lo = 40;
  let hi = 60;
  let best = null;
  while (lo <= hi) {
    const q = (lo + hi) >> 1;
    const buf = await avifAt(q);
    if (buf.length <= budgetKB * KB) {
      best = { q, buf };
      lo = q + 1;
    } else hi = q - 1;
  }
  // Rare: a busy image (the plate's 82 cut-outs at 960) misses even at q40. Step the floor down
  // (spec risk list: "lower the AVIF quality search floor if needed") rather than ship over budget.
  for (let q = 38; !best && q >= 24; q -= 2) {
    const buf = await avifAt(q);
    if (buf.length <= budgetKB * KB || q <= 24) best = { q, buf };
  }
  writeFileSync(avifPath, best.buf);
  const webp = await sharp(input).withExif(EXIF).webp({ quality: 78, alphaQuality: 80, effort: 6 }).toBuffer();
  writeFileSync(webpPath, webp);
  const ok = best.buf.length <= budgetKB * KB;
  console.log(`  ${ok ? "+" : "!"} ${name}.avif q${best.q} ${(best.buf.length / KB).toFixed(1)}/${budgetKB} KB · webp ${(webp.length / KB).toFixed(1)} KB`);
  return { name, bytes: best.buf.length, budget: budgetKB * KB, q: best.q };
}

const readMeta = (shot) => JSON.parse(readFileSync(path.join(IN, shot, `${shot}.json`), "utf8"));
const png = (shot, file) => path.join(IN, shot, file);
const q4 = (v, d) => Math.min(9999, Math.max(0, Math.round((v / d) * 10000)));

function writeData(file, payload) {
  const text = JSON.stringify({ _copyright: COPYRIGHT, ...payload });
  writeFileSync(path.join(DATA, file), text + "\n");
  const bytes = Buffer.byteLength(text) + 1;
  console.log(`  + src/data/${file} ${(bytes / KB).toFixed(2)} KB`);
  if (bytes > 10 * KB) note(`${file} is ${bytes} bytes (budget 10 KB)`);
}

function keysJson(meta) {
  const { w: W, h: H, field } = meta;
  return {
    v: 1,
    w: W,
    h: H,
    field: [q4(field[0], W), q4(field[1], H), q4(field[2], W), q4(field[3], H)],
    keys: [...meta.keys]
      .sort((a, b) => a.s - b.s)
      .map((k) => ({ s: k.s, c: k.c, p: k.p.flatMap(([x, y]) => [q4(x, W), q4(y, H)]), ...(k.t === null ? {} : { t: k.t }) })),
  };
}

async function checkCrop(file, field) {
  const m = await sharp(file).metadata();
  if (m.width !== field[2] || m.height !== field[3]) note(`${path.basename(file)} is ${m.width}×${m.height}, field is ${field[2]}×${field[3]}`);
}

/** Edge lines of a convex polygon with outward unit normals, skipping edges that lie on a frame border. */
function edgeLines(poly, W, H) {
  const twiceArea = poly.reduce((s, [x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return s + x * y2 - x2 * y;
  }, 0);
  const sign = twiceArea > 0 ? 1 : -1;
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const lines = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const onBorder = (near(ax, 0) && near(bx, 0)) || (near(ax, W) && near(bx, W)) || (near(ay, 0) && near(by, 0)) || (near(ay, H) && near(by, H));
    const len = Math.hypot(bx - ax, by - ay);
    if (onBorder || len < 1e-6) continue;
    lines.push({ ax, ay, nx: (sign * (by - ay)) / len, ny: (sign * -(bx - ax)) / len });
  }
  return lines;
}

/**
 * A pressed-class crop is only ever sampled inside that class's key polygons (the board engine clips
 * to the polygon before drawImage), so everything outside them is made transparent: same interface,
 * far fewer bytes. Inside, alpha feathers from 1 on the key's core hull (rest + pressed silhouettes,
 * so the moving key itself can never ghost) to 0 at the polygon edge, `offset_px` further out. A
 * press relights the neighbours' facing walls and the gaps around it; the feather blends that change
 * into the rest render instead of leaving a hard outline.
 */
async function maskedPress(file, meta, c) {
  const [fx, fy] = meta.field;
  const m = meta.offset_px ?? 3;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const alpha = new Float32Array(w * h);
  for (const key of meta.keys.filter((k) => k.c === c)) {
    const lines = edgeLines(key.p, meta.w, meta.h);
    const xs = key.p.map((p) => p[0] - fx);
    const ys = key.p.map((p) => p[1] - fy);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x++) {
        const px = x + 0.5 + fx;
        const py = y + 0.5 + fy;
        let out = -Infinity;
        for (const l of lines) out = Math.max(out, (px - l.ax) * l.nx + (py - l.ay) * l.ny);
        if (out >= 0) continue;
        const a = Math.min(1, -out / m);
        if (a > alpha[y * w + x]) alpha[y * w + x] = a;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (alpha[i] <= 0) {
      data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
    } else {
      data[o + 3] = Math.round(data[o + 3] * alpha[i]);
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

const results = [];
async function boardSet(shot) {
  const meta = readMeta(shot);
  const isPhone = shot === "phone";
  console.log(`${shot}: ${meta.w}×${meta.h}, field ${meta.field.join(",")}, ${meta.keys.length} keys`);
  const rest = png(shot, "rest.png");
  const restClean = async () => sharp(await (await cleanShadow(rest, isPhone ? PHONE_EDGES : HERO_EDGES)).png().toBuffer());
  if (isPhone) {
    results.push(await encode("kl75-phone-rest-1170", restClean, 45, rest));
  } else {
    results.push(await encode("kl75-rest-2880", restClean, 60, rest));
    results.push(await encode("kl75-rest-1440", async () => (await restClean()).resize(meta.w / 2, meta.h / 2, { kernel: "lanczos3" }), 25, rest));
  }
  for (let c = 0; c < 4; c++) {
    const press = png(shot, `press-${c}.png`);
    if (!existsSync(press)) {
      note(`${shot}/press-${c}.png is missing`);
      continue;
    }
    await checkCrop(press, meta.field);
    const masked = async () => sharp(await maskedPress(press, meta, c));
    if (isPhone) {
      results.push(await encode(`kl75-phone-press-${c}-1170`, masked, 45, press));
    } else {
      const [, , fw, fh] = meta.field;
      results.push(await encode(`kl75-press-${c}-2880`, masked, 45, press));
      results.push(await encode(`kl75-press-${c}-1440`, async () => (await masked()).resize(fw / 2, fh / 2, { kernel: "lanczos3" }), 20, press));
    }
  }
  writeData(isPhone ? "kl75-keys-phone.json" : "kl75-keys-desktop.json", keysJson(meta));
}

async function insideSet() {
  const meta = readMeta("inside");
  console.log(`inside: lens ${meta.camera.lens} mm, gap ${meta.gap}, fill x ${meta.fill?.x} y ${meta.fill?.y}, corner deviation ${meta.corner_deviation_px} px`);
  if (meta.corner_deviation_px >= 1.5) note(`inside corner deviation ${meta.corner_deviation_px} px (limit 1.5)`);
  const names = ["assembled", "exploded", ...["case", "brass", "pcb", "plate", "switches", "keycaps"].map((l) => `layer-${l}`), "lip"];
  for (const n of names) {
    const src = png("inside", `${n}.png`);
    if (!existsSync(src)) {
      note(`inside/${n}.png is missing`);
      continue;
    }
    const clean = async () => sharp(await (await cleanShadow(src, FIGURE_EDGES)).png().toBuffer());
    results.push(await encode(`kl75-inside-${n}-1600`, clean, 45, src));
    results.push(await encode(`kl75-inside-${n}-960`, async () => (await clean()).resize(960, 600, { kernel: "lanczos3" }), 20, src));
  }
  // `overlay` is optional: the case's front/left exterior, never moving, stacked above the switches
  // and below the keycaps so parts still inside the case stay hidden while they rise out of it.
  writeData("kl75-explode.json", {
    w: meta.w,
    h: meta.h,
    layers: meta.layers,
    overlay: { id: "lip", dy: 0, above: "switches", below: "keycaps" },
  });
}

async function buildSet() {
  for (const n of ["case-graphite", "case-silver", "case-black", "caps-classic", "caps-yolk"]) {
    const src = png("build", `${n}.png`);
    if (!existsSync(src)) {
      note(`build/${n}.png is missing`);
      continue;
    }
    const clean = async () => sharp(await (await cleanShadow(src, FIGURE_EDGES)).png().toBuffer());
    results.push(await encode(`kl75-build-${n}-1200`, clean, 40, src));
  }
}

async function brassSet() {
  const meta = readMeta("brass");
  const src = png("brass", "brass.png");
  results.push(await encode("kl75-build-brass-1200", () => sharp(src), 35, src));
  const [x, y, w, h] = meta.field;
  writeData("kl75-brass.json", {
    w: meta.w,
    h: meta.h,
    field: [q4(x, 1), q4(y, 1), q4(w, 1), q4(h, 1)],
    capHeight: meta.capHeight,
  });
}

// ----------------------------------------------------------------- previews (what the page will do)
function inPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * What the board engine does: clip to each key's polygon and draw its class's pressed crop (with the
 * crop's feathered alpha) over the rest image.
 */
function pressKeys(rest, crops, meta, slots, scale = 1) {
  const out = Buffer.from(rest.data);
  const [fx, fy] = meta.field.map((v) => v * scale);
  for (const s of slots) {
    const key = meta.keys.find((k) => k.s === s);
    if (!key) continue;
    const pts = key.p.map(([x, y]) => [x * scale, y * scale]);
    const crop = crops[key.c];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        if (!inPolygon(x + 0.5, y + 0.5, pts)) continue;
        const cx = x - Math.round(fx);
        const cy = y - Math.round(fy);
        if (cx < 0 || cy < 0 || cx >= crop.w || cy >= crop.h || x >= rest.w || y >= rest.h) continue;
        const o = (y * rest.w + x) * 4;
        const c = (cy * crop.w + cx) * 4;
        const a = crop.data[c + 3] / 255;
        for (let k = 0; k < 3; k++) out[o + k] = Math.round(crop.data[c + k] * a + out[o + k] * (1 - a));
        out[o + 3] = Math.round(255 * a + out[o + 3] * (1 - a));
      }
    }
  }
  return out;
}

/**
 * The seam a visitor could see: across each key's outline, how much bigger the step between the
 * pixels just inside and just outside is in the composite (that key pressed) than in the rest image.
 */
function seamReport(rest, crops, meta) {
  const [fx, fy] = meta.field;
  let worst = { d: 0, s: -1 };
  let total = 0;
  let count = 0;
  const restAt = (x, y) => {
    const r = (y * rest.w + x) * 4;
    return [rest.data[r], rest.data[r + 1], rest.data[r + 2]];
  };
  for (const key of meta.keys) {
    const crop = crops[key.c];
    const compAt = (x, y) => {
      const base = restAt(x, y);
      const cx = x - fx;
      const cy = y - fy;
      if (cx < 0 || cy < 0 || cx >= crop.w || cy >= crop.h || !inPolygon(x + 0.5, y + 0.5, key.p)) return base;
      const c = (cy * crop.w + cx) * 4;
      const a = crop.data[c + 3] / 255;
      return base.map((v, k) => crop.data[c + k] * a + v * (1 - a));
    };
    let sum = 0;
    let n = 0;
    for (const l of edgeLines(key.p, meta.w, meta.h)) {
      const i = key.p.findIndex(([x, y]) => Math.abs(x - l.ax) < 1e-9 && Math.abs(y - l.ay) < 1e-9);
      const [bx, by] = key.p[(i + 1) % key.p.length];
      const steps = Math.ceil(Math.hypot(bx - l.ax, by - l.ay));
      for (let t = 1; t < steps; t++) {
        const px = l.ax + ((bx - l.ax) * t) / steps;
        const py = l.ay + ((by - l.ay) * t) / steps;
        const xi = Math.round(px - 1.5 * l.nx - 0.5);
        const yi = Math.round(py - 1.5 * l.ny - 0.5);
        const xo = Math.round(px + 1.5 * l.nx - 0.5);
        const yo = Math.round(py + 1.5 * l.ny - 0.5);
        if ([xi, xo].some((v) => v < 0 || v >= rest.w) || [yi, yo].some((v) => v < 0 || v >= rest.h)) continue;
        const ci = compAt(xi, yi);
        const co = compAt(xo, yo);
        const ri = restAt(xi, yi);
        const ro = restAt(xo, yo);
        const extra = [0, 1, 2].reduce((s, k) => s + Math.abs(ci[k] - co[k]) - Math.abs(ri[k] - ro[k]), 0) / 3;
        sum += Math.max(0, extra);
        n++;
      }
    }
    if (!n) continue;
    total += sum;
    count += n;
    if (sum / n > worst.d) worst = { d: sum / n, s: key.s };
  }
  return { mean: count ? total / count : 0, ...worst };
}

async function onMat(rgba, w, h, matHex = "#F2C200") {
  return sharp({ create: { width: w, height: h, channels: 4, background: matHex } })
    .composite([{ input: rgba, raw: { width: w, height: h, channels: 4 } }])
    .png();
}

async function previewBoard(shot, family, pressed) {
  const meta = readMeta(shot);
  const restName = shot === "phone" ? "kl75-phone-rest-1170" : `kl75-rest-${family}`;
  const scale = family === "1440" ? 0.5 : 1;
  const rest = await raw(path.join(PUB, `${restName}.avif`));
  const crops = [];
  for (let c = 0; c < 4; c++) {
    const name = shot === "phone" ? `kl75-phone-press-${c}-1170` : `kl75-press-${c}-${family}`;
    crops.push(await raw(path.join(PUB, `${name}.avif`)));
  }
  const slots = meta.keys.filter((k) => pressed.includes(k.t)).map((k) => k.s);
  const out = pressKeys(rest, crops, meta, slots, scale);
  const file = path.join(PREVIEW, `${shot}-${family}-pressed.png`);
  await (await onMat(out, rest.w, rest.h)).toFile(file);
  // 200% zoom around the first pressed key, for seams.
  const k = meta.keys.find((x) => x.s === slots[0]);
  if (k) {
    const xs = k.p.map((p) => p[0] * scale);
    const ys = k.p.map((p) => p[1] * scale);
    const left = Math.max(0, Math.round(Math.min(...xs) - 60 * scale));
    const top = Math.max(0, Math.round(Math.min(...ys) - 40 * scale));
    const width = Math.min(rest.w - left, Math.round(Math.max(...xs) - Math.min(...xs) + 120 * scale));
    const height = Math.min(rest.h - top, Math.round(Math.max(...ys) - Math.min(...ys) + 80 * scale));
    await sharp(await (await onMat(out, rest.w, rest.h)).toBuffer())
      .extract({ left, top, width, height })
      .resize(width * 2, height * 2, { kernel: "nearest" })
      .toFile(path.join(PREVIEW, `${shot}-${family}-pressed-zoom200.png`));
  }
  if (family !== "1440") {
    const seam = seamReport(rest, crops, meta);
    console.log(`  ${shot} ${family}: extra step across key outlines ${seam.mean.toFixed(2)}/255 on average, worst key ${seam.d.toFixed(2)} (slot ${seam.s})`);
  }
  console.log(`  preview ${path.relative(ROOT, file)}`);
}

async function previewInside() {
  const meta = JSON.parse(readFileSync(path.join(DATA, "kl75-explode.json"), "utf8"));
  const W = 1600;
  const H = 1000;
  // The CSS stack in its assembled pose: each layer image translated down by dy, bottom to top, with
  // the lip overlay between the switches and the keycaps.
  const order = ["case", "brass", "pcb", "plate", "switches", "lip", "keycaps"];
  const layers = [];
  for (const id of order) {
    const dy = id === "lip" ? 0 : Math.round((meta.layers.find((l) => l.id === id).dy / 100) * H);
    const file = id === "lip" ? "kl75-inside-lip-1600.avif" : `kl75-inside-layer-${id}-1600.avif`;
    layers.push({ input: await sharp(path.join(PUB, file)).png().toBuffer(), top: dy, left: 0 });
  }
  const stack = await sharp({ create: { width: W, height: H + 600, channels: 4, background: "#F2C200" } })
    .composite(layers)
    .extract({ left: 0, top: 0, width: W, height: H })
    .png()
    .toBuffer();
  const still = await sharp({ create: { width: W, height: H, channels: 4, background: "#F2C200" } })
    .composite([{ input: await sharp(path.join(PUB, "kl75-inside-assembled-1600.avif")).png().toBuffer() }])
    .png()
    .toBuffer();
  await sharp({ create: { width: W, height: H * 2, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: still, top: 0, left: 0 }, { input: stack, top: H, left: 0 }])
    .png()
    .toFile(path.join(PREVIEW, "inside-still-vs-stack.png"));
  const a = await raw(still);
  const b = await raw(stack);
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) diff += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  console.log(`  inside: assembled still vs CSS stack mean |Δ| ${(diff / (a.data.length / 4) / 3).toFixed(2)}/255`);
  for (const n of ["assembled", "exploded"]) {
    await sharp({ create: { width: W, height: H, channels: 4, background: "#F2C200" } })
      .composite([{ input: await sharp(path.join(PUB, `kl75-inside-${n}-1600.avif`)).png().toBuffer() }])
      .toFile(path.join(PREVIEW, `inside-${n}.png`));
  }
}

async function previewBuild() {
  const tiles = [];
  for (const finish of ["graphite", "silver", "black"]) {
    for (const set of ["classic", "yolk"]) {
      const caseImg = await sharp(path.join(PUB, `kl75-build-case-${finish}-1200.avif`)).png().toBuffer();
      const capsImg = await sharp(path.join(PUB, `kl75-build-caps-${set}-1200.avif`)).png().toBuffer();
      // sharp resizes before it composites, so flatten the stack to a buffer first.
      const full = await sharp({ create: { width: 1200, height: 700, channels: 4, background: "#F2C200" } })
        .composite([{ input: caseImg }, { input: capsImg }])
        .png()
        .toBuffer();
      tiles.push(await sharp(full).resize(600, 350).png().toBuffer());
    }
  }
  await sharp({ create: { width: 1200, height: 1050, channels: 4, background: "#FFFFFF" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 600, top: Math.floor(i / 2) * 350 })))
    .toFile(path.join(PREVIEW, "build-six-combinations.png"));
  console.log("  preview build-six-combinations.png");
}

// --------------------------------------------------------------------------------------- main
const colourDir = option("--colour");
if (colourDir) {
  const shot = path.basename(colourDir);
  const meta = JSON.parse(readFileSync(path.join(colourDir, `${shot}.json`), "utf8"));
  console.log(JSON.stringify(await colourCheck(path.join(colourDir, "rest.png"), meta), null, 1));
  process.exit(0);
}

mkdirSync(PUB, { recursive: true });
mkdirSync(DATA, { recursive: true });
if (ONLY.includes("hero")) await boardSet("hero");
if (ONLY.includes("phone")) await boardSet("phone");
if (ONLY.includes("inside")) await insideSet();
if (ONLY.includes("build")) await buildSet();
if (ONLY.includes("brass")) await brassSet();

for (const r of results) if (r.bytes > r.budget) note(`${r.name}.avif is ${(r.bytes / KB).toFixed(1)} KB (budget ${r.budget / KB} KB)`);
for (const r of results) if (!existsSync(path.join(PUB, `${r.name}.webp`))) note(`${r.name}.webp is missing`);

if (ONLY.includes("hero") && existsSync(path.join(PUB, "kl75-rest-2880.avif"))) {
  const colour = await colourCheck(path.join(PUB, "kl75-rest-2880.avif"), readMeta("hero"));
  for (const [name, c] of Object.entries(colour)) {
    console.log(`  colour ${name}: ${c.got} vs ${c.target} ΔE2000 ${c.dE} (≤ ${c.limit})`);
    if (!c.ok) note(`${name} colour ΔE2000 ${c.dE} exceeds ${c.limit}`);
  }
}

if (flag("--preview")) {
  mkdirSync(PREVIEW, { recursive: true });
  if (ONLY.includes("hero")) {
    await previewBoard("hero", "2880", ["k", "r", "o", "m", "a"]);
    await previewBoard("hero", "1440", ["k", "r", "o", "m", "a"]);
  }
  if (ONLY.includes("phone")) await previewBoard("phone", "1170", ["j", "k", "l", "o", "p"]);
  if (ONLY.includes("inside")) await previewInside();
  if (ONLY.includes("build")) await previewBuild();
}

const total = results.reduce((n, r) => n + r.bytes, 0);
console.log(`encode: ${results.length} AVIF files, ${(total / KB).toFixed(1)} KB in total`);
if (flag("--verify")) {
  if (problems.length) {
    console.error(`encode --verify: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log("encode --verify: every budget and colour check passed");
}
