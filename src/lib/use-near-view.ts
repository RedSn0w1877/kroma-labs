"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is within `rootMargin` of the viewport.
 *
 * Used to mount an expensive WebGL scene only when it can actually be seen, so a
 * phone never holds two GPU contexts at once. State is set from the observer
 * callback, never synchronously in the effect body.
 */
export function useNearView(ref: RefObject<HTMLElement | null>, rootMargin = "120px 0px"): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return near;
}
