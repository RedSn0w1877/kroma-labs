"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown } from "lucide-react";
import { LazyKeyboardScene } from "@/components/three/lazy-keyboard-scene";
import type { Vec3 } from "@/components/three/keyboard-scene";
import { CornerTicks, SheetMark } from "@/components/brand/sheet-mark";
import { useScrollTo } from "@/components/providers/smooth-scroll";
import { EASE_OUT } from "@/components/ui/reveal";
import { useMedia } from "@/lib/use-media";
import { useNearView } from "@/lib/use-near-view";

const LINE_ONE = ["Machined", "from", "solid", "billet."];
const LINE_TWO = ["Tuned", "for", "a", "quieter", "strike."];

const CAMERA: Vec3 = [0.55, 2.5, 4.9];
const TARGET: Vec3 = [0, 0.18, 0];

const FIGURES = [
  { label: "Case mass", value: "1.52 kg" },
  { label: "Face tolerance", value: "±0.02 mm" },
  { label: "Batch 04", value: "120 units" },
  { label: "From", value: "$640" },
] as const;

function KineticLine({
  words,
  startIndex,
  className,
  highlightIndex,
}: {
  words: string[];
  startIndex: number;
  className?: string;
  /** Index of the one word to render in the editorial italic serif accent, breaking from the uppercase sans. */
  highlightIndex?: number;
}) {
  const reduce = useReducedMotion();
  return (
    // aria-hidden because the h1 carries its own plain-text aria-label; this is just the animated visual.
    <span aria-hidden className={`block ${className ?? ""}`}>
      {words.map((word, i) => {
        const isHighlight = i === highlightIndex;
        return (
          <span key={word}>
            <span
              className={`inline-block overflow-hidden pb-[0.06em] align-bottom ${
                isHighlight
                  ? "font-[family-name:var(--font-editorial-serif)] normal-case italic tracking-normal text-signal"
                  : ""
              }`}
            >
              <motion.span
                className="inline-block"
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 + (startIndex + i) * 0.07 }}
              >
                {word}
              </motion.span>
            </span>
            {/* A real space character, not just CSS margin, so selecting or copying this text doesn't run words together. */}
            {i < words.length - 1 && " "}
          </span>
        );
      })}
    </span>
  );
}

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const scrollTo = useScrollTo();
  const stage = useRef<HTMLDivElement>(null);
  const wide = useMedia("(min-width: 1024px)");
  const near = useNearView(stage);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -90]);

  return (
    <section id="top" ref={section} className="relative border-b border-hairline pt-16">
      <div className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12">
        <motion.div
          style={wide && !reduce ? { y: copyY } : undefined}
          className="flex flex-col justify-between gap-12 px-5 pb-10 pt-10 md:px-10 lg:col-span-6 lg:pb-12 lg:pt-12 xl:col-span-5"
        >
          <div>
            <SheetMark sheet="01" title="General arrangement" />
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-signal">KL-75 / Monolith — Mechanical keyboard</p>
            <h1
              aria-label="Machined from solid billet. Tuned for a quieter strike."
              className="mt-5 font-display text-[clamp(2.5rem,4.8vw,5.25rem)] font-semibold uppercase leading-[0.92] tracking-[-0.03em]"
            >
              <KineticLine words={LINE_ONE} startIndex={0} highlightIndex={0} />
              <KineticLine words={LINE_TWO} startIndex={LINE_ONE.length} className="text-metric" />
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-8 max-w-md text-[15px] leading-relaxed text-metric"
            >
              Each KL-75 case starts as a 4.6 kg block of 6063-T6 aluminum and leaves the mill at 1.52 kg, cut to
              ±0.02 mm on every mating face. A PVD brass ballast keeps the center of mass under the home row. A
              leaf-spring FR4 plate sets the sound.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 1.05 }}
              className="mt-9 flex flex-wrap gap-3"
            >
              <a
                href="#allocation"
                onClick={(event) => {
                  event.preventDefault();
                  scrollTo("#allocation");
                }}
                className="inline-flex h-12 items-center bg-signal px-6 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-carbon transition-colors hover:bg-chalk"
              >
                Reserve a Batch 04 slot
              </a>
              <a
                href="#schematic"
                onClick={(event) => {
                  event.preventDefault();
                  scrollTo("#schematic");
                }}
                className="inline-flex h-12 items-center gap-2 border border-hairline px-6 font-mono text-xs uppercase tracking-[0.16em] text-chalk transition-colors hover:border-chalk"
              >
                Exploded view
                <ArrowDown aria-hidden className="h-3.5 w-3.5" />
              </a>
            </motion.div>
          </div>

          <dl className="grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
            {FIGURES.map((figure) => (
              <div key={figure.label} className="bg-carbon px-4 py-3.5">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">{figure.label}</dt>
                <dd className="mt-1.5 font-display text-lg font-medium tabular-nums">{figure.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <div ref={stage} className="relative h-[60vh] min-h-[380px] border-t border-hairline lg:sticky lg:top-16 lg:col-span-6 lg:h-[calc(100svh-4rem)] lg:self-start lg:border-l lg:border-t-0 xl:col-span-7">
          <CornerTicks />
          <p className="absolute left-6 top-6 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-metric">
            Fig. 01 — Assembled, 7.2° typing angle
          </p>
          {wide || near ? <LazyKeyboardScene cameraPosition={CAMERA} target={TARGET} parallax={0.35} /> : null}
          <p className="pointer-events-none absolute bottom-3 left-6 font-mono text-[10px] uppercase tracking-[0.2em] text-metric/70">
            Drag to rotate
          </p>
        </div>
      </div>

      <div className="border-t border-hairline">
        <p className="mx-auto max-w-[1440px] px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.24em] text-chalk md:px-10">
          6063 Aluminum <span className="text-signal">{"//"}</span> 7.2° Incline <span className="text-signal">{"//"}</span>{" "}
          Leaf-spring FR4
        </p>
      </div>
    </section>
  );
}
