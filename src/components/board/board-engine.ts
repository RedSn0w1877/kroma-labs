// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { asset } from "@/lib/asset";
import type { Echo } from "@/lib/keymap";

/**
 * The board engine (spec §6.2, §11.7). Loaded lazily: at idle on desktop and in embeds, on the first touch
 * on lite devices. It is how a still photograph becomes an instrument, with zero WebGL.
 *
 * The hero <img> is a Cycles render of the KL-75 at rest. WS-B also rendered the board four more times,
 * each with one "press class" of keys pushed 4 mm down. The classes are a proper 4-colouring of the key
 * adjacency graph, so no two touching keys share one: whichever keys are held, each one's pressed pixels
 * come from a render where its neighbours were still up. Those four crops are pre-masked (transparent
 * outside the class's keys, feathered at the edges), so a press is one clipped drawImage of one key's
 * bounding box onto a transparent canvas lying over the <img>: about 0.2 ms, done synchronously in the
 * key handler and painted on the very next frame, the same frame the synth's transient leaves.
 *
 * Release clears a pixel-aligned rectangle (never an anti-aliased path, which would leave a faint ring)
 * and redraws any held neighbour that overlaps it, clipped to that rectangle. Every pixel ever drawn lies
 * inside a held key's box, so once nothing is held the canvas is provably empty again.
 */

export type KeyRec = { s: number; c: number; p: number[]; t?: string };
type KeySet = { w: number; h: number; field: number[]; keys: KeyRec[] };
type Prepared = KeyRec & { box: [number, number, number, number]; cx: number; cy: number; xs: Float32Array; ys: Float32Array };

const UNITS = 10000;
const CLASSES = 4;

// The key polygons ship inside this lazy chunk only, never in the HTML or the RSC payload (spec §11.10).
const KEYSETS: Record<"desktop" | "phone", (() => Promise<KeySet>) | null> = {
  desktop: () => import("@/data/kl75-keys-desktop.json").then((m) => m.default as unknown as KeySet),
  phone: () => import("@/data/kl75-keys-phone.json").then((m) => m.default as unknown as KeySet),
};

export type BoardSource = { set: "desktop" | "phone"; family: string; ext: "avif" | "webp" };

/** Which key set, resolution family and format the browser picked for the hero <img>. */
export function sourceOf(img: HTMLImageElement): BoardSource | null {
  const url = img.currentSrc || img.src;
  const m = /kl75-(phone-)?rest-(\d+)\.(avif|webp)/.exec(url);
  if (!m) return null;
  return { set: m[1] ? "phone" : "desktop", family: m[2], ext: m[3] as "avif" | "webp" };
}

const pressedUrl = ({ set, family, ext }: BoardSource, c: number) =>
  asset(set === "phone" ? `/renders/kl75-phone-press-${c}-1170.${ext}` : `/renders/kl75-press-${c}-${family}.${ext}`);

function prepare(keys: KeyRec[]): Prepared[] {
  return keys.map((k) => {
    const n = k.p.length / 2;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    let minX = UNITS, minY = UNITS, maxX = 0, maxY = 0, sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      xs[i] = k.p[i * 2];
      ys[i] = k.p[i * 2 + 1];
      minX = Math.min(minX, xs[i]);
      maxX = Math.max(maxX, xs[i]);
      minY = Math.min(minY, ys[i]);
      maxY = Math.max(maxY, ys[i]);
      sx += xs[i];
      sy += ys[i];
    }
    return { ...k, xs, ys, box: [minX, minY, maxX, maxY], cx: sx / n, cy: sy / n };
  });
}

function inside(k: Prepared, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = k.xs.length - 1; i < k.xs.length; j = i++) {
    if (k.ys[i] > y !== k.ys[j] > y && x < ((k.xs[j] - k.xs[i]) * (y - k.ys[i])) / (k.ys[j] - k.ys[i]) + k.xs[i]) hit = !hit;
  }
  return hit;
}

export type Board = {
  /** Push a key down in the picture (no sound; callers strike). Idempotent while held. */
  press(slot: number): void;
  release(slot: number): void;
  releaseAll(): void;
  /** The key under a viewport point, or null. Overlapping outlines resolve to the nearest centre. */
  hit(clientX: number, clientY: number): KeyRec | null;
  /** The printable character on a slot ("k", " ", ";"), if it has one. */
  char(slot: number): string | undefined;
  /** Resolves when the four pressed renders have decoded (presses before that are held and drawn then). */
  ready: Promise<void>;
  isReady(): boolean;
  /** The silent k-r-o-m-a run: presses 90 ms apart, each held 110 ms, typed into the echo. 10 one-shot timeouts. */
  attract(echo: Echo | null, onDone?: () => void): void;
  destroy(): void;
};

export async function createBoard(root: HTMLElement): Promise<Board> {
  const img = root.querySelector("img");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-board-canvas]");
  const ctx = canvas?.getContext("2d");
  if (!img || !canvas || !ctx) throw new Error("kroma board: markup missing");

  if (!img.currentSrc && !img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
  let source = sourceOf(img) ?? { set: "desktop", family: "1440", ext: "avif" };
  if (!KEYSETS[source.set]) source = { ...source, set: "desktop" };

  const first = await KEYSETS[source.set]!();
  let keys: Prepared[] = prepare(first.keys);
  let field = first.field;
  let bySlot = new Map(keys.map((k) => [k.s, k]));
  let images: (HTMLImageElement | null)[] = new Array(CLASSES).fill(null);
  let ready = false;
  const held = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let kx = 0;
  let ky = 0;
  let alive = true;

  /** A key's box in canvas pixels, snapped outward to whole pixels plus one. */
  const boxPx = (k: Prepared) => {
    const x0 = Math.max(0, Math.floor(k.box[0] * kx) - 1);
    const y0 = Math.max(0, Math.floor(k.box[1] * ky) - 1);
    const x1 = Math.min(canvas.width, Math.ceil(k.box[2] * kx) + 1);
    const y1 = Math.min(canvas.height, Math.ceil(k.box[3] * ky) + 1);
    return [x0, y0, x1, y1] as const;
  };

  const drawKey = (k: Prepared) => {
    const pressed = images[k.c];
    if (!pressed) return;
    const [x0, y0, x1, y1] = boxPx(k);
    // Destination box → source pixels in the field crop.
    const [fx, fy, fw, fh] = field;
    const iw = pressed.naturalWidth;
    const ih = pressed.naturalHeight;
    let sx0 = ((x0 / kx - fx) / fw) * iw;
    let sy0 = ((y0 / ky - fy) / fh) * ih;
    let sx1 = ((x1 / kx - fx) / fw) * iw;
    let sy1 = ((y1 / ky - fy) / fh) * ih;
    let dx0 = x0, dy0 = y0, dx1 = x1, dy1 = y1;
    // Clamp to the crop, moving the destination edge in proportion.
    const sxScale = (dx1 - dx0) / (sx1 - sx0);
    const syScale = (dy1 - dy0) / (sy1 - sy0);
    if (sx0 < 0) { dx0 -= sx0 * sxScale; sx0 = 0; }
    if (sy0 < 0) { dy0 -= sy0 * syScale; sy0 = 0; }
    if (sx1 > iw) { dx1 -= (sx1 - iw) * sxScale; sx1 = iw; }
    if (sy1 > ih) { dy1 -= (sy1 - ih) * syScale; sy1 = ih; }
    if (sx1 <= sx0 || sy1 <= sy0) return;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < k.xs.length; i++) {
      const x = k.xs[i] * kx;
      const y = k.ys[i] * ky;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(pressed, sx0, sy0, sx1 - sx0, sy1 - sy0, dx0, dy0, dx1 - dx0, dy1 - dy0);
    ctx.restore();
  };

  /**
   * Held keys, back row first. Where two held neighbours' outlines overlap, each crop shows the other at
   * rest; the nearer key (lower on screen, it occludes the one behind) must be painted last so its crop
   * wins, or the back key's crop would print the front key's resting top, legend and all, as a ghost.
   */
  const heldBackToFront = (): Prepared[] => {
    const list: Prepared[] = [];
    for (const slot of held) {
      const k = bySlot.get(slot);
      if (k) list.push(k);
    }
    return list.sort((a, b) => a.cy - b.cy);
  };

  /** Clear one key's box and repaint every held key that reaches into it, clipped to the box. */
  const repaint = (k: Prepared) => {
    if (!kx) return;
    const [x0, y0, x1, y1] = boxPx(k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    if (ready) {
      for (const other of heldBackToFront()) {
        const [a0, b0, a1, b1] = boxPx(other);
        if (a0 < x1 && a1 > x0 && b0 < y1 && b1 > y0) drawKey(other);
      }
    }
    ctx.restore();
  };

  const repaintAll = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ready) heldBackToFront().forEach(drawKey);
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }
    kx = canvas.width / UNITS;
    ky = canvas.height / UNITS;
    repaintAll();
  };
  const sizer = new ResizeObserver(size);
  sizer.observe(root);
  size();

  /** One pressed class: AVIF first, then the WebP twin if the AVIF fails to load or decode. */
  const fetchClass = async (src: BoardSource, c: number): Promise<HTMLImageElement> => {
    const attempt = async (ext: BoardSource["ext"]) => {
      const pressed = new Image();
      pressed.decoding = "async";
      pressed.fetchPriority = "low";
      pressed.src = pressedUrl({ ...src, ext }, c);
      await pressed.decode();
      return pressed;
    };
    try {
      return await attempt(src.ext);
    } catch (error) {
      if (src.ext === "webp") throw error;
      return attempt("webp");
    }
  };

  // If a class still can't be had, the board stays unpressed but never throws: ready resolves anyway,
  // presses are no-ops, the echo and the sound carry on.
  const load = async (src: BoardSource) => {
    let next: HTMLImageElement[];
    try {
      next = await Promise.all(Array.from({ length: CLASSES }, (_, c) => fetchClass(src, c)));
    } catch {
      performance.mark("kroma:board-failed");
      return;
    }
    if (!alive) return;
    images = next;
    ready = true;
    performance.mark("kroma:board-ready");
    repaintAll();
  };
  const readyPromise = load(source);

  // Crossing 640 px swaps the art-directed <img> between the desktop and phone renders: follow it.
  const onSwap = async () => {
    const next = sourceOf(img);
    if (!next || !KEYSETS[next.set] || next.set === source.set) return;
    source = next;
    ready = false;
    const set = await KEYSETS[next.set]!();
    keys = prepare(set.keys);
    field = set.field;
    bySlot = new Map(keys.map((k) => [k.s, k]));
    repaintAll();
    await load(next);
  };
  img.addEventListener("load", onSwap);

  const board: Board = {
    press(slot) {
      const k = bySlot.get(slot);
      if (!k || held.has(slot)) return;
      held.add(slot);
      repaint(k);
    },
    release(slot) {
      const k = bySlot.get(slot);
      if (!k || !held.delete(slot)) return;
      repaint(k);
    },
    releaseAll() {
      if (!held.size) return;
      held.clear();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    hit(clientX, clientY) {
      const rect = root.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * UNITS;
      const y = ((clientY - rect.top) / rect.height) * UNITS;
      let best: Prepared | null = null;
      let bestD = Infinity;
      for (const k of keys) {
        if (x < k.box[0] || x > k.box[2] || y < k.box[1] || y > k.box[3] || !inside(k, x, y)) continue;
        const d = (k.cx - x) ** 2 + (k.cy - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    },
    char: (slot) => bySlot.get(slot)?.t,
    ready: readyPromise,
    isReady: () => ready,
    attract(echo, onDone) {
      const word = "kroma";
      const slots = [...word].map((ch) => keys.find((k) => k.t === ch)?.s);
      echo?.clear();
      const later = (ms: number, fn: () => void) => {
        const t = setTimeout(() => {
          timers.delete(t);
          fn();
        }, ms);
        timers.add(t);
      };
      slots.forEach((slot, i) => {
        later(i * 90, () => {
          if (slot !== undefined) board.press(slot);
          echo?.type(word[i]);
        });
        later(i * 90 + 110, () => {
          if (slot !== undefined) board.release(slot);
          if (i === slots.length - 1) {
            echo?.rearm();
            performance.mark("kroma:attract-done");
            onDone?.();
          }
        });
      });
    },
    destroy() {
      alive = false;
      sizer.disconnect();
      img.removeEventListener("load", onSwap);
      timers.forEach(clearTimeout);
      timers.clear();
      held.clear();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
  return board;
}
