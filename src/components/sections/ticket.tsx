"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useRef } from "react";
import { Cap } from "@/components/ui/keycap";
import { glideAllowed } from "@/lib/glide";
import { SHIPS, barcode, buildLines, type Build } from "@/lib/build-code";
import styles from "./ticket.module.css";

/**
 * The printed build ticket (spec §6.6). A lazy chunk: build-form imports it on submit (and warms it on
 * the first interaction in #build). It feeds out of the mirror's slot like thermal paper, 18 steps over
 * 650 ms (instant under reduced motion), then takes focus so the visitor lands on what just happened.
 * The code and the barcode are derived from the build, never random.
 */

function Barcode({ code }: { code: string }) {
  const runs = barcode(code);
  const total = runs.reduce((a, b) => a + b, 0);
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  runs.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return (
    <svg className={styles.barcode} viewBox={`0 0 ${total} 10`} preserveAspectRatio="none" aria-hidden>
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={10} />
      ))}
    </svg>
  );
}

export default function Ticket({
  code,
  first,
  build,
  onEdit,
}: {
  code: string;
  first: string;
  build: Build;
  onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const h = heading.current;
    if (!h) return;
    h.focus({ preventScroll: true });
    // Follow the paper out of the slot. The feed's layout box is the ticket's full printed size (the
    // transform doesn't move layout), so this scrolls to where the ticket ends up, not where it starts.
    h.closest("article")?.parentElement?.scrollIntoView({
      block: "nearest",
      // Glides after a clicked [order]; jumps after Enter (src/lib/glide.ts).
      behavior: glideAllowed() ? "smooth" : "instant",
    });
  }, []);

  return (
    <article className={styles.ticket} aria-labelledby="ticket-title">
      <h3 id="ticket-title" ref={heading} tabIndex={-1} className={`t-ui ${styles.head}`}>
        kroma · build ticket
      </h3>
      <p className={styles.code}>{code}</p>
      <p className={`t-ui ${styles.for}`}>for {first}</p>
      <dl className={styles.lines}>
        {buildLines(build).map((line) => (
          <div key={line.k}>
            <dt>{line.k}</dt>
            <dd>{line.v}</dd>
          </div>
        ))}
      </dl>
      <p className={`t-ui-sm ${styles.ships}`}>{SHIPS}</p>
      <Barcode code={code} />
      <p className={`t-ui-sm ${styles.foot}`}>portfolio demo — nothing is ordered and nothing you type leaves your browser.</p>
      <p className={`t-fine ${styles.fine}`}>© 2026 HVNF Studios · do not redistribute</p>
      <Cap as="button" type="button" className={styles.edit} onClick={onEdit}>
        edit build
      </Cap>
    </article>
  );
}
