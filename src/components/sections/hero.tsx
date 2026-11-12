// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { existsSync } from "node:fs";
import path from "node:path";
import { HeroBoard } from "@/components/board/hero-board";
import { Spectrum } from "@/components/board/spectrum";
import { Cap } from "@/components/ui/keycap";
import styles from "./hero.module.css";

/**
 * "Press any key" (spec §6.2). Server markup: every word is in the static HTML and nothing textual
 * animates in. The type sits on the key grid (1u = one of the board's 16 columns) above a photoreal
 * KL-75 that bleeds off the bottom of the first screen, its home row lined up with page columns 1–16.
 *
 * The three h1 lines are explicit and nowrap on desktop, so the box is identical before and after the
 * font swap. The echo starts on line 2 at columns 12–16 so it can never touch line 1, and the lede sentence
 * that needs JS ("Press any key…") is gated by html.js and pointer. The red Enter key has its own row under
 * the lede, beside the link to the sound section, so it never collides with the headline (polish round).
 * The copyright sits as a quiet corner mark at the end of that row, on the mat, not on the product.
 */

// Phones get WS-B's dedicated 1170×1100 crop of the right-hand cluster once it exists; until then the
// desktop render stands in. Decided at build time, so the HTML never points at a missing file.
const PHONE_RENDERS = ["kl75-phone-rest-1170.avif", "kl75-phone-rest-1170.webp"].every((f) =>
  existsSync(path.join(process.cwd(), "public", "renders", f)),
);

export function Hero() {
  return (
    <section id="top" className={styles.hero} aria-labelledby="top-title">
      <div className={`ug ${styles.type}`}>
        <p className={styles.wordmark}>
          <span className={styles.mark}>kroma</span> <span className="t-ui">kl-75 monolith</span>
        </p>

        <h1 id="top-title" tabIndex={-1} className={`t-h1 ${styles.h1}`}>
          <span className={styles.l}>a mechanical keyboard</span> <span className={styles.l}>you can hear before</span>{" "}
          <span className={styles.l}>you buy it.</span>
        </h1>

        <div className={styles.side}>
          <div className={styles.echo} aria-hidden="true">
            <span className={styles.echoLine} data-echo>
              kroma
            </span>
          </div>
          <p className={`t-ui-sm js-only ${styles.caption}`}>
            <span className={styles.cAttract}>typed on the board below. now you try.</span>
            <span className={styles.cStill}>type anything. it lands on the board below.</span>
          </p>
          <Spectrum size="sm" className={`js-only ${styles.mini}`} />
        </div>

        <p className={`t-lede ${styles.lede}`}>
          KL-75 Monolith: a 75% keyboard (every key but the number pad), machined from one block of aluminum.{" "}
          <span className="js-only kbd-only">Press any key to hear it.</span>
          <span className="js-only touch-only">Tap any key to hear it.</span>
        </p>

        <div className={styles.actions}>
          <Cap
            as="a"
            href="#build"
            tone="signal"
            w={2.25}
            top="build yours"
            aria-label="build yours, from $640"
            className={styles.cta}
          >
            from $640 ↵
          </Cap>
          <a className={`t-em ${styles.listen}`} href="#sound">
            hear the three switches ↓
          </a>
        </div>

        <p className={`t-fine ${styles.corner}`}>© 2026 HVNF Studios · do not redistribute</p>
      </div>

      <div className={styles.boardCrop}>
        <HeroBoard phone={PHONE_RENDERS} />
      </div>
    </section>
  );
}
