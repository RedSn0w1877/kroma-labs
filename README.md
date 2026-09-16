# KROMA LABS — KL-75 Showcase

> © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute. See [LICENSE](LICENSE).

Flagship portfolio build: a fictional billet-aluminum keyboard brand with a scroll-driven 3D exploded view, a Web Audio switch soundboard, and an allocation form.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| Smooth scroll | `src/components/providers/smooth-scroll.tsx` | Lenis driven by GSAP's ticker, feeding ScrollTrigger |
| 3D model | `src/components/three/keyboard-model.tsx` | Six-layer keyboard built from three.js primitives |
| 3D canvas | `src/components/three/keyboard-scene.tsx` | Canvas, lights, environment map, contact shadows, parallax |
| Client-only loader | `src/components/three/lazy-keyboard-scene.tsx` | `next/dynamic` with `ssr: false`, loader + WebGL fallback |
| Exploded view | `src/components/sections/schematic.tsx` | Pinned GSAP timeline tweens `explodeStore.value` 0 → 1 → 0 |
| Soundboard | `src/lib/switch-synth.ts`, `src/components/sections/soundboard.tsx` | Synthesized keystrokes + spectrum bars |
| Copyright marks | `src/components/brand/*`, `src/lib/copyright.ts` | Watermark rail, sheet marks, copy attribution, print watermark |
