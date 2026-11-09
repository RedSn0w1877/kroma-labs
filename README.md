# Kroma — KL-75 Monolith ("press any key")

> © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute. See [LICENSE](LICENSE).

A portfolio concept by HVNF Studios: the product page for a fictional machined-aluminium 75% mechanical keyboard.
The board sits on a yolk-yellow felt desk mat as a photoreal Cycles render. Press a key on your own keyboard and
the same key goes down in the picture while a Web Audio synth plays that switch — no audio files, no WebGL.

## Run it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # static export to out/ (basePath /kroma-labs in production)
```

It deploys to GitHub Pages through `.github/workflows/deploy-pages.yml`.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| Tokens, grid, type, keycaps | `src/app/globals.css` | Three mats (`html[data-mat]`), the u-grid (1u = one of the board's 16 columns, `--u`/`--g`), type classes, the `.cap` keycap primitive, no-JS/lite/embed gates, print watermark |
| Fonts | `src/app/layout.tsx` | Martian Mono (variable, wdth axis; the only preload) and Hanken Grotesk 400, plus a size-adjusted fallback for the condensed display cut |
| Device tiers | `src/lib/device.ts` | Pre-paint script: `html.js`, `data-lite` (phones, reduced motion, low-end) and `data-embed` (framed) |
| Shared state | `src/lib/kroma-state.ts` | Tiny external store: voice, mute, sound-ready, mat; `setMat()` re-chromes the page |
| Sound | `src/lib/sound.ts` → `switch-synth.ts`, `switch-profiles.ts` | Lazy singleton over the synth; every strike goes through it so mute/embed rules apply everywhere |
| Public files | `src/lib/asset.ts` | Prefixes `public/` URLs with the basePath (Next doesn't) |
| Hero board | `src/components/board/*` | `<picture>` of the rest render + one 2D canvas; a key press is one clipped blit from a pressed-class render |
| Key router | `src/components/board/key-router.tsx`, `src/lib/keymap.ts` | Physical key → board slot, by zone (hero, sound, keymap); never `preventDefault` |
| Sections | `src/components/sections/*` | Function-row nav, sound, inside (CSS scroll-driven explode), specs card, build + ticket, keymap footer |
| Legal | `src/components/legal/legal-page.tsx`, `src/app/legal/*` | Terms and Privacy as cream paper on the mat |
| Copyright | `src/components/brand/copyright-guard.tsx`, `src/lib/copyright.ts` | Console notice (kept in production), attribution on long copies |

## Renders (no runtime 3D)

Everything visual about the keyboard is pre-rendered in Blender (Cycles) and shipped as AVIF with WebP fallbacks.
The pipeline lives in `scripts/renders/` (excluded from TypeScript and ESLint; `.cache/` is git-ignored):

| Step | File | Output |
| --- | --- | --- |
| Geometry | `geo/keyboard-layout.ts`, `geo/keycap-geometry.ts`, `export-geo.mjs` | Keycap meshes (OBJ) and per-slot data, with a proper 4-colouring of the keys into press classes |
| Scene | `kl75_scene.py`, `render.py` | The KL-75 model and the shots: hero (desktop + phone), inside (explode layers), build (cases + caps), brass |
| Encode | `encode.mjs` | AVIF + WebP to `public/renders/`, key polygons and layer offsets to `src/data/*.json`; `--verify` checks byte budgets and colour |
| Felt | `felt.mjs` | The desk mat's seamless felt tile, `src/assets/felt-256.webp` |
| All | `run-all.mjs` | Runs the steps above in order |

Run Blender headless (`blender -b --factory-startup -P scripts/renders/render.py -- <shot> <outDir>`); the
image tools use `sharp`, which is already in `node_modules` as a Next dependency.

## Rules this codebase keeps

- No WebGL, GSAP, Lenis, motion or icon libraries are imported (enforced in `eslint.config.mjs`); they remain in
  `package.json` only because the lockfile can't change without a human `npm install`.
- No `setInterval`, no idle `requestAnimationFrame`, and no `preventDefault` on keys: an idle page does no work and
  every key keeps its native job.
- All copy ships visible in the static HTML; JavaScript only adds behaviour.
- Kroma is fiction: no reviews, certifications, scarcity, deposits or random order codes.
