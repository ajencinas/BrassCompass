/**
 * Helpers shared by the .adv tools: a Vite SSR loader for TypeScript modules, the TypeScript
 * content of any git revision, a strict deep comparison, and the scripts on disk.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";
import { createServer } from "vite";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const SCRIPTS = join(ROOT, "src/content/scripts");

/** A Vite server that can import TypeScript from `root` (no HTTP; SSR module loading only). */
export async function loader(root = ROOT) {
  const server = await createServer({
    root, configFile: root === ROOT ? undefined : false, logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] },
  });
  return { load: (path) => server.ssrLoadModule(path), close: () => server.close() };
}

/** The hand-written TypeScript content as it stood at a git revision. */
export async function contentAt(rev) {
  const dir = mkdtempSync(join(tmpdir(), "adv-rev-"));
  const tar = execFileSync("git", ["archive", rev, "src"], { cwd: ROOT });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  const vite = await loader(dir);
  try {
    const m = async (p) => vite.load(p);
    const { ROOMS } = await m("/src/content/rooms.ts");
    const { DIALOGUES } = await m("/src/content/dialogue.ts");
    const { ITEMS } = await m("/src/content/items.ts");
    const { TIPS } = await m("/src/content/hints.ts");
    const { GLOBAL_COMBOS } = await m("/src/content/combos.ts");
    const { ACTS, ENDING } = await m("/src/content/acts.ts");
    const sources = {};
    for (const f of readdirSync(join(dir, "src/content"))) {
      if (f.endsWith(".ts")) sources[f] = readFileSync(join(dir, "src/content", f), "utf8");
    }
    return { rooms: ROOMS, dialogues: DIALOGUES, items: ITEMS, tips: TIPS, combos: GLOBAL_COMBOS, acts: ACTS, ending: ENDING, sources };
  } finally {
    await vite.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every .adv file under the scripts folder, as { path, text } with paths relative to it. */
export function readScripts(dir = SCRIPTS) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".adv")) out.push({ path: relative(dir, p).split("\\").join("/"), text: readFileSync(p, "utf8") });
    }
  };
  walk(dir);
  return out;
}

/**
 * Strict structural comparison: same keys (an explicit `undefined` counts as a key), same array
 * order, same primitive values. Record key order is ignored. Returns the first few differences.
 */
export function differences(a, b, path = "", out = [], limit = 25) {
  if (out.length >= limit) return out;
  if (a === b) return out;
  const ta = Array.isArray(a) ? "array" : a === null ? "null" : typeof a;
  const tb = Array.isArray(b) ? "array" : b === null ? "null" : typeof b;
  if (ta !== tb) { out.push(`${path || "(root)"}: ${ta} vs ${tb}`); return out; }
  if (ta === "array") {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} vs ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) differences(a[i], b[i], `${path}[${i}]`, out, limit);
    return out;
  }
  if (ta === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    for (const k of ka) if (!(k in b)) out.push(`${path}.${k}: only in the first`);
    for (const k of kb) if (!(k in a)) out.push(`${path}.${k}: only in the second`);
    for (const k of ka) if (k in b) differences(a[k], b[k], `${path}.${k}`, out, limit);
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}

/** The parts of the content the scripts define, in one comparable object. */
export function contentOf(c) {
  return { rooms: c.rooms, dialogues: c.dialogues, items: c.items, tips: c.tips, combos: c.combos, acts: c.acts, ending: c.ending };
}
