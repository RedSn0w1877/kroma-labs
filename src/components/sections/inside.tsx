// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { CSSProperties, ReactNode } from "react";
import explode from "@/data/kl75-explode.json";
import { ExplainKey } from "@/components/ui/explain-key";
import { InsideStage, type StackLayer } from "./inside-stage";
import styles from "./inside.module.css";

/**
 * #inside, "what's inside" (spec §6.4). The board comes apart in six detents as you scroll: a sticky
 * 100svh stage inside a 320svh section, animated by CSS scroll-driven animations on transform and opacity
 * only (a one-variable JS fallback where animation-timeline isn't supported). Which mode applies is
 * decided by CSS before first paint; reduced motion, lite devices and no-JS get the still, the list and
 * a toggle.
 *
 * Server component: all text lives here and is always visible. The figure (eight <picture>s) is rendered
 * by the client island so its markup isn't duplicated in the RSC payload.
 */

/** Detent start points (fraction of the sticky phase). Layer k travels a_k → a_k + .08, then holds. */
const A = [0.1, 0.26, 0.42, 0.58, 0.74, 0.9, 1] as const;

/** Each layer leads with its spec line (facts); the plain-English body is a beginner explanation, folded
 *  behind [explain the jargon]. Every fact comes from the spec card (spec-sheet.tsx) or switch-profiles.ts. */
const LAYERS: { title: string; body: ReactNode; facts: string }[] = [
  {
    title: "keycaps",
    body: "82 keycaps in thick PBT, a hard, matte plastic that won't go shiny. The letters are dyed in, so they never wear off.",
    facts: "82 × PBT, dye-sublimated legends",
  },
  {
    title: "switches",
    body: "82 switches, one under each key: a spring and a stem in a small housing. This is what clicks when you press.",
    facts: "82 × MX-style: linear, tactile or silent",
  },
  {
    title: "plate",
    body: (
      <>
        Twelve foam gaskets hold the plate between the top frame and the case. No screw touches it, so each keystroke
        sinks into foam instead of ringing through the aluminum. That&apos;s where the deep, soft sound comes from.
      </>
    ),
    facts: "FR4, 1.2 mm, flex-cut · 12 × Shore 20A urethane gaskets",
  },
  {
    title: "circuit board",
    body: "Sockets on the circuit board take any standard MX-style switch. Change the sound of the whole board in minutes, with no soldering iron.",
    facts: "1.6 mm FR4, hot-swap · QMK / VIA · 1000 Hz · USB-C",
  },
  {
    title: "brass weight",
    body: "A 620 g polished brass weight sits 4 mm above the desk. It pulls the balance of the board under the home row and adds depth to every keystroke.",
    facts: "620 g C360 / 0.8 µm PVD coat",
  },
  {
    title: "case",
    body: "It starts as a 4.6 kg block of aluminum and leaves the mill at 1.52 kg, cut to within ±0.02 mm on every face that meets another.",
    facts: "6063-T6 billet · ±0.02 mm · Type II anodize",
  },
];

/** kl75-explode.json (WS-B): dy = how far down, in % of frame height, each layer sits when assembled. Read
 *  by this server component at build time, so only the seven numbers reach the page. */
type ExplodeData = {
  layers: { id: string; dy: number }[];
  overlay?: { id: string; dy: number; above: string; below: string };
};

/** Bottom to top, as they stack on screen. Detent k (1–5) lifts the layer; the case and the lip never move. */
const STACK_ORDER = ["case", "brass", "pcb", "plate", "switches", "lip", "keycaps"] as const;
const DETENT: Record<string, number> = { keycaps: 1, switches: 2, plate: 3, pcb: 4, brass: 5 };

function stackLayers(data: ExplodeData): StackLayer[] {
  const dy = new Map(data.layers.map((l) => [l.id, l.dy]));
  if (data.overlay) dy.set(data.overlay.id, data.overlay.dy);
  return STACK_ORDER.filter((id) => dy.has(id)).map((id) => ({
    id,
    file: id === "lip" ? "lip" : `layer-${id}`,
    dy: Math.round((dy.get(id) ?? 0) * 100) / 100,
    detent: DETENT[id] ?? 0,
    a: DETENT[id] ? A[DETENT[id] - 1] : 0,
  }));
}

export function Inside() {
  const layers = stackLayers(explode as ExplodeData);
  return (
    <section id="inside" aria-labelledby="inside-title" className={styles.inside}>
      <div className={`ug ${styles.stage}`}>
        <div className={styles.copy}>
          <h2 id="inside-title" className={`t-h2 ${styles.title}`}>
            what&apos;s inside
          </h2>
          <p className={`t-lede ${styles.intro}`}>
            Six layers, stacked like a sandwich.
            <span className={styles.scrollOnly}> Keep scrolling and we&apos;ll take it apart, one layer at a time.</span>
          </p>
          <ExplainKey className={styles.explainKey} />
          <ol className={styles.layers} aria-label="the six layers, top to bottom">
            {LAYERS.map((layer, i) => (
              <li key={layer.title} data-k={i + 1} className={styles.item}>
                <span className={`cap ${styles.idx}`} aria-hidden>
                  {i + 1}
                </span>
                <div className={styles.itemText}>
                  <h3 className={`t-ui-lg ${styles.itemTitle}`}>{layer.title}</h3>
                  <p className={`t-ui-sm ${styles.facts}`}>{layer.facts}</p>
                  <p className={`explain ${styles.itemBody}`}>{layer.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <InsideStage layers={layers} />
      </div>
      {/* Scroll mode only: six bands, one per detent window, read by one IntersectionObserver. */}
      {A.slice(0, 6).map((a, i) => (
        <div
          key={a}
          aria-hidden
          data-sentinel={i + 1}
          className={styles.sentinel}
          style={{ "--a": a, "--b": A[i + 1] } as CSSProperties}
        />
      ))}
    </section>
  );
}
