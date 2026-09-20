"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { explodeStore } from "@/lib/explode-store";
import { LazyKeyboardScene } from "@/components/three/lazy-keyboard-scene";
import type { Vec3 } from "@/components/three/keyboard-scene";
import { CornerTicks, SheetMark } from "@/components/brand/sheet-mark";
import { useMedia } from "@/lib/use-media";
import { useNearView } from "@/lib/use-near-view";

const CAMERA: Vec3 = [3.7, 2.9, 6.1];
const TARGET: Vec3 = [0, 1, 0];

const CALLOUTS = [
  {
    index: "01",
    title: "Gasket isolation",
    body: "Twelve foam gaskets hold the plate between the top frame and the case. No screw touches the plate, so each keystroke sinks into foam instead of ringing through the aluminum.",
    spec: "Shore 20A Poron / 0.9 mm compression",
  },
  {
    index: "02",
    title: "Brass ballast",
    body: "A 620 g polished brass weight sits 4 mm above the desk. It pulls the balance of the board under the home row and adds depth to every keystroke.",
    spec: "620 g C360 / 0.8 µm PVD coat",
  },
  {
    index: "03",
    title: "Hot-swap matrix",
    body: "Sockets on the circuit board take any standard MX-style switch. Change the sound of the whole board in minutes, with no soldering iron.",
    spec: "QMK / VIA · 1000 Hz polling · USB-C",
  },
] as const;

export function Schematic() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Desktop keeps both scenes live; a phone only mounts the one on screen.
  const wide = useMedia("(min-width: 1024px)");
  const near = useNearView(stage);
  const [exploded, setExploded] = useState(false);
  const pinned = useMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const manualExplode = useMemo(() => ({ value: exploded ? 1 : 0 }), [exploded]);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const callouts = gsap.utils.toArray<HTMLElement>("[data-callout]");
        gsap.set(callouts, { opacity: 0.22 });

        // Timeline positions are in "timeline seconds"; scrub maps them onto scroll distance.
        const timeline = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: section.current,
            start: "top top",
            end: "+=260%",
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        timeline.to("[data-progress]", { scaleY: 1, ease: "none", duration: 3.4 }, 0);
        timeline.to(explodeStore, { value: 1, duration: 1.2 }, 0);

        callouts.forEach((callout, i) => {
          const at = 0.2 + i * 0.45;
          timeline.to(callout, { opacity: 1, duration: 0.25 }, at);
          timeline.to(callout.querySelector("[data-rule]"), { scaleX: 1, duration: 0.35 }, at);
          if (i > 0) timeline.to(callouts[i - 1], { opacity: 0.45, duration: 0.25 }, at);
        });

        // Reunite the assembly before the pin releases.
        timeline.to(explodeStore, { value: 0, duration: 1.2 }, 2.2);
        timeline.to(callouts, { opacity: 0.22, duration: 0.3 }, 2.6);

        return () => {
          explodeStore.value = 0;
        };
      });
      return () => media.revert();
    },
    { scope: section },
  );

  return (
    <section id="schematic" ref={section} className="relative overflow-hidden border-b border-hairline bg-carbon lg:motion-safe:h-[100svh]">
      <div className="mx-auto grid h-full max-w-[1440px] grid-rows-[auto_1fr] pt-16 lg:grid-cols-12 lg:grid-rows-1">
        <div className="relative z-10 flex flex-col px-5 pt-6 md:px-10 lg:col-span-5 lg:pb-12 lg:pt-10 xl:col-span-4">
          <SheetMark sheet="02" title="Exploded schematic" />
          <h2 className="mt-6 font-display text-3xl font-semibold uppercase leading-[0.95] tracking-[-0.02em] md:text-5xl">
            Six layers.
            <br />
            <span className="font-[family-name:var(--font-editorial-serif)] text-2xl normal-case italic tracking-normal text-metric md:text-4xl">
              One voicing.
            </span>
          </h2>
          <button
            type="button"
            aria-pressed={exploded}
            onClick={() => {
              setExploded((value) => !value);
            }}
            className="mt-5 min-h-11 self-start border border-signal px-5 font-mono text-xs uppercase tracking-wider text-signal lg:motion-safe:hidden"
          >
            {exploded ? "Reassemble keyboard" : "Explore the six layers"}
          </button>

          <div className="mt-6 flex gap-5 lg:mt-10">
            <div aria-hidden className="relative w-px shrink-0 bg-hairline">
              <span data-progress className="absolute inset-0 bg-signal" style={{ transform: "scaleY(0)", transformOrigin: "top" }} />
            </div>
            <ol className="flex flex-col gap-4 lg:gap-8">
              {CALLOUTS.map((callout) => (
                <li key={callout.index} data-callout>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-signal">{callout.index}</span>
                    <h3 className="font-display text-base font-semibold uppercase tracking-[0.04em] md:text-lg">{callout.title}</h3>
                  </div>
                  <span aria-hidden className="mt-2 block h-px bg-hairline">
                    <span data-rule className="block h-full bg-chalk" style={{ transform: "scaleX(0)", transformOrigin: "left" }} />
                  </span>
                  <p className="mt-3 hidden max-w-sm text-sm leading-relaxed text-metric sm:block">{callout.body}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/80">{callout.spec}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div ref={stage} className="relative mt-8 h-[65svh] min-h-[380px] lg:col-span-7 lg:mt-0 lg:h-auto lg:border-l lg:border-hairline xl:col-span-8">
          <CornerTicks />
          <p className="absolute right-6 top-6 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-metric">
            Fig. 02 — Exploded, Y-axis
          </p>
          {wide || near ? (
            <LazyKeyboardScene cameraPosition={CAMERA} target={TARGET} explode={pinned ? explodeStore : manualExplode} parallax={0.18} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
