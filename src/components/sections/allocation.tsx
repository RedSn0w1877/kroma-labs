"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { BorderBeam } from "border-beam";
import { SWITCH_PROFILES, type SwitchId } from "@/lib/switch-profiles";
import { SheetMark } from "@/components/brand/sheet-mark";
import { EASE_OUT, Reveal } from "@/components/ui/reveal";

type Option<T extends string> = { id: T; name: string; detail: string; swatch?: string };

type CaseFinish = "raw-billet" | "carbon-anodize" | "signal-orange";
type WeightFinish = "mirror-pvd" | "raw-brass";
type Layout = "ansi" | "iso";

const CASE_FINISHES: Option<CaseFinish>[] = [
  { id: "raw-billet", name: "Raw Billet", detail: "Bead-blast, clear anodize 20 µm", swatch: "#b4b4bb" },
  { id: "carbon-anodize", name: "Carbon", detail: "Type II black anodize 25 µm", swatch: "#26262b" },
  { id: "signal-orange", name: "Signal Orange", detail: "Type II dyed anodize 22 µm", swatch: "#ff4400" },
];

const WEIGHT_FINISHES: Option<WeightFinish>[] = [
  { id: "mirror-pvd", name: "Mirror PVD Brass", detail: "0.8 µm PVD, holds its shine", swatch: "#caa55a" },
  { id: "raw-brass", name: "Raw C360 Brass", detail: "Uncoated, develops patina", swatch: "#9c7a3c" },
];

const SWITCH_OPTIONS: Option<SwitchId>[] = SWITCH_PROFILES.map((profile) => ({
  id: profile.id,
  name: `${profile.name} (${profile.weight})`,
  detail: profile.type,
}));

const LAYOUTS: Option<Layout>[] = [
  { id: "ansi", name: "75% ANSI", detail: "Wide left shift, bar enter" },
  { id: "iso", name: "75% ISO", detail: "Split left shift, tall enter" },
];

const REGIONS = ["North America", "United Kingdom", "European Union", "Asia-Pacific", "Rest of world"] as const;

type FormState = {
  name: string;
  email: string;
  region: string;
  caseFinish: CaseFinish;
  weightFinish: WeightFinish;
  switchId: SwitchId;
  layout: Layout;
  notes: string;
  acknowledged: boolean;
};

type ErrorKey = "name" | "email" | "region" | "acknowledged";
type Errors = Partial<Record<ErrorKey, string>>;

const INITIAL: FormState = {
  name: "",
  email: "",
  region: "",
  caseFinish: "raw-billet",
  weightFinish: "mirror-pvd",
  switchId: "linear-mineral",
  layout: "ansi",
  notes: "",
  acknowledged: false,
};

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.region) errors.region = "Choose a shipping region.";
  if (!form.acknowledged) errors.acknowledged = "Confirm you've read the allocation terms.";
  return errors;
}

const nameOf = <T extends string>(options: Option<T>[], id: T) => options.find((option) => option.id === id)?.name ?? id;

const inputClass =
  "mt-2 h-12 w-full border border-hairline bg-carbon px-4 text-sm text-chalk placeholder:text-metric/60 transition-colors hover:border-metric focus:border-chalk focus:outline-none aria-[invalid=true]:border-signal";

function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string;
  name: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns: string;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 border px-4 py-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-signal ${
                checked ? "border-chalk bg-billet" : "border-hairline hover:border-metric"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              {option.swatch ? (
                <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 border border-chalk/20" style={{ backgroundColor: option.swatch }} />
              ) : (
                <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 ${checked ? "bg-signal" : "bg-hairline"}`} />
              )}
              <span>
                <span className="block text-sm font-medium text-chalk">{option.name}</span>
                <span className="mt-0.5 block text-xs text-metric">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
      {message}
    </p>
  );
}

export function Allocation() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"editing" | "holding" | "confirmed">("editing");
  const [reference, setReference] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
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
    setStatus("holding");
    timer.current = window.setTimeout(() => {
      setReference(`KL-B04-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
      setStatus("confirmed");
    }, 900);
  };

  const buildSheet = [
    ["Case", nameOf(CASE_FINISHES, form.caseFinish)],
    ["Ballast", nameOf(WEIGHT_FINISHES, form.weightFinish)],
    ["Switches", nameOf(SWITCH_OPTIONS, form.switchId)],
    ["Layout", nameOf(LAYOUTS, form.layout)],
  ] as const;

  return (
    <section id="allocation" className="border-b border-hairline">
      <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 lg:py-32">
        <SheetMark sheet="05" title="Allocation request" />

        <div className="mt-10 grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.02em] md:text-6xl">
              Hold a
              <br />
              <span className="font-[family-name:var(--font-editorial-serif)] text-2xl normal-case italic tracking-normal text-metric md:text-5xl">
                Batch 04 slot.
              </span>
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-metric">
              Batch 04 is limited to 120 cases so each one gets a full inspection pass. Tell us your build and we
              hold a slot for 72 hours while we send a deposit invoice.
            </p>

            <div className="mt-10 max-w-sm">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
                <span>Slots held</span>
                <span className="text-chalk tabular-nums">84 / 120</span>
              </div>
              <div className="mt-2 h-1 bg-hairline">
                <div className="h-full w-[70%] bg-signal" />
              </div>
            </div>

            <dl className="mt-10 max-w-sm border-t border-chalk/70">
              <div className="py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Your build sheet</div>
              {buildSheet.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-t border-hairline py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">{label}</dt>
                  <dd className="text-right text-sm text-chalk">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-hairline py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Deposit</dt>
                <dd className="text-right text-sm text-chalk">$150, refundable until machining</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-8">
            {/*
              BorderBeam is a one-off exception to the studio's own no-glow-border rule
              (see CLAUDE.md), approved for this page only. Sunset variant + zero radius
              so it reads as a scanning inspection light on a machined panel, not a SaaS glow.
            */}
            <BorderBeam size="md" colorVariant="sunset" theme="dark" strength={0.7} borderRadius={0}>
            <div className="border border-hairline bg-billet">
              <AnimatePresence mode="wait" initial={false}>
                {status === "confirmed" ? (
                  <motion.div
                    key="confirmed"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                    className="p-6 md:p-10"
                    role="status"
                  >
                    <span className="flex h-11 w-11 items-center justify-center bg-signal text-carbon">
                      <Check aria-hidden className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                    <h3 className="mt-6 font-display text-3xl font-semibold uppercase tracking-[-0.01em] md:text-4xl">
                      Slot held, {form.name.trim().split(" ")[0]}.
                    </h3>
                    <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-metric">
                      On a real order, this is where a deposit invoice would land in{" "}
                      <span className="text-chalk">{form.email.trim()}</span>&apos;s inbox within one business day.
                    </p>
                    <dl className="mt-8 grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
                      <div className="bg-carbon px-4 py-3">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Reference</dt>
                        <dd className="mt-1 font-mono text-lg text-signal">{reference}</dd>
                      </div>
                      <div className="bg-carbon px-4 py-3">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">Ships to</dt>
                        <dd className="mt-1 text-lg">{form.region}</dd>
                      </div>
                      {buildSheet.map(([label, value]) => (
                        <div key={label} className="bg-carbon px-4 py-3">
                          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">{label}</dt>
                          <dd className="mt-1 text-sm">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-metric/80">
                      Portfolio demo — no invoice was sent, no data was saved.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("editing");
                        setReference("");
                      }}
                      className="mt-6 inline-flex h-11 items-center border border-hairline px-5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:border-chalk"
                    >
                      Edit request
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    noValidate
                    onSubmit={onSubmit}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                    className="flex flex-col gap-8 p-6 md:p-10"
                  >
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label htmlFor="field-name" className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
                          Full name
                        </label>
                        <input
                          id="field-name"
                          type="text"
                          autoComplete="name"
                          value={form.name}
                          onChange={(event) => update("name", event.target.value)}
                          aria-invalid={Boolean(errors.name)}
                          aria-describedby={errors.name ? "error-name" : undefined}
                          className={inputClass}
                        />
                        <FieldError id="error-name" message={errors.name} />
                      </div>
                      <div>
                        <label htmlFor="field-email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
                          Email
                        </label>
                        <input
                          id="field-email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={form.email}
                          onChange={(event) => update("email", event.target.value)}
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? "error-email" : undefined}
                          className={inputClass}
                        />
                        <FieldError id="error-email" message={errors.email} />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="field-region" className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
                          Shipping region
                        </label>
                        <select
                          id="field-region"
                          value={form.region}
                          onChange={(event) => update("region", event.target.value)}
                          aria-invalid={Boolean(errors.region)}
                          aria-describedby={errors.region ? "error-region" : undefined}
                          className={`${inputClass} appearance-none`}
                        >
                          <option value="">Select a region</option>
                          {REGIONS.map((region) => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </select>
                        <FieldError id="error-region" message={errors.region} />
                      </div>
                    </div>

                    <OptionGroup
                      legend="Case finish"
                      name="caseFinish"
                      options={CASE_FINISHES}
                      value={form.caseFinish}
                      onChange={(value) => update("caseFinish", value)}
                      columns="sm:grid-cols-3"
                    />
                    <OptionGroup
                      legend="Ballast finish"
                      name="weightFinish"
                      options={WEIGHT_FINISHES}
                      value={form.weightFinish}
                      onChange={(value) => update("weightFinish", value)}
                      columns="sm:grid-cols-2"
                    />
                    <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
                      <OptionGroup
                        legend="Switches"
                        name="switchId"
                        options={SWITCH_OPTIONS}
                        value={form.switchId}
                        onChange={(value) => update("switchId", value)}
                        columns="grid-cols-1"
                      />
                      <OptionGroup
                        legend="Layout"
                        name="layout"
                        options={LAYOUTS}
                        value={form.layout}
                        onChange={(value) => update("layout", value)}
                        columns="grid-cols-1"
                      />
                    </div>

                    <div>
                      <label htmlFor="field-notes" className="font-mono text-[10px] uppercase tracking-[0.18em] text-metric">
                        Build notes <span className="normal-case tracking-normal">(optional)</span>
                      </label>
                      <textarea
                        id="field-notes"
                        rows={3}
                        value={form.notes}
                        onChange={(event) => update("notes", event.target.value)}
                        placeholder="Keycap set, foam preferences, delivery timing"
                        className={`${inputClass} h-auto resize-y py-3`}
                      />
                    </div>

                    <div>
                      <label className="flex cursor-pointer items-start gap-3 text-sm text-metric">
                        <input
                          id="field-acknowledged"
                          type="checkbox"
                          checked={form.acknowledged}
                          onChange={(event) => update("acknowledged", event.target.checked)}
                          aria-invalid={Boolean(errors.acknowledged)}
                          aria-describedby={errors.acknowledged ? "error-acknowledged" : undefined}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff4400]"
                        />
                        <span>
                          I understand this is a demo request, not a real order, and have read the{" "}
                          <Link href="/legal/terms" className="text-chalk underline decoration-hairline underline-offset-4 hover:decoration-chalk">
                            terms
                          </Link>{" "}
                          and{" "}
                          <Link href="/legal/privacy" className="text-chalk underline decoration-hairline underline-offset-4 hover:decoration-chalk">
                            privacy notice
                          </Link>
                          .
                        </span>
                      </label>
                      <FieldError id="error-acknowledged" message={errors.acknowledged} />
                    </div>

                    <div className="flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-metric/80">
                        Portfolio demo — nothing you type here leaves your browser.
                      </p>
                      <button
                        type="submit"
                        disabled={status === "holding"}
                        className="inline-flex h-12 items-center justify-center gap-2 bg-signal px-7 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-carbon transition-colors hover:bg-chalk disabled:cursor-wait disabled:opacity-70"
                      >
                        {status === "holding" ? "Holding slot…" : "Request allocation"}
                        {status !== "holding" && <ArrowRight aria-hidden className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
            </BorderBeam>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
