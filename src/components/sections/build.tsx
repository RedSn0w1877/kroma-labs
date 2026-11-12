// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import brass from "@/data/kl75-brass.json";
import { BuildForm } from "./build-form";
import styles from "./build.module.css";

/**
 * #build, "build yours" (spec §6.6, §9). Pick a mat (the whole page re-chromes), a case, keycaps and a
 * switch (you hear it as you choose), engrave the brass, then press enter and a ticket prints. Nothing
 * is ordered and nothing typed leaves the browser.
 *
 * Server shell: the heading and intro are static HTML; the form, the preview and the ticket are one
 * client island. The brass engraving field is read here, so only four numbers reach the client.
 */
export function Build() {
  const [x, y, w, h] = brass.field;
  return (
    <section id="build" aria-labelledby="build-title" className={`ug ${styles.build}`}>
      <h2 id="build-title" className={`t-h2 ${styles.title}`}>
        build yours
      </h2>
      <p className={`t-lede ${styles.intro}`}>
        Pick a case, keycaps and a switch: you&apos;ll hear the switch as you choose it. $640, ships in about 3 weeks.
        The order is a demo: nothing is charged or sent, and you get a printed ticket.
      </p>
      <BuildForm brassField={[x / 1e4, y / 1e4, w / 1e4, h / 1e4]} brassCap={brass.capHeight} />
    </section>
  );
}
