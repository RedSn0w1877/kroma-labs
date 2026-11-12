"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Cap, capClass } from "@/components/ui/keycap";
import { installGlide } from "@/lib/glide";
import { setState, useKroma } from "@/lib/kroma-state";
import styles from "./site-nav.module.css";

/**
 * The function row (spec §6.1). Desktop and tablet: a right-anchored row of keycaps, top right, no bar.
 * Phones: a bottom dock instead. Both are plain anchor links; the section in view sits pressed
 * (aria-current="location"), driven by one IntersectionObserver and no scroll listener.
 *
 * The f-legends are labels only: physical F1–F12 are never captured (the key router ignores them), so
 * they are hidden from assistive tech rather than announced as shortcuts that don't exist.
 */

const SECTIONS = [
  { id: "sound", f: "f1", label: "sound" },
  { id: "inside", f: "f2", label: "inside" },
  { id: "specs", f: "f3", label: "specs" },
  { id: "build", f: "f4", label: "build" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Whichever watched section crosses the line 45% down the viewport. null in the hero and the footer. */
function useCurrentSection(): SectionId | null {
  const [current, setCurrent] = useState<SectionId | null>(null);
  useEffect(() => {
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setCurrent(SECTIONS.find((section) => inBand.has(section.id))?.id ?? null);
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return current;
}

/** Appears once sound has actually played; pressed while muted. */
function MuteKey({ className }: { className: string }) {
  const muted = useKroma((s) => s.muted);
  return (
    <Cap as="button" type="button" className={className} aria-pressed={muted} onClick={() => setState({ muted: !muted })}>
      mute
    </Cap>
  );
}

export function SiteNav() {
  const current = useCurrentSection();
  // Every in-page link on the page jumps instantly from the keyboard and glides only on a pointer click.
  useEffect(() => installGlide(), []);
  const soundReady = useKroma((s) => s.soundReady);
  const here = (id: SectionId) => (current === id ? "location" : undefined);

  return (
    <>
      <nav aria-label="sections" className={styles.row} data-print-hide>
        {/* The row is anchored right, so nothing moves when [mute] arrives at its left end. */}
        {soundReady && <MuteKey className={styles.key} />}
        {SECTIONS.map((section) => (
          <Cap
            key={section.id}
            as="a"
            href={`#${section.id}`}
            top={section.f}
            topHidden
            className={styles.key}
            aria-current={here(section.id)}
          >
            {section.label}
          </Cap>
        ))}
        <Cap as="a" href="#order" tone="signal" top="enter ↵" topHidden className={`${styles.key} ${styles.order}`}>
          order
        </Cap>
      </nav>

      <nav aria-label="sections" className={styles.dock} data-print-hide>
        <Cap as="a" href="#top" top="↑" topHidden className={`${styles.dockKey} ${styles.dockTop}`}>
          top
        </Cap>
        {SECTIONS.filter((section) => section.id !== "build").map((section) => (
          <Cap key={section.id} as="a" href={`#${section.id}`} className={styles.dockKey} aria-current={here(section.id)}>
            {section.label}
          </Cap>
        ))}
        <Cap as="a" href="#build" tone="signal" className={styles.dockKey} aria-current={here("build")}>
          build yours
        </Cap>
      </nav>
      {soundReady && <MuteKey className={styles.muteMobile} />}
    </>
  );
}

/**
 * The legal pages' one navigation key: [esc ← / back to kroma]. The legend promises Esc, so Esc works:
 * it presses the key and goes home (outside text fields; the key's native behaviour is untouched).
 */
export function BackKey({ className }: { className?: string }) {
  const router = useRouter();
  const key = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.isComposing) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
      key.current?.setAttribute("data-down", "");
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Link ref={key} href="/" className={capClass("cream", `${styles.back} ${className ?? ""}`.trim())}>
      <span className="cap__top" aria-hidden>
        esc ←
      </span>
      <span>back to kroma</span>
    </Link>
  );
}
