/**
 * Export the whole game as one readable screenplay, for writers to review every line in context:
 *
 *   docs/FULL_SCRIPT.md     Markdown, with anchors and links
 *   docs/FULL_SCRIPT.docx   Word (via tools/script_docx.py and python-docx), with real headings
 *
 * Everything comes from the .adv scripts as compiled for the game (src/adv/compile.ts), so the
 * export is never maintained by hand: run `npm run script:export` after changing a script.
 * Each line carries its source as file:line (relative to src/content/scripts/), taken from the
 * compiler's location map, or from the script text for the few strings that have no object of
 * their own (verb lines, item looks, captions, tip and ending text).
 *
 * Layout: cast; then each act in order, with its opening and each room in the order the player
 * first meets it (a walk over the exits from the act's start room); each room's arrival scenes,
 * hotspots (every verb line, with its conditions and effects as stage directions), combinations,
 * and every conversation it starts, as a branching screenplay. A room that comes back in a
 * later act shows only the lines that belong to that act; every line is printed exactly once.
 * Then the global combinations, items, tips, the ending, and the fallback lines of lines.ts.
 *
 *   npm run script:export
 *   npm run script:export -- --no-docx      (Markdown only)
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loader, readScripts, ROOT } from "./adv-lib.mjs";

const OUT_MD = join(ROOT, "docs/FULL_SCRIPT.md");
const OUT_DOCX = join(ROOT, "docs/FULL_SCRIPT.docx");
const WANT_DOCX = !process.argv.includes("--no-docx");

// ------------------------------------------------------------------ load and compile

const vite = await loader();
let C, CHARACTERS, linesSource;
try {
  const { compile, formatError } = await vite.load("/src/adv/compile.ts");
  ({ CHARACTERS } = await vite.load("/src/content/characters.ts"));
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  C = compile(readScripts(), { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio });
  const errors = C.errors.filter((e) => !e.warning);
  if (errors.length) {
    console.error("the scripts don't compile:\n  " + errors.map(formatError).join("\n  "));
    process.exit(1);
  }
} finally {
  await vite.close();
}
linesSource = readFileSync(join(ROOT, "src/game/lines.ts"), "utf8");
const story = readFileSync(join(ROOT, "docs/STORY.md"), "utf8");
const scriptText = new Map(readScripts().map((f) => [f.path, f.text.split("\n")]));

const { rooms: ROOMS, dialogues: DIALOGUES, items: ITEMS, tips: TIPS, combos: GLOBAL, acts: ACTS, ending: ENDING, groups: GROUPS, locs: LOCS } = C;
const ACT_NUMS = Object.keys(ACTS).map(Number).sort((a, b) => a - b);
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ------------------------------------------------------------------ source references

const loc = (obj) => (obj && LOCS.get(obj)) || null;
const refOf = (l, dLine = 0) => (l ? `${l.file}:${l.line + dLine}` : "?");
const ref = (obj, dLine = 0) => refOf(loc(obj), dLine);

/** The line of a direct child of the block at `l` that starts with `kw` (a verb, look, caption...). */
function childLine(l, kw) {
  const lines = l && scriptText.get(l.file);
  if (!lines) return null;
  const indent = (s) => s.length - s.trimStart().length;
  const base = indent(lines[l.line - 1]);
  for (let i = l.line; i < lines.length; i++) {
    const s = lines[i];
    if (!s.trim() || s.trim().startsWith("#")) continue;
    const d = indent(s);
    if (d <= base) break;
    if (d === base + 2 && new RegExp(`^${kw}(\\s|:|$)`).test(s.trim())) return { file: l.file, line: i + 1 };
  }
  return null;
}
/** The first non-comment child line of the block at `l` (a combo's or tip's text). */
function firstChild(l) {
  const lines = l && scriptText.get(l.file);
  if (!lines) return null;
  for (let i = l.line; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith("#")) return { file: l.file, line: i + 1 };
  }
  return null;
}

// ------------------------------------------------------------------ document model
//
// A list of blocks: { t: "h", level, text, anchor } or { t: "p", runs, indent, style }.
// A run is { k, v }: text | speaker | dir (stage direction / condition) | ref | code | label | link.

const doc = [];
const h = (level, text, anchor) => doc.push({ t: "h", level, text, anchor });
const p = (runs, indent = 0, style) => doc.push({ t: "p", runs: runs.filter(Boolean), indent, style });
const T = (v) => ({ k: "text", v });
const S = (v) => ({ k: "speaker", v });
const D = (v) => ({ k: "dir", v });
const R = (v) => ({ k: "ref", v });
const K = (v) => ({ k: "code", v });
const L = (v) => ({ k: "label", v });
const Q = (v) => ({ k: "text", v });
const LINK = (v, to) => ({ k: "link", v, to });

const stats = { lines: 0, verbLines: 0, nodes: 0, choices: 0, says: 0, notes: 0, combos: 0, items: 0, tips: 0, ending: 0, fallback: 0, captions: 0 };

// ------------------------------------------------------------------ words

const charName = (id) => (id === "narrator" ? "Fenn (V.O.)" : CHARACTERS[id]?.name || id);
const itemName = (id) => ITEMS[id]?.name || id;
const roomName = (id) => ROOMS[id]?.name || id;
const actName = (n) => `Act ${ROMAN[n] || n}`;
const VERB_LABEL = {
  look: "Look at", talk: "Talk to", give: "Give", use: "Use", open: "Open", close: "Close", push: "Push",
  pull: "Pull", pickup: "Pick up", walk: "Walk to", turnon: "Turn on", turnoff: "Turn off",
};
const VERB_ORDER = ["look", "talk", "give", "use", "open", "close", "push", "pull", "pickup", "walk", "turnon", "turnoff"];

function condWords(c) {
  if ("any" in c) return `(${c.any.map(condWords).join(" or ")})`;
  if ("not" in c) {
    const inner = c.not;
    if ("has" in inner) return `doesn't have ${itemName(inner.has)}`;
    if ("act" in inner) return `not ${actsWords(inner.act)}`;
    return `not ${condWords(inner)}`;
  }
  if ("has" in c) return `has ${itemName(c.has)}`;
  if ("notHas" in c) return `doesn't have ${itemName(c.notHas)}`;
  if ("room" in c) return `in ${roomName(c.room)}`;
  if ("act" in c) return actsWords(c.act);
  if ("atLeast" in c) return `${c.flag} ≥ ${c.atLeast}`;
  if ("is" in c) return c.is === undefined ? `${c.flag} unset` : c.is === true ? c.flag : `${c.flag} = ${JSON.stringify(c.is)}`;
  return c.flag;
}
function actsWords(a) {
  const list = Array.isArray(a) ? a : [a];
  return list.length === 1 ? actName(list[0]) : `Acts ${list.map((n) => ROMAN[n] || n).join(", ")}`;
}
/** "[if drawer_open]", "[Act IV only]", "[Act IV, if iou_paid]". */
function condRun(conds) {
  if (!conds || !conds.length) return null;
  const acts = conds.filter((c) => "act" in c);
  const rest = conds.filter((c) => !("act" in c));
  const a = acts.map(condWords).join(" and ");
  const r = rest.map(condWords).join(" and ");
  if (a && !r) return D(`[${a} only]`);
  if (a) return D(`[${a}, if ${r}]`);
  return D(`[if ${r}]`);
}

/** Act numbers a condition list allows (only top-level act conditions narrow it). */
function actsOf(conds) {
  let set = new Set(ACT_NUMS);
  for (const c of conds || []) {
    if ("act" in c) { const l = [].concat(c.act); set = new Set([...set].filter((n) => l.includes(n))); }
    else if ("not" in c && "act" in c.not) { const l = [].concat(c.not.act); set = new Set([...set].filter((n) => !l.includes(n))); }
  }
  if (!set.size) return new Set(ACT_NUMS);
  // Narrow further by what the story allows: a flag can't hold before the first act that sets
  // it, and an item can't be held in an act that neither starts with it nor hands it over.
  let narrowed = set;
  for (const c of conds || []) {
    const positive = "flag" in c && (("atLeast" in c) || !("is" in c) || c.is === true);
    if (positive && FLAG_MIN.has(c.flag)) narrowed = new Set([...narrowed].filter((n) => n >= FLAG_MIN.get(c.flag)));
    if ("has" in c && ITEM_ACTS.has(c.has)) narrowed = new Set([...narrowed].filter((n) => ITEM_ACTS.get(c.has).has(n)));
  }
  return narrowed.size ? narrowed : set;
}
/** A combination's conditions, plus holding the item (and the other item, when it's two items). */
const comboConds = (c) => [...(c.if || []), { has: c.item }, ...(ITEMS[c.with] ? [{ has: c.with }] : [])];
let FLAG_MIN = new Map();
let ITEM_ACTS = new Map();

// ------------------------------------------------------------------ conversations: where each is told

const treeHome = new Map(); // tree id -> { label, anchor } once rendered or queued
let treeQueue = []; // trees to render at the end of the current section
let currentPlace = null; // { label, anchor } of the section being written

function treeTitle(id) {
  const t = DIALOGUES[id];
  const speakers = [...new Set(Object.values(t?.nodes || {}).map((n) => n.speaker).filter((s) => s !== "narrator" && s !== "fenn"))];
  return speakers.length ? `${id} (${speakers.map(charName).join(", ")})` : id;
}
const treeAnchor = (id) => `dlg-${id}`;
const nodeAnchor = (tree, node) => `dlg-${tree}-${node}`.replace(/[^A-Za-z0-9_-]/g, "-");

/** The stage direction for opening a conversation; queues it here if it hasn't a home yet. */
function talkRun(e) {
  const at = e.node ? ` at ${e.node}` : "";
  const home = treeHome.get(e.tree);
  if (!home) {
    treeHome.set(e.tree, { ...currentPlace });
    treeQueue.push(e.tree);
    return [D(`[→ conversation `), LINK(`${e.tree}${at}`, e.node ? nodeAnchor(e.tree, e.node) : treeAnchor(e.tree)), D(` — below]`)];
  }
  const where = home.anchor !== currentPlace?.anchor ? `see ${home.label}` : renderedTrees.has(e.tree) ? "above" : "below";
  return [D(`[→ conversation `), LINK(`${e.tree}${at}`, e.node ? nodeAnchor(e.tree, e.node) : treeAnchor(e.tree)), D(` — ${where}]`)];
}

/** One effect as stage-direction runs, plus the source ref. Says and notes are lines in their own right. */
function effectRuns(e) {
  switch (e.k) {
    case "flag": return [D(e.v === true ? `[sets ${e.id}]` : `[sets ${e.id} = ${JSON.stringify(e.v)}]`)];
    case "add": return [D(`[${e.id} ${e.n >= 0 ? "+" : "−"}${Math.abs(e.n)}]`)];
    case "give": return [D(`[Fenn receives: ${itemName(e.item)}]`)];
    case "take": return [D(`[Fenn hands over: ${itemName(e.item)}]`)];
    case "go": return [D(`[→ goes to ${roomName(e.room)}]`)];
    case "talk": return talkRun(e);
    case "act": return [D(`[→ ${actName(e.n)} ends]`)];
    case "win": return [D(`[→ the ending]`)];
    case "sound": return [D(`[sound: ${e.id}]`)];
    case "music": return [D(`[music: ${e.track}]`)];
    default: return [D(`[${e.k}]`)];
  }
}

/**
 * Effects as indented paragraphs: runs of plain stage directions are joined on one line; a
 * narrated line (`say`) or chart entry (`note`) gets its own line with its own reference.
 */
function effects(list, indent) {
  if (!list || !list.length) return;
  let pending = [];
  let pendingRef = null;
  const flush = () => {
    if (pending.length) p([...pending, R(pendingRef)], indent);
    pending = []; pendingRef = null;
  };
  for (const e of list) {
    if (e.k === "say") {
      flush();
      p([S(charName("narrator")), T(": "), Q(e.text), R(ref(e))], indent);
      stats.says++; stats.lines++;
    } else if (e.k === "note") {
      flush();
      p([D("[chart: "), Q(e.text), D("]"), R(ref(e))], indent);
      stats.notes++; stats.lines++;
    } else {
      if (pending.length) pending.push(T(" "));
      pending.push(...effectRuns(e));
      pendingRef ??= ref(e);
    }
  }
  flush();
}

/** Go and talk targets anywhere in an effect list, for the room walk. */
function* targets(list) {
  for (const e of list || []) {
    if (e.k === "go") yield { room: e.room };
    if (e.k === "talk") yield { tree: e.tree };
  }
}

// ------------------------------------------------------------------ conversations as screenplay

const printedNodes = new Set();

const renderedTrees = new Set();
function renderTree(id) {
  const t = DIALOGUES[id];
  renderedTrees.add(id);
  h(3, `Conversation: ${treeTitle(id)}`, treeAnchor(id));
  p([D(`[source: `), K(`dialogue ${id}`), D(`, starts at `), K(t.start), D(`]`), R(ref(t))], 0, "note");
  const done = new Set();
  const visit = (nid, depth) => {
    if (nid === "END" || done.has(nid) || !t.nodes[nid]) return;
    done.add(nid);
    const n = t.nodes[nid];
    printedNodes.add(`${id}/${nid}`);
    stats.nodes++; stats.lines++;
    p([K(nid), T(" "), S(charName(n.speaker)), T(": "), Q(n.text), R(ref(n))], 0, "node:" + nodeAnchor(id, nid));
    effects(n.do, 1);
    const later = [];
    (n.choices || []).forEach((ch, i) => {
      stats.choices++; stats.lines++;
      p([L(`${i + 1}.`), T(" "), S(charName("fenn")), T(": "), Q(ch.text), ch.if ? T(" ") : null, condRun(ch.if), R(ref(ch))], 1);
      effects(ch.do, 2);
      p([goTo(id, ch.to, done)], 2);
      later.push(ch.to);
    });
    if (!n.choices?.length) {
      if (n.next && n.next !== "END") p([goTo(id, n.next, done)], 1);
      else p([D("[ends]")], 1);
      if (n.next) later.push(n.next);
    }
    for (const to of later) visit(to, depth + 1);
  };
  visit(t.start, 0);
  // Nodes only reached by `talk tree at node` from elsewhere.
  const rest = Object.keys(t.nodes).filter((nid) => !done.has(nid));
  if (rest.length) {
    p([D("[entry points opened directly from elsewhere, or reached only from them:]")], 0, "note");
    for (const nid of rest) {
      if (done.has(nid)) continue;
      const from = entryRefs.get(`${id}/${nid}`);
      if (from) p([D(`[${nid}: opened directly from ${from.join(", ")}]`)], 0, "note");
      visit(nid, 0);
    }
  }
}
/** Where each `talk tree at node` comes from, for the entry points of a conversation. */
const entryRefs = new Map();
{
  const scan = (list) => {
    for (const e of list || []) if (e.k === "talk" && e.node) {
      const k = `${e.tree}/${e.node}`;
      if (!entryRefs.has(k)) entryRefs.set(k, []);
      if (!entryRefs.get(k).includes(ref(e))) entryRefs.get(k).push(ref(e));
    }
  };
  for (const r of Object.values(ROOMS)) {
    scan(r.onEnter);
    for (const sc of r.scenes || []) scan(sc.do);
    for (const hs of r.hotspots) {
      for (const l of Object.values(hs.do || {})) scan(l);
      for (const st of hs.states || []) for (const l of Object.values(st.do || {})) scan(l);
    }
    for (const c of r.combos || []) scan(c.do);
  }
  for (const c of GLOBAL) scan(c.do);
  for (const n of Object.keys(ACTS)) scan(ACTS[n].onStart);
  for (const t of Object.values(DIALOGUES)) for (const n of Object.values(t.nodes)) {
    scan(n.do);
    for (const ch of n.choices || []) scan(ch.do);
  }
}
function goTo(tree, to, done) {
  if (to === "END") return D("[ends]");
  return { k: "group", v: [D("→ continues at "), LINK(to, nodeAnchor(tree, to)), done.has(to) ? D(" (above)") : null].filter(Boolean) };
}

function flushTrees() {
  while (treeQueue.length) {
    const id = treeQueue.shift();
    renderTree(id);
  }
}

// ------------------------------------------------------------------ rooms

/** Every line in a room, with the acts it belongs to, so each is printed exactly once. */
const unitCache = new Map();
let unitsFrozen = false;
function roomUnits(room) {
  if (unitsFrozen && unitCache.has(room)) return unitCache.get(room);
  const units = buildUnits(room);
  if (unitsFrozen) unitCache.set(room, units);
  return units;
}
const unitLists = (u) => (u.kind === "hs" ? Object.values((u.state || u.hs).do || {}) : u.kind === "scene" ? [u.obj.do] : u.kind === "enter" ? [u.obj] : [u.obj.do]);

/**
 * Work out, to a fixed point, the first act each flag can be set in and the acts each item can
 * be held in, from where the effects that set and give them can run. Conversations run in the
 * acts of whatever opens them.
 */
function inferActs() {
  for (let round = 0; round < 8; round++) {
    const flagMin = new Map();
    const itemActs = new Map();
    for (const n of ACT_NUMS) for (const it of ACTS[n].inventory || []) {
      if (!itemActs.has(it)) itemActs.set(it, new Set());
      itemActs.get(it).add(n);
    }
    const treeActs = new Map();
    const record = (list, acts) => {
      if (!acts.size) return;
      const lo = Math.min(...acts);
      for (const e of list || []) {
        if ((e.k === "flag" && e.v !== false && e.v !== undefined) || (e.k === "add" && e.n > 0)) flagMin.set(e.id, Math.min(flagMin.get(e.id) ?? Infinity, lo));
        if (e.k === "give") { if (!itemActs.has(e.item)) itemActs.set(e.item, new Set()); acts.forEach((a) => itemActs.get(e.item).add(a)); }
        if (e.k === "talk") { if (!treeActs.has(e.tree)) treeActs.set(e.tree, new Set()); acts.forEach((a) => treeActs.get(e.tree).add(a)); }
      }
    };
    for (const room of Object.values(ROOMS)) for (const u of buildUnits(room)) {
      for (const l of unitLists(u)) record(l, u.acts);
      // A hotspot that Pick up turns into an item.
      if (u.kind === "hs" && !u.state && u.hs.item) record([{ k: "give", item: u.hs.item }], u.acts);
    }
    for (const n of ACT_NUMS) record(ACTS[n].onStart, new Set([n]));
    for (const c of GLOBAL) record(c.do, actsOf(comboConds(c)));
    for (let pass = 0; pass < 10; pass++) {
      for (const [id, acts] of [...treeActs]) {
        const t = DIALOGUES[id];
        if (!t) continue;
        for (const node of Object.values(t.nodes)) {
          record(node.do, acts);
          flagMin.set(`seen:${id}.${node.id}`, Math.min(flagMin.get(`seen:${id}.${node.id}`) ?? Infinity, Math.min(...acts)));
          for (const ch of node.choices || []) record(ch.do, acts);
        }
      }
    }
    const roomActs = new Map();
    for (const n of ACT_NUMS) for (const r of walkAct(n)) {
      if (!roomActs.has(r)) roomActs.set(r, new Set());
      roomActs.get(r).add(n);
    }
    const key = (m) => JSON.stringify([...m].map(([k, v]) => [k, typeof v === "object" ? [...v].sort() : v]).sort());
    const same = key(flagMin) === key(FLAG_MIN) && key(itemActs) === key(ITEM_ACTS) && key(roomActs) === key(ROOM_ACTS);
    FLAG_MIN = flagMin;
    ITEM_ACTS = itemActs;
    ROOM_ACTS = roomActs;
    if (same) break;
  }
  unitsFrozen = true;
}

/** The acts each room is reached in, once known: a room's lines can only run in those acts. */
let ROOM_ACTS = new Map();
function buildUnits(room) {
  const units = buildUnitsAnyAct(room);
  const reach = ROOM_ACTS.get(room.id);
  if (reach) for (const u of units) {
    const within = new Set([...u.acts].filter((n) => reach.has(n)));
    if (within.size) u.acts = within;
  }
  return units;
}
function buildUnitsAnyAct(room) {
  const units = [];
  for (const sc of room.scenes || []) units.push({ kind: "scene", obj: sc, acts: actsOf(sc.if) });
  if (room.onEnter?.length) units.push({ kind: "enter", obj: room.onEnter, acts: new Set(ACT_NUMS) });
  for (const hs of room.hotspots) {
    units.push({ kind: "hs", hs, state: null, acts: actsOf(hs.showIf) });
    (hs.states || []).forEach((st, i) => units.push({ kind: "hs", hs, state: st, si: i, acts: actsOf([...(hs.showIf || []), ...st.if]) }));
  }
  for (const c of room.combos || []) {
    // A combination on a hotspot can only happen while that hotspot is there.
    const target = room.hotspots.find((hs) => hs.id === c.with);
    units.push({ kind: "combo", obj: c, acts: actsOf([...comboConds(c), ...(target?.showIf || [])]) });
  }
  return units;
}
const hasContent = (u) => {
  if (u.kind !== "hs") return true;
  const t = u.state || u.hs;
  return Object.keys(t.say || {}).length || Object.keys(t.do || {}).length || (u.state && u.state.name) || (!u.state);
};

/** Rooms reachable in an act from its start, in the order the player meets them. */
function walkAct(n) {
  const order = [];
  const seen = new Set();
  const queue = [ACTS[n].start.room];
  const treesSeen = new Set();
  const fromTree = (id, out) => {
    if (treesSeen.has(id) || !DIALOGUES[id]) return;
    treesSeen.add(id);
    for (const node of Object.values(DIALOGUES[id].nodes)) {
      for (const x of targets(node.do)) out.push(x);
      for (const ch of node.choices || []) for (const x of targets(ch.do)) out.push(x);
    }
  };
  const expand = (list, out) => {
    for (const x of list) {
      if (x.room) out.push(x.room);
      else { const sub = []; fromTree(x.tree, sub); expand(sub, out); }
    }
  };
  // The act's opening conversation can send the player somewhere too.
  const start = [];
  expand([...targets(ACTS[n].onStart)], start);
  queue.push(...start);
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id) || !ROOMS[id]) continue;
    seen.add(id);
    order.push(id);
    const next = [];
    for (const u of roomUnits(ROOMS[id])) {
      if (!u.acts.has(n)) continue;
      for (const l of unitLists(u)) expand([...targets(l)], next);
    }
    queue.push(...next);
  }
  return order;
}

const printedUnits = new Set();

function renderHotspotUnit(u) {
  const t = u.state || u.hs;
  const verbs = VERB_ORDER.filter((v) => t.say?.[v] !== undefined || t.do?.[v] !== undefined);
  // Verbs with no line of their own and the same effects (an `exit`) share one entry.
  const groups = [];
  for (const v of verbs) {
    const key = t.say?.[v] === undefined ? JSON.stringify(t.do[v]) : null;
    const g = key && groups.find((x) => x.key === key);
    if (g) g.verbs.push(v); else groups.push({ key, verbs: [v] });
  }
  const indent = u.state ? 1 : 0;
  if (u.state) {
    p([D("When "), condRun(u.state.if) || D("[always]"), u.state.name ? D(` — called “${u.state.name}”`) : null, R(ref(u.state))], 1);
  }
  for (const g of groups) {
    const v = g.verbs[0];
    const label = g.verbs.map((x) => VERB_LABEL[x]).join(" / ");
    const lineLoc = childLine(loc(u.state || u.hs), v) || (g.key ? childLine(loc(u.state || u.hs), "exit") : null);
    const r = lineLoc ? refOf(lineLoc) : ref(t.do?.[v]) || ref(u.state || u.hs);
    if (t.say?.[v] !== undefined) {
      stats.verbLines++; stats.lines++;
      p([L(label + ":"), T(" "), Q(t.say[v]), R(r)], indent + 1);
    } else if (t.do[v]?.length && t.do[v].every((e) => e.k !== "say" && e.k !== "note")) {
      // No line of its own: the stage directions go on the verb's line.
      p([L(label + ":"), T(" "), ...t.do[v].flatMap((e, i) => [i ? T(" ") : null, ...effectRuns(e)]), R(r)], indent + 1);
      continue;
    } else {
      p([L(label + ":"), T(" "), ...(t.do[v]?.length ? [] : [D("[nothing: cancels the usual effects]")]), R(r)], indent + 1);
    }
    if (t.do?.[v]?.length) effects(t.do[v], indent + 2);
    else if (t.do?.[v] && t.say?.[v] !== undefined) p([D("[nothing: cancels the usual effects]")], indent + 2);
  }
}

function renderHotspotHeader(hs, showStatic) {
  const bits = [L(hs.name), T(" "), K(hs.id)];
  if (hs.showIf) bits.push(T(" "), D(`[present ${condRun(hs.showIf).v.slice(1, -1)}]`));
  if (showStatic && hs.item) bits.push(T(" "), D(`[Pick up gives: ${itemName(hs.item)}]`));
  bits.push(R(ref(hs)));
  p(bits, 0, "hotspot");
}

function renderComboUnit(c, groupOf, room) {
  stats.combos++; stats.lines++;
  const hs = room?.hotspots.find((x) => x.id === c.with);
  const target = hs ? hs.name : ITEMS[c.with] ? itemName(c.with) : (HS_NAMES.get(c.with) || c.with);
  const textLoc = firstChild(loc(c));
  p([L(`Use ${itemName(c.item)} on ${target}:`), T(" "), c.if ? condRun(c.if) : null, c.if ? T(" ") : null, Q(c.say),
    groupOf ? D(` [shared group ${groupOf}]`) : null, R(textLoc ? refOf(textLoc) : ref(c))], 1);
  effects(c.do, 2);
  if (c.consume) p([D(`[the ${itemName(c.item)} is used up]`)], 2);
}
const HS_NAMES = new Map();
const ROOMS_HS = new Set();
for (const r of Object.values(ROOMS)) for (const hs of r.hotspots) { HS_NAMES.set(hs.id, hs.name); ROOMS_HS.add(hs.id); }
const groupName = new Map();
for (const [name, list] of Object.entries(GROUPS)) for (const c of list) groupName.set(c, name);

function renderRoom(id, n, appearances, isFirst) {
  const room = ROOMS[id];
  const anchor = `act${n}-${id}`;
  currentPlace = { label: `${actName(n)} › ${room.name}`, anchor };
  h(2, room.name, anchor);
  const others = appearances.filter((a) => a !== n);
  p([D(`[room `), K(id), D(`${others.length ? `; also in ${others.map(actName).join(", ")}` : ""}${isFirst ? "" : `; lines for every act are under ${actName(appearances[0])}`}]`), R(ref(room))], 0, "note");
  const units = roomUnits(room).filter((u) => {
    if (printedUnits.has(u)) return false;
    const home = appearances.find((a) => u.acts.has(a)) ?? appearances[0];
    return home === n;
  });
  units.forEach((u) => printedUnits.add(u));

  const scenes = units.filter((u) => u.kind === "scene" || u.kind === "enter");
  if (scenes.length) {
    p([L("On arrival")], 0, "hotspot");
    for (const u of scenes) {
      if (u.kind === "enter") p([D("Every time:"), R(ref(u.obj))], 1);
      else p([D("Once, "), condRun(u.obj.if) || D("[always]"), R(ref(u.obj))], 1);
      effects(u.kind === "enter" ? u.obj : u.obj.do, 2);
    }
  }
  // Hotspots, in script order, with their base lines and then their states.
  for (const hs of room.hotspots) {
    const mine = units.filter((u) => u.kind === "hs" && u.hs === hs && hasContent(u));
    if (!mine.length) continue;
    renderHotspotHeader(hs, mine.some((u) => !u.state));
    for (const u of mine) renderHotspotUnit(u);
  }
  const combos = units.filter((u) => u.kind === "combo");
  if (combos.length) {
    p([L("Combinations here")], 0, "hotspot");
    const shown = new Set();
    for (const u of combos) {
      const g = groupName.get(u.obj);
      if (g && groupHome.has(g) && groupHome.get(g) !== anchor) {
        if (!shown.has(g)) p([D(`[the shared combinations of group ${g} — see `), LINK(groupHomeLabel.get(g), groupHome.get(g)), D("]")], 1);
        shown.add(g);
        continue;
      }
      if (g) { groupHome.set(g, anchor); groupHomeLabel.set(g, currentPlace.label); }
      renderComboUnit(u.obj, g, room);
    }
  }
  flushTrees();
}
const groupHome = new Map();
const groupHomeLabel = new Map();

// ------------------------------------------------------------------ the document

h(1, "The Brass Compass — The Father and the Fog — Full Script", "top");
p([D("Generated by "), K("npm run script:export"), D(" from the .adv scripts in src/content/scripts/. Do not edit by hand: edit the scripts and regenerate. Every line ends with its source as file:line (relative to src/content/scripts/).")], 0, "note");
p([D("Conventions: "), S("Name"), D(" speaks; "), S("Fenn (V.O.)"), D(" is Fenn's narration; "), D("[italic brackets]"), D(" are conditions and stage directions; hotspot verb lines (Look at, Talk to…) are Fenn's narration when the player does that; a room that recurs in a later act lists only the lines for that act.")], 0, "note");

// Cast
h(1, "Cast", "cast");
const castRows = new Map();
for (const row of story.split("\n")) {
  const m = row.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
  if (m) castRows.set(m[1].trim(), { who: m[2].trim(), voice: m[3].trim() });
}
function castOf(c) {
  const name = c.name.replace(/\s*\(.*\)$/, "");
  if (castRows.has(name)) return castRows.get(name);
  for (const [k, v] of castRows) if (k.split(" ").pop().toLowerCase() === c.id) return v;
  return null;
}
const speaks = new Map();
for (const t of Object.values(DIALOGUES)) for (const n of Object.values(t.nodes)) {
  const s = speaks.get(n.speaker) || { lines: 0, trees: new Set() };
  s.lines++; s.trees.add(t.id); speaks.set(n.speaker, s);
}
for (const c of Object.values(CHARACTERS)) {
  if (c.id === "narrator") continue;
  const info = castOf(c);
  const sp = speaks.get(c.id);
  // Print the people this story actually uses: speakers and the bible's cast table. A registry
  // entry left over from an older cut (no lines, no story row) is not part of the screenplay.
  if (!sp && !info && c.id !== "fenn") continue;
  const desc = info ? `${info.who}. ${info.voice}.` : "";
  const where = c.id === "fenn" ? "The player: every choice and every verb line." : sp ? `${sp.lines} lines in ${[...sp.trees].join(", ")}.` : "No spoken lines.";
  p([S(c.name), T(desc ? ` — ${desc} ` : " — "), D(`[${where}]`)], 0);
}

// Acts
inferActs();
const appearances = new Map(); // room -> acts in which it is met, in order
const actRooms = new Map();
for (const n of ACT_NUMS) {
  const list = walkAct(n);
  actRooms.set(n, list);
  for (const r of list) { if (!appearances.has(r)) appearances.set(r, []); appearances.get(r).push(n); }
}
// Rooms that no exit reaches: placed in the first act their lines name, else the last act.
const unreached = Object.keys(ROOMS).filter((r) => !appearances.has(r));
for (const r of unreached) {
  const acts = roomUnits(ROOMS[r]).map((u) => u.acts).filter((s) => s.size < ACT_NUMS.length);
  const n = acts.length ? Math.min(...acts.flatMap((s) => [...s])) : ACT_NUMS[ACT_NUMS.length - 1];
  actRooms.get(n).push(r);
  appearances.set(r, [n]);
}
const firstAppearance = new Map();

for (const n of ACT_NUMS) {
  const act = ACTS[n];
  h(1, `${actName(n)}: ${act.title}`, `act${n}`);
  currentPlace = { label: `${actName(n)} › Opening`, anchor: `act${n}-opening` };
  h(2, `${actName(n)} — Opening`, `act${n}-opening`);
  if (act.intro) p([D(`[opening cinematic: ${act.intro}]`), R(ref(act))], 0);
  if (act.inventory) p([D(`[Fenn carries: ${act.inventory.map(itemName).join(", ")}]`), R(refOf(childLine(loc(act), "inventory") || loc(act)))], 0);
  p([D(`[starts in ${roomName(act.start.room)}]`)], 0);
  if (act.caption) {
    stats.captions++; stats.lines++;
    p([S("Caption"), T(": "), Q(act.caption), R(refOf(childLine(loc(act), "caption") || loc(act)))], 0, "caption");
  }
  if (act.onStart?.length) {
    p([L("On start")], 0, "hotspot");
    effects(act.onStart, 1);
  }
  flushTrees();
  for (const r of actRooms.get(n)) {
    const apps = appearances.get(r);
    const isFirst = !firstAppearance.has(r);
    if (isFirst) firstAppearance.set(r, n);
    renderRoom(r, n, apps, isFirst);
  }
  if (act.outro) p([D(`[${actName(n)} closing cinematic: ${act.outro}]`), R(refOf(childLine(loc(act), "outro") || loc(act)))], 0, "note");
}

// Global combinations
h(1, "Combinations that work anywhere", "global-combos");
currentPlace = { label: "Combinations that work anywhere", anchor: "global-combos" };
p([D("[from combos.adv: these apply in every room, after the room's own combinations]")], 0, "note");
for (const c of GLOBAL) renderComboUnit(c, null);
const unusedGroups = Object.keys(GROUPS).filter((g) => !groupHome.has(g));
for (const g of unusedGroups) {
  p([L(`Group ${g} (not included by any room)`), R(ref(GROUPS[g]))], 0, "hotspot");
  for (const c of GROUPS[g]) renderComboUnit(c, g);
}
flushTrees();

// Conversations nobody opens from a room (opened from somewhere we didn't walk).
const orphanTrees = Object.keys(DIALOGUES).filter((id) => !treeHome.has(id));
if (orphanTrees.length) {
  h(1, "Conversations not opened from any room", "orphan-trees");
  currentPlace = { label: "Conversations not opened from any room", anchor: "orphan-trees" };
  for (const id of orphanTrees) { treeHome.set(id, { ...currentPlace }); treeQueue.push(id); }
  flushTrees();
}

// Items
h(1, "Items", "items");
for (const it of Object.values(ITEMS)) {
  stats.items++; stats.lines++;
  p([L(it.name), T(" "), K(it.id), T(" — "), Q(it.look), R(refOf(childLine(loc(it), "look") || loc(it)))], 0);
  for (const st of it.states || []) {
    const bits = [condRun(st.if) || D("[always]")];
    if (st.name) bits.push(D(` called “${st.name}”`));
    if (st.look) { bits.push(T(" "), Q(st.look)); stats.lines++; }
    const l = (st.look && childLine(loc(st), "look")) || loc(st);
    p([...bits, R(refOf(l))], 1);
  }
}

// Tips
h(1, "Tips", "tips");
p([D("[the first tip whose condition holds is the one shown (Tip button, H, or tip mode), so within each act they run from the last step back to the first. Asking shows the tip's nudge first; asking again shows the line under it]")], 0, "note");
/** The line of a tip's own text: its first child line in quotes (the nudge has its keyword). */
function tipTextLine(l) {
  const lines = l && scriptText.get(l.file);
  if (!lines) return null;
  for (let i = l.line; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('"')) return { file: l.file, line: i + 1 };
    if (t && !t.startsWith("#") && !t.startsWith("nudge")) break;
  }
  return null;
}
TIPS.forEach((tip, i) => {
  stats.tips++; stats.lines++;
  const textRef = R(refOf(tipTextLine(loc(tip)) || firstChild(loc(tip)) || loc(tip)));
  if (!tip.nudge) {
    p([L(`${i + 1}.`), T(" "), condRun(tip.if) || D("[always]"), T(" "), Q(tip.text), textRef], 0);
    return;
  }
  stats.lines++;
  p([L(`${i + 1}.`), T(" "), condRun(tip.if) || D("[always]"), T(" "), D("(nudge)"), T(" "), Q(tip.nudge), R(refOf(childLine(loc(tip), "nudge") || loc(tip)))], 0);
  p([D("(then)"), T(" "), Q(tip.text), textRef], 1);
});

// Ending
if (ENDING) {
  h(1, "The Ending", "ending");
  p([L("Closing title:"), T(" "), Q(ENDING.title), R(ref(ENDING))], 0);
  stats.ending++; stats.lines++;
  for (const t of ENDING.titles || []) {
    stats.ending++; stats.lines++;
    p([L("Title"), T(" "), condRun(t.if), T(" "), Q(t.text), R(refOf(firstChild(loc(t)) || loc(t)))], 1);
  }
  for (const l of ENDING.lines) {
    stats.ending++; stats.lines++;
    p([condRun(l.if) || D("[always]"), T(" "), Q(l.text), R(refOf(firstChild(loc(l)) || loc(l)))], 1);
  }
}

// Fallback lines
h(1, "Appendix: Fallback Lines", "fallback");
p([D("[from src/game/lines.ts: what Fenn says when nothing was written for an action. ⟨target⟩ is the thing or person, phrased (“the bar”, “Marta”); ⟨item⟩ is the item; ⟨verb⟩ the verb. Variants rotate.]")], 0, "note");
{
  const src = linesSource.split("\n");
  let fn = null;
  const stack = []; // { indent, text }
  let lastHeading = null;
  const indentOf = (s) => s.length - s.trimStart().length;
  src.forEach((line, i) => {
    const fm = line.match(/^export function (\w+)/);
    if (fm) { fn = ["defaultLine", "noComboLine", "itemAloneLine"].includes(fm[1]) ? fm[1] : null; stack.length = 0; return; }
    if (!fn) return;
    const ind = indentOf(line);
    const t = line.trim();
    const ctl = t.match(/^((?:case "\w+":\s*)+|default:|if \((.+?)\)\s*(?:return|\{))/);
    if (ctl) {
      while (stack.length && stack[stack.length - 1].indent >= ind) stack.pop();
      let label = ctl[1].startsWith("case") ? [...ctl[1].matchAll(/"(\w+)"/g)].map((m) => m[1]).join("/")
        : ctl[1] === "default:" ? "any other verb" : ctl[2];
      label = label.replace(/^t\.person$|^target\.person$/, "a person").replace(/^verb === "(\w+)"$/, "$1");
      stack.push({ indent: ind, text: label });
    } else if (t === "}" ) {
      while (stack.length && stack[stack.length - 1].indent >= ind) stack.pop();
    }
    const strs = [...line.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]);
    for (const s of strs) {
      const ctx = stack.filter((x) => x.indent < ind || (ctl && x.indent === ind)).map((x) => x.text);
      const what = { defaultLine: "Nothing written for this verb", noComboLine: "Using or giving an item with no combination", itemAloneLine: "An item used on nothing" }[fn] || fn;
      const heading = `${what}${ctx.length ? " — " + ctx.join(", ") : ""}`;
      if (heading !== lastHeading) { p([L(heading)], 0, "hotspot"); lastHeading = heading; }
      const text = s.replace(/\$\{cap\((\w)\)\}/g, "${$1}")
        .replace(/\$\{[NnTt]\}/g, "⟨target⟩").replace(/\$\{[Ii]\}/g, "⟨item⟩").replace(/\$\{verb\}/g, "⟨verb⟩")
        .replace(/\$\{\/\^\[aeiou\]\/i\.test\(name\) \? "an" : "a"\} \$\{name\}/g, "a ⟨name⟩");
      if (/^(the|a|an) \$\{name\}$|^\$\{/.test(s) && !/[a-z]{3}/.test(text.replace(/⟨\w+⟩/g, ""))) continue; // phrase() helpers, not lines
      stats.fallback++; stats.lines++;
      p([Q(text), R(`game/lines.ts:${i + 1}`)], 1);
    }
  });
}

// ------------------------------------------------------------------ coverage

const allNodes = Object.values(DIALOGUES).reduce((n, t) => n + Object.keys(t.nodes).length, 0);
const roomsShown = new Set(doc.filter((b) => b.t === "h" && b.level === 2 && /^act\d+-/.test(b.anchor || "") && !b.anchor.endsWith("-opening")).map((b) => b.anchor.replace(/^act\d+-/, "")));
const treesShown = new Set(doc.filter((b) => b.t === "h" && b.level === 3 && b.anchor?.startsWith("dlg-")).map((b) => b.anchor.slice(4)));
const unitsTotal = Object.values(ROOMS).reduce((n, r) => n + roomUnits(r).length, 0);
let verbTotal = 0;
for (const r of Object.values(ROOMS)) for (const hs of r.hotspots) {
  verbTotal += Object.keys(hs.say || {}).length;
  for (const st of hs.states || []) verbTotal += Object.keys(st.say || {}).length;
}
const coverage = {
  rooms: `${roomsShown.size}/${Object.keys(ROOMS).length}`,
  conversations: `${treesShown.size}/${Object.keys(DIALOGUES).length}`,
  nodes: `${printedNodes.size}/${allNodes}`,
  "room blocks (hotspots, states, scenes, combos)": `${printedUnits.size}/${unitsTotal}`,
  "hotspot verb lines": `${stats.verbLines}/${verbTotal}`,
  choices: stats.choices,
  "narrated lines (say)": stats.says,
  "chart notes": stats.notes,
  combinations: `${stats.combos} (${GLOBAL.length} global)`,
  items: `${stats.items}/${Object.keys(ITEMS).length}`,
  tips: `${stats.tips}/${TIPS.length}`,
  "ending lines": stats.ending,
  "fallback lines": stats.fallback,
  "total lines with a source": stats.lines,
};
h(1, "Coverage", "coverage");
for (const [k, v] of Object.entries(coverage)) p([L(k + ":"), T(" " + v)], 0);
const missing = [];
for (const r of Object.keys(ROOMS)) if (!roomsShown.has(r)) missing.push(`room ${r}`);
for (const t of Object.keys(DIALOGUES)) if (!treesShown.has(t)) missing.push(`conversation ${t}`);
for (const t of Object.values(DIALOGUES)) for (const nid of Object.keys(t.nodes)) if (!printedNodes.has(`${t.id}/${nid}`)) missing.push(`node ${t.id}.${nid}`);
if (stats.verbLines !== verbTotal) missing.push(`${verbTotal - stats.verbLines} verb lines`);
if (printedUnits.size !== unitsTotal) missing.push(`${unitsTotal - printedUnits.size} room blocks`);

// ------------------------------------------------------------------ Markdown

const mdEsc = (s) => s.replace(/([\\*`<>])/g, "\\$1");
/** Emphasis with the surrounding spaces kept outside the markers, so it always closes. */
const wrap = (s, m) => {
  const t = s.trim();
  if (!t) return s;
  const [, lead, , trail] = s.match(/^(\s*)(.*?)(\s*)$/s);
  return `${lead}${m}${t}${m}${trail}`;
};
function mdRuns(runs) {
  return runs.map((r) => {
    switch (r.k) {
      case "text": return mdEsc(r.v);
      case "speaker": return wrap(mdEsc(r.v.toUpperCase()), "**");
      case "label": return wrap(mdEsc(r.v), "**");
      case "dir": return wrap(mdEsc(r.v), "*");
      case "ref": return ` <sub>${r.v}</sub>`;
      case "code": return `\`${r.v}\``;
      case "link": return `[${mdEsc(r.v)}](#${r.to})`;
      case "group": return mdRuns(r.v);
      default: return "";
    }
  }).join("");
}
const md = [];
const toc = [];
for (const b of doc) {
  if (b.t === "h") {
    if (md.length && md[md.length - 1] !== "") md.push("");
    if (b.anchor) md.push(`<a id="${b.anchor}"></a>`);
    md.push(`${"#".repeat(b.level)} ${b.text}`, "");
    if (b.level <= 2 && b.anchor !== "top") toc.push(`${"  ".repeat(b.level - 1)}- [${b.text}](#${b.anchor})`);
    continue;
  }
  const anchor = b.style?.startsWith("node:") ? `<a id="${b.style.slice(5)}"></a>` : "";
  const text = anchor + mdRuns(b.runs);
  if (b.style === "hotspot") { if (md[md.length - 1] !== "") md.push(""); md.push(text, ""); continue; }
  if (b.style === "caption") { md.push(`> ${text}`, ""); continue; }
  if (b.style === "note" || (b.indent === 0 && !b.style?.startsWith("node:"))) { if (md[md.length - 1] !== "") md.push(""); md.push(text, ""); continue; }
  if (b.style?.startsWith("node:")) { if (md[md.length - 1] !== "") md.push(""); md.push(text); continue; }
  md.push(`${"  ".repeat(b.indent - 1)}- ${text}`);
}
// Table of contents after the conventions paragraph.
const insertAt = md.findIndex((l) => l.startsWith('<a id="cast">'));
md.splice(insertAt, 0, "## Contents", "", ...toc, "");
const mdText = md.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
writeFileSync(OUT_MD, mdText);

// ------------------------------------------------------------------ Word

if (WANT_DOCX) {
  const dir = mkdtempSync(join(tmpdir(), "full-script-"));
  try {
    const json = join(dir, "script.json");
    const flat = (runs) => runs.flatMap((r) => (r.k === "group" ? flat(r.v) : [r]));
    writeFileSync(json, JSON.stringify(doc.map((b) => (b.t === "p" ? { ...b, runs: flat(b.runs).map((r) => (r.k === "speaker" ? { ...r, v: r.v } : r)) } : b))));
    execFileSync("python3", [join(ROOT, "tools/script_docx.py"), json, OUT_DOCX], { stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ report

console.log(`wrote docs/FULL_SCRIPT.md (${mdText.split("\n").length} lines)${WANT_DOCX ? " and docs/FULL_SCRIPT.docx" : ""}`);
for (const [k, v] of Object.entries(coverage)) console.log(`  ${k}: ${v}`);
for (const n of ACT_NUMS) console.log(`  ${actName(n)}: ${actRooms.get(n).map((r) => r).join(", ")}`);
if (missing.length) {
  console.error("missing from the export:\n  " + missing.join("\n  "));
  process.exit(1);
}
