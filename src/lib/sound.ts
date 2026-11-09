// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { SwitchId, SwitchProfile, VoiceParams } from "./switch-profiles";
import type { SwitchSynth } from "./switch-synth";
import { isEmbed } from "./device";
import { getState, setState } from "./kroma-state";

/**
 * One lazy SwitchSynth for the whole page (spec §5.7). switch-synth.ts and switch-profiles.ts are
 * unchanged and arrive as a lazy chunk: preloadSound() fetches them at idle, and nothing here creates an
 * AudioContext. The synth makes its own context inside its first strike(), which always runs inside a
 * key or pointer gesture, so autoplay policies are satisfied and an untouched page stays silent.
 *
 * Every caller (board, router, sound panel, build form) goes through strike()/strikeVoice(), so the nav's
 * [mute] key, the embed rule and the unsupported notice apply everywhere at once.
 */

let synth: SwitchSynth | null = null;
let profiles: readonly SwitchProfile[] | null = null;
let loading: Promise<void> | null = null;
/** A strike requested before the synth arrived. Only the latest one is kept, and only played if fresh. */
let pending: { voice: SwitchId | VoiceParams; at: number } | null = null;
const PENDING_MAX_AGE_MS = 400;
const strikeListeners = new Set<() => void>();

/**
 * A running AudioContext keeps the audio thread rendering silence forever. After a few quiet seconds the
 * context is suspended; the synth's own boot() resumes it inside the next strike's gesture. One one-shot
 * timer, re-armed per strike, and only ever after a strike, so an untouched page still runs no timers.
 */
const SLEEP_AFTER_MS = 5000;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;

function armSleep(): void {
  if (sleepTimer !== null) clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    // switch-synth.ts is frozen by the spec, so its context is reached here rather than through a new
    // method. `ctx` is a TypeScript-private field: present at runtime, just not in the type.
    const ctx = (synth as unknown as { ctx?: AudioContext | null } | null)?.ctx;
    if (ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
  }, SLEEP_AFTER_MS);
}

/** Fetch the synth and its profiles (no AudioContext yet). Safe to call repeatedly; retries after a failure. */
export function preloadSound(): Promise<void> {
  loading ??= Promise.all([import("./switch-synth"), import("./switch-profiles")]).then(
    ([synthModule, profileModule]) => {
      synth = new synthModule.SwitchSynth();
      profiles = profileModule.SWITCH_PROFILES;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

const silenced = (): boolean => {
  const s = getState();
  return s.muted || s.unsupported || isEmbed();
};

function voiceOf(id: SwitchId): VoiceParams | null {
  if (!profiles || profiles.length === 0) return null;
  return (profiles.find((profile) => profile.id === id) ?? profiles[0]).voice;
}

function play(voice: VoiceParams | null): boolean {
  if (!synth || !voice) return false;
  if (!synth.strike(voice)) {
    setState({ unsupported: true });
    return false;
  }
  setState({ soundReady: true });
  strikeListeners.forEach((listener) => listener());
  armSleep();
  return true;
}

function resolve(voice: SwitchId | VoiceParams): VoiceParams | null {
  return typeof voice === "string" ? voiceOf(voice) : voice;
}

/** Play it now if the synth is here; otherwise queue it (latest wins) and play it on arrival if still fresh. */
function request(voice: SwitchId | VoiceParams): boolean {
  if (silenced()) return false;
  if (synth && profiles) return play(resolve(voice));
  pending = { voice, at: performance.now() };
  preloadSound().then(
    () => {
      const queued = pending;
      pending = null;
      if (!queued || silenced() || performance.now() - queued.at > PENDING_MAX_AGE_MS) return;
      play(resolve(queued.voice));
    },
    () => {
      pending = null;
    },
  );
  return true;
}

/**
 * Strike a switch: the named one, or the store's current voice. Returns false when muted, embedded or
 * unsupported (nothing will play); true when it played, or will as soon as the synth chunk arrives.
 */
export function strike(id?: SwitchId): boolean {
  return request(id ?? getState().voice);
}

/** Strike with raw voice parameters (the build form's ka-chunk). Same rules as strike(). */
export function strikeVoice(voice: VoiceParams): boolean {
  return request(voice);
}

/** The analyser's current bins (0–255 each), or null before the first strike. Reuses one buffer. */
export function readSpectrum(): Uint8Array | null {
  return synth?.readSpectrum() ?? null;
}

/** Hz covered by one spectrum bin (0 before the first strike). */
export function binHz(): number {
  return synth?.binHz ?? 0;
}

/** Run fn after every strike that played (the spectra start their 650 ms listen window). Returns the unsubscribe. */
export function onStrike(fn: () => void): () => void {
  strikeListeners.add(fn);
  return () => {
    strikeListeners.delete(fn);
  };
}
