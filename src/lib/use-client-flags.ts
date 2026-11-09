// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useCallback, useSyncExternalStore } from "react";

/**
 * Client-only flags that are safe during hydration (spec §5.4).
 *
 * useSyncExternalStore renders the *server* snapshot for the hydration pass, then re-renders with the
 * real browser value. So the first client render always matches the server HTML (no React #418), and
 * nothing has to call setState inside an effect.
 *
 * Never branch visible markup on these during hydration: anything visible at first paint is decided
 * by CSS (html.js, html[data-lite], html[data-embed], media queries). Use these for behaviour and for
 * attributes that only matter after hydration.
 */

const subscribeNothing = () => () => {};

/** false on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** A media query that reads false on the server and during hydration, then tracks the browser. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type HtmlFlag = "data-lite" | "data-embed";

/** Whether <html> carries data-lite or data-embed (set by liteScript before paint). false on the server. */
export function useHtmlFlag(name: HtmlFlag): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [name] });
      return () => observer.disconnect();
    },
    [name],
  );
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute(name),
    () => false,
  );
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The reduced-motion preference as a hook (false during hydration). */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION);
}

/** The reduced-motion preference right now, for event handlers and effects (false on the server). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION).matches;
}
