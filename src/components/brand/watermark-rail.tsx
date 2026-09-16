// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { COPYRIGHT_SHORT } from "@/lib/copyright";

/** Vertical hairline watermark pinned to the right edge on wide screens. Never intercepts clicks. */
export function WatermarkRail() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-2.5 top-1/2 z-40 hidden -translate-y-1/2 select-none xl:block"
    >
      <p className="rotate-180 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.3em] text-metric/55 [writing-mode:vertical-rl]">
        {COPYRIGHT_SHORT} — Portfolio sample — Do not redistribute
      </p>
    </div>
  );
}
