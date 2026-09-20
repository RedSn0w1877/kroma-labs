"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useState, type MouseEvent } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useScrollTo } from "@/components/providers/smooth-scroll";
import { EASE_OUT } from "@/components/ui/reveal";
import { COPYRIGHT_SHORT } from "@/lib/copyright";

const LINKS = [
  { href: "#schematic", label: "Schematic" },
  { href: "#acoustics", label: "Acoustics" },
  { href: "#specs", label: "Specs" },
] as const;

export function SiteNav() {
  const scrollTo = useScrollTo();
  const [open, setOpen] = useState(false);

  const onAnchor = (event: MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    setOpen(false);
    if (!href?.startsWith("#")) return;
    event.preventDefault();
    scrollTo(href);
  };

  return (
    <motion.header
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-carbon/95"
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 md:px-10">
        <a href="#top" onClick={onAnchor} className="flex items-center gap-2.5 font-display text-sm font-semibold tracking-[0.18em]">
          <span aria-hidden className="block h-2.5 w-2.5 bg-signal" />
          KROMA LABS
        </a>

        <p className="hidden items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-metric sm:flex">
          <span aria-hidden className="block h-1.5 w-1.5 animate-led rounded-full bg-led" />
          Batch 04 — 84/120 claimed
        </p>

        <div className="flex items-center gap-4 md:gap-8">
          <ul className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={onAnchor}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-metric transition-colors hover:text-chalk"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#allocation"
            onClick={onAnchor}
            className="hidden h-9 items-center gap-1.5 bg-signal px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-carbon transition-colors hover:bg-chalk sm:inline-flex"
          >
            Configure
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center border border-hairline text-chalk md:hidden"
          >
            {open ? <X aria-hidden className="h-4 w-4" /> : <Menu aria-hidden className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden border-t border-hairline bg-carbon md:hidden"
          >
            <ul className="flex flex-col divide-y divide-hairline px-5">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={onAnchor}
                    className="block py-4 font-mono text-xs uppercase tracking-[0.18em] text-metric transition-colors hover:text-chalk"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#allocation"
                  onClick={onAnchor}
                  className="flex items-center justify-between py-4 font-mono text-xs uppercase tracking-[0.18em] text-signal"
                >
                  Configure
                  <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                </a>
              </li>
            </ul>
            <p className="border-t border-hairline px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-metric/70">
              {COPYRIGHT_SHORT} · Do not redistribute
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
