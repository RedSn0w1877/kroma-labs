// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { prefersReducedMotion } from "./use-client-flags";

/**
 * Smooth scrolling for pointer clicks only. `html` scrolls instantly by default (globals.css), so Tab
 * focus, Enter on a link, Esc and every other keyboard-initiated scroll jump straight there: a keyboard
 * action is repeated too often to animate. A mouse or touch click on an in-page link sets
 * `html[data-glide]`, which turns `scroll-behavior: smooth` on for that one fragment navigation; the
 * browser's own link handling still runs (history, :target, the focus start point). The flag drops on
 * `scrollend`, on the next key press, or after 1.5 s at most.
 */

let lastInput: "pointer" | "key" = "key";

/** True when the last input was a pointer and motion is allowed: callers may pass behavior "smooth". */
export function glideAllowed(): boolean {
  return lastInput === "pointer" && !prefersReducedMotion();
}

/** Installs the listeners; returns the cleanup. Passive listeners only: no idle work, no rAF. */
export function installGlide(): () => void {
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    window.removeEventListener("scrollend", stop);
    delete root.dataset.glide;
  };

  const onPointer = () => {
    lastInput = "pointer";
  };
  const onKey = () => {
    lastInput = "key";
    if ("glide" in root.dataset) stop();
  };
  const onClick = (event: MouseEvent) => {
    // detail is 0 when a key (Enter) activated the link.
    if (event.defaultPrevented || event.detail === 0 || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement) || !link.hash) return;
    if (link.pathname !== location.pathname || link.origin !== location.origin) return;
    if (prefersReducedMotion()) return;
    stop();
    root.dataset.glide = "";
    window.addEventListener("scrollend", stop, { once: true });
    timer = setTimeout(stop, 1500);
  };

  window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  window.addEventListener("keydown", onKey, { capture: true, passive: true });
  document.addEventListener("click", onClick);
  return () => {
    stop();
    window.removeEventListener("pointerdown", onPointer, { capture: true });
    window.removeEventListener("keydown", onKey, { capture: true });
    document.removeEventListener("click", onClick);
  };
}
