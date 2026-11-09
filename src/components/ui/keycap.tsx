// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { createElement, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";

/**
 * Keycaps as page furniture (spec §5.6). Server-safe: no hooks, no "use client", so it renders in server
 * and client components alike. The look lives in globals.css (.cap, .cap--graphite, .cap--signal,
 * .cap__top, --w); this only assembles the classes and the two legends.
 *
 *   <Cap as="a" href="#build" tone="signal" w={2.25} top="build yours">from $640 ↵</Cap>
 *   <Cap as="button" type="button" aria-pressed={on}>mute</Cap>
 *   <Cap as="kbd" data-keymap="esc">esc</Cap>
 *
 * For a next/link, use capClass(): <Link className={capClass("cream", styles.back)} href="/">…</Link>.
 */

export type CapTag = "a" | "button" | "span" | "kbd";
export type CapTone = "cream" | "graphite" | "signal";

type CapOwnProps<T extends CapTag> = {
  /** The element to render. Default "span". "a" for links, "button" for actions, "kbd" for shortcut legends. */
  as?: T;
  /** cream (alphas), graphite (modifiers) or signal (the red Esc/Enter). Default cream. */
  tone?: CapTone;
  /** The small top legend, e.g. "f1" or "enter ↵". */
  top?: ReactNode;
  /** Hide the top legend from assistive tech when it's only a shortcut hint (e.g. "enter ↵" over "order"). */
  topHidden?: boolean;
  /** Width in key units, e.g. 2.25 for an Enter key: the cap is w·u wide minus one key gap. */
  w?: number;
};

type CapBase = { className?: string; style?: CSSProperties; children?: ReactNode };

export type CapProps<T extends CapTag = "span"> = CapOwnProps<T> &
  CapBase &
  Omit<ComponentPropsWithoutRef<T>, keyof CapOwnProps<T> | keyof CapBase>;

const TONE_CLASS: Record<CapTone, string> = { cream: "", graphite: "cap--graphite", signal: "cap--signal" };

/** The class string for a keycap of this tone, plus any extra classes. */
export function capClass(tone: CapTone = "cream", extra?: string): string {
  return ["cap", TONE_CLASS[tone], extra].filter(Boolean).join(" ");
}

export function Cap<T extends CapTag = "span">({
  as,
  tone = "cream",
  top,
  topHidden = false,
  w,
  className,
  style,
  children,
  ...rest
}: CapProps<T>) {
  const merged = w === undefined ? style : ({ ...style, "--w": w } as CSSProperties);
  // createElement rather than a JSX <Tag>: TS types a JSX tag of a union type as the intersection of
  // every candidate's props, which collapses to never.
  return createElement(
    as ?? "span",
    { ...rest, className: capClass(tone, className), style: merged },
    top === undefined ? null : (
      <span className="cap__top" aria-hidden={topHidden || undefined}>
        {top}
      </span>
    ),
    children,
  );
}

/** A small inline keycap for running text, e.g. "press <Kbd>1</Kbd>, <Kbd>2</Kbd> or <Kbd>3</Kbd>". */
export function Kbd({ className, ...rest }: ComponentPropsWithoutRef<"kbd">) {
  return <kbd className={["cap", "kbd", className].filter(Boolean).join(" ")} {...rest} />;
}
