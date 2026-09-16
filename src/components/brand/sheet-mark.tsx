// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { COPYRIGHT_SHORT } from "@/lib/copyright";

const TOTAL_SHEETS = "05";

/** Engineering-drawing title strip. Doubles as the per-section copyright mark. */
export function SheetMark({ sheet, title }: { sheet: string; title: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-hairline pb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-metric">
      <span>
        <span className="text-chalk">
          SHT {sheet}/{TOTAL_SHEETS}
        </span>{" "}
        — {title}
      </span>
      <span className="select-none text-metric/70">{COPYRIGHT_SHORT} · Do not redistribute</span>
    </div>
  );
}

/** Registration marks in each corner of a drawing frame. */
export function CornerTicks() {
  const base = "pointer-events-none absolute h-3 w-3 border-chalk/35";
  return (
    <>
      <span aria-hidden className={`${base} left-3 top-3 border-l border-t`} />
      <span aria-hidden className={`${base} right-3 top-3 border-r border-t`} />
      <span aria-hidden className={`${base} bottom-3 left-3 border-b border-l`} />
      <span aria-hidden className={`${base} bottom-3 right-3 border-b border-r`} />
    </>
  );
}
