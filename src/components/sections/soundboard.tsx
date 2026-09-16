"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Volume2 } from "lucide-react";
import { SWITCH_PROFILES, type SwitchId } from "@/lib/switch-profiles";
import { SwitchSynth } from "@/lib/switch-synth";
import { SheetMark } from "@/components/brand/sheet-mark";
import { Reveal } from "@/components/ui/reveal";

const BAR_COUNT = 36;
const MAX_BIN = 200;
const LISTEN_MS = 650;
// Rounded so server and browser produce identical numbers (avoids hydration mismatches).
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, (_, i) => Math.round((0.04 + 0.03 * Math.sin(i * 0.55) ** 2) * 1000) / 1000);
const TEST_KEYS = ["K", "R", "O", "M", "A"] as const;

/** Squash ~200 linear FFT bins into log-spaced bars, the way ears hear pitch. */
function toBars(spectrum: Uint8Array): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const start = Math.floor(MAX_BIN ** (i / BAR_COUNT));
    const end = Math.max(start + 1, Math.floor(MAX_BIN ** ((i + 1) / BAR_COUNT)));
    let sum = 0;
    for (let b = start; b < end; b++) sum += spectrum[b] ?? 0;
    const level = (sum / (end - start) / 255) ** 0.85;
    return Math.max(0.04, Math.min(1, level));
  });
}

export function Soundboard() {
  const section = useRef<HTMLElement>(null);
  const synth = useRef<SwitchSynth | null>(null);
  const frame = useRef<number | null>(null);
  const listenUntil = useRef(0);
  const inView = useInView(section, { amount: 0.35 });

  const [activeId, setActiveId] = useState<SwitchId>("linear-mineral");
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [peakHz, setPeakHz] = useState<number | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const active = SWITCH_PROFILES.find((profile) => profile.id === activeId) ?? SWITCH_PROFILES[0];

  const strike = useCallback((profileId: SwitchId, keyLabel: string) => {
    const engine = (synth.current ??= new SwitchSynth());
    const profile = SWITCH_PROFILES.find((p) => p.id === profileId) ?? SWITCH_PROFILES[0];
    if (!engine.strike(profile.voice)) {
      setUnsupported(true);
      return;
    }
    setPressed(keyLabel);
    listenUntil.current = performance.now() + LISTEN_MS;
    if (frame.current !== null) return;

    let loudestBin = 0;
    let loudestValue = 0;
    const loop = () => {
      const spectrum = engine.readSpectrum();
      if (spectrum) {
        for (let b = 2; b < MAX_BIN; b++) {
          if (spectrum[b] > loudestValue) {
            loudestValue = spectrum[b];
            loudestBin = b;
          }
        }
        setLevels(toBars(spectrum));
      }
      if (performance.now() < listenUntil.current) {
        frame.current = requestAnimationFrame(loop);
      } else {
        frame.current = null;
        setLevels(IDLE_LEVELS);
        setPressed(null);
        if (loudestValue > 0) setPeakHz(Math.round(loudestBin * engine.binHz));
      }
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  // While this section is on screen, physical keys play the selected switch.
  useEffect(() => {
    if (!inView) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const isActivation = event.key === " " || event.key === "Enter";
      if (isActivation && target?.closest("button, a")) return;
      if (!/^[a-z0-9]$/i.test(event.key) && !isActivation) return;
      if (event.key === " ") event.preventDefault();
      strike(activeId, event.key === " " ? "SPACE" : event.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inView, activeId, strike]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      synth.current?.dispose();
    },
    [],
  );

  const readout = [
    ["Actuation", active.spring],
    ["Total travel", active.travel],
    ["Stem", active.stem],
    ["Housing", active.housing],
    ["Dominant band", active.band],
    ["Last strike peak", peakHz ? `${peakHz.toLocaleString()} Hz` : "Press a key"],
  ] as const;

  return (
    <section id="acoustics" ref={section} className="border-b border-hairline">
      <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 lg:py-32">
        <SheetMark sheet="03" title="Acoustic test bench" />

        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.02em] md:text-6xl">
              Hear the
              <br />
              <span className="font-[family-name:var(--font-editorial-serif)] text-2xl normal-case italic tracking-normal text-metric md:text-5xl">
                switch first.
              </span>
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-metric">
              Each voicing is synthesized live in your browser from its stem material, spring weight, and housing
              plastic. No recordings. Pick a switch, then press the keys or type on your own keyboard.
            </p>
            <p className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
              <Volume2 aria-hidden className="h-3.5 w-3.5" />
              Audio starts on your first press
            </p>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-8">
            <div role="tablist" aria-label="Switch voicing" className="grid grid-cols-1 border border-hairline sm:grid-cols-3">
              {SWITCH_PROFILES.map((profile) => {
                const selected = profile.id === activeId;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="switch-panel"
                    onClick={() => {
                      setActiveId(profile.id);
                      setPeakHz(null);
                      strike(profile.id, "TAB");
                    }}
                    className={`flex items-center justify-between gap-3 border-hairline px-5 py-4 text-left transition-colors not-last:border-b sm:not-last:border-b-0 sm:not-last:border-r ${
                      selected ? "bg-billet text-chalk" : "text-metric hover:text-chalk"
                    }`}
                  >
                    <span>
                      <span className="block font-display text-sm font-semibold uppercase tracking-[0.06em]">
                        {profile.name}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em]">
                        {profile.type} · {profile.weight}
                      </span>
                    </span>
                    <span aria-hidden className={`h-2 w-2 shrink-0 ${selected ? "bg-signal" : "bg-hairline"}`} />
                  </button>
                );
              })}
            </div>

            <div id="switch-panel" role="tabpanel" className="border-x border-b border-hairline bg-billet">
              <div className="flex items-end justify-between gap-6 border-b border-hairline px-5 py-4">
                <p className="max-w-lg text-sm leading-relaxed text-metric">{active.summary}</p>
                <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-metric">20 Hz — 10 kHz</p>
              </div>

              <div aria-hidden className="flex h-44 items-end gap-[3px] px-5 pb-5 pt-6 md:h-56">
                {levels.map((level, i) => (
                  <motion.span
                    key={i}
                    className={`block h-full flex-1 origin-bottom ${level > 0.55 ? "bg-signal" : "bg-chalk/85"}`}
                    initial={false}
                    animate={{ scaleY: level }}
                    transition={{ duration: 0.08, ease: "linear" }}
                  />
                ))}
              </div>

              <div className="grid gap-px border-t border-hairline bg-hairline md:grid-cols-[1fr_1.1fr]">
                <div className="bg-billet p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Test keys</p>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {TEST_KEYS.map((label) => (
                      <motion.button
                        key={label}
                        type="button"
                        whileTap={{ y: 3 }}
                        onPointerDown={() => strike(activeId, label)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            if (!event.repeat) strike(activeId, label);
                          }
                        }}
                        aria-label={`Play ${active.name} keystroke`}
                        className={`aspect-square border font-mono text-sm transition-colors ${
                          pressed === label ? "border-signal text-signal" : "border-hairline text-chalk hover:border-metric"
                        }`}
                      >
                        {label}
                      </motion.button>
                    ))}
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ y: 3 }}
                    onPointerDown={() => strike(activeId, "SPACE")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (!event.repeat) strike(activeId, "SPACE");
                      }
                    }}
                    aria-label={`Play ${active.name} spacebar`}
                    className={`mt-2 h-11 w-full border font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                      pressed === "SPACE" ? "border-signal text-signal" : "border-hairline text-metric hover:border-metric"
                    }`}
                  >
                    Space
                  </motion.button>
                  {unsupported && (
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                      Web Audio isn&apos;t available in this browser.
                    </p>
                  )}
                </div>

                <dl className="divide-y divide-hairline bg-billet px-5 py-2">
                  {readout.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">{label}</dt>
                      <dd aria-live={label === "Last strike peak" ? "polite" : undefined} className="text-right text-sm tabular-nums text-chalk">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
