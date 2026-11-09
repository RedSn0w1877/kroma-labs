// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/**
 * Device tiers, in one place for both sides of the page. Copied from HVNF main's src/lib/device.ts,
 * plus the `data-embed` flag Kroma needs (spec §5.2).
 *
 * No "use client" on purpose. layout.tsx is a server component and needs liteScript() as a string to
 * inline in <head>; client code reads the same answers back with isLite() and isEmbed(). So the guess
 * made before first paint and the answer the scripts act on can never drift apart.
 *
 * "Lite" means: no idle preloading, pressed renders load on first touch, and the explode is a still
 * plus a list. Phones, small touch screens, reduced motion, low core counts, low memory, data saver
 * and slow connections all land there.
 *
 * "Embed" means the page is framed (HVNF's Work carousel iframes the hero): only the hero renders
 * (globals.css hides everything else) and sound never starts.
 */

export const LITE_QUERIES = [
  "(prefers-reduced-motion: reduce)",
  "(max-width: 767px)",
  "(pointer: coarse) and (max-width: 1024px)",
] as const;

/** Four cores or fewer, or 4GB or less, is a phone-class budget whatever the screen says. */
export const LITE_MAX_CORES = 4;
export const LITE_MAX_MEMORY_GB = 4;
export const LITE_SLOW_NETWORK = /^(slow-2g|2g|3g)$/;

/**
 * The pre-paint guess, about 500 bytes. It runs while the HTML is still parsing, so CSS can branch on
 * html[data-lite] and html[data-embed] from the very first frame. It also marks html.js, so styles can
 * tell a scripted page from a no-JS one. Wrapped in try/catch: a browser that cannot answer is treated
 * as full; a frame whose parent can't be read (cross-origin) is an embed.
 */
export function liteScript(): string {
  return (
    `(function(){var d=document.documentElement,n=navigator,c=n.connection||{};d.classList.add("js");` +
    `try{if(window.self!==window.top)d.setAttribute("data-embed","")}catch(e){d.setAttribute("data-embed","")}` +
    `try{if(${JSON.stringify(LITE_QUERIES)}.some(function(q){return matchMedia(q).matches})` +
    `||(n.hardwareConcurrency>0&&n.hardwareConcurrency<=${LITE_MAX_CORES})` +
    `||n.deviceMemory<=${LITE_MAX_MEMORY_GB}` +
    `||c.saveData===true` +
    `||${LITE_SLOW_NETWORK}.test(c.effectiveType||""))d.setAttribute("data-lite","")}catch(e){}` +
    // html.fx = "full experience" (scripted and not lite): one short class for CSS to gate on, instead of
    // repeating html.js:not([data-lite]) in every rule (inside.module.css has 26 of them).
    `if(!d.hasAttribute("data-lite"))d.classList.add("fx")})()`
  );
}

const flag = (name: string): boolean =>
  typeof document !== "undefined" && document.documentElement.hasAttribute(name);

/** True when the pre-paint script marked this device lite. Read it in effects and handlers, never in render. */
export const isLite = (): boolean => flag("data-lite");

/** True when the page is framed (HVNF's Work carousel). Read it in effects and handlers, never in render. */
export const isEmbed = (): boolean => flag("data-embed");
