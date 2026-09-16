// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/sections/site-footer";

export type LegalSection = { heading: string; body: ReactNode };

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 md:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-metric transition-colors hover:text-chalk"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Back to KROMA LABS
        </Link>
        <h1 className="mt-10 font-display text-4xl font-semibold uppercase tracking-[-0.02em] md:text-5xl">{title}</h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Last updated {updated}</p>
        <div className="mt-12 flex flex-col gap-10">
          {sections.map((section, i) => (
            <section key={section.heading} className="border-t border-hairline pt-6">
              <h2 className="flex items-baseline gap-3 font-display text-lg font-semibold uppercase tracking-[0.03em]">
                <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-metric">{section.body}</div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
