"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import dynamic from "next/dynamic";
import type { KeyboardSceneProps } from "./keyboard-scene";
import { SceneBoundary } from "./scene-boundary";

function SceneLoader() {
  return (
    <div
      role="status"
      aria-label="Loading 3D model"
      className="flex h-full w-full items-end justify-between gap-4 p-5 font-mono text-[10px] uppercase tracking-[0.2em] text-metric"
    >
      <span>Loading geometry</span>
      <span className="block h-px w-28 overflow-hidden bg-hairline">
        <span className="block h-full w-1/3 animate-loadbar bg-signal" />
      </span>
    </div>
  );
}

function SceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-metric">
      3D preview unavailable on this device.
      <br />
      Full specification below.
    </div>
  );
}

// three.js needs `window` + WebGL, so this chunk only ever loads in the browser.
const KeyboardScene = dynamic(() => import("./keyboard-scene"), {
  ssr: false,
  loading: () => <SceneLoader />,
});

export function LazyKeyboardScene(props: KeyboardSceneProps) {
  return (
    <SceneBoundary fallback={<SceneFallback />}>
      <KeyboardScene {...props} />
    </SceneBoundary>
  );
}
