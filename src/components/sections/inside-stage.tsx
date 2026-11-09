"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useState, type CSSProperties } from "react";
import { asset } from "@/lib/asset";
import { isLite } from "@/lib/device";
import { useHydrated } from "@/lib/use-client-flags";
import styles from "./inside.module.css";

/**
 * The #inside figure and its behaviour (spec §6.4).
 *
 * Markup: the assembled still, the stack of layers (each rendered at its exploded position and pushed
 * down by --dy into its assembled pose) and the exploded still. CSS shows the right subset per mode, so
 * lazy images in a display:none branch are never fetched: scroll mode loads the still + 7 layers, static
 * mode loads one still (two after the toggle).
 *
 * Behaviour, after hydration only:
 * - scroll mode: one IntersectionObserver over six detent bands sets data-detent on #inside and
 *   aria-current="step" on the matching list item (attributes only, no React state per detent);
 * - where animation-timeline isn't supported (Firefox), a passive scroll listener, attached only while
 *   #inside intersects, writes one variable (--p) per frame;
 * - static mode: the toggle swaps the assembled and exploded stills.
 */

export type StackLayer = { id: string; file: string; dy: number; detent: number; a: number };

/**
 * Extra lift in the exploded pose, % of the frame, on top of the render's own spread (fixer round 1,
 * idc-06): the baked spacing read as a compressed stack, so each layer climbs a little further than the
 * one under it. The keycaps' extra rise runs into the figure's top padding (overflow-clip-margin).
 */
const LIFT: Record<string, number> = { keycaps: -9, switches: -6.5, plate: -4, pcb: -1.5 };
/** The layers above the brass. At detent 5 they thin to a ghost so the brass weight can be seen. */
const XRAY = new Set(["keycaps", "switches", "plate", "pcb"]);

/** Must match the scroll-mode media query in inside.module.css. */
const SCROLL_MODE = "(prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 600px)";
const SIZES = "(min-width: 1024px) 62vw, 100vw";

function Pic({
  name,
  alt,
  className,
  style,
  detent,
  xray,
}: {
  name: string;
  alt: string;
  className: string;
  style?: CSSProperties;
  detent?: number;
  xray?: boolean;
}) {
  const base = asset(`/renders/kl75-inside-${name}`);
  return (
    <picture className={className} style={style} data-l={detent} data-x={xray || undefined}>
      <source type="image/avif" srcSet={`${base}-960.avif 960w, ${base}-1600.avif 1600w`} sizes={SIZES} />
      <source type="image/webp" srcSet={`${base}-960.webp 960w, ${base}-1600.webp 1600w`} sizes={SIZES} />
      <img src={`${base}-1600.webp`} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" />
    </picture>
  );
}

function useDetents() {
  useEffect(() => {
    const section = document.getElementById("inside");
    if (!section || isLite() || !window.matchMedia(SCROLL_MODE).matches) return;

    // Which detent band crosses the middle of the viewport. Bands abut, so at a boundary two can touch
    // the 1% line for a moment; the later detent wins.
    const items = Array.from(section.querySelectorAll<HTMLElement>("[data-k]"));
    const inBand = new Set<number>();
    let current = 0;
    const detents = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const k = Number((entry.target as HTMLElement).dataset.sentinel);
          if (entry.isIntersecting) inBand.add(k);
          else inBand.delete(k);
        }
        const next = inBand.size ? Math.max(...inBand) : 0;
        if (next === current) return;
        current = next;
        if (next) section.dataset.detent = String(next);
        else delete section.dataset.detent;
        for (const item of items) {
          if (Number(item.dataset.k) === next) item.setAttribute("aria-current", "step");
          else item.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-49.5% 0px -49.5% 0px" },
    );
    section.querySelectorAll("[data-sentinel]").forEach((band) => detents.observe(band));

    // Fallback progress writer. Native scroll timelines need none of this.
    let near: IntersectionObserver | null = null;
    let frame = 0;
    const write = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height - window.innerHeight)));
      section.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    if (!CSS.supports("animation-timeline: view()")) {
      near = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          window.addEventListener("scroll", onScroll, { passive: true });
          onScroll();
        } else {
          window.removeEventListener("scroll", onScroll);
        }
      });
      near.observe(section);
    }

    return () => {
      detents.disconnect();
      near?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

export function InsideStage({ layers }: { layers: StackLayer[] }) {
  const [exploded, setExploded] = useState(false);
  const hydrated = useHydrated();
  useDetents();

  return (
    <div className={styles.figure}>
      <div id="inside-frame" className={styles.frame} data-view={exploded ? "exploded" : undefined}>
        <Pic name="assembled" className={styles.assembled} alt="The KL-75 assembled, seen from the front left." />
        {/* The layers only ever show in scroll mode, which needs JS, so they're added after hydration:
            seven decorative <picture>s kept out of the static HTML. */}
        <div className={styles.stack} aria-hidden>
          {hydrated && layers.map((layer) => (
            <Pic
              key={layer.id}
              name={layer.file}
              alt=""
              className={styles.layer}
              detent={layer.detent || undefined}
              xray={XRAY.has(layer.id)}
              style={{ "--dy": `${layer.dy}%`, "--a": layer.a, "--lift": `${LIFT[layer.id] ?? 0}%` } as CSSProperties}
            />
          ))}
        </div>
        <Pic
          name="exploded"
          className={styles.exploded}
          alt="The KL-75 taken apart into six layers, top to bottom: keycaps, switches, plate, circuit board, brass weight and case."
        />
      </div>
      {/* Static mode with JS only (CSS hides it in scroll mode and without JS). The label says what the
          press will do, so it carries no aria-pressed; the latched look comes from data-down. */}
      <button
        type="button"
        className={`cap js-only ${styles.toggle}`}
        aria-controls="inside-frame"
        data-down={exploded || undefined}
        onClick={() => setExploded((v) => !v)}
      >
        {exploded ? "put it back together" : "explore the six layers"}
      </button>
    </div>
  );
}
