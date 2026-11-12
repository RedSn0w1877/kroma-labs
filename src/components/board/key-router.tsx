"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Board } from "./board-engine";
import { CODE_TO_SLOT, Echo, SLOT, VOICE_BY_DIGIT, isFunctionKey } from "@/lib/keymap";
import { getState, setState } from "@/lib/kroma-state";
import { strike } from "@/lib/sound";

/**
 * The input router (spec §7): one keydown/keyup pair on window that decides what a physical key does,
 * depending on which part of the page is on screen. It NEVER calls preventDefault: Space still scrolls,
 * Tab still moves focus, arrows still arrow. The page plays along; it doesn't take the keyboard away.
 *
 * Zones (IntersectionObserver only, no scroll listeners), highest priority first:
 *   hero    the board is ≥25% visible   → the key goes down in the picture, the switch sounds, the echo types
 *   sound   #sound is ≥35% visible      → the switch sounds; 1/2/3 pick a switch; k r o m a press test keys
 *   keymap  #keymap is ≥50% visible     → letters sound and press the [a–z] legend
 */

export type BoardHandle = {
  /** The engine if it has loaded. */
  get(): Board | null;
  /** Load it now (lite devices wait for the first touch). */
  ensure(): Promise<Board | null>;
  echo(): Echo | null;
  /** The visitor touched a key: the attract run must not start now. */
  interact(): void;
};

type Zone = "hero" | "sound" | "keymap";

/** Text entry makes its own sound (the type test) or none (the build form); the router stays out. */
const TEXT_ENTRY =
  'input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"]),textarea,select,[contenteditable]:not([contenteditable="false"])';
/** Space activates these natively. Enter does too, except on radios and checkboxes (where it orders, in #build). */
const SPACE_CONTROLS = 'button,a[href],[role="tab"],summary,input[type="radio"],input[type="checkbox"]';
const ENTER_CONTROLS = 'button,a[href],[role="tab"],summary';
const TAB_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
const TEST_KEYS = new Set(["k", "r", "o", "m", "a"]);

/**
 * Strike in step with the picture. Once the synth is running a strike costs ~1 ms, so it happens right
 * here, in the same task as the board draw: picture and transient leave on the same frame. The very first
 * strike also has to boot an AudioContext, which can take tens of ms (hundreds on a cold, busy machine);
 * that one waits a frame so the pressed key paints first and the board never freezes on its first touch.
 * Keys and mouse clicks keep their user activation across that one frame (touch never takes this path).
 */
export function strikeInStep(): void {
  if (getState().soundReady) {
    strike();
    return;
  }
  // One frame later. A plain short timer, not rAF: WebKit carries the user gesture into timers under 1 s.
  setTimeout(() => strike(), 17);
}

/** Press a page keycap for a beat, the same 120 ms the sound section's test keys use. */
function tap(el: Element | null, ms = 120) {
  if (!el) return;
  el.setAttribute("data-down", "");
  setTimeout(() => el.removeAttribute("data-down"), ms);
}

export function startKeyRouter(board: BoardHandle): () => void {
  const ratios: Record<Zone, number> = { hero: 0, sound: 0, keymap: 0 };
  const need: Record<Zone, number> = { hero: 0.25, sound: 0.35, keymap: 0.5 };
  const targets: [Zone, Element | null][] = [
    ["hero", document.querySelector("[data-board]")],
    ["sound", document.getElementById("sound")],
    ["keymap", document.getElementById("keymap")],
  ];
  const observers = targets.flatMap(([zone, el]) => {
    if (!el) return [];
    const io = new IntersectionObserver(
      ([entry]) => {
        ratios[zone] = entry.isIntersecting ? entry.intersectionRatio : 0;
      },
      { threshold: [0, need[zone] - 0.01, need[zone], Math.min(1, need[zone] + 0.15), 1] },
    );
    io.observe(el);
    return [io];
  });
  const zone = (): Zone | null => (["hero", "sound", "keymap"] as const).find((z) => ratios[z] >= need[z]) ?? null;

  /** What each held physical key pressed, so its keyup can let exactly that go. */
  const down = new Map<string, { slot?: number; cap?: Element }>();

  const pressBoard = (code: string, slot: number) => {
    const engine = board.get();
    if (engine) {
      engine.press(slot);
      return;
    }
    // Lite: the engine loads on this first press. The sound has already played; the picture follows
    // once the pressed renders decode, if the key is still held.
    void board.ensure().then((late) => {
      if (late && down.get(code)?.slot === slot) late.press(slot);
    });
  };

  const releaseCode = (code: string) => {
    const held = down.get(code);
    if (!held) return;
    down.delete(code);
    if (held.slot !== undefined) board.get()?.release(held.slot);
    held.cap?.removeAttribute("data-down");
  };

  const releaseEverything = () => {
    for (const code of [...down.keys()]) releaseCode(code);
    board.get()?.releaseAll();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // 1–2. Repeats, IME composition and shortcuts (Shift is fine) are not keystrokes on the board.
    if (e.repeat || e.isComposing || e.key === "Process") return;
    if ((e.ctrlKey && e.key !== "Control") || (e.altKey && e.key !== "Alt") || (e.metaKey && e.key !== "Meta")) return;
    // 3. Fields make their own sound.
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(TEXT_ENTRY)) return;
    // 4. F1–F12 belong to the browser.
    if (isFunctionKey(e.code)) return;

    const slot = CODE_TO_SLOT.get(e.code);
    const where = zone();

    // 5. Esc: back to the top, from anywhere.
    if (e.key === "Escape") {
      board.interact();
      const cap = document.querySelector('[data-keymap="esc"]');
      cap?.setAttribute("data-down", "");
      down.set(e.code, { slot: where === "hero" ? SLOT.esc : undefined, cap: cap ?? undefined });
      if (where === "hero") {
        pressBoard(e.code, SLOT.esc);
        strikeInStep();
      }
      // A key press: jump, never glide (src/lib/glide.ts).
      window.scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("top-title")?.focus({ preventScroll: true });
      return;
    }

    // 6. Space and Enter on a focused control are that control's.
    if (e.key === " " && target?.closest(SPACE_CONTROLS)) return;
    if (e.key === "Enter" && target?.closest(ENTER_CONTROLS)) return;
    // The switch tabs strike on their own arrow-key selection.
    if (TAB_KEYS.has(e.key) && target?.closest('[role="tab"]')) return;

    // 7. Enter inside the build form orders.
    if (e.key === "Enter" && target?.closest("#build")) {
      (document.getElementById("build-form") as HTMLFormElement | null)?.requestSubmit();
      return;
    }

    if (slot === undefined || !where) return;

    // 8. In the sound section, 1 / 2 / 3 pick a switch.
    if (where === "sound" && e.key in VOICE_BY_DIGIT) {
      const voice = VOICE_BY_DIGIT[e.key as keyof typeof VOICE_BY_DIGIT];
      setState({ voice });
      strike(voice);
      return;
    }

    // 9. By zone.
    if (where === "hero") {
      board.interact();
      down.set(e.code, { slot });
      pressBoard(e.code, slot);
      strikeInStep();
      const echo = board.echo();
      if (echo) {
        if (e.key.length === 1) echo.type(e.key);
        else if (e.key === "Backspace") echo.backspace();
        else if (e.key === "Enter") echo.clear();
      }
      // macOS only reports CapsLock's keyup when it toggles off: let it spring back on its own.
      if (slot === SLOT.capsLock) setTimeout(() => releaseCode(e.code), 120);
      return;
    }

    if (where === "sound") {
      strike();
      const letter = e.key.toLowerCase();
      if (TEST_KEYS.has(letter)) tap(document.querySelector(`[data-test-key="${letter}"]`));
      return;
    }

    if (where === "keymap" && /^[a-z]$/i.test(e.key)) {
      strike();
      const cap = document.querySelector('[data-keymap="letters"]');
      cap?.setAttribute("data-down", "");
      down.set(e.code, { cap: cap ?? undefined });
    }
  };

  const onKeyUp = (e: KeyboardEvent) => releaseCode(e.code);
  const onHidden = () => {
    if (document.visibilityState === "hidden") releaseEverything();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseEverything);
  document.addEventListener("visibilitychange", onHidden);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", releaseEverything);
    document.removeEventListener("visibilitychange", onHidden);
    observers.forEach((io) => io.disconnect());
    releaseEverything();
  };
}
