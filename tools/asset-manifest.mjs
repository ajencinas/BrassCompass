#!/usr/bin/env node
/**
 * The active-content asset manifest.
 *
 * The game has one live story (the four acts in src/content/scripts) and a much larger shelf
 * of archived art: superseded plates, character studies and item icons from earlier passes.
 * Only the art the live rooms, acts, dialogue, items and code actually name should ever be
 * copied into a build.
 *
 *   node tools/asset-manifest.mjs --write    # rewrite src/content/active-assets.json (npm run assets)
 *   node tools/asset-manifest.mjs --check    # fail if it is stale (prebuild runs this)
 *   node tools/asset-manifest.mjs            # print what is active/archived
 *
 * "Named" means a key or URL in the compiled content (rooms, acts, ending, dialogue, items and
 * the character registry), or a key/URL literal in any TypeScript module under src outside
 * content/assets.ts. Item art is also named dynamically as item_<id> for every live item. The
 * JSON is consumed by the Vite build: public files not listed in `files` are not copied.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loader } from "./adv-lib.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const OUT = join(ROOT, "src/content/active-assets.json");
const SRC = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");

/** Page-shell files in public/ (icons named by index.html). Always shipped, not in MANIFEST. */
export const SHELL_FILES = ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"];

const IMAGE_KEY = /^(bg|char|npc|prop|item)_[a-z0-9_]+$/;
const AUDIO_KEY = /^music_[a-z0-9_]+$/;

/** Every string value under `value` (object keys are labels, not references). */
function walkStrings(value, visit) {
  if (typeof value === "string") { visit(value); return; }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const v of value) walkStrings(v, visit); return; }
  for (const v of Object.values(value)) walkStrings(v, visit);
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkFiles(path, out);
    else out.push(path);
  }
  return out;
}

/** TypeScript source without comments: a key named only in prose is not in use. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mb(bytes) {
  return bytes / (1024 * 1024);
}

/**
 * Read the manifest and live content, and work out which entries the game actually names.
 * The source manifest in `src/content/assets.ts` is the catalogue of known art; this returns
 * the subset that is active plus everything excluded from the build.
 */
export async function collect() {
  const vite = await loader();
  try {
    const { MANIFEST } = await vite.load("/src/content/assets.ts");
    const { ROOMS } = await vite.load("/src/content/rooms.ts");
    const { ACTS, ENDING } = await vite.load("/src/content/acts.ts");
    const { DIALOGUES } = await vite.load("/src/content/dialogue.ts");
    const { ITEMS } = await vite.load("/src/content/items.ts");
    const { CHARACTERS } = await vite.load("/src/content/characters.ts");

    const images = MANIFEST.images;
    const audio = MANIFEST.audio;
    // A clone without the shared art folder is a code-only checkout, not a broken manifest:
    // keep the build working and say so. The shelf counts as present only when the painted
    // folders exist (public/assets/audio is tracked in git, so it proves nothing). A shelf that
    // exists but lacks an active file is still an error (see `missing` below).
    const artShelf = hasArtShelf();
    const all = new Map([
      ...Object.entries(images).map(([key, url]) => [key, { kind: "image", url }]),
      ...Object.entries(audio).map(([key, url]) => [key, { kind: "audio", url }]),
    ]);
    const refs = new Map([...all.keys()].map((key) => [key, new Set()]));
    const name = (key, why) => {
      const set = refs.get(key);
      if (set) set.add(why);
    };

    // 1. Compiled content: rooms, act structure, ending paintings, dialogue effects, items,
    //    and the character registry (portraits and standing bodies are content too).
    const content = { ROOMS, ACTS, ENDING, DIALOGUES, ITEMS, CHARACTERS };
    walkStrings(content, (text) => {
      if (all.has(text)) name(text, "content");
      const entry = [...all.entries()].find(([, e]) => e.url === text);
      if (entry) name(entry[0], "content URL");
    });
    for (const item of Object.values(ITEMS)) {
      name(`item_${item.id}`, "item icon");
    }
    for (const character of Object.values(CHARACTERS)) {
      if (character.portrait) name(character.portrait, "character portrait");
      if (character.body) name(character.body, "character body");
    }

    // 2. Runtime references: UI, atlas, title, prologue and ending code name some art
    //    directly (keys or site-absolute URLs), outside the compiled content.
    const sourceFiles = walkFiles(SRC).filter((p) =>
      p.endsWith(".ts") && !p.replaceAll(sep, "/").endsWith("/src/content/assets.ts"));
    const sources = sourceFiles.map((path) => ({
      path: relative(ROOT, path).split(sep).join("/"),
      text: stripComments(readFileSync(path, "utf8")),
    }));
    for (const [key, entry] of all) {
      const word = new RegExp(`\\b${escapeRe(key)}\\b`);
      const url = entry.url;
      for (const source of sources) {
        if (word.test(source.text) || source.text.includes(url)) name(key, source.path);
      }
    }

    const activeImages = {};
    const activeAudio = {};
    const missing = [];
    const activeFiles = new Set(SHELL_FILES);
    const unreferenced = [];
    const activeKeySet = new Set();

    for (const [key, entry] of [...all.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!refs.get(key)?.size) {
        unreferenced.push({ key, kind: entry.kind, url: entry.url, bytes: fileSize(entry.url) });
        continue;
      }
      activeKeySet.add(key);
      if (entry.kind === "image") activeImages[key] = entry.url;
      else activeAudio[key] = entry.url;
      const rel = entry.url.replace(/^\//, "");
      // Always list the expected file: the build plugin needs the allowlist even on a clone
      // without the art shelf (where it warns instead of failing).
      activeFiles.add(rel);
      if (!existsSync(join(PUBLIC, rel)) && artShelf) missing.push({ key, url: entry.url });
    }

    // The page icon is not in the asset manifest, but it is part of the shipped shell.
    for (const shell of SHELL_FILES) {
      if (!existsSync(join(PUBLIC, shell))) missing.push({ key: `shell:${shell}`, url: `/${shell}` });
    }

    const files = [...activeFiles].sort();
    const activeBytes = files.reduce((sum, rel) => {
      const path = join(PUBLIC, rel);
      return sum + (existsSync(path) ? statSync(path).size : 0);
    }, 0);

    const manifestUrls = new Set([...Object.values(images), ...Object.values(audio)]);
    const publicFiles = walkFiles(PUBLIC).map((path) => relative(PUBLIC, path).split(sep).join("/"));
    const outsideManifest = publicFiles
      .filter((rel) => !manifestUrls.has(`/${rel}`))
      .map((rel) => ({ rel, bytes: statSync(join(PUBLIC, rel)).size }))
      .sort((a, b) => a.rel.localeCompare(b.rel));
    const archived = unreferenced
      .map((entry) => ({ rel: entry.url.replace(/^\//, ""), bytes: entry.bytes }))
      .sort((a, b) => a.rel.localeCompare(b.rel));

    return {
      files,
      activeKeySet,
      activeImages,
      activeAudio,
      activeBytes,
      unreferenced,
      missing,
      artShelf,
      outsideManifest,
      archived,
      catalogCount: all.size,
      activeCount: activeKeySet.size,
    };
  } finally {
    await vite.close();
  }
}

/**
 * True when the shared painted art is in place: the gitignored scenes and characters folders.
 * Keep in step with `hasArtShelf` in vite.config.ts and the CI art checks.
 */
export function hasArtShelf() {
  return existsSync(join(PUBLIC, "assets/scenes")) && existsSync(join(PUBLIC, "assets/characters"));
}

function fileSize(url) {
  const path = join(PUBLIC, url.replace(/^\//, ""));
  return existsSync(path) ? statSync(path).size : 0;
}

/** The committed JSON. Deterministic: sorted keys and files, no timestamps or machine paths. */
export function serialized(result) {
  return `${JSON.stringify({
    generatedBy: "tools/asset-manifest.mjs",
    note: "Active content only; public files not listed here are not copied into a build.",
    images: result.activeImages,
    audio: result.activeAudio,
    files: result.files,
  }, null, 2)}\n`;
}

export function summary(result) {
  const lines = [];
  lines.push(`active manifest: ${Object.keys(result.activeImages).length} images, ` +
    `${Object.keys(result.activeAudio).length} audio, ${result.files.length} shipped public files`);
  lines.push(`shipped public weight: ${mb(result.activeBytes).toFixed(1)} MiB`);
  if (!result.artShelf) {
    lines.push("art shelf: public/assets/scenes and /characters are absent — code-only bundle (copy the shared art folder to run the game).");
  }
  lines.push(`archived manifest entries (not built): ${result.unreferenced.length} entries, ` +
    `${mb(result.unreferenced.reduce((n, e) => n + e.bytes, 0)).toFixed(1)} MiB`);
  if (result.unreferenced.length) {
    for (const entry of result.unreferenced) lines.push(`  - ${entry.key}  ${entry.url}`);
  }
  lines.push(`public files outside the manifest (not built): ${result.outsideManifest.length} files, ` +
    `${mb(result.outsideManifest.reduce((n, e) => n + e.bytes, 0)).toFixed(1)} MiB`);
  if (result.missing.length) {
    lines.push(`missing active files: ${result.missing.length}`);
    for (const entry of result.missing) lines.push(`  ! ${entry.key}  ${entry.url}`);
  }
  return lines.join("\n");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await collect();
  const text = serialized(result);
  if (args.has("--write")) {
    writeFileSync(OUT, text);
    console.log(summary(result));
    console.log(`\nwrote ${relative(ROOT, OUT)}`);
  } else if (args.has("--check")) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current !== text) {
      console.error(`asset-manifest — ${relative(ROOT, OUT)} is stale; run npm run assets.`);
      process.exitCode = 1;
    } else {
      console.log(`asset-manifest — ${relative(ROOT, OUT)} is current (${result.files.length} files).`);
    }
  } else {
    console.log(summary(result));
  }
  if (result.missing.length) {
    if (args.has("--check") || args.has("--write")) {
      console.error(`asset-manifest — ${result.missing.length} active file(s) missing from public/:`);
      for (const entry of result.missing) console.error(`  ! ${entry.key}  ${entry.url}`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
