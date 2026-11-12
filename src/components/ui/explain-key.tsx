"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { Cap } from "@/components/ui/keycap";
import { setState, useKroma } from "@/lib/kroma-state";

/**
 * [? / explain]: a latching key that unfolds the beginner explanations (.explain) across the page, so the
 * enthusiast spec leads and the plain-English version is one press away. Every instance shares one state
 * (kroma-state) and one switch on <html> (data-explain), which the gate in globals.css reads.
 *
 * JS-only by nature: without JS the key is not rendered and the explanations simply show.
 */
export function ExplainKey({ className }: { className?: string }) {
  const on = useKroma((s) => s.explain);
  const toggle = () => {
    const next = !on;
    setState({ explain: next });
    if (next) document.documentElement.setAttribute("data-explain", "");
    else document.documentElement.removeAttribute("data-explain");
  };
  return (
    <Cap as="button" type="button" top="?" topHidden aria-pressed={on} onClick={toggle} className={`js-only ${className ?? ""}`.trim()}>
      explain the jargon
    </Cap>
  );
}
