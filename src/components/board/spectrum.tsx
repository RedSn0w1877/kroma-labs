"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useRef } from "react";
import { getState, subscribe, useKroma } from "@/lib/kroma-state";
import { binHz, onStrike, readSpectrum } from "@/lib/sound";
import type { SwitchId } from "@/lib/switch-profiles";
import fingerprints from "@/data/switch-fingerprints.json";
import styles from "./board.module.css";

/**
 * The switch's sound, drawn as it happens (spec §6.3). One 2D canvas, painted through refs, never through
 * React state. It only animates inside the 650 ms "listen window" after a strike, and only while it is on
 * screen; then it draws its idle baseline once and goes quiet: an idle page runs no frames.
 *
 * The bars are the analyser's ~200 linear FFT bins squashed into 36 log-spaced bands (toBars, ported
 * verbatim), the way ears hear pitch. Each band keeps a hairline peak-hold that falls back as the strike
 * dies, like the needle memory on a studio meter. Loud bands (over .55) are ink, the rest ink-soft.
 *
 * At rest it never shows an empty rule: before the first strike it draws the selected switch's
 * fingerprint (switch-fingerprints.json: the same synth rendered offline, 36 bands, one static frame),
 * and picking another switch repaints that switch's shape once.
 */

const FINGERPRINTS = fingerprints as unknown as Record<SwitchId, readonly number[]>;

export const BAR_COUNT = 36;
export const MAX_BIN = 200;
export const LISTEN_MS = 650;
// Rounded so server and browser produce identical numbers.
const IDLE_LEVELS = Array.from({ length: BAR_COUNT }, (_, i) => Math.round((0.04 + 0.03 * Math.sin(i * 0.55) ** 2) * 1000) / 1000);
/** Extra listening allowed while a strike has produced no sound yet (the first AudioContext boot). */
const BOOT_GRACE_MS = 600;
/** Peak-hold fall per frame at 60 Hz (scaled by real frame time). */
const PEAK_FALL_PER_MS = 0.0011;

/** Squash ~200 linear FFT bins into log-spaced bars, the way ears hear pitch. */
export function toBars(spectrum: Uint8Array): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const start = Math.floor(MAX_BIN ** (i / BAR_COUNT));
    const end = Math.max(start + 1, Math.floor(MAX_BIN ** ((i + 1) / BAR_COUNT)));
    let sum = 0;
    for (let b = start; b < end; b++) sum += spectrum[b] ?? 0;
    const level = (sum / (end - start) / 255) ** 0.85;
    return Math.max(0.04, Math.min(1, level));
  });
}

type Props = {
  /** sm: the hero's mini meter under the echo. lg: the sound section's full-width meter. */
  size: "sm" | "lg";
  /** Called once per listen window with the loudest frequency it heard, in Hz. */
  onPeak?: (hz: number) => void;
  /** Whose fingerprint to show at rest. Default: the page's current switch. */
  voice?: SwitchId;
  className?: string;
};

export function Spectrum({ size, onPeak, voice: voiceProp, className }: Props) {
  const storeVoice = useKroma((s) => s.voice);
  const voice = voiceProp ?? storeVoice;
  const canvas = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef(onPeak);
  /** Set by the drawing effect: seed the resting silhouette with a switch's fingerprint and repaint. */
  const restAs = useRef<((id: SwitchId) => void) | null>(null);
  const voiceRef = useRef(voice);

  useEffect(() => {
    voiceRef.current = voice;
    restAs.current?.(voice);
  }, [voice]);

  useEffect(() => {
    peakRef.current = onPeak;
  }, [onPeak]);

  useEffect(() => {
    const el = canvas.current;
    // CPU-backed on purpose (willReadFrequently is the standard switch for that): 36 rectangles a frame
    // need no GPU, and an accelerated canvas makes its first resize open a GPU command buffer
    // synchronously on the main thread, 80–250 ms inside the first frames (fix round 2, PERF-1).
    const ctx = el?.getContext("2d", { willReadFrequently: true });
    if (!el || !ctx) return;

    let visible = false;
    let frame: number | null = null;
    let listenUntil = 0;
    let last = 0;
    let loudestBin = 0;
    let loudestValue = 0;
    let ink = "#141414";
    let soft = "#3D3A33";
    const peaks = new Float32Array(BAR_COUNT);
    /** The loudest each band got during the last listen window: the strike's fingerprint. */
    const memory = new Float32Array(BAR_COUNT);
    let remembered = false;
    const seed = (id: SwitchId) => {
      const print = FINGERPRINTS[id];
      if (!print) return;
      for (let i = 0; i < BAR_COUNT; i++) memory[i] = print[i] ?? 0;
      remembered = true;
    };
    seed(voiceRef.current);

    const draw = (levels: readonly number[], withPeaks: boolean) => {
      const w = el.width;
      const h = el.height;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const pitch = w / BAR_COUNT;
      const bar = Math.max(1, Math.round(pitch * 0.62));
      const hair = Math.max(1, Math.round(h * 0.025));
      // At rest the meter keeps the last strike's shape as a faint silhouette with hairline caps, so
      // tactile, linear and silent can be compared by eye after they have stopped sounding.
      if (!withPeaks && remembered) {
        for (let i = 0; i < BAR_COUNT; i++) {
          const x = Math.round(i * pitch + (pitch - bar) / 2);
          const top = Math.round(h - memory[i] * h);
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = soft;
          ctx.fillRect(x, top, bar, h - top);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = ink;
          ctx.fillRect(x, top, bar, hair);
        }
        ctx.globalAlpha = 1;
        // At rest the silhouette is the whole picture: no row of floor hairlines under it.
        return;
      }
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = Math.round(i * pitch + (pitch - bar) / 2);
        const level = levels[i];
        const bh = Math.max(hair, Math.round(level * h));
        ctx.fillStyle = level > 0.55 ? ink : soft;
        ctx.fillRect(x, h - bh, bar, bh);
        if (withPeaks && peaks[i] > level + 0.02) {
          ctx.fillStyle = ink;
          ctx.fillRect(x, Math.round(h - peaks[i] * h), bar, hair);
        }
      }
    };
    const idle = () => draw(IDLE_LEVELS, false);
    restAs.current = (id) => {
      seed(id);
      if (frame === null) idle();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const spectrum = readSpectrum();
      if (spectrum) {
        for (let b = 2; b < MAX_BIN; b++) {
          if (spectrum[b] > loudestValue) {
            loudestValue = spectrum[b];
            loudestBin = b;
          }
        }
        const levels = toBars(spectrum);
        for (let i = 0; i < BAR_COUNT; i++) {
          peaks[i] = Math.max(levels[i], peaks[i] - PEAK_FALL_PER_MS * dt);
          memory[i] = Math.max(memory[i], levels[i]);
        }
        remembered = true;
        draw(levels, true);
      }
      // The very first strike boots the AudioContext, and its sound can arrive after a 650 ms window that
      // started on the keypress: keep listening a little longer (once, bounded) until it actually lands.
      const t = performance.now();
      if (visible && (t < listenUntil || (loudestValue === 0 && t < listenUntil + BOOT_GRACE_MS))) {
        frame = requestAnimationFrame(loop);
        return;
      }
      frame = null;
      idle();
      if (loudestValue > 0) peakRef.current?.(Math.round(loudestBin * binHz()));
      loudestValue = 0;
      loudestBin = 0;
    };

    const unsubscribe = onStrike(() => {
      if (!visible) return;
      listenUntil = performance.now() + LISTEN_MS;
      if (frame !== null) return;
      const cs = getComputedStyle(el);
      ink = cs.getPropertyValue("--ink").trim() || ink;
      soft = cs.getPropertyValue("--ink-soft").trim() || soft;
      peaks.fill(0);
      memory.fill(0);
      last = 0;
      frame = requestAnimationFrame(loop);
    });

    // A new mat flips --ink: repaint the resting meter in the new colours (after setMat has finished).
    let mat = getState().mat;
    const unwatch = subscribe(() => {
      if (getState().mat === mat) return;
      mat = getState().mat;
      queueMicrotask(() => {
        const cs = getComputedStyle(el);
        ink = cs.getPropertyValue("--ink").trim() || ink;
        soft = cs.getPropertyValue("--ink-soft").trim() || soft;
        if (frame === null) idle();
      });
    });

    const sizer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = entry.contentRect;
      const w = Math.round(box.width * dpr);
      const h = Math.round(box.height * dpr);
      if (w === el.width && h === el.height) return;
      el.width = w;
      el.height = h;
      const cs = getComputedStyle(el);
      ink = cs.getPropertyValue("--ink").trim() || ink;
      soft = cs.getPropertyValue("--ink-soft").trim() || soft;
      if (frame === null) idle();
    });
    sizer.observe(el);

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    seen.observe(el);

    return () => {
      restAs.current = null;
      unsubscribe();
      unwatch();
      sizer.disconnect();
      seen.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      className={[styles.spectrum, size === "sm" ? styles.spectrumSm : styles.spectrumLg, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-print-hide
    />
  );
}
