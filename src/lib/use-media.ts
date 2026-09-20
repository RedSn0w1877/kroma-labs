"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a media query without ever setting state inside an effect body.
 *
 * The server (and the first client render) always answer `false`, so markup
 * matches on hydration and the query result lands on the next commit.
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    useCallback((notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    }, [query]),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
}
