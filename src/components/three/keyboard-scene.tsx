"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { useInView } from "motion/react";
import { KeyboardModel, type ExplodeSource } from "./keyboard-model";
import { SceneBoundary } from "./scene-boundary";
import { COPYRIGHT_SHORT } from "@/lib/copyright";
import { useMedia, usePageVisible } from "@/lib/use-media";

export type Vec3 = readonly [number, number, number];

export type KeyboardSceneProps = {
  cameraPosition: Vec3;
  target: Vec3;
  explode?: ExplodeSource;
  parallax?: number;
};

const MAX_PITCH = 0.6;
const DRAG_SENSITIVITY = 0.008;

/** Aims the camera and pulls it back on narrow canvases so the board never crops. */
function CameraRig({ position, target }: { position: Vec3; target: Vec3 }) {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1));

  useLayoutEffect(() => {
    const focus = new THREE.Vector3(...target);
    const offset = new THREE.Vector3(...position).sub(focus);
    const pullBack = aspect < 1.5 ? 1.5 / Math.max(aspect, 0.5) : 1;
    camera.position.copy(focus).add(offset.multiplyScalar(pullBack));
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
  }, [camera, aspect, position, target]);

  return null;
}

export default function KeyboardScene({ cameraPosition, target, explode, parallax = 0.3 }: KeyboardSceneProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  // Pause rendering when the canvas is off screen — saves GPU and battery.
  const inView = useInView(wrapper, { margin: "60px 0px" });
  const visible = usePageVisible();
  const compact = useMedia("(max-width: 767px), (pointer: coarse)");
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const pointer = useRef({ x: 0, y: 0 });
  // Persists across drags: the model stays wherever you leave it, with ambient
  // cursor parallax layered on top once you let go.
  const orbit = useRef({ yaw: 0, pitch: 0 });
  const dragState = useRef({ dragging: false, lastX: 0, lastY: 0, pointerId: -1 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!inView || !visible || compact || reduce) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [inView, visible, compact, reduce]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragState.current = { dragging: true, lastX: event.clientX, lastY: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    orbit.current.yaw += dx * DRAG_SENSITIVITY;
    orbit.current.pitch = THREE.MathUtils.clamp(orbit.current.pitch - dy * DRAG_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current.pointerId !== event.pointerId) return;
    dragState.current.dragging = false;
    setDragging(false);
  };

  return (
    <div
      ref={wrapper}
      className="relative h-full w-full touch-pan-y"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <Canvas
        frameloop={inView && visible ? "always" : "never"}
        dpr={compact ? [1, 1.25] : [1, 1.5]}
        camera={{ position: [...cameraPosition], fov: 30, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <CameraRig position={cameraPosition} target={target} />
        {/* Product-shot rig: key light, cool fill, warm rim. */}
        <ambientLight intensity={0.18} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <directionalLight position={[-5, 3, -2]} intensity={0.5} color="#8891a8" />
        <directionalLight position={[-2, 2, -5]} intensity={0.8} color="#ff4400" />
        <KeyboardModel explode={explode} pointer={pointer} orbit={orbit} parallax={compact || reduce ? 0 : parallax} />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.65} blur={2.4} scale={9} far={2.5} resolution={compact ? 256 : 512} />
        {/* The HDR map comes from a CDN; if it's blocked, the model still renders with the lights above. */}
        <SceneBoundary fallback={null}>
          <Suspense fallback={null}>
            <Environment preset="studio" environmentIntensity={0.55} />
          </Suspense>
        </SceneBoundary>
      </Canvas>
      <span className="pointer-events-none absolute bottom-3 right-4 select-none font-mono text-[10px] uppercase tracking-[0.2em] text-metric/60">
        Render {COPYRIGHT_SHORT}
      </span>
    </div>
  );
}
