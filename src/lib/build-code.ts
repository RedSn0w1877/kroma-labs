// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Mat } from "./kroma-state";
import type { SwitchId, VoiceParams } from "./switch-profiles";

/**
 * The configurator's vocabulary and the ticket code (spec §6.6). Pure data and pure functions: the code
 * is spelled out from the visitor's choices, so the same build always prints the same ticket. Nothing
 * here is random, and nothing is sent anywhere.
 */

export type CaseFinish = "graphite" | "silver" | "black";
export type CapSet = "classic" | "yolk";

export type Build = {
  mat: Mat;
  caseFinish: CaseFinish;
  caps: CapSet;
  voice: SwitchId;
  engraving: string;
};

export const MATS: readonly Mat[] = ["yolk", "chalk", "ink"];
export const CASES: readonly CaseFinish[] = ["graphite", "silver", "black"];
export const CAP_SETS: readonly CapSet[] = ["classic", "yolk"];

export const CAP_SET_HELP: Readonly<Record<CapSet, string>> = {
  classic: "cream, graphite and red",
  yolk: "all cream, yellow escape and enter",
};

/** The switch choices as the form and the ticket name them (§14). */
export const SWITCHES: readonly { id: SwitchId; type: string; weight: string }[] = [
  { id: "linear-mineral", type: "linear", weight: "45 g" },
  { id: "tactile-topaz", type: "tactile", weight: "62 g" },
  { id: "silent-cream", type: "silent", weight: "55 g" },
];

export const PRICE = "$640";
export const ENGRAVING_MAX = 24;

const MAT_CODE: Record<Mat, string> = { yolk: "YOLK", chalk: "CHLK", ink: "INK" };
const CASE_CODE: Record<CaseFinish, string> = { graphite: "GR", silver: "SV", black: "BK" };
const SWITCH_CODE: Record<SwitchId, string> = { "linear-mineral": "LN", "tactile-topaz": "TT", "silent-cream": "SC" };
const CAPS_CODE: Record<CapSet, string> = { classic: "A", yolk: "B" };

/** KL75-{MAT}-{CASE}-{SWITCH}-{CAPS}. The defaults spell KL75-YOLK-GR-TT-A. */
export function ticketCode(build: Pick<Build, "mat" | "caseFinish" | "voice" | "caps">): string {
  return `KL75-${MAT_CODE[build.mat]}-${CASE_CODE[build.caseFinish]}-${SWITCH_CODE[build.voice]}-${CAPS_CODE[build.caps]}`;
}

export function switchOf(id: SwitchId) {
  return SWITCHES.find((s) => s.id === id) ?? SWITCHES[1];
}

/** The mirror's and the ticket's lines, in order (§14). The page colour (the mat) is not a product, so it
 *  has no line; it only tints the ticket code. */
export function buildLines(build: Build): { k: string; v: string }[] {
  const sw = switchOf(build.voice);
  const engraved = build.engraving.trim();
  return [
    { k: "case", v: `${build.caseFinish} anodized` },
    { k: "switch", v: `${sw.type} (${sw.weight})` },
    { k: "keycaps", v: build.caps },
    { k: "engraved", v: engraved ? `“${engraved}”` : "—" },
    { k: "price", v: PRICE },
  ];
}

export const SHIPS = "ships in about 3 weeks";

/**
 * A barcode for the printed ticket, derived from the code: each character becomes a bar–gap–bar–gap
 * run of widths 1–3. It is decoration (not a real symbology), but it is the same for the same build.
 */
export function barcode(code: string): number[] {
  const runs: number[] = [2, 1, 1, 1]; // start guard
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i) * 7 + i * 13;
    runs.push(1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 3) % 3), 1 + ((c >> 5) % 2));
  }
  runs.push(1, 1, 2); // stop guard
  return runs;
}

/** The order key's "ka": a sharp, bright strike. Tuned by ear against the three switch voices. */
export const KA: VoiceParams = {
  thumpHz: 95,
  thumpGain: 0.6,
  thumpDecay: 0.09,
  clickHz: 1100,
  clickQ: 0.9,
  clickGain: 0.45,
  clickDecay: 0.06,
  lowpassHz: 4200,
  releaseDelay: 0.05,
  releaseGain: 0.12,
};

/** The printer's "chunk", 140 ms later: lower, heavier, duller. */
export const CHUNK: VoiceParams = {
  thumpHz: 70,
  thumpGain: 0.8,
  thumpDecay: 0.14,
  clickHz: 700,
  clickQ: 0.7,
  clickGain: 0.35,
  clickDecay: 0.08,
  lowpassHz: 2600,
  releaseDelay: 0.11,
  releaseGain: 0.08,
};
