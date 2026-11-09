"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import styles from "./spec-sheet.module.css";

/**
 * #specs, "the numbers" (spec §6.5). A typed index card lying on the mat: cream paper on the page's own
 * columns (a subgrid), four big figures, then four groups of label/value lines with no rules, cells or
 * dividers.
 *
 * A client component with no state, props or effects, on purpose (perfPlan §9: "big markup lives in client
 * components so it isn't duplicated in the RSC payload"). Every word is still in the static HTML; as a
 * server component its whole tree was also serialised into the inline RSC flight, about 11 KB of the
 * page's HTML. As a client island the flight carries one reference and the copy ships once, in the cached
 * JS chunk.
 */

const SPEC_GROUPS = [
  {
    index: "A",
    title: "case",
    rows: [
      ["Material", "6063-T6 aluminum, machined from one solid block (billet)"],
      ["Mating-face tolerance", "±0.02 mm"],
      ["Finish", "Type II anodize, 20–25 µm"],
      ["Typing angle", "7.2°"],
      ["Front height", "18.5 mm"],
    ],
  },
  {
    index: "B",
    title: "size and weight",
    rows: [
      ["Footprint", "334.0 × 148.8 mm"],
      ["Case mass", "1.52 kg"],
      ["Built mass", "2.48 kg with switches and keycaps"],
      ["Brass weight", "620 g C360 brass, mirror PVD"],
    ],
  },
  {
    index: "C",
    title: "mounting and sound",
    rows: [
      ["Mount style", "Gasket, 12 × urethane foam (Shore 20A)"],
      ["Plate", "Leaf-spring FR4, 1.2 mm, flex-cut"],
      ["Dampening", "Case foam, PE sheet, IXPE switch pad"],
      ["Tuning options", "Plate foam in / out, O-ring gasket kit"],
    ],
  },
  {
    index: "D",
    title: "electronics",
    rows: [
      ["PCB", "1.6 mm FR4, hot-swap, south-facing sockets"],
      ["Firmware", "QMK / VIA"],
      ["Connection", "USB-C, 1000 Hz polling"],
      ["Layouts", "75% ANSI, 75% ISO"],
    ],
  },
] as const;

/** The four headline figures (§14): number, unit, one line of plain English. */
const FIGURES = [
  { n: "1.52", unit: "kg", text: "The case alone. It starts as a 4.6 kg block of aluminum." },
  { n: "±0.02", unit: "mm", text: "How closely every mating face is cut: about a quarter of a hair's width." },
  { n: "7.2°", unit: "", text: "The typing angle is machined into the case, so there are no feet to flip out." },
  { n: "82", unit: "keys", text: "A 75% layout: every key but the number pad, packed tight." },
] as const;

export function SpecSheet() {
  return (
    <section id="specs" aria-labelledby="specs-title" className={`ug ${styles.specs}`}>
      <h2 id="specs-title" className={`t-h2 ${styles.title}`}>
        the numbers
      </h2>
      <p className={`t-body ${styles.intro}`}>
        Measured on the first production case. Every KL-75 ships with its own inspection card listing the measured
        flatness of the plate shelf.
      </p>

      <div className={`paper ${styles.card}`}>
        <ul className={styles.figures} aria-label="the four numbers that matter">
          {FIGURES.map((f) => (
            <li key={f.n} className={styles.figure}>
              <p className={styles.fig}>
                <span className="t-fig">{f.n}</span>
                {f.unit && <span className={styles.unit}>{f.unit}</span>}
              </p>
              <p className={`t-body ${styles.caption}`}>{f.text}</p>
            </li>
          ))}
        </ul>

        {SPEC_GROUPS.map((group) => (
          <section key={group.index} className={styles.group} aria-labelledby={`specs-${group.index}`}>
            <h3 id={`specs-${group.index}`} className={`t-ui-lg ${styles.groupTitle}`}>
              {group.title}
            </h3>
            <dl className={styles.rows}>
              {group.rows.map(([label, value]) => (
                <div key={label} className={styles.row}>
                  <dt className="t-ui">{label}</dt>
                  <dd className={`t-body ${styles.value}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}
