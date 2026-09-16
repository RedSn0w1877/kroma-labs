// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/** One keyboard "unit" (1u, the width of a letter key) in scene units. */
export const KEY_UNIT = 0.19;
/** Gap between neighbouring keycaps. */
export const KEY_GAP = 0.022;
/** Extra space between the function row and the number row. */
const F_ROW_GAP = 0.25;

export type KeyTone = "alpha" | "mod" | "accent";

type KeyDef = {
  label: string;
  /** Secondary glyph printed above the main one (shifted symbols). */
  sub?: string;
  /** Width in units; defaults to 1u. */
  w?: number;
  tone?: KeyTone;
};

const k = (label: string, extra: Omit<KeyDef, "label"> = {}): KeyDef => ({ label, ...extra });
const letters = (source: string) => source.split("").map((char) => k(char));

const NUMBER_ROW: KeyDef[] = [
  ["1", "!"],
  ["2", "@"],
  ["3", "#"],
  ["4", "$"],
  ["5", "%"],
  ["6", "^"],
  ["7", "&"],
  ["8", "*"],
  ["9", "("],
  ["0", ")"],
].map(([label, sub]) => k(label, { sub }));

/** 75% ANSI. Rows 1–5 are 16u wide; the F-row stops at 14u to leave space for the knob. */
const ROWS: KeyDef[][] = [
  [
    k("Esc", { tone: "accent" }),
    ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, { tone: "mod" })),
    k("Del", { tone: "mod" }),
  ],
  [
    k("`", { sub: "~" }),
    ...NUMBER_ROW,
    k("-", { sub: "_" }),
    k("=", { sub: "+" }),
    k("Bksp", { w: 2, tone: "mod" }),
    k("Home", { tone: "mod" }),
  ],
  [
    k("Tab", { w: 1.5, tone: "mod" }),
    ...letters("QWERTYUIOP"),
    k("[", { sub: "{" }),
    k("]", { sub: "}" }),
    k("\\", { sub: "|", w: 1.5, tone: "mod" }),
    k("PgUp", { tone: "mod" }),
  ],
  [
    k("Caps", { w: 1.75, tone: "mod" }),
    ...letters("ASDFGHJKL"),
    k(";", { sub: ":" }),
    k("'", { sub: '"' }),
    k("Enter", { w: 2.25, tone: "accent" }),
    k("PgDn", { tone: "mod" }),
  ],
  [
    k("Shift", { w: 2.25, tone: "mod" }),
    ...letters("ZXCVBNM"),
    k(",", { sub: "<" }),
    k(".", { sub: ">" }),
    k("/", { sub: "?" }),
    k("Shift", { w: 1.75, tone: "mod" }),
    k("↑", { tone: "mod" }),
    k("End", { tone: "mod" }),
  ],
  [
    k("Ctrl", { w: 1.25, tone: "mod" }),
    k("Win", { w: 1.25, tone: "mod" }),
    k("Alt", { w: 1.25, tone: "mod" }),
    k("", { w: 6.25 }),
    k("Alt", { tone: "mod" }),
    k("Fn", { tone: "mod" }),
    k("Ctrl", { tone: "mod" }),
    k("←", { tone: "mod" }),
    k("↓", { tone: "mod" }),
    k("→", { tone: "mod" }),
  ],
];

/**
 * Per-row keycap sculpt, the thing that makes a board read as real: rows are
 * different heights and tilt toward the typist at the back, away at the front.
 */
export const ROW_PROFILE = [
  { height: 0.074, tilt: 7, dish: 0.012 },
  { height: 0.086, tilt: 6, dish: 0.014 },
  { height: 0.08, tilt: 3, dish: 0.014 },
  { height: 0.074, tilt: 0, dish: 0.015 },
  { height: 0.076, tilt: -3, dish: 0.014 },
  { height: 0.082, tilt: -6, dish: 0.013 },
] as const;

export const BOARD_WIDTH = 16 * KEY_UNIT;
export const BOARD_DEPTH = (ROWS.length + F_ROW_GAP) * KEY_UNIT;

export type KeySlot = {
  x: number;
  z: number;
  width: number;
  row: number;
  tone: KeyTone;
  label: string;
  sub?: string;
  /** Index of this key's cell in the legend texture atlas. */
  cell: number;
};

let cell = 0;

export const KEY_SLOTS: KeySlot[] = ROWS.flatMap((keys, row) => {
  let cursor = 0;
  // The F-row hugs the back edge; every other row is pushed down by the gap.
  const rowOffset = row === 0 ? 0 : row + F_ROW_GAP;
  return keys.map((key) => {
    const width = key.w ?? 1;
    const x = (cursor + width / 2) * KEY_UNIT - BOARD_WIDTH / 2;
    cursor += width;
    return {
      x,
      z: (rowOffset + 0.5) * KEY_UNIT - BOARD_DEPTH / 2,
      width,
      row,
      tone: key.tone ?? "alpha",
      label: key.label,
      sub: key.sub,
      cell: cell++,
    };
  });
});

/** Rotary knob sits in the 2u the F-row leaves open at the top right. */
export const KNOB_X = 15 * KEY_UNIT - BOARD_WIDTH / 2;
export const KNOB_Z = 0.5 * KEY_UNIT - BOARD_DEPTH / 2;
