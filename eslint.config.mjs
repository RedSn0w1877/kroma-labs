// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// three, R3F, drei, GSAP, Lenis, motion, border-beam and lucide stay in package.json (the lockfile can't
// change without a human `npm install`), but nothing under src/ may import them (spec §1.2, §1.4, §1.9).
const DROPPED = [
  { name: "three", message: "Kroma ships zero WebGL: the board is a Cycles render (spec §0, §11)." },
  { name: "gsap", message: "No GSAP: use position:sticky and CSS scroll-driven animations (spec §6.4)." },
  { name: "@gsap/react", message: "No GSAP (spec §0)." },
  { name: "lenis", message: "No smooth-scroll library: native scroll only (spec §8)." },
  { name: "motion", message: "No motion: CSS transitions and keyframes only (spec §0, §8)." },
  { name: "framer-motion", message: "No motion (spec §0)." },
  { name: "border-beam", message: "No BorderBeam (spec §0)." },
  { name: "lucide-react", message: "No icon library: legends are text on keycaps (spec §0)." },
  { name: "sonner", message: "No toasts on Kroma (spec §1.9)." },
  { name: "canvas-confetti", message: "No confetti on Kroma (spec §1.9)." },
  { name: "next/image", message: "Use a plain <picture> with width/height (spec §1.4)." },
  { name: "next/dynamic", message: "Use a plain import() inside an effect or handler (spec §1.4)." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: DROPPED,
          patterns: [
            { group: ["three/*", "@react-three/*"], message: "Kroma ships zero WebGL (spec §0, §11)." },
            { group: ["gsap/*", "lenis/*", "motion/*"], message: "Dropped library (spec §0)." },
          ],
        },
      ],
      // An idle page has 0 timers (spec §1.8): one-shot setTimeout only.
      "no-restricted-globals": ["error", { name: "setInterval", message: "No setInterval: an idle page runs no timers (spec §1.8)." }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "setInterval", message: "No setInterval (spec §1.8)." },
        { object: "globalThis", property: "setInterval", message: "No setInterval (spec §1.8)." },
      ],
      // No page-level preventDefault, ever (spec §1.7). The build form's onSubmit is the one exception.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='preventDefault']",
          message: "No preventDefault: keys keep their native job (spec §1.7). Only build-form's onSubmit may call it.",
        },
      ],
    },
  },
  {
    // The two sanctioned preventDefault calls: the build form's submit (spec §6.6) and CopyrightGuard's copy
    // handler, which must cancel the copy event for its attribution to reach the clipboard (spec §10).
    files: ["src/components/sections/build-form.tsx", "src/components/brand/copyright-guard.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Ticket codes are derived from the visitor's choices, never random (spec §1.10, §6.6).
    files: ["src/lib/build-code.ts", "src/components/sections/build-form.tsx", "src/components/sections/ticket.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Ticket codes are derived, never random (spec §6.6)." },
        { object: "window", property: "setInterval", message: "No setInterval (spec §1.8)." },
        { object: "globalThis", property: "setInterval", message: "No setInterval (spec §1.8)." },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Blender/sharp render pipeline runs under plain Node with .ts import extensions (spec §11.1).
    "scripts/**",
  ]),
]);

export default eslintConfig;
