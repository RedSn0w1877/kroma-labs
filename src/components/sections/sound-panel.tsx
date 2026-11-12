"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Spectrum } from "@/components/board/spectrum";
import { Cap, capClass } from "@/components/ui/keycap";
import { setState, useKroma } from "@/lib/kroma-state";
import { strike } from "@/lib/sound";
import { SWITCH_PROFILES, type SwitchId } from "@/lib/switch-profiles";
import styles from "./soundboard.module.css";

/**
 * The instrument half of #sound (spec §6.3): three latching switch keycaps (a real tablist with roving
 * tabindex), the k r o m a test keys, the peak readout, the big meter and the type test. Everything
 * strikes through sound.ts, so the nav's [mute] and the embed rule apply here too, and every strike also
 * lights the meters (they listen to onStrike).
 *
 * Mouse and pen strike on pointerdown, the instant the key starts to move. Touch and keyboard strike on
 * click: on touch screens pointerup is the gesture allowed to start audio, and a keyboard's Space/Enter
 * arrive as a click with detail 0. One press, one strike, either way.
 */

type Voice = { id: SwitchId; n: string; name: string; sub: string; line: string; travel: string };

const VOICES: readonly Voice[] = [
  {
    id: "linear-mineral",
    n: "1",
    name: "linear",
    sub: "mineral · 45 g",
    line: "linear: smooth all the way down, with no bump. The sound is deep and rounded.",
    travel: "4.0 mm",
  },
  {
    id: "tactile-topaz",
    n: "2",
    name: "tactile",
    sub: "topaz · 62 g",
    line: "tactile: a small bump halfway down, so you feel each press.",
    travel: "3.8 mm, bump at 0.6 mm",
  },
  {
    id: "silent-cream",
    n: "3",
    name: "silent",
    sub: "cream · 55 g",
    line: "silent: rubber dampers soften the bottom and the top of every press. Made for shared offices and late nights.",
    travel: "3.5 mm",
  },
];

const TEST_LETTERS = ["k", "r", "o", "m", "a"] as const;
const TARGET = "the quick brown fox jumps over the lazy dog.";
const PRESS_MS = 120;

/** "Hz" and "kHz" keep their case inside the lowercase UI classes. */
function Hz({ hz }: { hz: number }) {
  return hz >= 1000 ? (
    <>
      {(hz / 1000).toFixed(1)} <span className="t-keep">kHz</span>
    </>
  ) : (
    <>
      {hz} <span className="t-keep">Hz</span>
    </>
  );
}

/**
 * The selected switch's sheet, straight from switch-profiles.ts (the synth's own source of truth): what an
 * enthusiast looks for first. Lube is stated only where the profile states it (the linear's stem).
 */
function specRows(voice: Voice): [string, string][] {
  const p = SWITCH_PROFILES.find((profile) => profile.id === voice.id);
  if (!p) return [];
  return [
    ["switch", `${p.name}, ${p.type.toLowerCase()}`],
    ["spring", p.spring],
    ["stem", p.stem],
    ["housing", p.housing],
    ["travel", voice.travel],
    ["loudest", p.band],
  ];
}

/** Units inside the facts lines keep their case too. */
function withUnits(text: string) {
  return text.split(/(\bHz\b)/).map((part, i) =>
    part === "Hz" ? (
      <span key={i} className="t-keep">
        Hz
      </span>
    ) : (
      part
    ),
  );
}

/** One press per gesture: pointerdown for mouse/pen, click for touch and keyboard. */
function usePress(onPress: () => void) {
  const fromPointer = useRef(false);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      fromPointer.current = true;
      onPress();
    },
    onClick: () => {
      if (fromPointer.current) {
        fromPointer.current = false;
        return;
      }
      onPress();
    },
  };
}

function SwitchKey({ voice, selected, onSelect }: { voice: Voice; selected: boolean; onSelect: (id: SwitchId) => void }) {
  const press = usePress(() => onSelect(voice.id));
  return (
    <button
      type="button"
      role="tab"
      id={`switch-${voice.name}`}
      aria-selected={selected}
      aria-controls="switch-panel"
      tabIndex={selected ? 0 : -1}
      data-voice={voice.id}
      className={`cap ${selected ? "cap--graphite" : ""} ${styles.switch}`}
      {...press}
    >
      <span className={`cap__top ${styles.switchTop}`} aria-hidden="true">
        {voice.n}
      </span>
      <span className={styles.switchName}>{voice.name}</span>
      <span className={styles.switchSub}>
        {voice.sub.split(" · ")[0]}
        <span className={styles.dot}> · </span>
        <span className={styles.weight}>{voice.sub.split(" · ")[1]}</span>
      </span>
    </button>
  );
}

function TestKey({ letter, voiceName, onPlayed }: { letter: string; voiceName: string; onPlayed: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const press = usePress(() => {
    if (!strike()) return;
    onPlayed();
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-down", "");
    setTimeout(() => el.removeAttribute("data-down"), PRESS_MS);
  });
  return (
    <button
      type="button"
      ref={ref}
      data-test-key={letter}
      aria-label={`play the ${voiceName} switch, ${letter}`}
      className={capClass("cream", styles.testKey)}
      {...press}
    >
      {letter}
    </button>
  );
}

export function SoundPanel() {
  const voiceId = useKroma((s) => s.voice);
  const muted = useKroma((s) => s.muted);
  const unsupported = useKroma((s) => s.unsupported);
  const voice = VOICES.find((v) => v.id === voiceId) ?? VOICES[1];
  const [peak, setPeak] = useState<number | null>(null);
  const tabs = useRef<HTMLDivElement>(null);

  // The readout is visual. Screen readers hear the peak only for strikes they asked for (a switch tab or
  // a test key), never for every letter typed in the type test or every physical key on the page.
  const [heard, setHeard] = useState("");
  const announceNext = useRef(false);
  const armAnnounce = useCallback(() => {
    announceNext.current = true;
  }, []);
  const onPeak = useCallback((hz: number) => {
    setPeak(hz);
    if (!announceNext.current) return;
    announceNext.current = false;
    setHeard(`last strike peaked at ${hz >= 1000 ? `${(hz / 1000).toFixed(1)} kilohertz` : `${hz} hertz`}`);
  }, []);

  const select = useCallback((id: SwitchId) => {
    setState({ voice: id });
    if (strike(id)) announceNext.current = true;
  }, []);

  // Arrow keys, Home and End move along the latching keys and select as they go (no preventDefault needed:
  // arrows on a button do nothing natively, and focus is moved by hand).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = VOICES.findIndex((v) => v.id === voiceId);
    const next =
      e.key === "ArrowRight" ? (i + 1) % VOICES.length
      : e.key === "ArrowLeft" ? (i + VOICES.length - 1) % VOICES.length
      : e.key === "Home" ? 0
      : e.key === "End" ? VOICES.length - 1
      : -1;
    if (next < 0 || e.repeat) return;
    select(VOICES[next].id);
    tabs.current?.querySelector<HTMLButtonElement>(`[data-voice="${VOICES[next].id}"]`)?.focus();
  };

  // ---- type test ----
  const [typed, setTyped] = useState("");
  const [wpm, setWpm] = useState<number | null>(null);
  const [done, setDone] = useState<string>("");
  const startedAt = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return;
    // Characters, Backspace and Enter sound; Tab, Shift, arrows and the like don't.
    if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
    strike();
    const letter = e.key.toLowerCase();
    if ((TEST_LETTERS as readonly string[]).includes(letter)) {
      const key = document.querySelector(`[data-test-key="${letter}"]`);
      key?.setAttribute("data-down", "");
      setTimeout(() => key?.removeAttribute("data-down"), PRESS_MS);
    }
  };

  const onFieldInput = (value: string) => {
    const now = performance.now();
    if (!value) {
      startedAt.current = null;
      setWpm(null);
    } else {
      startedAt.current ??= now;
      const minutes = (now - startedAt.current) / 60000;
      setWpm(value.length >= 10 && minutes > 0 ? Math.round(value.length / 5 / minutes) : null);
    }
    setTyped(value);
    if (value === TARGET && !done) {
      const minutes = (now - (startedAt.current ?? now)) / 60000;
      const final = minutes > 0 ? Math.round(value.length / 5 / minutes) : 0;
      setDone(`${final} wpm on the ${voice.name} switch.`);
    }
  };

  const clear = () => {
    setTyped("");
    setWpm(null);
    setDone("");
    startedAt.current = null;
    input.current?.focus();
  };

  // How far the visitor has got: the matching prefix in ink, the first slip marked, the rest soft.
  let match = 0;
  while (match < typed.length && match < TARGET.length && typed[match] === TARGET[match]) match++;
  const slipped = typed.length > match;

  return (
    <>
      <div ref={tabs} role="tablist" aria-label="switch" className={styles.tabs} onKeyDown={onTabKey}>
        {VOICES.map((v) => (
          <SwitchKey key={v.id} voice={v} selected={v.id === voice.id} onSelect={select} />
        ))}
      </div>

      <div id="switch-panel" role="tabpanel" aria-labelledby={`switch-${voice.name}`} className={styles.panel}>
        <dl className={styles.sheet}>
          {specRows(voice).map(([k, v]) => (
            <div key={k}>
              <dt className="t-ui-sm">{k}</dt>
              <dd>{withUnits(v)}</dd>
            </div>
          ))}
        </dl>
        <p className={`t-body explain ${styles.plain}`}>{voice.line}</p>
      </div>

      <div className={styles.bench}>
        <p className={`t-ui ${styles.benchLabel}`} id="test-keys-label">
          test keys
        </p>
        <div className={styles.testKeys} role="group" aria-labelledby="test-keys-label">
          {TEST_LETTERS.map((l) => (
            <TestKey key={l} letter={l} voiceName={voice.name} onPlayed={armAnnounce} />
          ))}
        </div>
        <p className={`t-ui-sm ${styles.hint}`}>press 1, 2 or 3 to switch · your own keys play while this is on screen</p>
        <p className={`t-ui-sm ${styles.what}`}>what you hear is synthesized live in your browser from each switch&apos;s profile.</p>
        <p className="sr-only" aria-live="polite">
          {heard}
        </p>
        <p className={`t-ui-lg ${styles.readout}`}>
          {peak === null ? "press a key to measure it" : (
            <>
              last strike peaked at <Hz hz={peak} />
            </>
          )}
        </p>
        {muted && <p className={`t-ui-sm ${styles.note}`}>sound is muted. press mute in the top row to turn it back on.</p>}
        {unsupported && <p className={`t-body ${styles.note}`}>This browser can&apos;t play Web Audio, so the switches stay silent here.</p>}
      </div>

      <figure className={styles.meter}>
        <Spectrum size="lg" onPeak={onPeak} voice={voice.id} />
        <figcaption className={`t-ui-sm ${styles.meterCaption}`}>
          20 <span className="t-keep">Hz</span> – 10 <span className="t-keep">kHz</span>
        </figcaption>
      </figure>

      <div className={styles.typing}>
        <label htmlFor="type-test" className={`t-ui ${styles.typeLabel}`}>
          type a sentence
        </label>
        <p className={styles.target} aria-hidden="true">
          <span className={styles.got}>{TARGET.slice(0, match)}</span>
          {slipped && match < TARGET.length && <span className={styles.slip}>{TARGET[match]}</span>}
          <span className={styles.todo}>{TARGET.slice(match + (slipped ? 1 : 0))}</span>
        </p>
        <p className="sr-only">Target sentence: {TARGET}</p>
        <div className={styles.typeRow}>
          <input
            ref={input}
            id="type-test"
            className={styles.field}
            type="text"
            value={typed}
            maxLength={80}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={onFieldKey}
            onChange={(e) => onFieldInput(e.target.value)}
          />
          <Cap as="button" type="button" className={styles.clear} onClick={clear}>
            clear
          </Cap>
          <p className={`t-ui-lg ${styles.wpm}`}>{done || (wpm === null ? "— wpm" : `${wpm} wpm`)}</p>
        </div>
        <p className="sr-only" aria-live="polite">
          {done}
        </p>
      </div>
    </>
  );
}
