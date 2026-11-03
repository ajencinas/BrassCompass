/**
 * Data to `.adv` text: the inverse of compile.ts. Used by the one-off converter
 * (tools/to-adv.mjs) and by the round-trip test (tools/test-scripts.mjs), which checks that
 * compile(serialize(x)) gives back x exactly. Anything the language can't express throws, so
 * nothing is ever silently dropped.
 */

import type { Poly, Pt } from "../engine/walkbox";
import type { Combo, Cond, DialogueTree, Effect, Hotspot, Item, Room, SceneSprite, VerbId } from "../game/types";
import type { ActDef, EndingDef } from "../content/acts";
import type { Tip } from "../content/hints";

/** Comment lines to write above a block, keyed like `room:dock` or `hotspot:dock.ship`. */
export type Comments = (key: string) => string[] | undefined;

const ID = /^[A-Za-z_][A-Za-z0-9_:.]*$/;
const RESERVED = new Set(["and", "or", "not", "has", "room", "act", "if", "true", "false", "unset"]);

function id(v: unknown, what = "name"): string {
  if (typeof v !== "string" || !ID.test(v) || /[.:]$/.test(v)) throw new Error(`can't write ${what} ${JSON.stringify(v)}`);
  return v;
}
function flagId(v: string): string {
  if (RESERVED.has(v)) throw new Error(`flag named '${v}' clashes with a keyword`);
  return id(v, "flag");
}
export function str(s: unknown): string {
  if (typeof s !== "string") throw new Error(`expected a string, got ${JSON.stringify(s)}`);
  return JSON.stringify(s);
}
function num(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`expected a number, got ${JSON.stringify(n)}`);
  return String(n);
}
export function value(v: unknown): string {
  if (v === true) return "true";
  if (v === false) return "false";
  if (v === undefined) return "unset";
  if (typeof v === "number") return num(v);
  if (typeof v === "string") return str(v);
  throw new Error(`can't write value ${JSON.stringify(v)}`);
}
export function pt(p: Pt): string { return `${num(p.x)},${num(p.y)}`; }
export function poly(p: Poly): string { return p.map((q) => `(${pt(q)})`).join(" "); }

function only(obj: object, keys: string[], what: string): void {
  for (const k of Object.keys(obj)) if (!keys.includes(k)) throw new Error(`${what}: can't write key '${k}'`);
}

// ---------------------------------------------------------------- conditions and effects

export function cond(c: Cond): string {
  if ("atLeast" in c) { only(c, ["flag", "atLeast"], "cond"); return `${flagId(c.flag)} >= ${num(c.atLeast)}`; }
  if ("flag" in c) {
    only(c, ["flag", "is"], "cond");
    if (!("is" in c)) return flagId(c.flag);
    if (c.is === false) return `not ${flagId(c.flag)}`;
    return `${flagId(c.flag)} = ${value(c.is)}`;
  }
  if ("has" in c) return `has ${id(c.has)}`;
  if ("notHas" in c) return `not has ${id(c.notHas)}`;
  if ("room" in c) return `room ${id(c.room)}`;
  if ("act" in c) {
    if (!Array.isArray(c.act)) return `act ${num(c.act)}`;
    return c.act.length > 1 ? `act ${c.act.map(num).join(",")}` : `act [${c.act.map(num).join(",")}]`;
  }
  if ("any" in c) {
    if (c.any.length < 2) throw new Error("can't write an any-of with fewer than two conditions");
    return `(${c.any.map(cond).join(" or ")})`;
  }
  if ("not" in c) {
    const inner = c.not;
    if ("act" in inner || "room" in inner || "any" in inner) return `not ${cond(inner)}`;
    return `not (${cond(inner)})`;
  }
  throw new Error(`can't write condition ${JSON.stringify(c)}`);
}

export function conds(list: Cond[]): string {
  if (!list.length) throw new Error("can't write an empty condition list here");
  return list.map(cond).join(" and ");
}
const ifs = (list?: Cond[]): string => (list && list.length ? ` if ${conds(list)}` : "");

export function effect(e: Effect): string {
  switch (e.k) {
    case "say": only(e, ["k", "text"], "say"); return `say ${str(e.text)}`;
    case "flag": only(e, ["k", "id", "v"], "set"); return e.v === true ? `set ${flagId(e.id)}` : `set ${flagId(e.id)} = ${value(e.v)}`;
    case "add": return `add ${flagId(e.id)} ${num(e.n)}`;
    case "give": return `give ${id(e.item)}`;
    case "take": return `take ${id(e.item)}`;
    case "go": return `go ${id(e.room)}`;
    case "talk": only(e, ["k", "tree", "node"], "talk"); return e.node !== undefined ? `talk ${id(e.tree)} at ${id(e.node)}` : `talk ${id(e.tree)}`;
    case "act": return `act ${num(e.n)}`;
    case "win": return "win";
    case "sound": return `sound ${id(e.id)}`;
    case "music": return `music ${id(e.track)}`;
  }
  throw new Error(`can't write effect ${JSON.stringify(e)}`);
}

// ---------------------------------------------------------------- writer

class W {
  lines: string[] = [];
  constructor(private comments?: Comments) {}
  line(depth: number, text: string): void { this.lines.push("  ".repeat(depth) + text); }
  blank(): void { if (this.lines.length && this.lines[this.lines.length - 1] !== "") this.lines.push(""); }
  private said = new Set<string>();
  comment(depth: number, key: string): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    for (const c of this.comments?.(key) ?? []) this.line(depth, c ? `# ${c}` : "#");
  }
  effects(depth: number, list: Effect[]): void {
    if (!list.length) this.line(depth, "nothing");
    for (const e of list) this.line(depth, effect(e));
  }
  text(): string { return this.lines.join("\n").replace(/\n+$/, "") + "\n"; }
}

// ---------------------------------------------------------------- rooms

const EXIT_VERBS = ["open", "use", "walk"] as const;

/** `exit room`: open, use and walk each do exactly one `go` to the same room. */
function exitOf(d?: Partial<Record<VerbId, Effect[]>>): string | null {
  if (!d) return null;
  let room: string | null = null;
  for (const v of EXIT_VERBS) {
    const list = d[v];
    if (!list || list.length !== 1 || list[0].k !== "go") return null;
    const r = (list[0] as { room: string }).room;
    if (room !== null && r !== room) return null;
    room = r;
  }
  return room;
}

function verbs(w: W, depth: number, say: Partial<Record<VerbId, string>> = {}, d: Partial<Record<VerbId, Effect[]>> = {}): void {
  const exit = exitOf(d);
  if (exit) w.line(depth, `exit ${id(exit)}`);
  const order = [...Object.keys(say), ...Object.keys(d).filter((k) => !(k in say))] as VerbId[];
  for (const v of order) {
    const text = say[v];
    const list = exit && (EXIT_VERBS as readonly string[]).includes(v) ? undefined : d[v];
    if (text === undefined && !list) continue;
    if (text === undefined && list?.length === 1) { w.line(depth, `${v}: ${effect(list[0])}`); continue; }
    w.line(depth, text !== undefined ? `${v} ${str(text)}` : v);
    if (list) w.effects(depth + 1, list);
  }
}

function sprite(s: SceneSprite): string {
  only(s, ["key", "x", "y", "size", "visible", "flip", "idle", "speaker", "grade", "hotspot", "showIf"], "sprite");
  let out = `sprite ${id(s.key)} at ${num(s.x)},${num(s.y)} size ${num(s.size)}`;
  if (s.visible !== undefined) out += ` visible ${num(s.visible)}`;
  if (s.flip !== undefined) { if (s.flip !== true) throw new Error("sprite flip: false"); out += " flip"; }
  if (s.idle !== undefined) { if (s.idle !== true) throw new Error("sprite idle: false"); out += " idle"; }
  if (s.speaker !== undefined) out += ` speaker ${id(s.speaker)}`;
  if (s.hotspot !== undefined) out += ` for ${id(s.hotspot)}`;
  if (s.grade !== undefined) out += ` grade ${str(s.grade)}`;
  if (s.showIf !== undefined) out += ` if ${conds(s.showIf)}`;
  return out;
}

function hotspot(w: W, room: string, h: Hotspot): void {
  only(h, ["id", "name", "area", "stand", "showIf", "states", "person", "verb", "article", "item", "say", "do", "noWalk"], "hotspot");
  w.comment(1, `hotspot:${room}.${h.id}`);
  w.line(1, `hotspot ${id(h.id)} ${str(h.name)}`);
  if (h.showIf) w.line(2, `show if ${conds(h.showIf)}`);
  if ("rect" in h.area) {
    const r = h.area.rect;
    w.line(2, `area ${num(r.x)},${num(r.y)} ${num(r.w)}x${num(r.h)}`);
  } else w.line(2, `area ${poly(h.area)}`);
  if (h.stand) w.line(2, `stand ${pt(h.stand)}`);
  if (h.person !== undefined) w.line(2, h.person ? "person" : "thing");
  if (h.noWalk !== undefined) { if (!h.noWalk) throw new Error("noWalk: false"); w.line(2, "nowalk"); }
  if (h.verb) w.line(2, `verb ${id(h.verb)}`);
  if (h.article) w.line(2, `article ${id(h.article)}`);
  if (h.item) w.line(2, `item ${id(h.item)}`);
  verbs(w, 2, h.say, h.do);
  if (h.states && !h.states.length) w.line(2, "states none");
  for (const st of h.states ?? []) {
    only(st, ["if", "name", "say", "do"], "state");
    w.line(2, `state${ifs(st.if)}`);
    if (st.name !== undefined) w.line(3, `name ${str(st.name)}`);
    verbs(w, 3, st.say, st.do);
  }
}

function combo(w: W, depth: number, c: Combo, scope: string): void {
  only(c, ["item", "with", "say", "do", "consume", "if"], "combo");
  w.comment(depth, `combo:${scope}:${c.item}+${c.with}:${String(c.say).slice(0, 20)}`);
  if (c.if && !c.if.length) throw new Error("combo with an empty if");
  w.line(depth, `use ${id(c.item)} on ${id(c.with)}${ifs(c.if)}`);
  w.line(depth + 1, str(c.say));
  if (c.consume !== undefined) w.line(depth + 1, c.consume ? "consume" : "keep");
  if (c.do) w.effects(depth + 1, c.do);
}

/**
 * One room. `groupOf` names the shared combo group a combo belongs to, so a run of shared
 * combos is written as one `combos <group>` line.
 */
export function room(r: Room, groupOf: (c: Combo) => { name: string; size: number } | undefined = () => undefined, comments?: Comments): string {
  only(r, ["id", "name", "bg", "music", "walk", "entry", "arrive", "perspective", "scale", "hotspots", "combos",
    "sprites", "occluders", "onEnter", "scenes", "ambience", "grade", "stars", "width"], "room");
  const w = new W(comments);
  w.comment(0, `room:${r.id}`);
  w.line(0, `room ${id(r.id)} ${str(r.name)}`);
  w.line(1, `bg ${id(r.bg)}`);
  if (r.width !== undefined) w.line(1, `width ${num(r.width)}`);
  if (r.music !== undefined) w.line(1, `music ${id(r.music)}`);
  if (r.ambience !== undefined) w.line(1, `ambience ${id(r.ambience)}`);
  if (r.grade !== undefined) w.line(1, `grade ${str(r.grade)}`);
  if (r.stars !== undefined) w.line(1, `stars ${num(r.stars.y)}`);
  const p = r.perspective;
  w.comment(1, `perspective:${r.id}`);
  w.line(1, `perspective horizon ${num(p.horizon)} ref ${num(p.refY)} height ${num(p.refH)}`);
  for (const k of [...(r.scale ?? [])].sort((a, b) => a.y - b.y)) {
    w.line(1, `scale ${num(k.y)} ${num(k.h)}`);
  }
  w.comment(1, `walk:${r.id}`);
  for (const wp of r.walk) w.line(1, `walk ${poly(wp)}`);
  w.line(1, `entry ${pt(r.entry)}`);
  for (const [from, at] of Object.entries(r.arrive ?? {})) w.line(1, `arrive ${id(from)} ${pt(at)}`);
  if (r.sprites?.length) { w.blank(); w.comment(1, `sprites:${r.id}`); }
  for (const s of r.sprites ?? []) { w.comment(1, `sprite:${r.id}:${s.key}@${s.x},${s.y}`); w.line(1, sprite(s)); }
  if (r.occluders?.length) { w.blank(); w.comment(1, `occluders:${r.id}`); }
  for (const o of r.occluders ?? []) { only(o, ["area", "y"], "occluder"); w.comment(1, `occluder:${r.id}:y${o.y}`); w.line(1, `occluder floor ${num(o.y)} ${poly(o.area)}`); }
  if (r.onEnter) { w.blank(); w.line(1, "on enter"); w.effects(2, r.onEnter); }
  for (const sc of r.scenes ?? []) {
    w.blank();
    w.line(1, `scene${ifs(sc.if)}`);
    w.effects(2, sc.do);
  }
  for (const h of r.hotspots) { w.blank(); hotspot(w, r.id, h); }
  const combos = r.combos ?? [];
  if (r.combos && !combos.length) throw new Error(`${r.id}: empty combos list`);
  if (combos.length) { w.blank(); w.comment(1, `combos:${r.id}`); }
  for (let i = 0; i < combos.length;) {
    const g = groupOf(combos[i]);
    if (g) { w.line(1, `combos ${id(g.name)}`); i += g.size; continue; }
    combo(w, 1, combos[i], r.id);
    i++;
  }
  return w.text();
}

// ---------------------------------------------------------------- dialogue

export function dialogue(t: DialogueTree, comments?: Comments): string {
  only(t, ["id", "start", "nodes"], "dialogue");
  const w = new W(comments);
  w.comment(0, `tree:${t.id}`);
  w.line(0, `dialogue ${id(t.id)}`);
  const keys = Object.keys(t.nodes);
  if (t.start !== keys[0]) w.line(1, `start ${id(t.start)}`);
  for (const key of keys) {
    const n = t.nodes[key];
    only(n, ["id", "speaker", "text", "choices", "next", "do"], "node");
    if (n.id !== key) throw new Error(`${t.id}: node key ${key} has id ${n.id}`);
    w.comment(1, `node:${t.id}.${key}`);
    w.line(1, `node ${id(n.id)} ${id(n.speaker)} ${str(n.text)}`);
    if (n.do) w.effects(2, n.do);
    for (const c of n.choices ?? []) {
      only(c, ["text", "to", "if", "do"], "choice");
      if (c.if && !c.if.length) throw new Error("choice with an empty if");
      w.comment(2, `choice:${t.id}.${key}:${c.text.slice(0, 20)}`);
      w.line(2, `> ${str(c.text)}${ifs(c.if)} -> ${id(c.to)}`);
      if (c.do) w.effects(3, c.do);
    }
    if (n.next !== undefined) w.line(2, `-> ${id(n.next)}`);
  }
  return w.text();
}

// ---------------------------------------------------------------- items, tips, combos, acts

export function items(list: Item[], comments?: Comments): string {
  const w = new W(comments);
  for (const it of list) {
    only(it, ["id", "name", "look", "states"], "item");
    w.comment(0, `item:${it.id}`);
    w.line(0, `item ${id(it.id)} ${str(it.name)}`);
    w.line(1, `look ${str(it.look)}`);
    for (const st of it.states ?? []) {
      only(st, ["if", "name", "look"], "item state");
      w.line(1, `state${ifs(st.if)}`);
      if (st.name !== undefined) w.line(2, `name ${str(st.name)}`);
      if (st.look !== undefined) w.line(2, `look ${str(st.look)}`);
    }
    w.blank();
  }
  return w.text();
}

export function tips(list: Tip[], comments?: Comments): string {
  const w = new W(comments);
  list.forEach((t, i) => {
    only(t, ["if", "text"], "tip");
    w.comment(0, `tip:${i}`);
    w.line(0, `tip${ifs(t.if)}`);
    w.line(1, str(t.text));
  });
  return w.text();
}

export function combos(global: Combo[], groups: Record<string, Combo[]>, comments?: Comments): string {
  const w = new W(comments);
  for (const c of global) { combo(w, 0, c, "global"); w.blank(); }
  for (const [name, list] of Object.entries(groups)) {
    w.comment(0, `group:${name}`);
    w.line(0, `combos ${id(name)}`);
    for (const c of list) combo(w, 1, c, `group:${name}`);
    w.blank();
  }
  return w.text();
}

export function acts(list: ActDef[], ending: EndingDef | null, comments?: Comments): string {
  const w = new W(comments);
  for (const a of list) {
    only(a, ["n", "title", "start", "intro", "outro", "caption", "inventory", "onStart"], "act");
    w.comment(0, `act:${a.n}`);
    w.line(0, `act ${num(a.n)} ${str(a.title)}`);
    only(a.start, ["room", "pos"], "act start");
    w.line(1, `start ${id(a.start.room)}${a.start.pos ? ` at ${pt(a.start.pos)}` : ""}`);
    if (a.intro !== undefined) w.line(1, `intro ${str(a.intro)}`);
    if (a.outro !== undefined) w.line(1, `outro ${str(a.outro)}`);
    if (a.inventory !== undefined) w.line(1, `inventory ${a.inventory.map((i) => id(i)).join(" ")}`);
    if (a.caption !== undefined) w.line(1, `caption ${str(a.caption)}`);
    if (a.onStart) { w.line(1, "on start"); w.effects(2, a.onStart); }
    w.blank();
  }
  if (ending) {
    only(ending, ["title", "titles", "lines"], "ending");
    w.comment(0, "ending");
    w.line(0, `ending ${str(ending.title)}`);
    for (const t of ending.titles ?? []) { w.line(1, `title if ${conds(t.if)}`); w.line(2, str(t.text)); }
    ending.lines.forEach((l, i) => {
      only(l, ["if", "text"], "ending line");
      w.comment(1, `ending:${i}`);
      if (l.if && !l.if.length) throw new Error("ending line with an empty if");
      w.line(1, `line${ifs(l.if)}`);
      w.line(2, str(l.text));
    });
  }
  return w.text();
}
