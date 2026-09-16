// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { SheetMark } from "@/components/brand/sheet-mark";
import { Reveal } from "@/components/ui/reveal";

const SPEC_GROUPS = [
  {
    index: "A",
    title: "Case",
    rows: [
      ["Material", "6063-T6 aluminum, machined from solid billet"],
      ["Mating-face tolerance", "±0.02 mm"],
      ["Finish", "Type II anodize, 20–25 µm"],
      ["Typing angle", "7.2°"],
      ["Front height", "18.5 mm"],
    ],
  },
  {
    index: "B",
    title: "Dimensions & mass",
    rows: [
      ["Footprint", "334.0 × 148.8 mm"],
      ["Case mass", "1.52 kg"],
      ["Built mass", "2.48 kg with switches and keycaps"],
      ["Ballast", "620 g C360 brass, mirror PVD"],
    ],
  },
  {
    index: "C",
    title: "Mounting & acoustics",
    rows: [
      ["Mount style", "Gasket, 12 × Poron (Shore 20A)"],
      ["Plate", "Leaf-spring FR4, 1.2 mm, flex-cut"],
      ["Dampening", "Case foam, PE sheet, IXPE switch pad"],
      ["Tuning options", "Plate foam in / out, O-ring gasket kit"],
    ],
  },
  {
    index: "D",
    title: "Electronics",
    rows: [
      ["PCB", "1.6 mm FR4, hot-swap, south-facing sockets"],
      ["Firmware", "QMK / VIA"],
      ["Connection", "USB-C, 1000 Hz polling"],
      ["Layouts", "75% ANSI, 75% ISO"],
    ],
  },
] as const;

const TITLE_BLOCK = [
  ["Drawing", "KL75-SPEC"],
  ["Revision", "C"],
  ["Units", "mm / g"],
  ["Scale", "NTS"],
] as const;

export function SpecSheet() {
  return (
    <section id="specs" className="border-b border-hairline">
      <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 lg:py-32">
        <SheetMark sheet="04" title="Technical specification" />

        <div className="mt-10 grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.02em] md:text-6xl">
              Spec
              <br />
              <span className="font-[family-name:var(--font-editorial-serif)] text-2xl normal-case italic tracking-normal text-metric md:text-5xl">
                sheet.
              </span>
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-metric">
              Measured on the Batch 04 first article. Every case ships with its own inspection card listing the
              measured flatness of the plate shelf.
            </p>
            <dl className="mt-10 grid max-w-sm grid-cols-2 border-l border-t border-hairline font-mono text-[10px] uppercase tracking-[0.18em]">
              {TITLE_BLOCK.map(([label, value]) => (
                <div key={label} className="border-b border-r border-hairline px-3 py-2.5">
                  <dt className="text-metric">{label}</dt>
                  <dd className="mt-1 text-chalk">{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <div className="flex flex-col gap-12 lg:col-span-8">
            {SPEC_GROUPS.map((group, i) => (
              <Reveal key={group.index} delay={i * 0.05}>
                <div className="flex items-baseline gap-4 border-t border-chalk/70 pt-4">
                  <span className="font-mono text-xs text-signal">{group.index}</span>
                  <h3 className="font-display text-lg font-semibold uppercase tracking-[0.04em]">{group.title}</h3>
                </div>
                <dl className="mt-3 divide-y divide-hairline">
                  {group.rows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-12 gap-4 py-3">
                      <dt className="col-span-5 font-mono text-[10px] uppercase tracking-[0.18em] text-metric sm:col-span-4 sm:text-[11px]">
                        {label}
                      </dt>
                      <dd className="col-span-7 text-sm tabular-nums text-chalk sm:col-span-8">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
