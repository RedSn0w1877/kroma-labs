"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import Link from "next/link";
import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Cap } from "@/components/ui/keycap";
import { asset } from "@/lib/asset";
import {
  CAP_SETS,
  CAP_SET_HELP,
  CASES,
  CHUNK,
  ENGRAVING_MAX,
  KA,
  MATS,
  SHIPS,
  SWITCHES,
  buildLines,
  ticketCode,
  type Build,
  type CapSet,
  type CaseFinish,
} from "@/lib/build-code";
import { setMat, setState, useKroma, type Mat } from "@/lib/kroma-state";
import { strike, strikeVoice } from "@/lib/sound";
import type { SwitchId } from "@/lib/switch-profiles";
import { useHydrated } from "@/lib/use-client-flags";
import styles from "./build.module.css";

/**
 * The configurator, its live preview and the order (spec §6.6, §9).
 *
 * Every choice is a native radio (arrow keys move within a group for free), drawn as a latching keycap
 * or a felt swatch. The mat writes the page's colour (kroma-state.setMat); the switch is the page-wide
 * voice, so #sound and #build stay in step and choosing one plays it.
 *
 * Preview: the case and keycap renders stack in one box (caps on top), so 3 cases × 2 sets give all six
 * builds from five images. The two defaults load lazily as #build approaches; the other three are fetched
 * and decoded on the first focus or press inside #build, and a swap only happens once the new image has
 * decoded (then a 240 ms crossfade).
 *
 * Ordering: validated here, then a ka-chunk, then the ticket (a lazy chunk) prints out of the mirror's
 * slot. The submit key stays disabled until hydration, and the text fields carry no `name`, so even a
 * no-JS submit could never put a name or an email in a URL.
 */

const Ticket = lazy(() => import("./ticket"));

const MAT_SWATCH: Record<Mat, string> = { yolk: "#F2C200", chalk: "#D8D5CC", ink: "#17171A" };
const CASE_CHIP: Record<CaseFinish, string> = { graphite: "#3A3B40", silver: "#B4B4BB", black: "#1E1F22" };
const CAP_TRIO: Record<CapSet, [string, string, string]> = {
  classic: ["var(--cap)", "var(--graphite)", "var(--signal)"],
  yolk: ["var(--cap)", "var(--cap)", "#F2C200"],
};

// ---- ported from the old reservation form: validation (region removed), update(), first-invalid focus -
type FormState = { name: string; email: string; engraving: string; acknowledged: boolean };
type ErrorKey = "name" | "email" | "acknowledged";
type Errors = Partial<Record<ErrorKey, string>>;

const INITIAL: FormState = { name: "", email: "", engraving: "", acknowledged: false };

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.acknowledged) errors.acknowledged = "Tick the box to confirm this is a demo.";
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={`t-ui-sm ${styles.error}`}>
      {message}
    </p>
  );
}

// ---- the preview's images ----------------------------------------------------------------------------
const render = (name: string, ext: "avif" | "webp") => asset(`/renders/kl75-build-${name}-1200.${ext}`);

function Render({ name, on, alt }: { name: string; on: boolean; alt: string }) {
  return (
    <picture className={styles.render} data-on={on || undefined}>
      <source type="image/avif" srcSet={render(name, "avif")} />
      <img src={render(name, "webp")} alt={on ? alt : ""} width={1200} height={700} loading="lazy" decoding="async" />
    </picture>
  );
}

/** Fetch and decode the three alternates on the first interaction inside #build; report each as it lands. */
function usePrimedRenders(): ReadonlySet<string> {
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set(["case-graphite", "caps-classic"]));
  useEffect(() => {
    const section = document.getElementById("build");
    if (!section) return;
    let done = false;
    const prime = () => {
      if (done) return;
      done = true;
      section.removeEventListener("focusin", prime);
      section.removeEventListener("pointerdown", prime);
      void import("./ticket"); // warm the ticket chunk too, so the print follows the ka-chunk without a gap
      // Same format the browser chose for the defaults, so the swap reuses the decoded bytes.
      const shown = section.querySelector<HTMLImageElement>(`.${styles.render} img`);
      const ext = shown?.currentSrc.endsWith(".webp") ? "webp" : "avif";
      for (const name of ["case-silver", "case-black", "caps-yolk"]) {
        const img = new Image();
        img.src = render(name, ext);
        img
          .decode()
          .catch(() => undefined) // e.g. no AVIF: the <picture> will pick the WebP itself
          .then(() => setReady((r) => new Set(r).add(name)));
      }
    };
    section.addEventListener("focusin", prime);
    section.addEventListener("pointerdown", prime);
    return () => {
      section.removeEventListener("focusin", prime);
      section.removeEventListener("pointerdown", prime);
    };
  }, []);
  return ready;
}

// ---- options -------------------------------------------------------------------------------------------
function Choice<T extends string>({
  name,
  value,
  checked,
  onChange,
  children,
  face,
}: {
  name: string;
  value: T;
  checked: boolean;
  onChange: (value: T) => void;
  children: ReactNode;
  face: "key" | "swatch";
}) {
  return (
    <label className={styles.opt}>
      <input
        type="radio"
        className={styles.radio}
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span className={face === "key" ? `cap ${styles.key}` : styles.swatchOpt}>{children}</span>
    </label>
  );
}

type Printed = { n: number; code: string; first: string; build: Build };

export function BuildForm({ brassField, brassCap }: { brassField: [number, number, number, number]; brassCap: number }) {
  const hydrated = useHydrated();
  const mat = useKroma((s) => s.mat);
  const voice = useKroma((s) => s.voice);
  const [caseFinish, setCaseFinish] = useState<CaseFinish>("graphite");
  const [caps, setCaps] = useState<CapSet>("classic");
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [printed, setPrinted] = useState<Printed | null>(null);
  const [announce, setAnnounce] = useState("");
  const chunkTimer = useRef<number | null>(null);
  const ready = usePrimedRenders();
  const aside = useRef<HTMLElement>(null);

  // A sticky column taller than the viewport (it is, once a ticket prints) would hide its own bottom.
  // Publish its height; CSS then sticks it at min(1u, 100svh − height − 16px), so it scrolls with the
  // page until its bottom meets the viewport and sticks there. Event-driven only.
  useEffect(() => {
    const el = aside.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      el.style.setProperty("--aside-h", `${Math.round(entry.borderBoxSize[0]?.blockSize ?? el.offsetHeight)}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (chunkTimer.current !== null) window.clearTimeout(chunkTimer.current);
    },
    [],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const build: Build = { mat, caseFinish, caps, voice, engraving: form.engraving };
  const code = ticketCode(build);
  const lines = buildLines(build);

  const pickVoice = (id: SwitchId) => {
    setState({ voice: id });
    strike(id);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    const firstInvalid = (Object.keys(found) as ErrorKey[])[0];
    if (firstInvalid) {
      document.getElementById(`field-${firstInvalid}`)?.focus();
      return;
    }
    // Ka… chunk: the key, then the printer.
    strikeVoice(KA);
    if (chunkTimer.current !== null) window.clearTimeout(chunkTimer.current);
    chunkTimer.current = window.setTimeout(() => {
      chunkTimer.current = null;
      strikeVoice(CHUNK);
    }, 140);
    setPrinted((prev) => ({
      n: (prev?.n ?? 0) + 1,
      code,
      first: form.name.trim().split(/\s+/)[0],
      build: { ...build, engraving: form.engraving },
    }));
    setAnnounce(`ticket printed, ${code}`);
  };

  const editBuild = () => {
    document.querySelector<HTMLInputElement>('#build-form input[name="mat"]:checked')?.focus();
  };

  const shownCase = ready.has(`case-${caseFinish}`) ? caseFinish : "graphite";
  const shownCaps = ready.has(`caps-${caps}`) ? caps : "classic";
  const [bx, by, bw, bh] = brassField;
  const engraving = form.engraving.trim();

  return (
    <>
      {/* ---- the preview: render, mirror and brass ---- */}
      <aside ref={aside} className={styles.preview} aria-label="your build, previewed">
        <div className={styles.board}>
          {CASES.map((f) =>
            ready.has(`case-${f}`) ? (
              <Render
                key={f}
                name={`case-${f}`}
                on={f === shownCase}
                alt={`The KL-75 in a ${shownCase} case with ${shownCaps} keycaps, on the ${mat} mat.`}
              />
            ) : null,
          )}
          {CAP_SETS.map((s) => (ready.has(`caps-${s}`) ? <Render key={s} name={`caps-${s}`} on={s === shownCaps} alt="" /> : null))}
        </div>

        <div className={styles.printer}>
          <div className={`paper ${styles.mirror}`}>
            <h3 className={`t-ui ${styles.mirrorHead}`}>your build</h3>
            <p className={styles.code}>{code}</p>
            <dl className={styles.lines}>
              {lines.map((line) => (
                <div key={line.k}>
                  <dt>{line.k}</dt>
                  <dd>{line.v}</dd>
                </div>
              ))}
            </dl>
            <p className={`t-ui-sm ${styles.ships}`}>{SHIPS}</p>
          </div>
          <div className={styles.slot} aria-hidden />
          <div className={styles.feed}>
            {printed && (
              <Suspense fallback={null}>
                <Ticket key={printed.n} code={printed.code} first={printed.first} build={printed.build} onEdit={editBuild} />
              </Suspense>
            )}
          </div>
        </div>

        <figure className={styles.brass}>
          <picture>
            <source type="image/avif" srcSet={render("brass", "avif")} />
            <img
              src={render("brass", "webp")}
              alt="The brass weight inside the KL-75, close up, where your engraving goes."
              width={1200}
              height={700}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <p
            className={styles.engrave}
            aria-hidden
            data-empty={engraving ? undefined : ""}
            style={
              {
                left: `${bx * 100}%`,
                top: `${by * 100}%`,
                width: `${bw * 100}%`,
                height: `${bh * 100}%`,
                "--cap-h": brassCap,
              } as CSSProperties
            }
          >
            <span>{engraving || "your words here"}</span>
          </p>
        </figure>
      </aside>

      {/* ---- the form ---- */}
      <form id="build-form" className={styles.form} noValidate onSubmit={onSubmit}>
        <fieldset className={styles.set}>
          <legend className="t-ui">page colour</legend>
          <div className={styles.swatches}>
            {MATS.map((m) => (
              <Choice key={m} name="mat" value={m} checked={mat === m} onChange={setMat} face="swatch">
                <span className={styles.felt} style={{ "--swatch": MAT_SWATCH[m] } as CSSProperties} aria-hidden />
                <span className="t-ui-sm">{m}</span>
              </Choice>
            ))}
          </div>
          <p className={`t-ui-sm ${styles.help}`}>recolours this page, like the felt mat in the photos. not part of the build.</p>
        </fieldset>

        <fieldset className={styles.set}>
          <legend className="t-ui">case</legend>
          <div className={styles.keys}>
            {CASES.map((f) => (
              <Choice key={f} name="case" value={f} checked={caseFinish === f} onChange={setCaseFinish} face="key">
                <span className={styles.chip} style={{ "--chip": CASE_CHIP[f] } as CSSProperties} aria-hidden />
                <span>{f}</span>
              </Choice>
            ))}
          </div>
          <p className={`t-ui-sm ${styles.help}`}>anodized aluminum</p>
        </fieldset>

        <fieldset className={styles.set}>
          <legend className="t-ui">keycaps</legend>
          <div className={styles.keys}>
            {CAP_SETS.map((s) => (
              <Choice key={s} name="caps" value={s} checked={caps === s} onChange={setCaps} face="key">
                <span className={styles.trio} aria-hidden>
                  {CAP_TRIO[s].map((c, i) => (
                    <i key={i} style={{ "--c": c } as CSSProperties} />
                  ))}
                </span>
                <span>
                  {s}
                  <span className={styles.sub}>{CAP_SET_HELP[s]}</span>
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.set}>
          <legend className="t-ui">switch</legend>
          <div className={styles.keys}>
            {SWITCHES.map((s) => (
              <Choice key={s.id} name="switch" value={s.id} checked={voice === s.id} onChange={pickVoice} face="key">
                <span>
                  {s.type} · {s.weight}
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="field-engraving" className="t-ui">
            engraving (optional)
          </label>
          <input
            id="field-engraving"
            className={styles.input}
            type="text"
            maxLength={ENGRAVING_MAX}
            autoComplete="off"
            spellCheck={false}
            value={form.engraving}
            onChange={(event) => update("engraving", event.target.value)}
            aria-describedby="help-engraving"
          />
          <p id="help-engraving" className={`t-ui-sm ${styles.help}`}>
            up to 24 characters, engraved on the brass weight inside. only you&apos;ll know it&apos;s there.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="field-name" className="t-ui">
            your name
          </label>
          <input
            id="field-name"
            className={styles.input}
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "error-name" : undefined}
          />
          <FieldError id="error-name" message={errors.name} />
        </div>

        <div className={styles.field}>
          <label htmlFor="field-email" className="t-ui">
            email
          </label>
          <input
            id="field-email"
            className={styles.input}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "error-email" : undefined}
          />
          <FieldError id="error-email" message={errors.email} />
        </div>

        <div className={styles.field}>
          <label className={styles.consent}>
            <input
              id="field-acknowledged"
              type="checkbox"
              checked={form.acknowledged}
              onChange={(event) => update("acknowledged", event.target.checked)}
              aria-invalid={Boolean(errors.acknowledged)}
              aria-describedby={errors.acknowledged ? "error-acknowledged" : undefined}
            />
            <span>I understand this is a portfolio demo, not a real order, and I&apos;ve read the terms of use and the privacy notice.</span>
          </label>
          {/* Outside the label, so a tap on a link never ticks the box; each link is a full 44 px target. */}
          <p className={`t-ui-sm ${styles.consentLinks}`}>
            <Link href="/legal/terms/">terms of use</Link>
            <Link href="/legal/privacy/">privacy notice</Link>
          </p>
          <FieldError id="error-acknowledged" message={errors.acknowledged} />
        </div>

        <div id="order" className={styles.order}>
          <p className={`t-ui js-only ${styles.hint}`}>press enter for a demo order: nothing is charged, you get a ticket.</p>
          <Cap
            as="button"
            type="submit"
            tone="signal"
            w={2.25}
            top="enter ↵"
            topHidden
            className={styles.submit}
            disabled={!hydrated}
          >
            order
          </Cap>
          <p className={`t-ui-sm ${styles.honest}`}>Portfolio demo. Nothing you type here leaves your browser.</p>
          <p className={`t-ui-sm no-js ${styles.honest}`}>Ordering needs JavaScript. Everything else on this page works without it.</p>
        </div>
        <p className={styles.live} aria-live="polite">
          {announce}
        </p>
      </form>
    </>
  );
}
