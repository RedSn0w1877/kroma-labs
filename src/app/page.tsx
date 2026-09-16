// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { SiteNav } from "@/components/sections/site-nav";
import { Hero } from "@/components/sections/hero";
import { Schematic } from "@/components/sections/schematic";
import { Soundboard } from "@/components/sections/soundboard";
import { SpecSheet } from "@/components/sections/spec-sheet";
import { Allocation } from "@/components/sections/allocation";
import { SiteFooter } from "@/components/sections/site-footer";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[60] focus:bg-signal focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:text-carbon"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <Schematic />
        <Soundboard />
        <SpecSheet />
        <Allocation />
      </main>
      <SiteFooter />
    </>
  );
}
