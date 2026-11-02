/**
 * The puzzle map: what each act's puzzles are made of. Items and flags are nodes; so is every
 * place that needs or makes one (a hotspot verb, a combination, a dialogue choice, a scene,
 * an act's start). Edges run from what a place needs to the place, and from the place to what
 * it makes. Laid out in layers, left to right, as an SVG.
 */

import type { Combo, Cond, DialogueChoice, Effect, Hotspot, Room, VerbId } from "../game/types";
import { CONTENT } from "../content/content";
import { cond as condText } from "../adv/serialize";
import { VERBS } from "../game/verbs";

export interface Ref { kind: "item" | "flag"; id: string }
export interface Site {
  key: string;
  label: string;
  /** What the site belongs to, for its tooltip. */
  where: string;
  /** The compiled object whose script line the site opens. */
  obj: object;
  needs: Ref[];
  makes: Ref[];
  acts: Set<number>;
}
export interface Problem { kind: "unobtainable" | "unused" | "never-set" | "never-read"; ref: Ref; obj?: object }

const refKey = (r: Ref): string => `${r.kind}:${r.id}`;
const auto = (f: string): boolean => f.startsWith("seen:") || f.startsWith("looked:");

/** Every item and flag a list of conditions reads (flags the game sets itself are left out). */
function condRefs(list: Cond[] | undefined, out: Ref[] = []): Ref[] {
  for (const c of list ?? []) {
    if ("flag" in c) { if (!auto(c.flag)) out.push({ kind: "flag", id: c.flag }); }
    else if ("has" in c) out.push({ kind: "item", id: c.has });
    else if ("notHas" in c) out.push({ kind: "item", id: c.notHas });
    else if ("any" in c) condRefs(c.any, out);
    else if ("not" in c) condRefs([c.not], out);
  }
  return out;
}
/**
 * What a list of conditions requires to be held or set: its positive top-level conditions.
 * Negative ones (not has, not flag) and alternatives (a or b) don't gate anything here.
 */
function requires(list: Cond[] | undefined): Ref[] {
  const out: Ref[] = [];
  for (const c of list ?? []) {
    if ("has" in c) out.push({ kind: "item", id: c.has });
    else if ("atLeast" in c) out.push({ kind: "flag", id: c.flag });
    else if ("flag" in c && !auto(c.flag) && (!("is" in c) || (c.is !== false && c.is !== undefined))) out.push({ kind: "flag", id: c.flag });
  }
  return out;
}
/** Acts a list of conditions allows (every act when it doesn't say). */
function condActs(list: Cond[] | undefined, all: number[]): Set<number> {
  let acts = new Set(all);
  for (const c of list ?? []) {
    if ("act" in c) {
      const allowed = Array.isArray(c.act) ? c.act : [c.act];
      acts = new Set([...acts].filter((n) => allowed.includes(n)));
    }
  }
  return acts;
}
function effectRefs(list: Effect[] | undefined): { makes: Ref[]; takes: Ref[]; go: string[]; talk: string[] } {
  const out = { makes: [] as Ref[], takes: [] as Ref[], go: [] as string[], talk: [] as string[] };
  for (const e of list ?? []) {
    if (e.k === "give") out.makes.push({ kind: "item", id: e.item });
    else if (e.k === "take") out.takes.push({ kind: "item", id: e.item });
    else if (e.k === "flag" || e.k === "add") out.makes.push({ kind: "flag", id: e.id });
    else if (e.k === "go") out.go.push(e.room);
    else if (e.k === "talk") out.talk.push(e.tree);
  }
  return out;
}
const uniq = (list: Ref[]): Ref[] => [...new Map(list.map((r) => [refKey(r), r])).values()];
const short = (s: string, n = 34): string => (s.length > n ? s.slice(0, n - 1) + "…" : s);

interface RawSite {
  key: string; label: string; where: string; obj: object; needs: Ref[]; makes: Ref[];
  conds: Cond[]; room?: string; tree?: string; act?: number; go: string[]; talk: string[]; acting: boolean;
}

/** Every site in the game, with the acts it can happen in. */
export function analyse(): { sites: Site[]; problems: Problem[]; acts: number[] } {
  const { rooms, dialogues, combos, acts, items, tips, ending } = CONTENT;
  const actList = Object.values(acts).map((a) => a.n).sort((a, b) => a - b);
  const raw: RawSite[] = [];
  const add = (s: Omit<RawSite, "go" | "talk" | "makes" | "acting"> & { effects?: Effect[]; extraMakes?: Ref[] }): void => {
    const fx = effectRefs(s.effects);
    raw.push({ ...s, needs: uniq([...s.needs, ...fx.takes]), makes: uniq([...(s.extraMakes ?? []), ...fx.makes]), go: fx.go, talk: fx.talk,
      acting: Boolean(s.effects?.length || s.extraMakes?.length) });
  };

  for (const a of Object.values(acts)) {
    add({ key: `act:${a.n}`, label: `Act ${a.n} starts`, where: a.title, obj: a, needs: [], conds: [], act: a.n,
      effects: a.onStart, extraMakes: (a.inventory ?? []).map((id) => ({ kind: "item" as const, id })) });
  }
  const verbSites = (room: Room, h: Hotspot): void => {
    const states = [{ st: h as { if?: Cond[]; do?: Partial<Record<VerbId, Effect[]>> }, n: -1 }, ...(h.states ?? []).map((st, n) => ({ st, n }))];
    for (const { st, n } of states) {
      const conds = [...(h.showIf ?? []), ...(st.if ?? [])];
      for (const [verb, list] of Object.entries(st.do ?? {}) as [VerbId, Effect[]][]) {
        add({ key: `${room.id}.${h.id}.${n}.${verb}`, label: `${(VERBS.find((v) => v.id === verb)?.label ?? verb).toLowerCase()} ${h.name}`, where: `${room.name}${n >= 0 ? ` (state: ${(st.if ?? []).map(condText).join(" and ") || "always"})` : ""}`,
          obj: n >= 0 ? st : h, needs: requires(conds), conds, room: room.id, effects: list });
      }
    }
    if (h.item) {
      add({ key: `${room.id}.${h.id}.pickup-item`, label: `pick up ${h.name}`, where: room.name, obj: h,
        needs: requires(h.showIf), conds: h.showIf ?? [], room: room.id, extraMakes: [{ kind: "item", id: h.item }], effects: h.do?.pickup });
    }
  };
  const comboSite = (c: Combo, i: number, room?: Room): void => {
    const needs: Ref[] = [{ kind: "item", id: c.item }];
    // Used on a hotspot (which wins over an item of the same name): only while it's there.
    const target = room?.hotspots.find((h) => h.id === c.with);
    if (items[c.with] && !target) needs.push({ kind: "item", id: c.with });
    add({ key: `${room?.id ?? "global"}.combo.${i}`, label: `use ${c.item} on ${c.with}`, where: room?.name ?? "anywhere", obj: c,
      needs: [...needs, ...requires(c.if)], conds: [...(c.if ?? []), ...(target?.showIf ?? [])], room: room?.id, effects: c.do });
  };
  for (const room of Object.values(rooms)) {
    for (const h of room.hotspots) verbSites(room, h);
    (room.combos ?? []).forEach((c, i) => comboSite(c, i, room));
    (room.scenes ?? []).forEach((sc, i) => add({ key: `${room.id}.scene.${i}`, label: "arrival scene", where: room.name, obj: sc,
      needs: requires(sc.if), conds: sc.if, room: room.id, effects: sc.do }));
    if (room.onEnter) add({ key: `${room.id}.enter`, label: "on enter", where: room.name, obj: room, needs: [], conds: [], room: room.id, effects: room.onEnter });
  }
  combos.forEach((c, i) => comboSite(c, i));
  for (const tree of Object.values(dialogues)) {
    for (const node of Object.values(tree.nodes)) {
      if (node.do) add({ key: `${tree.id}.${node.id}`, label: `“${short(node.text, 28)}”`, where: `${tree.id} · ${node.id}`, obj: node,
        needs: [], conds: [], tree: tree.id, effects: node.do });
      (node.choices ?? []).forEach((ch: DialogueChoice, i) => {
        if (!ch.do && !ch.if) return;
        add({ key: `${tree.id}.${node.id}.${i}`, label: `> ${short(ch.text, 30)}`, where: `${tree.id} · ${node.id}`, obj: ch,
          needs: requires(ch.if), conds: ch.if ?? [], tree: tree.id, effects: ch.do });
      });
    }
  }

  // Which acts each site can happen in. Act by act, from its start room and inventory: a site
  // is live when its room or conversation has been reached, its conditions allow the act, and
  // what it requires has been obtained (items in this act, since each act starts with its own
  // inventory; flags in this act or an earlier one). Live sites open doors and conversations
  // and make more items and flags, until nothing changes.
  const liveIn = new Map<RawSite, Set<number>>(raw.map((r) => [r, new Set<number>()]));
  const carried = new Set<string>();
  for (const n of actList) {
    const act = acts[n];
    const rooms = new Set([act.start.room]), trees = new Set<string>();
    const have = new Set([...carried, ...(act.inventory ?? []).map((id) => `item:${id}`)]);
    const allowed = raw.filter((r) => condActs(r.conds, actList).has(n) && (r.act === undefined || r.act === n));
    for (let changed = true; changed;) {
      changed = false;
      for (const r of allowed) {
        if (liveIn.get(r)!.has(n)) continue;
        const reached = r.act !== undefined || (r.room ? rooms.has(r.room) : r.tree ? trees.has(r.tree) : true);
        if (!reached || !r.needs.every((x) => have.has(refKey(x)))) continue;
        liveIn.get(r)!.add(n);
        changed = true;
        r.makes.forEach((x) => have.add(refKey(x)));
        r.go.forEach((x) => rooms.add(x));
        r.talk.forEach((x) => trees.add(x));
      }
    }
    for (const k of have) if (k.startsWith("flag:")) carried.add(k);
  }
  const sites: Site[] = raw
    .map((s) => ({ key: s.key, label: s.label, where: s.where, obj: s.obj, needs: s.needs, makes: s.makes, acts: liveIn.get(s)! }))
    // Flavour (a line and nothing else) isn't part of any puzzle.
    .filter((s) => s.makes.length || (s.needs.length && raw.find((r) => r.key === s.key)!.acting));

  // Problems, over the whole game.
  const obtained = new Set<string>(), used = new Set<string>(), set = new Set<string>(), read = new Map<string, object>();
  const firstSet = new Map<string, object>();
  for (const s of sites) {
    for (const r of s.makes) { (r.kind === "item" ? obtained : set).add(r.id); if (!firstSet.has(refKey(r))) firstSet.set(refKey(r), s.obj); }
    for (const r of s.needs) { if (r.kind === "item") used.add(r.id); else if (!read.has(r.id)) read.set(r.id, s.obj); }
  }
  const readAll = (list: Cond[] | undefined, obj: object): void => {
    for (const r of condRefs(list)) { if (r.kind === "item") used.add(r.id); else if (!read.has(r.id)) read.set(r.id, obj); }
  };
  for (const r of raw) readAll(r.conds, r.obj);
  // Reads that aren't sites: visibility, states without effects, sprites, items, tips, the ending.
  for (const room of Object.values(rooms)) {
    for (const h of room.hotspots) { readAll(h.showIf, h); for (const st of h.states ?? []) readAll(st.if, st); }
    for (const sp of room.sprites ?? []) readAll(sp.showIf, sp);
    for (const c of room.combos ?? []) { used.add(c.item); if (items[c.with]) used.add(c.with); }
  }
  for (const c of combos) { used.add(c.item); used.add(c.with); }
  for (const it of Object.values(items)) for (const st of it.states ?? []) readAll(st.if, st);
  for (const t of tips) readAll(t.if, t);
  for (const l of [...(ending?.lines ?? []), ...(ending?.titles ?? [])]) readAll(l.if, l);
  const problems: Problem[] = [];
  for (const it of Object.values(items)) {
    if (!obtained.has(it.id)) problems.push({ kind: "unobtainable", ref: { kind: "item", id: it.id }, obj: it });
    if (!used.has(it.id)) problems.push({ kind: "unused", ref: { kind: "item", id: it.id }, obj: it });
  }
  for (const [f, obj] of read) if (!set.has(f)) problems.push({ kind: "never-set", ref: { kind: "flag", id: f }, obj });
  for (const f of set) if (!read.has(f)) problems.push({ kind: "never-read", ref: { kind: "flag", id: f }, obj: firstSet.get(`flag:${f}`) });
  return { sites, problems, acts: actList };
}

export const PROBLEM_TEXT: Record<Problem["kind"], string> = {
  unobtainable: "item never obtainable",
  unused: "item never used",
  "never-set": "flag read but never set",
  "never-read": "flag set but never read",
};

// ---------------------------------------------------------------- layout and drawing

interface GNode { key: string; label: string; title: string; kind: "item" | "flag" | "site"; obj?: object; bad: boolean; layer: number; order: number; x: number; y: number; w: number }

/** An act's map as SVG markup. Nodes carry `data-key`; `objOf` maps a key back to its object. */
export function renderMap(act: number | "all"): { svg: string; objOf: Map<string, object>; count: { sites: number; refs: number } } {
  const { sites: allSites, problems } = analyse();
  const sites = allSites.filter((s) => act === "all" || s.acts.has(act));
  const bad = new Map(problems.map((p) => [refKey(p.ref), p]));
  const nodes = new Map<string, GNode>();
  const edges: [string, string][] = [];
  const edgeSet = new Set<string>();
  const edge = (a: string, b: string): void => {
    if (!edgeSet.has(`${a}>${b}`)) { edgeSet.add(`${a}>${b}`); edges.push([a, b]); }
  };
  const objOf = new Map<string, object>();
  const node = (key: string, label: string, title: string, kind: GNode["kind"], obj?: object, isBad = false): void => {
    if (!nodes.has(key)) nodes.set(key, { key, label, title, kind, obj, bad: isBad, layer: 0, order: 0, x: 0, y: 0, w: 0 });
    if (obj && !objOf.has(key)) objOf.set(key, obj);
  };
  const madeAt = new Map<string, object>(), neededAt = new Map<string, object>();
  const resource = (r: Ref): void => {
    const p = bad.get(refKey(r));
    node(refKey(r), r.id, `${r.kind} ${r.id}${p ? `\n${PROBLEM_TEXT[p.kind]}` : ""}`, r.kind, undefined, Boolean(p));
  };
  // The same thing done in several rooms (Quill's combinations, say) is one node.
  const same = new Map<string, { key: string; where: string[] }>();
  for (const s of sites) {
    const sig = `${s.label}|${s.needs.map(refKey).join()}|${s.makes.map(refKey).join()}`;
    const first = same.get(sig);
    if (first) { first.where.push(s.where); s.key = first.key; }
    else same.set(sig, { key: s.key, where: [s.where] });
  }
  const whereOf = new Map([...same.values()].map((v) => [v.key, v.where]));
  for (const s of sites) {
    const where = whereOf.get(s.key)!;
    node(`site:${s.key}`, s.label, `${s.label}\n${where.join("\n")}`, "site", s.obj);
    for (const r of s.needs) {
      resource(r);
      if (!neededAt.has(refKey(r))) neededAt.set(refKey(r), s.obj);
      edge(refKey(r), `site:${s.key}`);
    }
    for (const r of s.makes) {
      resource(r);
      if (!madeAt.has(refKey(r))) madeAt.set(refKey(r), s.obj);
      edge(`site:${s.key}`, refKey(r));
    }
  }
  // An item or flag opens where it's first made, or else where it's first needed.
  for (const n of nodes.values()) if (n.kind !== "site") objOf.set(n.key, (madeAt.get(n.key) ?? neededAt.get(n.key))!);

  // Longest-path layers, ignoring edges that close a cycle.
  const out = new Map<string, string[]>();
  for (const [a, b] of edges) out.set(a, [...(out.get(a) ?? []), b]);
  const state = new Map<string, number>();
  const order: string[] = [];
  const visit = (k: string): void => {
    state.set(k, 1);
    for (const n of out.get(k) ?? []) if (!state.has(n)) visit(n);
    state.set(k, 2);
    order.push(k);
  };
  for (const k of nodes.keys()) if (!state.has(k)) visit(k);
  order.reverse();
  const rank = new Map(order.map((k, i) => [k, i]));
  const forward = edges.filter(([a, b]) => rank.get(a)! < rank.get(b)!);
  for (const k of order) {
    const n = nodes.get(k)!;
    for (const [a, b] of forward) if (a === k) nodes.get(b)!.layer = Math.max(nodes.get(b)!.layer, n.layer + 1);
  }
  // Pull sources right, next to what they feed.
  for (const k of [...order].reverse()) {
    const n = nodes.get(k)!;
    const next = forward.filter(([a]) => a === k).map(([, b]) => nodes.get(b)!.layer);
    if (next.length) n.layer = Math.max(n.layer, Math.min(...next) - 1);
  }
  const layers: GNode[][] = [];
  for (const n of nodes.values()) (layers[n.layer] ??= []).push(n);
  // Order each layer by the average position of its predecessors.
  const preds = new Map<string, string[]>();
  for (const [a, b] of forward) preds.set(b, [...(preds.get(b) ?? []), a]);
  layers.forEach((layer) => {
    layer.forEach((n, i) => {
      const ps = (preds.get(n.key) ?? []).map((p) => nodes.get(p)!.order);
      n.order = ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : i;
    });
    layer.sort((a, b) => a.order - b.order);
    layer.forEach((n, i) => (n.order = i));
  });

  const colW = 230, rowH = 34, pad = 20;
  const charW = 6.6;
  let height = 0;
  layers.forEach((layer, li) => {
    layer.forEach((n, i) => {
      n.w = Math.min(colW - 30, Math.max(60, n.label.length * charW + 18));
      n.x = pad + li * colW;
      n.y = pad + i * rowH;
      height = Math.max(height, n.y + rowH);
    });
  });
  const width = pad * 2 + layers.length * colW;
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + pad}" viewBox="0 0 ${width} ${height + pad}">`;
  for (const [a, b] of edges) {
    const p = nodes.get(a)!, q = nodes.get(b)!;
    const x1 = p.x + p.w, y1 = p.y + 12, x2 = q.x, y2 = q.y + 12;
    const back = x2 <= x1;
    const mx = back ? 60 : (x2 - x1) / 2;
    svg += `<path class="edge${back ? " back" : ""}" data-from="${esc(a)}" data-to="${esc(b)}" d="M${x1},${y1} C${x1 + mx},${y1} ${x2 - mx},${y2} ${x2},${y2}"/>`;
  }
  for (const n of nodes.values()) {
    const cls = `node ${n.kind}${n.bad ? " bad" : ""}`;
    svg += `<g class="${cls}" data-key="${esc(n.key)}" transform="translate(${n.x},${n.y})"><title>${esc(n.title)}</title>` +
      `<rect width="${n.w}" height="24" rx="${n.kind === "site" ? 3 : 12}"/><text x="${n.kind === "site" ? 8 : 10}" y="16">${esc(short(n.label, Math.floor((n.w - 14) / charW)))}</text></g>`;
  }
  svg += "</svg>";
  return { svg, objOf, count: { sites: sites.length, refs: nodes.size - sites.length } };
}
