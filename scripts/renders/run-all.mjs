// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

// run-all: the whole KL-75 render pipeline in ship order.
//   1. export-geo.mjs   the site's layout + keycap geometry -> .cache/kl75_caps.obj + kl75_slots.json
//   2. render.py        each shot through Blender (Cycles) -> .cache/renders/<shot>/
//   3. encode.mjs       AVIF + WebP -> public/renders/, JSON -> src/data/, then --verify
// Blender runs through BLENDER_RUNNER (a node script such as the studio toolkit's blender.mjs, which
// queues for the shared Blender slot) when it is set, otherwise `blender` on PATH.
// Usage: node scripts/renders/run-all.mjs [--shots hero,phone,inside,build,brass] [--samples N] [--skip-encode]
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : fallback);
const shots = option("--shots", "hero,phone,inside,build,brass").split(",");
const samples = option("--samples", null);

function step(label, cmd, cmdArgs) {
  console.log(`\n== ${label}`);
  const t = Date.now();
  const res = spawnSync(cmd, cmdArgs, { cwd: here, stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`run-all: ${label} failed (exit ${res.status ?? res.signal})`);
    process.exit(res.status ?? 1);
  }
  console.log(`== ${label} done in ${Math.round((Date.now() - t) / 1000)} s`);
}

step("export-geo", process.execPath, [path.join(here, "export-geo.mjs")]);
for (const shot of shots) {
  const shotArgs = ["render.py", "--", shot, path.join(here, ".cache", "renders", shot), ...(samples ? [samples] : [])];
  if (process.env.BLENDER_RUNNER) step(`render ${shot}`, process.execPath, [process.env.BLENDER_RUNNER, ...shotArgs]);
  else step(`render ${shot}`, "blender", ["-b", "--factory-startup", "--python-exit-code", "1", "-P", ...shotArgs]);
}
if (!args.includes("--skip-encode")) {
  step("encode", process.execPath, [path.join(here, "encode.mjs"), "--only", shots.join(","), "--verify"]);
}
