"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { explodeStore } from "@/lib/explode-store";
import { LazyKeyboardScene } from "@/components/three/lazy-keyboard-scene";
import type { Vec3 } from "@/components/three/keyboard-scene";
import { CornerTicks, SheetMark } from "@/components/brand/sheet-mark";

const CAMERA: Vec3 = [3.7, 2.9, 6.1];
const TARGET: Vec3 = [0, 1, 0];

const CALLOUTS = [
  {
    index: "01",
    title: "Gasket isolation",
    body: "Twelve 3.5 mm Poron gaskets hold the plate between the top frame and the case. No screw boss touches the plate, so each keystroke decays into foam instead of ringing through aluminum.",
    spec: "Shore 20A Poron / 0.9 mm compression",
  },
  {
    index: "02",
    title: "Brass ballast",
    body: "A 620 g C360 brass weight with mirror PVD sits 4 mm above the desk. It pulls the center of mass under the home row and adds low-mid body to every bottom-out.",
    spec: "620 g C360 / 0.8 µm PVD coat",
  },
  {
    index: "03",
    title: "Hot-swap matrix",
    body: "Sockets on a 1.6 mm FR4 PCB accept any 3- or 5-pin MX-style switch. Change the voicing of the whole board in minutes, with no soldering iron.",
    spec: "QMK / VIA · 1000 Hz polling · USB-C",
  },
] as const;

export function Schematic() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
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
    },
    { scope: section },
  );

  return (
    <section id="schematic" ref={section} className="relative h-[100svh] overflow-hidden border-b border-hairline bg-carbon">
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

        <div className="relative min-h-0 lg:col-span-7 lg:border-l lg:border-hairline xl:col-span-8">
          <CornerTicks />
          <p className="absolute right-6 top-6 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-metric">
            Fig. 02 — Exploded, Y-axis
          </p>
          <LazyKeyboardScene cameraPosition={CAMERA} target={TARGET} explode={explodeStore} parallax={0.18} />
        </div>
      </div>
    </section>
  );
}
