// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { ReactNode } from "react";
import { BackKey } from "@/components/sections/site-nav";
import { SiteFooter } from "@/components/sections/site-footer";
import styles from "./legal-page.module.css";

export type LegalSection = { heading: string; body: ReactNode };

/**
 * A typed cream page lying on the mat (spec §6.8): the [esc ← / back to kroma] key at the top left, where
 * Esc sits on a keyboard, and the paper on page columns 3–14.
 */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="page">
      <main id="main" className={`ug ${styles.main}`}>
        <div className={styles.backSlot}>
          <BackKey />
        </div>
        <article className={`paper ${styles.paper}`} aria-labelledby="legal-title">
          <header className={styles.head}>
            <h1 id="legal-title" className="t-h2">
              {title}
            </h1>
            <p className={`t-ui ${styles.updated}`}>last updated {updated}</p>
          </header>
          {sections.map((section, i) => (
            <section key={section.heading} className={styles.section}>
              <p className={`t-ui ${styles.number}`} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className={`t-ui-lg ${styles.heading}`}>{section.heading}</h2>
              <div className={`t-body ${styles.body}`}>{section.body}</div>
            </section>
          ))}
        </article>
      </main>
      <SiteFooter keymap={false} />
    </div>
  );
}
