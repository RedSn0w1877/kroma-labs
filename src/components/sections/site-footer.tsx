// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import Link from "next/link";
import { COPYRIGHT_NOTICE, STUDIO } from "@/lib/copyright";

export function SiteFooter() {
  return (
    <footer className="bg-carbon">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 md:grid-cols-12 md:px-10">
        <div className="md:col-span-5">
          <p className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-[0.18em]">
            <span aria-hidden className="block h-2.5 w-2.5 bg-signal" />
            KROMA LABS
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-metric">
            Billet aluminum keyboards and desk hardware, machined in small numbered batches and voiced by hand.
          </p>
        </div>

        <div className="md:col-span-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-metric">Studio coordinates</h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-chalk">
            Machine Shop 4
            <br />
            Portland, Oregon, USA
            <br />
            <span className="font-mono text-xs text-metric">45.5231° N / 122.6765° W</span>
          </address>
        </div>

        <div className="md:col-span-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-metric">Compliance notes</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-metric">
            <li>Machining partner operates to an ISO 9001:2015 quality management framework.</li>
            <li>Electronics designed to RoHS, CE and FCC Part 15B requirements.</li>
            <li>
              <Link href="/legal/terms" className="text-chalk underline decoration-hairline underline-offset-4 hover:decoration-chalk">
                Terms of use
              </Link>
              <span className="px-2 text-hairline">/</span>
              <Link href="/legal/privacy" className="text-chalk underline decoration-hairline underline-offset-4 hover:decoration-chalk">
                Privacy notice
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-6 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-metric md:flex-row md:items-start md:justify-between md:px-10">
          <p className="text-chalk">{COPYRIGHT_NOTICE}</p>
          <p className="max-w-xl md:text-right">
            KROMA LABS is a fictional brand designed and engineered by {STUDIO} as a portfolio concept. Specifications,
            certifications, pricing and batch figures are illustrative. Copying, redistribution or reuse of this code,
            copy or design is prohibited.
          </p>
        </div>
      </div>
    </footer>
  );
}
