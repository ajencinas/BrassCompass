#!/usr/bin/env node
/**
 * Asset audit — the gate that keeps the build honest.
 *
 *   node tools/audit-assets.mjs            # references, active weight, excluded files
 *   node tools/audit-assets.mjs --dist     # also check a built dist/ (postbuild)
 *   node tools/audit-assets.mjs --json     # machine-readable report
 *
 * Fails when:
 *   - a manifest entry has no source reference (the game would never load it);
 *   - a referenced/active file is missing from public/;
 *   - the active shipped media exceeds the budget below;
 *   - (--dist) dist/ contains a public asset the manifest does not list, or a listed file is
 *     missing, or the whole build exceeds the delivery budget.
 *
 * Public files outside the manifest are expected: public/assets also holds the source shelf
 * (archived plates and old films). They are listed, and the build excludes them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { collect, OUT, ROOT, serialized } from "./asset-manifest.mjs";

/** The live game may ship this much media (images + audio) and no more. */
const MAX_ACTIVE_MIB = 80;
/** The finished build (bundle + media + shell) may weigh this much. */
const MAX_DIST_MIB = 85;

const args = new Set(process.argv.slice(2));

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, base));
    else out.push(path);
  }
  return out;
}
const result = await collect();
const errors = [];
const notes = [];

// 1. The manifest is only what the game names.
for (const entry of result.unreferenced) {
  errors.push(`manifest entry '${entry.key}' (${entry.url}) has no source reference`);
}

// 2. The committed allowlist is current (so the build and the source agree).
const expected = serialized(result);
const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if (current !== expected) {
  errors.push("src/content/active-assets.json is stale — run npm run assets");
}

// 3. Every active file exists.
for (const entry of result.missing) {
  errors.push(`active asset '${entry.key}' is missing: public${entry.url}`);
}

// 4. Budget: active media, not the source shelf.
const activeMib = result.activeBytes / (1024 * 1024);
if (activeMib > MAX_ACTIVE_MIB) {
  errors.push(`active media is ${activeMib.toFixed(1)} MiB, over the ${MAX_ACTIVE_MIB} MiB budget`);
}

// 5. Report the public source shelf not shipped. This is information, not a failure.
const outsideMib = result.outsideManifest.reduce((sum, file) => sum + file.bytes, 0) / (1024 * 1024);
if (!args.has("--json")) {
  console.log(`active: ${Object.keys(result.activeImages).length} images + ` +
    `${Object.keys(result.activeAudio).length} audio = ${result.files.length} files, ${activeMib.toFixed(1)} MiB ` +
    `(budget ${MAX_ACTIVE_MIB} MiB)`);
  if (result.outsideManifest.length) {
    console.log(`not in the manifest (excluded from the build): ${result.outsideManifest.length} files, ${outsideMib.toFixed(1)} MiB`);
    if (!args.has("--dist")) {
      for (const file of result.outsideManifest) {
        if (file.rel === "favicon.svg") continue; // the page icon is shell, not game art
        console.log(`  - public/${file.rel}  ${(file.bytes / (1024 * 1024)).toFixed(2)} MiB`);
      }
    }
  }
}

// 6. Postbuild: the copy step must not have smuggled anything back in.
if (args.has("--dist")) {
  const dist = join(ROOT, "dist");
  if (!existsSync(join(dist, "index.html"))) {
    errors.push("dist/index.html is missing — build before --dist");
  } else if (!result.artShelf) {
    notes.push("dist: built without the art shelf (code-only); media checks skipped");
  } else {
    const expectedFiles = new Set(result.files);
    for (const rel of result.files) {
      if (!existsSync(join(dist, rel))) errors.push(`dist is missing ${rel}`);
    }
    const files = walk(dist);
    let total = 0;
    let media = 0;
    for (const path of files) {
      const rel = relative(dist, path).split(sep).join("/");
      const size = statSync(path).size;
      total += size;
      if (/\.(png|webp|jpg|jpeg|gif|mp3|ogg|mp4|webm)$/i.test(rel)) media += size;
      if (!rel.startsWith("assets/") && rel !== "favicon.svg" && rel !== "index.html") {
        if (rel !== "index.html" && rel !== "favicon.svg") errors.push(`dist has an unexpected root file: ${rel}`);
        continue;
      }
      if (rel.startsWith("assets/") && !/^assets\/[^/]+\.(js|css|map)$/.test(rel)) {
        if (!expectedFiles.has(rel)) errors.push(`dist has a public asset the manifest does not list: ${rel}`);
      }
    }
    const totalMib = total / (1024 * 1024);
    if (totalMib > MAX_DIST_MIB) {
      errors.push(`dist is ${totalMib.toFixed(1)} MiB, over the ${MAX_DIST_MIB} MiB delivery budget`);
    }
    notes.push(`dist: ${files.length} files, ${totalMib.toFixed(1)} MiB total, ${(media / (1024 * 1024)).toFixed(1)} MiB media`);
  }
}

if (args.has("--json")) {
  console.log(JSON.stringify({
    active: { files: result.files.length, bytes: result.activeBytes },
    outsideManifest: result.outsideManifest,
    unreferenced: result.unreferenced,
    errors,
    notes,
  }, null, 2));
} else {
  for (const note of notes) console.log(note);
}

if (errors.length) {
  for (const error of errors) console.error(`asset audit: ${error}`);
  process.exitCode = 1;
} else if (!args.has("--json")) {
  console.log("asset audit: ok");
}
