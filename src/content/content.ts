/**
 * The game's content, compiled from the .adv scripts in ./scripts at startup. rooms.ts,
 * dialogue.ts, items.ts, hints.ts, combos.ts and acts.ts re-export the pieces under the names
 * the engine has always used. The records are live: the dev editor recompiles and swaps new
 * content into these same objects, so everything that imported them sees the change.
 */

import { compile, formatError, type Compiled, type CompileOptions, type Loc, type SourceFile } from "../adv/compile";
import { CHARACTERS } from "./characters";
import { MANIFEST } from "./assets";

const raw = import.meta.glob("./scripts/**/*.adv", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** The script files the game was built from, paths relative to src/content/scripts. */
export const SOURCES: SourceFile[] = Object.entries(raw).map(([path, text]) => ({ path: path.replace(/^\.\/scripts\//, ""), text }));

export const COMPILE_OPTIONS: CompileOptions = { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio };

const first = compile(SOURCES, COMPILE_OPTIONS);
const fatal = first.errors.filter((e) => !e.warning);
if (fatal.length) throw new Error("The .adv scripts don't compile:\n" + fatal.map(formatError).join("\n"));

export const CONTENT = {
  rooms: first.rooms,
  dialogues: first.dialogues,
  items: first.items,
  tips: first.tips,
  combos: first.combos,
  acts: first.acts,
  ending: first.ending!,
};

let locs = first.locs;
/** The script line that made a compiled object (room, hotspot, node, effect, point...). */
export function locOf(obj: object | undefined): Loc | undefined {
  return obj ? locs.get(obj) : undefined;
}

function refill<T>(target: Record<string, T>, source: Record<string, T>): void {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, source);
}

/** Swap freshly compiled content into the live records (dev editor only). */
export function swapContent(next: Compiled): void {
  refill(CONTENT.rooms, next.rooms);
  refill(CONTENT.dialogues, next.dialogues);
  refill(CONTENT.items, next.items);
  refill(CONTENT.acts as Record<string, unknown>, next.acts as Record<string, unknown>);
  CONTENT.tips.splice(0, CONTENT.tips.length, ...next.tips);
  CONTENT.combos.splice(0, CONTENT.combos.length, ...next.combos);
  if (next.ending) refill(CONTENT.ending as unknown as Record<string, unknown>, next.ending as unknown as Record<string, unknown>);
  locs = next.locs;
}
