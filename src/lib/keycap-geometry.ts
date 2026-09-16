// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { KEY_GAP, KEY_UNIT, type KeySlot } from "./keyboard-layout";

/** How much narrower the top of a keycap is than its base. */
const TOP_TAPER = 0.8;

export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 6;

/** Depth of the dish at a point, as a function of its position on the cap top. */
function dishAt(x: number, z: number, depth: number) {
  const rx = THREE.MathUtils.clamp(x / (KEY_UNIT * 0.42), -1, 1);
  const rz = THREE.MathUtils.clamp(z / ((KEY_UNIT - KEY_GAP) * 0.42), -1, 1);
  const radial = Math.min(1, rx * rx * 0.55 + rz * rz);
  // 0 at the rim, full depth in the middle — a concave scoop, not a sunken slab.
  return depth * (1 - radial);
}

/**
 * Builds one sculpted keycap: a rounded box that tapers toward the top and is
 * scooped out on its top face. Warping is a pure function of vertex position,
 * so shared edges move together and the surface stays watertight.
 */
export function createKeycapGeometry(widthUnits: number, height: number, dish: number) {
  const width = widthUnits * KEY_UNIT - KEY_GAP;
  const depth = KEY_UNIT - KEY_GAP;
  const geometry = new RoundedBoxGeometry(width, height, depth, 5, 0.014);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const t = THREE.MathUtils.clamp((vertex.y + height / 2) / height, 0, 1);

    const taper = THREE.MathUtils.lerp(1, TOP_TAPER, t * t);
    vertex.x *= taper;
    vertex.z *= taper;

    const topWeight = THREE.MathUtils.smoothstep(t, 0.75, 1);
    if (topWeight > 0) vertex.y -= dishAt(vertex.x, vertex.z, dish) * topWeight;

    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A small plane that follows the dished cap surface, with its UVs remapped to
 * one cell of the legend atlas. Baking UVs per key means every legend can share
 * a single material and a single texture upload.
 */
export function createLegendGeometry(dish: number, atlasCell: number) {
  const size = KEY_UNIT * 0.62;
  const geometry = new THREE.PlaneGeometry(size, size, 8, 8);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, -dishAt(x, z, dish) + 0.0015);
  }
  position.needsUpdate = true;

  const column = atlasCell % ATLAS_COLS;
  const row = Math.floor(atlasCell / ATLAS_COLS);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      (column + uv.getX(i)) / ATLAS_COLS,
      (ATLAS_ROWS - 1 - row + uv.getY(i)) / ATLAS_ROWS,
    );
  }
  uv.needsUpdate = true;

  geometry.computeVertexNormals();
  return geometry;
}

/** Draws every key legend into one canvas, white on transparent, tinted per keycap. */
export function createLegendAtlas(slots: KeySlot[]) {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * cell;
  canvas.height = ATLAS_ROWS * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  for (const slot of slots) {
    if (!slot.label) continue;
    const cx = (slot.cell % ATLAS_COLS) * cell + cell / 2;
    const cy = Math.floor(slot.cell / ATLAS_COLS) * cell + cell / 2;

    if (slot.sub) {
      ctx.font = "600 42px Inter, 'Segoe UI', Helvetica, sans-serif";
      ctx.fillText(slot.sub, cx, cy - 24);
      ctx.fillText(slot.label, cx, cy + 24);
    } else {
      const size = slot.label.length > 3 ? 30 : slot.label.length > 1 ? 38 : 54;
      ctx.font = `600 ${size}px Inter, 'Segoe UI', Helvetica, sans-serif`;
      ctx.fillText(slot.label, cx, cy);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * PCB silkscreen: small white ink text in a corner, the way a real board
 * prints its manufacturer, revision and part number near the edge.
 */
export function createSilkscreenTexture(lines: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(230, 230, 235, 0.92)";
  const lineHeight = 30;
  lines.forEach((line, i) => {
    ctx.font = "600 24px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(line, 20, 20 + i * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Text engraved onto a metal surface, drawn to a canvas so no font has to load. */
export function createEngravingTexture(lines: { text: string; size: number }[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(24, 18, 6, 0.85)";
  const step = canvas.height / (lines.length + 1);
  lines.forEach((line, i) => {
    ctx.font = `600 ${line.size}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillText(line.text, canvas.width / 2, step * (i + 1));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
