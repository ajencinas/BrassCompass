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

// ---------------------------------------------------------------- content lints (pure data)

const TERMINAL_KINDS = new Set(["go", "talk", "act", "win"]);

/**
 * Conversation nodes that offer choices AND carry a terminal effect (go, talk, act, win). The
 * node's terminals run when the conversation ends from it, and a save made mid-node would carry
 * them as well; a node should either offer choices or end, never both.
 */
export function choiceTerminalNodes(dialogues) {
  const out = [];
  for (const tree of Object.values(dialogues)) {
    for (const node of Object.values(tree.nodes)) {
      const terminal = (node.do ?? []).filter((e) => TERMINAL_KINDS.has(e.k));
      if ((node.choices?.length ?? 0) > 0 && terminal.length) {
        out.push(`${tree.id}.${node.id}: has choices and a node-level ${terminal.map((e) => e.k).join("/")}; put the effect on a choice, or give the node no choices`);
      }
    }
  }
  return out;
}

/**
 * Which flags can be true while each act is current, read from the compiled content the way
 * reach.ts does (only `act` conditions are honoured; everything else might come true), with the
 * two things a tip must not count: flags set in the same effect list that ends an act (they
 * belong to the NEXT act, and nothing can be asked in between) or that `win` (the save strips the
 * ending flags, and the card is up), and flags every start-of-act scene sets at once.
 *
 * Returns { live(flag, act), forced(flag, act) }: `live` false means the flag is never true in
 * that act; `forced` true means it always is (set when the act opens and never cleared).
 */
export function flagReachability({ rooms, dialogues, acts, items, combos, reach, endingFlags }) {
  const actNums = Object.keys(acts).map(Number).sort((a, b) => a - b);
  const setIn = new Map(); // flag -> Set(act numbers it first becomes true in)
  const cleared = new Set();
  const narrow = (conds, from) => {
    let out = from;
    for (const c of conds ?? []) {
      if (c && typeof c === "object" && "act" in c) { const want = new Set([].concat(c.act)); out = new Set([...out].filter((n) => want.has(n))); }
    }
    return out;
  };
  const effects = (list, here) => {
    const ends = list.find((e) => e.k === "act");
    const wins = list.some((e) => e.k === "win");
    for (const e of list) {
      if (e.k !== "flag" && e.k !== "add") continue;
      if (e.k === "flag" && e.v === false) { cleared.add(e.id); continue; }
      if (wins) continue;
      const into = ends ? (here.has(ends.n) ? [ends.n + 1] : []) : [...here];
      if (!setIn.has(e.id)) setIn.set(e.id, new Set());
      into.forEach((n) => setIn.get(e.id).add(n));
    }
  };
  const visit = (v, here) => {
    if (Array.isArray(v)) {
      if (v.length && v.every((e) => e && typeof e === "object" && typeof e.k === "string")) { effects(v, here); return; }
      for (const x of v) visit(x, here);
      return;
    }
    if (!v || typeof v !== "object") return;
    let next = here;
    if (Array.isArray(v.if)) next = narrow(v.if, next);
    if (Array.isArray(v.showIf)) next = narrow(v.showIf, next);
    for (const x of Object.values(v)) visit(x, next);
  };
  const all = new Set(actNums);
  const inReach = (kind, id) => new Set(actNums.filter((n) => reach.get(n)?.[kind].has(id)));
  for (const r of Object.values(rooms)) visit(r, inReach("rooms", r.id));
  for (const t of Object.values(dialogues)) visit(t, inReach("trees", t.id));
  visit(items, all);
  visit(combos, all);
  for (const a of Object.values(acts)) if (a.onStart) visit(a.onStart, new Set([a.n]));

  // What the opening of each act sets for certain: its start room's unconditional scenes.
  const startFlags = new Map();
  for (const a of Object.values(acts)) {
    const room = rooms[a.start.room];
    const set = new Set();
    const lists = [a.onStart ?? [], room?.onEnter ?? []];
    const scenes = (room?.scenes ?? []);
    for (let again = true; again;) {
      again = false;
      for (const s of scenes) {
        const ok = (s.if ?? []).every((c) => {
          if ("act" in c) return [].concat(c.act).includes(a.n);
          if ("flag" in c && !("atLeast" in c)) return "is" in c && c.is === false ? !set.has(c.flag) : (c.is === undefined || c.is === true) && set.has(c.flag);
          return false;
        });
        if (!ok || lists.includes(s.do)) continue;
        lists.push(s.do);
        again = true;
      }
    }
    for (const l of lists) for (const e of l) if (e.k === "flag" && e.v !== false) set.add(e.id);
    startFlags.set(a.n, set);
  }
  return {
    live(flag, act) {
      if (endingFlags.has(flag)) return false;
      if (flag.includes(":")) return true; // seen:, looked:, visited: ... are set by the game itself
      const from = setIn.get(flag);
      return Boolean(from && [...from].some((n) => n <= act));
    },
    forced(flag, act) {
      if (cleared.has(flag) || endingFlags.has(flag)) return false;
      return [...startFlags.keys()].some((n) => n <= act && startFlags.get(n).has(flag));
    },
  };
}

/**
 * Tip rungs that can never be the current tip in real play. Per act: try every combination of the
 * flags, items and rooms the act's rungs read, except that a flag the act can never have is false
 * and a flag it always has is true (see flagReachability); a rung must be the first match for at
 * least one combination.
 */
export function deadTips(tips, acts, reachability, roomsOfAct) {
  const keyOf = (c) => "f:" + c.flag + ("atLeast" in c ? ">=" + c.atLeast : "is" in c && ![true, false, undefined].includes(c.is) ? "=" + JSON.stringify(c.is) : "");
  const atoms = (c, out) => {
    if ("any" in c) c.any.forEach((x) => atoms(x, out));
    else if ("not" in c) atoms(c.not, out);
    else if ("flag" in c) out.add(keyOf(c));
    else if ("has" in c) out.add("has:" + c.has);
    else if ("notHas" in c) out.add("has:" + c.notHas);
    else if ("room" in c) out.add("room:" + c.room);
  };
  const holds = (c, env, act) => {
    if ("any" in c) return c.any.some((x) => holds(x, env, act));
    if ("not" in c) return !holds(c.not, env, act);
    if ("act" in c) return [].concat(c.act).includes(act);
    if ("flag" in c) { const v = env.get(keyOf(c)); return "is" in c && (c.is === false || c.is === undefined) ? !v : v; }
    if ("has" in c) return env.get("has:" + c.has);
    if ("notHas" in c) return !env.get("has:" + c.notHas);
    return env.get("room:" + c.room);
  };
  const dead = [];
  for (const act of acts) {
    const mine = tips.map((t, i) => ({ t, i })).filter(({ t }) => t.if.every((c) => !("act" in c) || [].concat(c.act).includes(act)));
    const names = [...new Set(mine.flatMap(({ t }) => { const o = new Set(); t.if.forEach((c) => atoms(c, o)); return [...o]; }))];
    const fixed = new Map();
    const free = [];
    for (const n of names) {
      const plain = n.startsWith("f:") && !/[>=]/.test(n.slice(2)) ? n.slice(2) : null;
      if (plain && !reachability.live(plain, act)) fixed.set(n, false);
      else if (plain && reachability.forced(plain, act)) fixed.set(n, true);
      else if (n.startsWith("room:") && roomsOfAct && !roomsOfAct(act).has(n.slice(5))) fixed.set(n, false);
      else free.push(n);
    }
    if (free.length > 22) throw new Error(`act ${act}: too many tip conditions to try every combination`);
    const first = new Set();
    for (let m = 0; m < 1 << free.length; m++) {
      const env = new Map([...fixed, ...free.map((n, k) => [n, Boolean((m >> k) & 1)])]);
      const hit = mine.find(({ t }) => t.if.every((c) => holds(c, env, act)));
      if (hit) first.add(hit.i);
    }
    for (const { t, i } of mine) if (!first.has(i)) dead.push(`act ${act}: tip rung #${i} can never be the current tip (shadowed by an earlier rung, or it needs a state this act cannot reach): "${t.text}"`);
  }
  return dead;
}
