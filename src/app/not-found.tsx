// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata } from "next";
import { BackKey } from "@/components/sections/site-nav";
import styles from "@/components/legal/legal-page.module.css";

/**
 * The 404 (static export: out/404.html). The legal pages' chrome in its smallest form: the
 * [esc ← / back to kroma] key, one cream sheet with one plain line, and the © side-print, so a dead link
 * stays on-brand and watermarked. Kept deliberately tiny: the root not-found tree is serialised into every
 * page's RSC payload, so it doesn't reuse LegalPage and its full footer. (It does reuse the legal
 * stylesheet: Turbopack's default CSS chunking merges that into the shared chunk every route loads anyway,
 * so a separate 404 stylesheet would only add bytes.)
 */

export const metadata: Metadata = {
  title: "not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="page">
      <main id="main" className={`ug ${styles.main}`}>
        <div className={styles.backSlot}>
          <BackKey />
        </div>
        <article className={`paper ${styles.paper}`} aria-labelledby="nf-title">
          <h1 id="nf-title" className={`t-h2 ${styles.head}`}>
            no key here.
          </h1>
          <p className={`t-body ${styles.head}`}>
            This page doesn&apos;t exist. Press Esc, or the key above, to go back to the keyboard.
          </p>
          <p className={`t-fine ${styles.head}`}>© 2026 HVNF STUDIOS · PORTFOLIO SAMPLE — DO NOT REDISTRIBUTE</p>
        </article>
      </main>
    </div>
  );
}
