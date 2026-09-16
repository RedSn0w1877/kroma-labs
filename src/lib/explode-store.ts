// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/**
 * Plain mutable object shared between GSAP and React Three Fiber.
 * GSAP tweens `value` from 0 → 1 while scrolling; the 3D model reads it every frame.
 * Keeping it outside React state means zero re-renders during scroll.
 */
export const explodeStore = { value: 0 };
