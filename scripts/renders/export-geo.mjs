// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

// export-geo: re-runs the site's own keyboard layout and keycap builder in Node (24+ strips the
// TypeScript types natively) and writes what Blender needs to restage the KL-75 offline:
//   .cache/kl75_caps.obj    one mesh per unique cap shape (width × row), three Y-up → Blender Z-up
//   .cache/kl75_slots.json  board constants + the 82 slots, each with its KeyboardEvent.code,
//                           press class (cls) and printable character (text)
// It asserts that the press classes are a proper 4-colouring of the key adjacency graph with
// 19–22 keys per class, so no two touching keys are ever pressed in the same render.
// Usage: node scripts/renders/export-geo.mjs [--out <dir>]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as KL from "./geo/keyboard-layout.ts";
import { createKeycapGeometry } from "./geo/keycap-geometry.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(here, ".cache");
mkdirSync(OUT, { recursive: true });

function fail(message) {
  console.error(`export-geo: ${message}`);
  process.exit(1);
}

// ---- KeyboardEvent.code for every slot, in KEY_SLOTS order (Fn has no code) ------------------
const range = (prefix, chars) => chars.split("").map((c) => prefix + c);
const CODES = [
  "Escape", ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`), "Delete",
  "Backquote", ...range("Digit", "1234567890"), "Minus", "Equal", "Backspace", "Home",
  "Tab", ...range("Key", "QWERTYUIOP"), "BracketLeft", "BracketRight", "Backslash", "PageUp",
  "CapsLock", ...range("Key", "ASDFGHJKL"), "Semicolon", "Quote", "Enter", "PageDown",
  "ShiftLeft", ...range("Key", "ZXCVBNM"), "Comma", "Period", "Slash", "ShiftRight", "ArrowUp", "End",
  "ControlLeft", "MetaLeft", "AltLeft", "Space", "AltRight", null, "ControlRight", "ArrowLeft", "ArrowDown", "ArrowRight",
];
const SYMBOL_TEXT = {
  Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Space: " ",
};
/** The unshifted character a key types, or null for keys that don't type one. */
function textFor(code) {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return SYMBOL_TEXT[code] ?? null;
}

const slots = KL.KEY_SLOTS;
if (slots.length !== 82) fail(`expected 82 slots, got ${slots.length}`);
if (CODES.length !== slots.length) fail(`code table has ${CODES.length} entries for ${slots.length} slots`);
// Cross-check the table against the layout's own labels so the two can never drift apart.
slots.forEach((s, i) => {
  const code = CODES[i];
  const t = textFor(code);
  if (t && t !== " " && s.label.toLowerCase() !== t) fail(`slot ${i} label "${s.label}" vs code ${code}`);
  if (code === "Space" && s.label !== "") fail(`slot ${i} should be the spacebar`);
  if (code === null && s.label !== "Fn") fail(`slot ${i} has no code but is not Fn`);
});

// ---- press classes: DSATUR (ties by slot index) + balancing, as validated in colour.mjs -------
const keys = slots.map((s, i) => {
  const x0 = s.x / KL.KEY_UNIT + 8 - s.width / 2;
  return { i, row: s.row, x0, x1: x0 + s.width };
});
const adj = keys.map(() => new Set());
for (const a of keys) {
  for (const b of keys) {
    if (a.i >= b.i) continue;
    let touch = false;
    // Same-row neighbours touch edge to edge; adjacent rows touch when their spans overlap or meet.
    // The F-row ↔ number-row pair counts as adjacent.
    if (a.row === b.row) touch = Math.abs(a.x1 - b.x0) < 1e-6 || Math.abs(b.x1 - a.x0) < 1e-6;
    else if (Math.abs(a.row - b.row) === 1) touch = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > -0.01;
    if (touch) {
      adj[a.i].add(b.i);
      adj[b.i].add(a.i);
    }
  }
}

const cls = Array(keys.length).fill(-1);
for (let n = 0; n < keys.length; n++) {
  let best = -1;
  let bestSat = -1;
  let bestDeg = -1;
  for (const v of keys) {
    if (cls[v.i] >= 0) continue;
    const sat = new Set([...adj[v.i]].map((u) => cls[u]).filter((c) => c >= 0)).size;
    const deg = adj[v.i].size;
    if (sat > bestSat || (sat === bestSat && deg > bestDeg)) {
      best = v.i;
      bestSat = sat;
      bestDeg = deg;
    }
  }
  const used = new Set([...adj[best]].map((u) => cls[u]));
  let c = 0;
  while (used.has(c)) c++;
  cls[best] = c;
}
const K = Math.max(...cls) + 1;
if (K !== 4) fail(`DSATUR needed ${K} colours; the layout should need exactly 4`);

// Balance the class sizes: move a key to the smallest class when none of its neighbours is in it,
// otherwise swap a Kempe chain between the largest and smallest classes.
for (let iteration = 0; iteration < 5000; iteration++) {
  const size = Array(K).fill(0);
  cls.forEach((c) => size[c]++);
  const big = size.indexOf(Math.max(...size));
  const small = size.indexOf(Math.min(...size));
  if (size[big] - size[small] <= 1) break;
  let moved = false;
  for (const v of keys) {
    if (cls[v.i] !== big || [...adj[v.i]].some((u) => cls[u] === small)) continue;
    cls[v.i] = small;
    moved = true;
    break;
  }
  if (!moved) {
    for (const v of keys) {
      if (cls[v.i] !== big) continue;
      const chain = new Set([v.i]);
      const stack = [v.i];
      while (stack.length) {
        const x = stack.pop();
        for (const u of adj[x]) {
          if ((cls[u] === big || cls[u] === small) && !chain.has(u)) {
            chain.add(u);
            stack.push(u);
          }
        }
      }
      let nBig = 0;
      let nSmall = 0;
      chain.forEach((x) => (cls[x] === big ? nBig++ : nSmall++));
      if (nBig > nSmall) {
        chain.forEach((x) => {
          cls[x] = cls[x] === big ? small : big;
        });
        moved = true;
        break;
      }
    }
  }
  if (!moved) break;
}

const proper = keys.every((v) => [...adj[v.i]].every((u) => cls[u] !== cls[v.i]));
const sizes = Array(K).fill(0);
cls.forEach((c) => sizes[c]++);
if (!proper) fail("press classes are not a proper colouring: two touching keys share a class");
if (sizes.some((n) => n < 19 || n > 22)) fail(`class sizes ${sizes.join("/")} are outside 19–22`);

// ---- caps OBJ: three is Y-up, Blender is Z-up, so (x, y, z) → (x, −z, y) ----------------------
const capName = (s) => `cap_${String(s.width).replace(".", "p")}_r${s.row}`;
const capShapes = new Map();
for (const s of slots) {
  const name = capName(s);
  if (!capShapes.has(name)) {
    const profile = KL.ROW_PROFILE[s.row];
    capShapes.set(name, createKeycapGeometry(s.width, profile.height, profile.dish));
  }
}
const obj = ["# © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute."];
let offset = 0;
for (const [name, geometry] of capShapes) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  obj.push(`o ${name}`);
  for (let i = 0; i < pos.count; i++) obj.push(`v ${pos.getX(i).toFixed(6)} ${(-pos.getZ(i)).toFixed(6)} ${pos.getY(i).toFixed(6)}`);
  for (let i = 0; i < nor.count; i++) obj.push(`vn ${nor.getX(i).toFixed(5)} ${(-nor.getZ(i)).toFixed(5)} ${nor.getY(i).toFixed(5)}`);
  const index = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: pos.count }, (_, i) => i);
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]].map((n) => n + 1 + offset);
    obj.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  offset += pos.count;
}
writeFileSync(path.join(OUT, "kl75_caps.obj"), obj.join("\n") + "\n");

const table = {
  _copyright: "© 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.",
  KEY_UNIT: KL.KEY_UNIT,
  KEY_GAP: KL.KEY_GAP,
  BOARD_WIDTH: KL.BOARD_WIDTH,
  BOARD_DEPTH: KL.BOARD_DEPTH,
  KNOB_X: KL.KNOB_X,
  KNOB_Z: KL.KNOB_Z,
  ROW_PROFILE: KL.ROW_PROFILE,
  slots: slots.map((s, i) => ({
    i,
    label: s.label,
    sub: s.sub ?? null,
    tone: s.tone,
    width: s.width,
    row: s.row,
    x: s.x,
    z: s.z,
    cap: capName(s),
    code: CODES[i],
    cls: cls[i],
    text: textFor(CODES[i]),
  })),
};
writeFileSync(path.join(OUT, "kl75_slots.json"), JSON.stringify(table, null, 1) + "\n");

console.log(`export-geo: ${capShapes.size} cap shapes, ${offset} verts → ${path.join(OUT, "kl75_caps.obj")}`);
console.log(`export-geo: press classes ${sizes.join("/")} (proper 4-colouring, max degree ${Math.max(...adj.map((s) => s.size))})`);
for (let c = 0; c < K; c++) {
  console.log(`  class ${c}: ${slots.filter((_, i) => cls[i] === c).map((s) => s.label || "space").join(" ")}`);
}
