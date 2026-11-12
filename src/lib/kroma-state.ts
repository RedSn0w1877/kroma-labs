// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useSyncExternalStore } from "react";
import type { SwitchId } from "./switch-profiles";

/**
 * The page's one shared store (spec §5.5): which switch is voiced, whether sound is muted / has played /
 * can't play, and which desk mat is down. A tiny external store instead of React context, so the board
 * engine, the key router and the sound module (plain modules, not components) can read and write it too.
 *
 * Client-only: import it from client components and client modules. A server component may import its
 * types with `import type`.
 */

export type Mat = "yolk" | "chalk" | "ink";

export type KromaState = {
  /** The switch every strike plays unless a caller names one. #sound and #build both bind to it. */
  voice: SwitchId;
  /** The nav's [mute] key. While true, strike() returns false and plays nothing. */
  muted: boolean;
  /** True after the first strike that actually played; the nav shows [mute] from then on. */
  soundReady: boolean;
  /** True when this browser has no Web Audio; the sound section shows its notice. */
  unsupported: boolean;
  mat: Mat;
  /** The [explain] key: beginner explanations shown (true) or folded behind the spec (false). */
  explain: boolean;
};

/** What the server renders and what hydration sees. */
export const DEFAULT_STATE: Readonly<KromaState> = Object.freeze({
  voice: "tactile-topaz",
  muted: false,
  soundReady: false,
  unsupported: false,
  mat: "yolk",
  explain: false,
});

/** <meta name="theme-color"> per mat, so the browser chrome follows the page. */
export const MAT_THEME_COLOR: Readonly<Record<Mat, string>> = Object.freeze({
  yolk: "#F2C200",
  chalk: "#D8D5CC",
  ink: "#17171A",
});

let state: KromaState = DEFAULT_STATE;
const listeners = new Set<() => void>();

export function getState(): KromaState {
  return state;
}

/** Merge a patch; listeners run only when a value actually changed. `undefined` values are ignored. */
export function setState(patch: Partial<KromaState>): void {
  let next: KromaState | null = null;
  for (const key of Object.keys(patch) as (keyof KromaState)[]) {
    const value = patch[key];
    if (value === undefined || value === state[key]) continue;
    next ??= { ...state };
    (next as Record<keyof KromaState, unknown>)[key] = value;
  }
  if (!next) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Read one slice of the store in a component, e.g. `useKroma((s) => s.voice)`. The selector must return
 * a primitive or an existing reference (never a fresh object), because React compares snapshots by
 * identity. Hydration renders DEFAULT_STATE, so the first client render matches the server HTML.
 */
export function useKroma<T>(selector: (s: KromaState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT_STATE),
  );
}

function applyMat(mat: Mat): void {
  setState({ mat });
  const root = document.documentElement;
  if (mat === "yolk") delete root.dataset.mat;
  else root.dataset.mat = mat;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", MAT_THEME_COLOR[mat]);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Put a different mat down. Re-chromes the whole page through html[data-mat] (globals.css swaps --mat,
 * --ink and friends) and recolours the browser chrome.
 *
 * Where View Transitions exist, the new mat is laid down as a circle that grows from the chosen swatch
 * over ~420 ms (one-shot, compositor-run, CSS in globals.css), so yolk never fades through olive on its way
 * to ink. Elsewhere, and under reduced motion, body fades its background in Oklab over 240 ms.
 */
export function setMat(mat: Mat): void {
  if (mat === state.mat) return;
  const doc = document as ViewTransitionDocument;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) {
    applyMat(mat);
    return;
  }
  const root = document.documentElement;
  const swatch = document.querySelector(`input[name="mat"][value="${mat}"]`);
  const box = swatch?.getBoundingClientRect();
  const x = box && box.width ? box.left + box.width / 2 : window.innerWidth / 2;
  const y = box && box.height ? box.top + box.height / 2 : window.innerHeight / 2;
  // The farthest viewport corner from the origin: the circle's final radius.
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.style.setProperty("--vt-x", `${Math.round(x)}px`);
  root.style.setProperty("--vt-y", `${Math.round(y)}px`);
  root.style.setProperty("--vt-r", `${Math.ceil(r)}px`);
  root.dataset.rechrome = "";
  const done = () => {
    delete root.dataset.rechrome;
  };
  try {
    doc.startViewTransition(() => applyMat(mat)).finished.then(done, done);
  } catch {
    done();
    applyMat(mat);
  }
}
