// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/**
 * The keymap (spec §7): which key on the KL-75 a physical key presses, plus the hero's echo.
 *
 * Slots follow KEY_SLOTS in scripts/renders/geo/keyboard-layout.ts (row by row, left to right), which is
 * also the `s` field of src/data/kl75-keys-*.json. The map is keyed by KeyboardEvent.code, the physical
 * position, so an AZERTY or Dvorak visitor still presses the key under their finger, while the echo
 * prints the character they actually typed (event.key).
 *
 * No React here: the echo is written straight into the DOM, one span per glyph, so a keystroke costs
 * zero renders. Plain module, safe to import from eager and lazy code alike.
 */

const row = (codes: readonly string[], first: number, into: Map<string, number>) =>
  codes.forEach((code, i) => into.set(code, first + i));

function buildCodeMap(): ReadonlyMap<string, number> {
  const m = new Map<string, number>();
  m.set("Escape", 0);
  for (let f = 1; f <= 12; f++) m.set(`F${f}`, f);
  m.set("Delete", 13);
  m.set("Backquote", 14);
  row(["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"], 15, m);
  row(["Minus", "Equal", "Backspace", "Home", "Tab"], 25, m);
  row([..."QWERTYUIOP"].map((c) => `Key${c}`), 30, m);
  row(["BracketLeft", "BracketRight", "Backslash", "PageUp", "CapsLock"], 40, m);
  row([..."ASDFGHJKL"].map((c) => `Key${c}`), 45, m);
  row(["Semicolon", "Quote", "Enter", "PageDown", "ShiftLeft"], 54, m);
  row([..."ZXCVBNM"].map((c) => `Key${c}`), 59, m);
  row(["Comma", "Period", "Slash", "ShiftRight", "ArrowUp", "End", "ControlLeft", "MetaLeft", "AltLeft", "Space", "AltRight"], 66, m);
  m.set("ContextMenu", 77); // the board's Fn has no code of its own
  row(["ControlRight", "ArrowLeft", "ArrowDown", "ArrowRight"], 78, m);
  // Aliases: the same physical key under another name.
  m.set("NumpadEnter", 56);
  m.set("IntlBackslash", 58);
  m.set("OSLeft", 73);
  m.set("MetaRight", 77);
  m.set("OSRight", 77);
  return m;
}

/** KeyboardEvent.code → the KL-75 slot it presses. */
export const CODE_TO_SLOT: ReadonlyMap<string, number> = buildCodeMap();

export const SLOT_COUNT = 82;
export const SLOT = { esc: 0, enter: 56, capsLock: 44, space: 75 } as const;

/** Physical F1–F12: never captured, never pressed, never sounded (spec §1.7). */
export const isFunctionKey = (code: string): boolean => /^F([1-9]|1[0-2])$/.test(code);

/** The switch the sound section's 1 / 2 / 3 picks. */
export const VOICE_BY_DIGIT = { "1": "linear-mineral", "2": "tactile-topaz", "3": "silent-cream" } as const;

/** Martian Mono's measured advance at wdth 75 (WS-A §3.3), minus the echo's tracking. */
const ECHO_ADVANCE_EM = 0.6 - 0.04;

/**
 * The hero's echo: the last few characters typed on the board, set huge in the display face. Each new
 * glyph is its own span carrying a one-shot "land" animation (CSS, ~170 ms, transform only), so the type
 * itself bottoms out like a key. Old glyphs are trimmed from the front; nothing ever loops.
 */
/**
 * The echo steps its type down as the line grows (data-step 1–3, sizes in hero.module.css), so it holds
 * about twelve characters before it starts to scroll. The box keeps its height; only the line shrinks.
 */
const ECHO_STEPS = [1, 0.72, 0.52] as const;

export class Echo {
  /** How many glyphs fit at each step. */
  private caps: number[] = [6, 8, 11];
  private fresh = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly glyphClass: string,
  ) {
    this.measure();
  }

  /** How many glyphs fit per step: floor(width / (base size × step × advance)). Call after a resize. */
  measure(): void {
    const width = this.el.clientWidth;
    const box = this.el.parentElement ?? this.el;
    const size = parseFloat(getComputedStyle(box).fontSize) || 1;
    if (width > 0) this.caps = ECHO_STEPS.map((k) => Math.max(3, Math.floor(width / (size * k * ECHO_ADVANCE_EM))));
    this.fit();
  }

  /** Pick the largest step that holds the line; at the smallest, trim from the front, a word at a time. */
  private fit(): void {
    const n = this.el.childNodes.length || (this.el.textContent ?? "").length;
    let step = this.caps.findIndex((cap) => n <= cap);
    if (step < 0) step = ECHO_STEPS.length - 1;
    const max = this.caps[step];
    if (this.el.childNodes.length > max) {
      const glyphs = Array.from(this.el.childNodes);
      let cut = glyphs.length - max;
      // Prefer to start on a word: drop up to the next space if one is close.
      const space = glyphs.findIndex((g, i) => i >= cut && g.textContent === " ");
      if (space >= 0 && space - cut <= 4 && space < glyphs.length - 1) cut = space + 1;
      for (let i = 0; i < cut; i++) glyphs[i].remove();
    }
    // No attribute means step 1, so a short line (the server "kroma", the attract run) never writes one:
    // at hydration a write here would invalidate style and force another whole-page layout.
    const value = step === 0 ? undefined : String(step + 1);
    if (this.el.dataset.step === value) return;
    if (value) this.el.dataset.step = value;
    else delete this.el.dataset.step;
  }

  /** Drop everything, including the server-rendered "kroma". */
  clear(): void {
    this.el.textContent = "";
    this.fresh = false;
    this.fit();
  }

  /** The first real keystroke replaces the server or attract "kroma". */
  type(char: string): void {
    if (this.fresh) this.clear();
    const glyph = document.createElement("span");
    glyph.className = this.glyphClass;
    glyph.textContent = char;
    this.el.append(glyph);
    this.fit();
  }

  backspace(): void {
    if (this.fresh) this.clear();
    this.el.lastChild?.remove();
    this.fit();
  }

  /** Arm the echo so the next keystroke clears it (after the attract run re-types "kroma"). */
  rearm(): void {
    this.fresh = true;
  }

  get text(): string {
    return this.el.textContent ?? "";
  }
}
