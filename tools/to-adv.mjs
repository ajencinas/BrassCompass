/**
 * One-off converter: the hand-written TypeScript content of a git revision (default 1014f5e,
 * the last commit before the switch to scripts) written out as .adv scripts, then compiled
 * back and deep-compared with the original data. Nothing is hand-copied, and the proof can be
 * re-run at any time:
 *
 *   node tools/to-adv.mjs                 convert 1014f5e into src/content/scripts/
 *   node tools/to-adv.mjs --out DIR       write somewhere else (the proof still runs)
 *   node tools/to-adv.mjs --rev REV       convert another revision
 *
 * Comments next to rooms, hotspots, conversations, nodes and items in the TypeScript are
 * carried across as `#` comments.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { contentAt, contentOf, differences, loader, readScripts, SCRIPTS } from "./adv-lib.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const rev = arg("--rev", "1014f5e");
const out = resolve(arg("--out", SCRIPTS));

const old = await contentAt(rev);
const vite = await loader();
const ser = await vite.load("/src/adv/serialize.ts");
const { compile, formatError } = await vite.load("/src/adv/compile.ts");
const { CHARACTERS } = await vite.load("/src/content/characters.ts");
const { MANIFEST } = await vite.load("/src/content/assets.ts");

// ------------------------------------------------------------ comments from the TypeScript

const comments = new Map();
const note = (key, lines) => {
  if (!lines.length) return;
  comments.set(key, [...(comments.get(key) ?? []), ...(comments.has(key) ? [""] : []), ...lines]);
};
/** Comment text from a buffered run of // and /** lines, minus rulers. */
function clean(buf) {
  return buf
    .map((l) => l.trim().replace(/^\/\*\*?|\*\/$/g, "").replace(/^\/\/ ?|^\* ?/, "").trim())
    .map((l) => l.replace(/^[-=]{4,}\s*/, "").replace(/\s*[-=]{4,}$/, ""))
    .filter((l, i, all) => l || (i > 0 && all[i - 1] !== ""))
    .join("\n").trim().split("\n")
    .filter((l, i, all) => all.length > 1 || l);
}
/** The first string literal in a run of TypeScript lines, unescaped. */
function firstString(text) {
  const m = /"((?:[^"\\]|\\.)*)"/.exec(text);
  return m ? JSON.parse(`"${m[1]}"`) : "";
}
/**
 * Walk a TypeScript content file and file each run of comments under the thing it describes:
 * the next room, hotspot (or a property inside one), sprite, occluder, combination, walk area,
 * conversation, node or choice. Keys match the ones serialize.ts asks for.
 */
function harvest(file, kind) {
  const lines = old.sources[file].split("\n");
  let buf = [], top = null, tree = null, node = null, hotspot = null, tip = 0, endingLine = -1, inEnding = false;
  let inBlock = false, prop = null;
  const ahead = (i, n = 8) => lines.slice(i, i + n).join("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (inBlock || t.startsWith("/*")) {
      buf.push(l);
      inBlock = !t.includes("*/");
      continue;
    }
    if (t.startsWith("//")) { buf.push(l); continue; }
    // Blank lines and bare openers don't end a comment's run.
    if (t === "" || (/^[{[(]+$/.test(t) && (kind === "room" || kind === "tree"))) { if (buf.length && t === "") buf.push("//"); continue; }
    const c = clean(buf);
    buf = [];
    const indent = /^ */.exec(l)[0].length;
    // Back at the top level: past the last room or conversation.
    if (indent === 0) { top = tree = node = hotspot = prop = null; }
    const topKey = indent === 2 ? /^ {2}(\w+): \{/.exec(l)?.[1] : undefined;
    const propKey = /^\s*(\w+):/.exec(l)?.[1];
    if (kind === "room") {
      if (topKey) { top = topKey; hotspot = null; prop = null; note(`room:${top}`, c); continue; }
      if (indent === 4 && propKey) { prop = propKey; hotspot = null; }
      if (!top) continue;
      const sprite = /\{ key: "(\w+)", x: (-?[\d.]+), y: (-?[\d.]+)/.exec(l);
      const hid = /^\s*(?:\{\s*)?id: "(\w+)"/.exec(l)?.[1] ?? (/^\s*quill\(/.test(l) ? "quill" : null);
      if (hid && prop === "hotspots") hotspot = hid;
      // Act IV states layered onto an Act I hotspot: `states: { crate: [ ... ] }`.
      const layered = prop === "states" ? /^ {6}(\w+): \[/.exec(l)?.[1] : undefined;
      if (layered) hotspot = layered;
      if (!c.length) continue;
      if (indent === 4 && ["perspective", "walk", "sprites", "occluders", "combos"].includes(propKey)) note(`${propKey}:${top}`, c);
      else if (sprite) note(`sprite:${top}:${sprite[1]}@${sprite[2]},${sprite[3]}`, c);
      else if (prop === "walk" || propKey === "walk") note(`walk:${top}`, c);
      else if (prop === "occluders") {
        const y = /\by: (-?[\d.]+)/.exec(ahead(i))?.[1];
        if (y) note(`occluder:${top}:y${y}`, c);
      } else if (prop === "combos") {
        // The combination this comment sits above, or inside: its item, target and line.
        let from = i;
        if (!/\bitem: "/.test(lines.slice(i, i + 3).join(" "))) {
          for (let k = i - 1; k > i - 9 && k >= 0; k--) if (/\bitem: "/.test(lines[k])) { from = k; break; }
        }
        const text = ahead(from, 8);
        const item = /\bitem: "(\w+)"/.exec(text)?.[1], w = /\bwith: "(\w+)"/.exec(text)?.[1];
        const sayAt = text.indexOf("say:");
        if (item && w && sayAt >= 0) note(`combo:${top}:${item}+${w}:${firstString(text.slice(sayAt)).slice(0, 20)}`, c);
      } else if (hotspot || hid) note(`hotspot:${top}.${hid ?? hotspot}`, c);
    } else if (kind === "tree") {
      if (topKey) { tree = topKey; note(`tree:${tree}`, c); continue; }
      const nid = /^ {6}(\w+): /.exec(l)?.[1];
      if (nid && tree) { node = nid; note(`node:${tree}.${nid}`, c); continue; }
      const choice = /^\s*\{ text: /.test(l) ? firstString(l) : null;
      if (choice !== null && tree && node) note(`choice:${tree}.${node}:${choice.slice(0, 20)}`, c);
    } else if (kind === "item") {
      if (topKey) note(`item:${topKey}`, c);
    } else if (kind === "tip") {
      if (/^ {2}\{ if:/.test(l)) note(`tip:${tip++}`, c);
    } else if (kind === "combo") {
      const text = ahead(i, 6);
      const item = /item: "(\w+)"/.exec(text)?.[1], w = /with: "(\w+)"/.exec(text)?.[1];
      const sayAt = text.indexOf("say:");
      if (item && w && sayAt >= 0 && c.length) note(`combo:global:${item}+${w}:${firstString(text.slice(sayAt)).slice(0, 20)}`, c);
    } else if (kind === "act") {
      const n = /^ {2}(\d+): \{/.exec(l)?.[1];
      if (n) note(`act:${n}`, c);
      if (/^ {2}lines: \[/.test(l)) inEnding = true;
      else if (/^export const ENDING/.test(l)) note("ending", c);
      else if (inEnding && /^ {4}\{/.test(l)) note(`ending:${++endingLine}`, c);
    }
  }
}
for (const f of ["rooms.ts", "rooms_act3.ts", "rooms_act4.ts"]) harvest(f, "room");
for (const f of ["dialogue.ts", "dialogue_act3.ts", "dialogue_act4.ts"]) harvest(f, "tree");
harvest("items.ts", "item");
harvest("hints.ts", "tip");
harvest("combos.ts", "combo");
harvest("acts.ts", "act");
const commentsFor = (key) => comments.get(key);
/** A file's leading doc comment, minus the TypeScript-specific parts. */
function header(file) {
  const m = /^\/\*\*([\s\S]*?)\*\//.exec(old.sources[file]);
  return m ? clean(m[0].split("\n")) : [];
}
const withHeader = (lines, text) => (lines.length ? lines.map((l) => (l ? `# ${l}` : "#")).join("\n") + "\n\n" : "") + text;

// ------------------------------------------------------------ shared combo groups

// A run of the same combo objects spread into several rooms becomes one named group.
const owners = new Map();
for (const room of Object.values(old.rooms)) {
  for (const c of room.combos ?? []) owners.set(c, [...(owners.get(c) ?? []), room.id]);
}
const NAMES = { "bill+quill": "quill_combos", "bucket+lagoon": "fill_bucket" };
const groups = {};
const groupStart = new Map();
for (const room of Object.values(old.rooms)) {
  const list = room.combos ?? [];
  for (let i = 0; i < list.length;) {
    const sig = (owners.get(list[i]) ?? []).join(",");
    if ((owners.get(list[i]) ?? []).length < 2) { i++; continue; }
    let j = i;
    while (j < list.length && (owners.get(list[j]) ?? []).join(",") === sig) j++;
    if (!groupStart.has(list[i])) {
      const first = list[i];
      const name = NAMES[`${first.item}+${first.with}`] ?? `shared_${Object.keys(groups).length + 1}`;
      groups[name] = list.slice(i, j);
      groupStart.set(first, { name, size: j - i });
    }
    i = j;
  }
}
const groupOf = (c) => groupStart.get(c);

// ------------------------------------------------------------ write

rmSync(out, { recursive: true, force: true });
const files = {};
for (const r of Object.values(old.rooms)) files[`rooms/${r.id}.adv`] = ser.room(r, groupOf, commentsFor);
for (const t of Object.values(old.dialogues)) files[`dialogue/${t.id}.adv`] = ser.dialogue(t, commentsFor);
files["items.adv"] = withHeader(header("items.ts"), ser.items(Object.values(old.items), commentsFor));
files["tips.adv"] = withHeader(header("hints.ts"), ser.tips(old.tips, commentsFor));
files["combos.adv"] = withHeader(header("combos.ts"), ser.combos(old.combos, groups, commentsFor));
files["acts.adv"] = withHeader(header("acts.ts"), ser.acts(Object.values(old.acts), old.ending, commentsFor));
for (const [path, text] of Object.entries(files)) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
}

// ------------------------------------------------------------ prove it

const result = compile(readScripts(out), { characters: CHARACTERS, images: MANIFEST.images });
const errors = result.errors.filter((e) => !e.warning);
for (const e of result.errors) console.log("  " + formatError(e));
const diff = differences(contentOf(old), contentOf(result));
const lines = Object.values(files).reduce((n, t) => n + t.split("\n").length, 0);
console.log(`${Object.keys(files).length} files, ${lines} lines written to ${out}`);
console.log(`${comments.size} comments carried over; combo groups: ${Object.keys(groups).join(", ") || "none"}`);
if (errors.length || diff.length) {
  console.log("ROUND TRIP FAILED");
  for (const d of diff) console.log("  " + d);
  await vite.close();
  process.exit(1);
}
const counts = `${Object.keys(result.rooms).length} rooms, ${Object.keys(result.dialogues).length} conversations, ` +
  `${Object.keys(result.items).length} items, ${result.tips.length} tips, ${result.combos.length} global combos, ${Object.keys(result.acts).length} acts`;
console.log(`round trip identical to ${rev}: ${counts}`);
await vite.close();
