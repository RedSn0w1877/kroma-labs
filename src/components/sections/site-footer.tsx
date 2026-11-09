// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Cap } from "@/components/ui/keycap";
import styles from "./site-footer.module.css";

/**
 * The footer is the keymap (spec §6.7): a cream sheet listing ONLY the shortcuts that really work on
 * this page. The key router (WS-C) presses [a–z] and [esc] through their data-keymap hooks while #keymap
 * is on screen. Below it: the legal links, the fictional-brand note and the © keycap with its side-print.
 * Server component, no JS. The legal pages render it with keymap={false}.
 */

const KEYMAP: { keys: ReactNode; text: string }[] = [
  {
    keys: (
      <Cap as="kbd" w={1.25} data-keymap="letters">
        a–z
      </Cap>
    ),
    text: "hear the switch: on the board up top, in sound, or right here",
  },
  {
    keys: ["1", "2", "3"].map((n) => (
      <Cap key={n} as="kbd" w={1}>
        {n}
      </Cap>
    )),
    text: "pick a switch, in sound",
  },
  {
    keys: ["←", "→"].map((arrow) => (
      <Cap key={arrow} as="kbd" w={1}>
        {arrow}
      </Cap>
    )),
    text: "change the mat, in build",
  },
  {
    keys: (
      <Cap as="kbd" tone="signal" w={2.25}>
        enter
      </Cap>
    ),
    text: "order, in build",
  },
  {
    keys: (
      <Cap as="kbd" w={1} data-keymap="esc">
        esc
      </Cap>
    ),
    text: "back to the top",
  },
];

export function SiteFooter({ keymap = true }: { keymap?: boolean }) {
  return (
    <footer className={`ug ${styles.footer}`} data-plain={keymap ? undefined : ""}>
      {keymap && (
        <section id="keymap" aria-labelledby="keymap-title" className={`paper ${styles.sheet}`}>
          <h2 id="keymap-title" className={`t-h2 ${styles.title}`}>
            keymap
          </h2>
          <p className={`t-ui ${styles.sub}`}>the shortcuts that work on this page</p>
          <dl className={styles.list}>
            {KEYMAP.map((entry) => (
              <div key={entry.text} className={styles.entry}>
                <dt className={styles.keys}>{entry.keys}</dt>
                <dd className={`t-ui-lg ${styles.what}`}>{entry.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className={styles.base}>
        <p className={`t-ui ${styles.legal}`}>
          <Link href="/legal/terms/">terms of use</Link> · <Link href="/legal/privacy/">privacy</Link>
        </p>
        <p className={`t-body ${styles.note}`}>
          Kroma is a fictional brand, designed and built by HVNF Studios as a portfolio concept. Specifications, prices
          and shipping times are illustrative. Nothing here is for sale.
        </p>
        {/* The copyright as a pad-printed side legend next to a © keycap. */}
        <p className={styles.sideprint}>
          <kbd className="cap" style={{ "--w": 1 } as CSSProperties} aria-hidden>
            ©
          </kbd>
          <span className="t-fine">© 2026 HVNF STUDIOS · ALL RIGHTS RESERVED · PORTFOLIO SAMPLE — DO NOT REDISTRIBUTE</span>
        </p>
      </div>
    </footer>
  );
}
