"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  BOARD_DEPTH,
  BOARD_WIDTH,
  KEY_SLOTS,
  KNOB_X,
  KNOB_Z,
  ROW_PROFILE,
} from "@/lib/keyboard-layout";
import {
  createEngravingTexture,
  createKeycapGeometry,
  createLegendAtlas,
  createLegendGeometry,
  createSilkscreenTexture,
} from "@/lib/keycap-geometry";
import { COPYRIGHT_SHORT } from "@/lib/copyright";

export type ExplodeSource = { value: number };
export type PointerRef = RefObject<{ x: number; y: number }>;
/** Drag-to-rotate offset, in radians. Persists between drags; ambient parallax layers on top. */
export type OrbitRef = RefObject<{ yaw: number; pitch: number }>;

const INCLINE = THREE.MathUtils.degToRad(7.2);
const BEZEL = 0.15;
const CASE_W = BOARD_WIDTH + BEZEL * 2;
const CASE_D = BOARD_DEPTH + BEZEL * 2;
const CASE_H = 0.28;
const WALL = 0.13;
const RAIL = BEZEL;

/** Y offset of each layer when assembled (rest) and fully exploded (open). */
const LAYERS = [
  { id: "case", rest: 0, open: 0 },
  { id: "brass", rest: 0.075, open: 0.45 },
  { id: "pcb", rest: 0.135, open: 0.85 },
  { id: "switches", rest: 0.175, open: 1.25 },
  { id: "frame", rest: CASE_H, open: 1.65 },
  { id: "keycaps", rest: 0.3, open: 2.05 },
] as const;

const GASKET_X = [-1.15, -0.4, 0.4, 1.15];

type KeyboardModelProps = {
  explode?: ExplodeSource;
  pointer: PointerRef;
  orbit?: OrbitRef;
  parallax?: number;
};

export function KeyboardModel({ explode, pointer, orbit, parallax = 0.3 }: KeyboardModelProps) {
  // The root group's children are the six layer groups, in LAYERS order.
  const root = useRef<THREE.Group>(null);
  const housings = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);

  const materials = useMemo(() => {
    const anodized = (color: string) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.34,
        metalness: 0.86,
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
      });

    return {
      // Part A — anodized 6063 aluminum top frame and case
      frame: anodized("#34343c"),
      caseBody: anodized("#2b2b32"),
      // Part C — mirrored PVD brass weight
      brass: new THREE.MeshStandardMaterial({ color: "#caa55a", roughness: 0.08, metalness: 1 }),
      pcb: new THREE.MeshStandardMaterial({ color: "#14231c", roughness: 0.55, metalness: 0.15 }),
      plate: new THREE.MeshStandardMaterial({ color: "#2a2a30", roughness: 0.48, metalness: 0.2 }),
      gasket: new THREE.MeshStandardMaterial({ color: "#3b3b42", roughness: 0.9, metalness: 0 }),
      // Part B — frosted polycarbonate switch housings
      housing: new THREE.MeshPhysicalMaterial({
        color: "#e4e4ec",
        roughness: 0.36,
        metalness: 0,
        transmission: 0.82,
        thickness: 0.14,
        ior: 1.585,
      }),
      stem: new THREE.MeshStandardMaterial({ color: "#ff4400", roughness: 0.45 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#131317", roughness: 0.95 }),
      port: new THREE.MeshStandardMaterial({ color: "#0c0c0f", roughness: 0.6, metalness: 0.4 }),
      knob: new THREE.MeshStandardMaterial({ color: "#3d3d46", roughness: 0.3, metalness: 0.9 }),
      led: new THREE.MeshStandardMaterial({
        color: "#ff4400",
        emissive: "#ff4400",
        emissiveIntensity: 2.2,
      }),
      alpha: new THREE.MeshStandardMaterial({ color: "#dcdce0", roughness: 0.62 }),
      mod: new THREE.MeshStandardMaterial({ color: "#35353d", roughness: 0.6 }),
      accent: new THREE.MeshStandardMaterial({ color: "#ff4400", roughness: 0.55 }),
    };
  }, []);

  // One texture holds every legend; per-key UVs are baked into the geometry.
  const legendAtlas = useMemo(() => createLegendAtlas(KEY_SLOTS), []);

  const legendMaterials = useMemo(() => {
    const make = (color: string) =>
      new THREE.MeshStandardMaterial({
        color,
        map: legendAtlas,
        roughness: 0.75,
        alphaTest: 0.2,
      });
    return {
      alpha: make("#2a2a2e"),
      mod: make("#d4d4d8"),
      accent: make("#2a1000"),
    };
  }, [legendAtlas]);

  // Cache cap shapes by width + row, so 82 keys share ~20 geometries.
  const capGeometries = useMemo(() => {
    const cache = new Map<string, THREE.BufferGeometry>();
    for (const slot of KEY_SLOTS) {
      const key = `${slot.width}|${slot.row}`;
      if (!cache.has(key)) {
        const profile = ROW_PROFILE[slot.row];
        cache.set(key, createKeycapGeometry(slot.width, profile.height, profile.dish));
      }
    }
    return cache;
  }, []);

  const legendGeometries = useMemo(
    () =>
      new Map(
        KEY_SLOTS.filter((slot) => slot.label).map((slot) => [
          slot.cell,
          createLegendGeometry(ROW_PROFILE[slot.row].dish, slot.cell),
        ]),
      ),
    [],
  );

  const brassEngraving = useMemo(
    () =>
      createEngravingTexture([
        { text: "KROMA LABS · KL-75 · BATCH 04", size: 58 },
        { text: `${COPYRIGHT_SHORT.toUpperCase()} · DO NOT REDISTRIBUTE`, size: 34 },
      ]),
    [],
  );

  const pcbSilkscreen = useMemo(
    () => createSilkscreenTexture(["KROMA LABS", "KL75-PCB REV C", COPYRIGHT_SHORT]),
    [],
  );

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
      Object.values(legendMaterials).forEach((material) => material.dispose());
      capGeometries.forEach((geometry) => geometry.dispose());
      legendGeometries.forEach((geometry) => geometry.dispose());
      legendAtlas?.dispose();
      brassEngraving?.dispose();
      pcbSilkscreen?.dispose();
    },
    [materials, legendMaterials, capGeometries, legendGeometries, legendAtlas, brassEngraving, pcbSilkscreen],
  );

  // Place every switch housing + stem with instancing: 2 draw calls instead of 164.
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    KEY_SLOTS.forEach((slot, i) => {
      matrix.makeTranslation(slot.x, 0.063, slot.z);
      housings.current?.setMatrixAt(i, matrix);
      matrix.makeTranslation(slot.x, 0.125, slot.z);
      stems.current?.setMatrixAt(i, matrix);
    });
    if (housings.current) housings.current.instanceMatrix.needsUpdate = true;
    if (stems.current) stems.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const e = explode ? THREE.MathUtils.clamp(explode.value, 0, 1) : 0;
    const group = root.current;
    if (!group) return;

    LAYERS.forEach((layer, i) => {
      const child = group.children[i];
      if (!child) return;
      const target = THREE.MathUtils.lerp(layer.rest, layer.open, e);
      child.position.y = THREE.MathUtils.damp(child.position.y, target, 10, dt);
    });

    const { x, y } = pointer.current;
    const yaw = orbit?.current.yaw ?? 0;
    const pitch = orbit?.current.pitch ?? 0;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, yaw + x * parallax - e * 0.35, 4, dt);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, INCLINE + pitch - y * parallax * 0.35 + e * 0.12, 4, dt);
  });

  return (
    <group ref={root} rotation={[INCLINE, 0, 0]}>
      {/* Bottom case, USB-C port and feet */}
      <group position={[0, LAYERS[0].rest, 0]}>
        <RoundedBox args={[CASE_W, 0.07, CASE_D]} radius={0.028} position={[0, 0.035, 0]} material={materials.caseBody} />
        <RoundedBox args={[CASE_W, CASE_H, WALL]} radius={0.03} position={[0, CASE_H / 2, CASE_D / 2 - WALL / 2]} material={materials.caseBody} />
        <RoundedBox args={[CASE_W, CASE_H, WALL]} radius={0.03} position={[0, CASE_H / 2, -CASE_D / 2 + WALL / 2]} material={materials.caseBody} />
        <RoundedBox args={[WALL, CASE_H, CASE_D - WALL * 2]} radius={0.03} position={[CASE_W / 2 - WALL / 2, CASE_H / 2, 0]} material={materials.caseBody} />
        <RoundedBox args={[WALL, CASE_H, CASE_D - WALL * 2]} radius={0.03} position={[-CASE_W / 2 + WALL / 2, CASE_H / 2, 0]} material={materials.caseBody} />
        <RoundedBox args={[0.13, 0.05, 0.03]} radius={0.014} position={[0, 0.17, -CASE_D / 2 + 0.01]} material={materials.port} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}-${sz}`}
              position={[sx * (CASE_W / 2 - 0.3), -0.008, sz * (CASE_D / 2 - 0.25)]}
              material={materials.rubber}
            >
              <cylinderGeometry args={[0.055, 0.055, 0.016, 20]} />
            </mesh>
          )),
        )}
      </group>

      {/* Brass ballast with engraved maker's mark */}
      <group position={[0, LAYERS[1].rest, 0]}>
        <RoundedBox args={[BOARD_WIDTH * 0.86, 0.05, BOARD_DEPTH * 0.6]} radius={0.012} position={[0, 0.025, 0]} material={materials.brass} />
        {brassEngraving && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0506, 0]}>
            <planeGeometry args={[1.7, 0.425]} />
            <meshStandardMaterial map={brassEngraving} transparent depthWrite={false} roughness={0.35} metalness={0.6} />
          </mesh>
        )}
      </group>

      {/* Hot-swap PCB, silkscreened like a real board */}
      <group position={[0, LAYERS[2].rest, 0]}>
        <RoundedBox args={[BOARD_WIDTH + 0.04, 0.035, BOARD_DEPTH + 0.04]} radius={0.008} position={[0, 0.0175, 0]} material={materials.pcb} />
        {pcbSilkscreen && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-BOARD_WIDTH / 2 + 0.42, 0.0351, BOARD_DEPTH / 2 - 0.09]}
          >
            <planeGeometry args={[0.82, 0.205]} />
            <meshStandardMaterial map={pcbSilkscreen} transparent depthWrite={false} roughness={0.65} />
          </mesh>
        )}
      </group>

      {/* Leaf-spring plate, gaskets, polycarbonate switch housings */}
      <group position={[0, LAYERS[3].rest, 0]}>
        <RoundedBox args={[BOARD_WIDTH + 0.02, 0.018, BOARD_DEPTH + 0.02]} radius={0.006} position={[0, 0.009, 0]} material={materials.plate} />
        {GASKET_X.flatMap((gx) =>
          [1, -1].map((side) => (
            <mesh key={`${gx}-${side}`} position={[gx, 0.009, side * (BOARD_DEPTH / 2 + 0.03)]} material={materials.gasket}>
              <boxGeometry args={[0.2, 0.03, 0.05]} />
            </mesh>
          )),
        )}
        <instancedMesh ref={housings} args={[undefined, undefined, KEY_SLOTS.length]} material={materials.housing} frustumCulled={false}>
          <boxGeometry args={[0.14, 0.09, 0.14]} />
        </instancedMesh>
        <instancedMesh ref={stems} args={[undefined, undefined, KEY_SLOTS.length]} material={materials.stem} frustumCulled={false}>
          <boxGeometry args={[0.04, 0.05, 0.04]} />
        </instancedMesh>
      </group>

      {/* Anodized aluminum top frame, knob and indicator */}
      <group position={[0, LAYERS[4].rest, 0]}>
        <RoundedBox args={[CASE_W, 0.075, RAIL]} radius={0.018} position={[0, 0.0375, CASE_D / 2 - RAIL / 2]} material={materials.frame} />
        <RoundedBox args={[CASE_W, 0.075, RAIL]} radius={0.018} position={[0, 0.0375, -CASE_D / 2 + RAIL / 2]} material={materials.frame} />
        <RoundedBox args={[RAIL, 0.075, CASE_D - RAIL * 2]} radius={0.018} position={[CASE_W / 2 - RAIL / 2, 0.0375, 0]} material={materials.frame} />
        <RoundedBox args={[RAIL, 0.075, CASE_D - RAIL * 2]} radius={0.018} position={[-CASE_W / 2 + RAIL / 2, 0.0375, 0]} material={materials.frame} />
        <mesh position={[KNOB_X, 0.06, KNOB_Z]} material={materials.knob}>
          <cylinderGeometry args={[0.082, 0.082, 0.09, 36]} />
        </mesh>
        <mesh position={[KNOB_X, 0.106, KNOB_Z - 0.045]} material={materials.led}>
          <boxGeometry args={[0.008, 0.004, 0.035]} />
        </mesh>
        <mesh position={[CASE_W / 2 - 0.34, 0.077, CASE_D / 2 - RAIL / 2]} material={materials.led}>
          <boxGeometry args={[0.07, 0.004, 0.014]} />
        </mesh>
      </group>

      {/* Sculpted keycaps with legends */}
      <group position={[0, LAYERS[5].rest, 0]}>
        {KEY_SLOTS.map((slot) => {
          const profile = ROW_PROFILE[slot.row];
          const legend = legendGeometries.get(slot.cell);
          return (
            <mesh
              key={slot.cell}
              geometry={capGeometries.get(`${slot.width}|${slot.row}`)}
              material={materials[slot.tone]}
              position={[slot.x, profile.height / 2, slot.z]}
              rotation={[THREE.MathUtils.degToRad(profile.tilt), 0, 0]}
            >
              {legend && (
                <mesh geometry={legend} material={legendMaterials[slot.tone]} position={[0, profile.height / 2, 0]} />
              )}
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
