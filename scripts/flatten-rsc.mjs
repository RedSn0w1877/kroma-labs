// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/**
 * Post-export step (npm "postbuild"): give every nested RSC segment file the flat name the client
 * router asks for.
 *
 * The static export writes a route's page data nested, e.g.
 *   out/book/__next.book/__PAGE__.txt
 *   out/services/brakes/__next.services/$d$slug/__PAGE__.txt
 * but the Next client requests it flat, in the route's own folder:
 *   out/book/__next.book.__PAGE__.txt
 *   out/services/brakes/__next.services.$d$slug.__PAGE__.txt
 * A plain static host (GitHub Pages) has no rewrite for that, so every one 404s. This copies each
 * nested file to its flat name next to the route's index.html (the nested copy stays too).
 */
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "out");
if (!existsSync(out)) {
  console.error(`[flatten-rsc] no ${out}; nothing to do`);
  process.exit(0);
}

let copied = 0;

/** All files under dir, as paths relative to dir. */
function filesUnder(dir, rel = "") {
  const found = [];
  for (const name of readdirSync(path.join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(path.join(dir, r)).isDirectory()) found.push(...filesUnder(dir, r));
    else found.push(r);
  }
  return found;
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === "_next") continue;
    if (name.startsWith("__next.")) {
      // A nested segment folder: flatten everything in it into the folder that holds it.
      for (const rel of filesUnder(full)) {
        if (!rel.endsWith(".txt")) continue;
        const flat = path.join(dir, `${name}.${rel.split("/").join(".")}`);
        copyFileSync(path.join(full, rel), flat);
        copied++;
      }
      continue;
    }
    walk(full);
  }
}

walk(out);
console.log(`[flatten-rsc] wrote ${copied} flat RSC segment file(s) in ${path.relative(process.cwd(), out) || out}`);
