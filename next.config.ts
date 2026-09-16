// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const REPO_PATH = "/kroma-labs";

const nextConfig: NextConfig = {
  // The parent studio folder has its own lockfile; pin the root to this project.
  turbopack: { root: path.resolve(__dirname) },
  // GitHub Pages serves this at github.io/kroma-labs/, not the domain root, and it's a plain
  // static file host (no Node server) — export a static build and prefix every path to match.
  // The prefix is production-only so `npm run dev` still serves from localhost root.
  output: "export",
  basePath: isProd ? REPO_PATH : undefined,
  assetPrefix: isProd ? `${REPO_PATH}/` : undefined,
  // Static export writes `route.html` per page by default; GitHub Pages only auto-serves
  // `index.html` for a directory request, so routes need to actually BE directories.
  trailingSlash: true,
};

export default nextConfig;
