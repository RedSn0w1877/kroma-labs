// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/**
 * basePath is not applied to files in public/ (see next/dist/docs basePath.md), so every public URL
 * (the renders) goes through asset(). next.config inlines NEXT_PUBLIC_BASE_PATH at build time:
 * "/kroma-labs" in production, "" in dev. CSS url() never needs this: it may only point at files under
 * src/, which Turbopack fingerprints into /_next/static/media/ with the prefix already applied.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** asset("/renders/kl75-rest-1440.avif") → "/kroma-labs/renders/kl75-rest-1440.avif" in production. */
export const asset = (p: string): string => BASE_PATH + p;
