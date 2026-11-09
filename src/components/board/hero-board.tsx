"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useRef } from "react";
import type { Board } from "./board-engine";
import { startKeyRouter, strikeInStep, type BoardHandle } from "./key-router";
import { asset } from "@/lib/asset";
import { isEmbed, isLite } from "@/lib/device";
import { Echo } from "@/lib/keymap";
import { preloadSound, strike } from "@/lib/sound";
import { prefersReducedMotion } from "@/lib/use-client-flags";
import styles from "./board.module.css";

/**
 * The KL-75 on the mat (spec §6.2). The <picture> is the page's LCP: server-rendered (this component's
 * markup is in the static HTML), fetchpriority high, no lazy loading, no fade, its box reserved by
 * width/height. Over it lies one transparent canvas the board engine paints pressed keys onto.
 *
 * Everything else happens after hydration: the key router, the synth preload at idle, the engine (at idle
 * on desktop and in embeds, on the first touch on lite devices) and the one-time silent attract run.
 */

const ALT =
  "The Kroma KL-75 Monolith seen from your chair: cream letter keys, graphite modifier keys and red escape and enter keys in a graphite aluminum case.";

/** How long after hydration the pressed renders may take to decode and still earn the attract run. */
const ATTRACT_DEADLINE_MS = 2500;
/** A touch that travels this far is a scroll, not a keystroke. */
const TAP_SLOP_PX = 10;

const idle = (fn: () => void, timeout: number): (() => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
};

export function HeroBoard({ phone }: { phone: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const hydratedAt = performance.now();
    performance.mark("kroma:hydrated");
    const embed = isEmbed();
    const lite = isLite();
    const reduced = prefersReducedMotion();

    const echoEl = el.closest("section")?.querySelector<HTMLElement>("[data-echo]") ?? null;
    const echo = echoEl ? new Echo(echoEl, styles.glyph) : null;
    const echoSizer = echoEl ? new ResizeObserver(() => echo?.measure()) : null;
    if (echoEl) echoSizer?.observe(echoEl);

    let dead = false;
    let engine: Board | null = null;
    let loading: Promise<Board | null> | null = null;
    let interacted = false;
    let visible = false;

    const seen = new IntersectionObserver(([entry]) => (visible = entry.intersectionRatio >= 0.25), { threshold: [0, 0.25, 0.5, 1] });
    seen.observe(el);

    const ensure = () =>
      (loading ??= import("./board-engine")
        .then((m) => m.createBoard(el))
        .then((board) => {
          if (dead) {
            board.destroy();
            return null;
          }
          engine = board;
          return board;
        })
        .catch(() => null));

    const handle: BoardHandle = {
      get: () => engine,
      ensure,
      echo: () => echo,
      interact: () => {
        interacted = true;
      },
    };

    const cancels: (() => void)[] = [];
    if (!embed) {
      cancels.push(startKeyRouter(handle));
      cancels.push(idle(() => void preloadSound().catch(() => {}), 2000));
    }

    // The attract run: once, silent, only for a visitor who hasn't touched a key yet and only if the
    // pressed renders arrived quickly. Lite and reduced-motion visitors never see it.
    // When it doesn't happen, html[data-attract="skipped"] swaps the hero caption from "typed on the
    // board below" to an invitation, so the page never claims a run that didn't play.
    if (!lite || embed) {
      const skip = () => {
        if (!dead) document.documentElement.dataset.attract = "skipped";
      };
      cancels.push(
        idle(() => {
          void ensure().then((board) => {
            if (!board) return skip();
            return board.ready.then(
              () => {
                if (dead || reduced || lite) return;
                if (!board.isReady() || interacted || !visible) return skip();
                if (performance.now() - hydratedAt > ATTRACT_DEADLINE_MS) return skip();
                board.attract(echo);
              },
              skip,
            );
          });
        }, 500),
      );
    }

    // ---- pointer: mouse and pen strike on press; touch strikes on a clean tap's release ----
    let active: { id: number; touch: boolean; x: number; y: number; slot: number | null } | null = null;

    const typeChar = (slot: number | null) => {
      if (slot === null || !engine) return;
      const ch = engine.char(slot);
      if (ch !== undefined) echo?.type(ch);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      interacted = true;
      const touch = e.pointerType === "touch";
      const key = engine?.hit(e.clientX, e.clientY) ?? null;
      active = { id: e.pointerId, touch, x: e.clientX, y: e.clientY, slot: key?.s ?? null };
      if (key) engine?.press(key.s);
      if (!engine) {
        // Lite (or before the idle load): load now; press the key if the finger is still down.
        const at = { x: e.clientX, y: e.clientY, id: e.pointerId };
        void ensure().then((board) => {
          if (!board || active?.id !== at.id) return;
          const late = board.hit(at.x, at.y);
          if (!late) return;
          active.slot = late.s;
          board.press(late.s);
        });
      }
      if (!touch) {
        strikeInStep();
        typeChar(active.slot);
      }
    };

    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      if (active.touch) {
        if (Math.hypot(e.clientX - active.x, e.clientY - active.y) >= TAP_SLOP_PX) cancel(e);
        return;
      }
      // Mouse held down and dragged across the board: a glissando, one strike per key crossed.
      const key = engine?.hit(e.clientX, e.clientY) ?? null;
      const slot = key?.s ?? null;
      if (slot === active.slot) return;
      if (active.slot !== null) engine?.release(active.slot);
      active.slot = slot;
      if (slot !== null) {
        engine?.press(slot);
        strikeInStep();
        typeChar(slot);
      }
    };

    const up = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const { touch, slot } = active;
      active = null;
      if (!touch) {
        if (slot !== null) engine?.release(slot);
        return;
      }
      // pointerup is the gesture that may start audio on touch screens.
      strike();
      typeChar(slot);
      if (slot !== null) setTimeout(() => engine?.release(slot), 60);
    };

    const cancel = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      if (active.slot !== null) engine?.release(active.slot);
      active = null;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);

    return () => {
      dead = true;
      cancels.forEach((fn) => fn());
      seen.disconnect();
      echoSizer?.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerleave", cancel);
      el.removeEventListener("pointercancel", cancel);
      (engine as Board | null)?.destroy();
    };
  }, []);

  return (
    <div ref={root} className={styles.board} data-board data-phone={phone ? "" : undefined}>
      <picture>
        {phone && (
          <>
            <source
              media="(max-width: 639px)"
              type="image/avif"
              srcSet={`${asset("/renders/kl75-phone-rest-1170.avif")} 1170w`}
              sizes="100vw"
              width={1170}
              height={1100}
            />
            <source
              media="(max-width: 639px)"
              type="image/webp"
              srcSet={`${asset("/renders/kl75-phone-rest-1170.webp")} 1170w`}
              sizes="100vw"
              width={1170}
              height={1100}
            />
          </>
        )}
        <source
          type="image/avif"
          srcSet={`${asset("/renders/kl75-rest-1440.avif")} 1440w, ${asset("/renders/kl75-rest-2880.avif")} 2880w`}
          sizes="100vw"
          width={2880}
          height={1200}
        />
        <img
          className={styles.img}
          src={asset("/renders/kl75-rest-1440.webp")}
          srcSet={`${asset("/renders/kl75-rest-1440.webp")} 1440w, ${asset("/renders/kl75-rest-2880.webp")} 2880w`}
          sizes="100vw"
          width={2880}
          height={1200}
          fetchPriority="high"
          alt={ALT}
          draggable={false}
        />
      </picture>
      <canvas className={styles.canvas} data-board-canvas data-print-hide aria-hidden="true" />
    </div>
  );
}
