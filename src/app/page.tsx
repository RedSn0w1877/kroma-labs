// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { SiteNav } from "@/components/sections/site-nav";
import { Hero } from "@/components/sections/hero";
import { Soundboard } from "@/components/sections/soundboard";
import { Inside } from "@/components/sections/inside";
import { SpecSheet } from "@/components/sections/spec-sheet";
import { Build } from "@/components/sections/build";
import { SiteFooter } from "@/components/sections/site-footer";

/**
 * The page (spec §5.8). The fixed function row sits outside .page, because .page is a query container
 * (layout containment would make it the containing block of anything fixed inside it). Sections are
 * separated only by a seam: one key gap of the deeper mat, full bleed.
 */
export default function Home() {
  return (
    <>
      <a href="#main" className="cap skip">
        skip to content
      </a>
      <SiteNav />
      <div className="page">
        <main id="main">
          <Hero />
          <div className="seam" aria-hidden />
          <Soundboard />
          <div className="seam" aria-hidden />
          <Inside />
          <div className="seam" aria-hidden />
          <SpecSheet />
          <div className="seam" aria-hidden />
          <Build />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
