/**
 * The `.adv` script compiler: plain-text adventure scripts in, the game's own data out
 * (Room, DialogueTree, Item, Tip, Combo, ActDef). Pure TypeScript with no DOM or Node APIs, so
 * the game, the in-browser editor and the node tools all run the same code.
 *
 * A script is a tree of indented lines (two spaces per level). Each line starts with a keyword;
 * what may follow, and which keywords a block accepts, depends on its parent. See
 * docs/SCRIPTING.md for the language reference.
 */

import type { Pt, Poly } from "../engine/walkbox";
import type {
  Area, Combo, Cond, DialogueChoice, DialogueNode, DialogueTree, Effect, Hotspot, Item, Room,
  SceneSprite, SoundId, VerbId,
} from "../game/types";
import { SOUNDS } from "../game/types";
import type { ActDef, EndingDef } from "../content/acts";
import type { Tip } from "../content/hints";

// ---------------------------------------------------------------- results

export interface SourceFile { path: string; text: string }

/** Where something was written: 1-based line and column, and the column just past its end. */
export interface Loc { file: string; line: number; col: number; end?: number }

export interface AdvError extends Loc { message: string; warning?: boolean }

export interface Compiled {
  rooms: Record<string, Room>;
  dialogues: Record<string, DialogueTree>;
  items: Record<string, Item>;
  tips: Tip[];
  combos: Combo[];
  acts: Record<number, ActDef>;
  ending: EndingDef | null;
  /** Named combo groups (`combos name`), included by rooms. */
  groups: Record<string, Combo[]>;
  errors: AdvError[];
  /**
   * Every compiled object (room, hotspot, state, combo, sprite, node, choice, effect, point,
   * polygon...) mapped to the script line that made it. Points and polygons also carry the
   * column span of their coordinates, so tools can rewrite them in place.
   */
  locs: WeakMap<object, Loc>;
}

export interface CompileOptions {
  /** Known speakers; when given, unknown speakers are errors. */
  characters?: Record<string, unknown>;
  /** Known image keys; when given, unknown backgrounds and sprites are errors. */
  images?: Record<string, unknown>;
  /** Known music tracks; when given, unknown room music and `music` effects are errors. */
  music?: Record<string, unknown>;
}

export const VERB_IDS: VerbId[] = [
  "open", "close", "push", "pull", "walk", "pickup", "talk", "give", "use", "look", "turnon", "turnoff",
];
export { SOUNDS };

// ---------------------------------------------------------------- tokens and lines

type Tok =
  | { t: "id"; v: string; col: number; end: number }
  | { t: "num"; v: number; col: number; end: number }
  | { t: "str"; v: string; col: number; end: number }
  | { t: "size"; w: number; h: number; col: number; end: number }
  | { t: "p"; v: string; col: number; end: number };

interface Line {
  file: string;
  line: number;
  indent: number;
  toks: Tok[];
  children: Line[];
}

class AdvSyntaxError extends Error {
  constructor(public loc: Loc, message: string) { super(message); }
}

const ID_START = /[A-Za-z_]/;
const ID_CHAR = /[A-Za-z0-9_:.]/;

function tokenize(file: string, lineNo: number, text: string, from: number): Tok[] {
  const toks: Tok[] = [];
  let i = from;
  const fail = (col: number, msg: string): never => {
    throw new AdvSyntaxError({ file, line: lineNo, col: col + 1 }, msg);
  };
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "#") break;
    const start = i;
    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
      if (i >= text.length) fail(start, "unterminated string");
      i++;
      let v: string;
      try { v = JSON.parse(text.slice(start, i)); } catch { v = fail(start, "bad escape in string"); }
      toks.push({ t: "str", v, col: start + 1, end: i + 1 });
      continue;
    }
    const size = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?![A-Za-z0-9_])/.exec(text.slice(i));
    if (size) {
      i += size[0].length;
      toks.push({ t: "size", w: Number(size[1]), h: Number(size[2]), col: start + 1, end: i + 1 });
      continue;
    }
    const num = /^-?\d+(?:\.\d+)?(?![A-Za-z_])/.exec(text.slice(i));
    if (num) {
      i += num[0].length;
      toks.push({ t: "num", v: Number(num[0]), col: start + 1, end: i + 1 });
      continue;
    }
    if (ID_START.test(c)) {
      while (i < text.length && ID_CHAR.test(text[i])) i++;
      // A trailing dot or colon is punctuation, not part of the name.
      while (i > start + 1 && /[.:]/.test(text[i - 1])) i--;
      toks.push({ t: "id", v: text.slice(start, i), col: start + 1, end: i + 1 });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === "->" || two === ">=") {
      i += 2;
      toks.push({ t: "p", v: two, col: start + 1, end: i + 1 });
      continue;
    }
    if ("(),=>:[]".includes(c)) {
      i++;
      toks.push({ t: "p", v: c, col: start + 1, end: i + 1 });
      continue;
    }
    fail(start, `unexpected character '${c}'`);
  }
  return toks;
}

/** Split a file into a tree of indented lines. */
function parseLines(file: string, text: string, errors: AdvError[]): Line[] {
  const root: Line = { file, line: 0, indent: -1, toks: [], children: [] };
  const stack: Line[] = [root];
  text.split(/\r?\n/).forEach((raw, n) => {
    const lineNo = n + 1;
    let indent = 0;
    while (indent < raw.length && raw[indent] === " ") indent++;
    if (raw[indent] === "\t") {
      errors.push({ file, line: lineNo, col: indent + 1, message: "indent with spaces, not tabs" });
      return;
    }
    let toks: Tok[];
    try { toks = tokenize(file, lineNo, raw, indent); } catch (e) {
      if (e instanceof AdvSyntaxError) { errors.push({ ...e.loc, message: e.message }); return; }
      throw e;
    }
    if (!toks.length) return;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    // Two spaces per level: an odd indent, or a jump of more than one level, is a slip of the
    // keyboard that would otherwise quietly nest a line under the wrong parent.
    const parent = stack[stack.length - 1];
    if (indent % 2 !== 0) {
      errors.push({ file, line: lineNo, col: indent + 1, message: "indent by two spaces per level (this line has an odd number)" });
    } else if (indent > parent.indent + 2 + (parent.indent < 0 ? -1 : 0)) {
      errors.push({ file, line: lineNo, col: indent + 1, message: "indented too far: nest one level (two spaces) at a time" });
    }
    const line: Line = { file, line: lineNo, indent, toks, children: [] };
    stack[stack.length - 1].children.push(line);
    stack.push(line);
  });
  return root.children;
}

// ---------------------------------------------------------------- token cursor

class Cur {
  i = 0;
  constructor(public ln: Line) {}
  get toks(): Tok[] { return this.ln.toks; }
  peek(o = 0): Tok | undefined { return this.toks[this.i + o]; }
  done(): boolean { return this.i >= this.toks.length; }
  isId(v?: string, o = 0): boolean { const t = this.peek(o); return t?.t === "id" && (v === undefined || t.v === v); }
  isP(v: string, o = 0): boolean { const t = this.peek(o); return t?.t === "p" && t.v === v; }
  loc(t?: Tok): Loc {
    const tok = t ?? this.peek() ?? this.toks[this.toks.length - 1];
    return { file: this.ln.file, line: this.ln.line, col: tok ? (this.done() && !t ? tok.end : tok.col) : this.ln.indent + 1 };
  }
  fail(msg: string, t?: Tok): never { throw new AdvSyntaxError(this.loc(t), msg); }
  next(): Tok {
    const t = this.peek();
    if (!t) this.fail("unexpected end of line");
    this.i++;
    return t;
  }
  id(what = "a name"): string {
    const t = this.peek();
    if (t?.t !== "id") this.fail(`expected ${what}`);
    this.i++;
    return t.v;
  }
  kw(v: string): void {
    if (!this.isId(v)) this.fail(`expected '${v}'`);
    this.i++;
  }
  p(v: string): Tok {
    if (!this.isP(v)) this.fail(`expected '${v}'`);
    return this.next();
  }
  num(what = "a number"): number {
    const t = this.peek();
    if (t?.t !== "num") this.fail(`expected ${what}`);
    this.i++;
    return t.v;
  }
  str(what = "a quoted string"): string {
    const t = this.peek();
    if (t?.t !== "str") this.fail(`expected ${what}`);
    this.i++;
    return t.v;
  }
  isStr(): boolean { return this.peek()?.t === "str"; }
  end(): void {
    if (!this.done()) this.fail(`unexpected '${tokText(this.peek()!)}'`);
  }
}

function tokText(t: Tok): string {
  switch (t.t) {
    case "str": return JSON.stringify(t.v);
    case "size": return `${t.w}x${t.h}`;
    default: return String(t.v);
  }
}

// ---------------------------------------------------------------- the compiler

export function compile(files: SourceFile[], options: CompileOptions = {}): Compiled {
  const out: Compiled = {
    rooms: {}, dialogues: {}, items: {}, tips: [], combos: [], acts: {}, ending: null, groups: {},
    errors: [], locs: new WeakMap(),
  };
  const { errors, locs } = out;
  const at = <T extends object>(obj: T, loc: Loc): T => { locs.set(obj, loc); return obj; };
  const lineLoc = (ln: Line): Loc => ({ file: ln.file, line: ln.line, col: ln.indent + 1 });
  /** Run one line's parser; a syntax error is recorded and that line skipped. */
  const guard = (fn: () => void): void => {
    try { fn(); } catch (e) {
      if (e instanceof AdvSyntaxError) errors.push({ ...e.loc, message: e.message });
      else throw e;
    }
  };
  const noChildren = (ln: Line): void => {
    if (ln.children.length) errors.push({ ...lineLoc(ln.children[0]), message: "nothing can be nested here" });
  };
  /** Room combo includes resolve after every group is known. */
  const includes: { room: Room; index: number; name: string; loc: Loc }[] = [];

  // -------------------------------------------------------------- values

  const value = (c: Cur): unknown => {
    const t = c.next();
    if (t.t === "num" || t.t === "str") return t.v;
    if (t.t === "id") {
      if (t.v === "true") return true;
      if (t.v === "false") return false;
      if (t.v === "unset") return undefined;
    }
    return c.fail("expected a value: true, false, unset, a number or a quoted string", t);
  };

  const point = (c: Cur, paren: boolean): Pt => {
    const open = paren ? c.p("(") : undefined;
    const first = c.peek();
    const x = c.num("an x coordinate");
    c.p(",");
    const yTok = c.peek();
    const y = c.num("a y coordinate");
    const close = paren ? c.p(")") : yTok;
    return at({ x, y }, { file: c.ln.file, line: c.ln.line, col: (open ?? first)!.col, end: close!.end });
  };

  const poly = (c: Cur): Poly => {
    const start = c.peek();
    const pts: Pt[] = [];
    while (c.isP("(")) pts.push(point(c, true));
    if (pts.length < 3) c.fail("a polygon needs at least three points, like (10,20) (30,20) (20,40)");
    const last = c.toks[c.i - 1];
    return at(pts, { file: c.ln.file, line: c.ln.line, col: start!.col, end: last.end });
  };

  // -------------------------------------------------------------- conditions

  const atom = (c: Cur): Cond => {
    const t = c.peek();
    if (!t) c.fail("expected a condition");
    if (t.t === "p" && t.v === "(") return group(c);
    if (t.t !== "id") c.fail("expected a condition, like has mushroom, not knows_key or aff >= 14");
    c.next();
    switch (t.v) {
      case "has": return { has: c.id("an item") };
      case "room": return { room: c.id("a room") };
      case "act": {
        if (c.isP("[")) {
          c.next();
          const list = [c.num("an act number")];
          while (c.isP(",")) { c.next(); list.push(c.num("an act number")); }
          c.p("]");
          return { act: list };
        }
        const n = c.num("an act number");
        if (!c.isP(",")) return { act: n };
        const list = [n];
        while (c.isP(",")) { c.next(); list.push(c.num("an act number")); }
        return { act: list };
      }
      case "not": {
        if (c.isId("has")) { c.next(); return { notHas: c.id("an item") }; }
        if (c.isP("(") || c.isId("act") || c.isId("room")) return { not: atom(c) };
        return { flag: c.id("a flag"), is: false };
      }
      case "and": case "or":
        return c.fail(`'${t.v}' needs a condition before it`, t);
    }
    if (c.isP("=")) { c.next(); return { flag: t.v, is: value(c) }; }
    if (c.isP(">=")) { c.next(); return { flag: t.v, atLeast: c.num() }; }
    return { flag: t.v };
  };

  /** `( a or b or c )` is any-of; `( a )` is just a. */
  const group = (c: Cur): Cond => {
    c.p("(");
    const list = [atom(c)];
    let ors = 0;
    while (c.isId("or")) { c.next(); ors++; list.push(atom(c)); }
    if (c.isId("and")) c.fail("only 'or' can join conditions inside parentheses");
    c.p(")");
    return ors ? { any: list } : list[0];
  };

  /** `a and b and c`, up to the end of the line or a `->`. */
  const conds = (c: Cur): Cond[] => {
    const list = [atom(c)];
    while (c.isId("and")) { c.next(); list.push(atom(c)); }
    if (c.isId("or")) c.fail("wrap 'or' conditions in parentheses: (a or b)");
    return list;
  };

  /** An optional `if ...` up to the end of the line (or a `->`). */
  const optIf = (c: Cur): Cond[] | undefined => {
    if (!c.isId("if")) return undefined;
    c.next();
    return conds(c);
  };

  // -------------------------------------------------------------- effects

  const effect = (ln: Line, c = new Cur(ln)): Effect => {
    const first = c.peek();
    const kw = c.id("an effect, like say, set, give, take, go, talk or note");
    let e: Effect;
    switch (kw) {
      case "say": e = { k: "say", text: c.str() }; break;
      case "set": {
        const id = c.id("a flag");
        if (c.isP("=")) { c.next(); e = { k: "flag", id, v: value(c) }; } else e = { k: "flag", id, v: true };
        break;
      }
      case "add": {
        const id = c.id("a counter flag");
        e = { k: "add", id, n: c.num("an amount") };
        break;
      }
      case "give": e = { k: "give", item: c.id("an item") }; break;
      case "take": e = { k: "take", item: c.id("an item") }; break;
      case "go": e = { k: "go", room: c.id("a room") }; break;
      case "talk": {
        const tree = c.id("a conversation");
        if (c.isId("at")) { c.next(); e = { k: "talk", tree, node: c.id("a node") }; } else e = { k: "talk", tree };
        break;
      }
      case "act": e = { k: "act", n: c.num("an act number") }; break;
      case "win": e = { k: "win" }; break;
      case "sound": {
        const t = c.peek();
        const id = c.id("a sound");
        if (!(SOUNDS as readonly string[]).includes(id)) c.fail(`no sound '${id}' (sounds: ${SOUNDS.join(", ")})`, t);
        e = { k: "sound", id: id as SoundId };
        break;
      }
      case "music": e = { k: "music", track: c.id("a music track") }; break;
      case "note": {
        const noteId = c.id("a casebook entry id");
        const text = c.str("the entry, in quotes");
        e = { k: "note", id: noteId, text };
        break;
      }
      default:
        return c.fail(`'${kw}' isn't an effect (say, set, add, give, take, go, talk, act, win, sound, music)`, first);
    }
    c.end();
    noChildren(ln);
    return at(e, { file: ln.file, line: ln.line, col: first!.col });
  };

  /** The effect lines nested under a line. `nothing` stands for an explicitly empty list. */
  const effects = (lines: Line[]): Effect[] => {
    const list: Effect[] = [];
    for (const ln of lines) {
      if (ln.toks.length === 1 && ln.toks[0].t === "id" && ln.toks[0].v === "nothing") { noChildren(ln); continue; }
      guard(() => list.push(effect(ln)));
    }
    return list;
  };
  const effectsAt = (ln: Line, lines: Line[]): Effect[] => at(effects(lines), lineLoc(ln));

  // -------------------------------------------------------------- shared blocks

  const isVerb = (v: string): v is VerbId => (VERB_IDS as string[]).includes(v);

  /** A verb line: `look "text"`, optionally followed by nested effects. */
  const verbLine = (ln: Line, c: Cur, verb: VerbId, target: { say?: Partial<Record<VerbId, string>>; do?: Partial<Record<VerbId, Effect[]>> }): void => {
    if (c.isStr()) {
      target.say ??= {};
      if (target.say[verb] !== undefined) c.fail(`'${verb}' already has a line`);
      target.say[verb] = c.str();
    }
    if (c.isP(":")) {
      // `talk: talk marta4` — one effect on the verb's own line.
      c.next();
      target.do ??= {};
      if (target.do[verb]) c.fail(`'${verb}' already has effects`, c.toks[0]);
      target.do[verb] = at([effect(ln, c)], lineLoc(ln));
      return;
    }
    c.end();
    if (ln.children.length) {
      target.do ??= {};
      if (target.do[verb]) c.fail(`'${verb}' already has effects`, c.toks[0]);
      target.do[verb] = effectsAt(ln, ln.children);
    } else if (target.say?.[verb] === undefined) {
      c.fail(`'${verb}' needs a line in quotes or nested effects`, c.toks[0]);
    }
  };

  /** `exit room`: open, use and walk all go there. */
  const exitLine = (c: Cur, target: { do?: Partial<Record<VerbId, Effect[]>> }): void => {
    const room = c.id("a room");
    c.end();
    target.do ??= {};
    for (const verb of ["open", "use", "walk"] as const) {
      if (target.do[verb]) c.fail(`'${verb}' already has effects, so 'exit' can't add them`);
      target.do[verb] = at([at({ k: "go", room } as Effect, lineLoc(c.ln))], lineLoc(c.ln));
    }
  };

  /** `use ITEM on TARGET [if ...]`, then the line in quotes, then effects. */
  const comboBlock = (ln: Line): Combo => {
    const c = new Cur(ln);
    c.kw("use");
    const item = c.id("an item");
    c.kw("on");
    const target = c.id("a hotspot or item");
    const cond = optIf(c);
    c.end();
    let say: string | undefined;
    let consume: boolean | undefined;
    const rest: Line[] = [];
    for (const child of ln.children) {
      const first = child.toks[0];
      if (first.t === "str" && say === undefined && !rest.length) {
        guard(() => { const cc = new Cur(child); say = cc.str(); cc.end(); noChildren(child); });
      } else if (first.t === "id" && first.v === "consume" && child.toks.length === 1) {
        consume = true;
      } else if (first.t === "id" && first.v === "keep" && child.toks.length === 1) {
        consume = false;
      } else rest.push(child);
    }
    if (say === undefined) c.fail(`'use ${item} on ${target}' needs its line in quotes on the next line`, c.toks[0]);
    const combo: Combo = { item, with: target, say: say as string };
    if (cond) combo.if = cond;
    if (consume !== undefined) combo.consume = consume;
    if (rest.length) combo.do = effectsAt(ln, rest);
    return at(combo, lineLoc(ln));
  };

  // -------------------------------------------------------------- rooms

  const roomBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("room");
    const id = c.id("a room id");
    const name = c.str("the room's name in quotes");
    c.end();
    if (out.rooms[id]) c.fail(`room '${id}' is defined twice`);
    const room = at({ id, name } as Room, lineLoc(ln));
    room.hotspots = [];
    const hotspotIds = new Set<string>();
    let perspective = false, entry = false;
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("a room property, hotspot or use");
      const leaf = (): void => { cc.end(); noChildren(child); };
      switch (kw) {
        case "bg": room.bg = cc.id("an image"); leaf(); break;
        case "width": room.width = cc.num(); leaf(); break;
        case "music": room.music = cc.id("a music track"); leaf(); break;
        case "ambience": {
          const a = cc.id("an ambience");
          if (a !== "gulls" && a !== "sea" && a !== "wind" && a !== "tavern") {
            cc.fail("ambience is gulls, sea, wind or tavern");
          }
          room.ambience = a as Room["ambience"]; leaf(); break;
        }
        case "grade": room.grade = cc.str("a CSS filter in quotes"); leaf(); break;
        case "stars": room.stars = { y: cc.num() }; leaf(); break;
        case "perspective": {
          cc.kw("horizon"); const horizon = cc.num();
          cc.kw("ref"); const refY = cc.num();
          cc.kw("height"); const refH = cc.num();
          room.perspective = at({ horizon, refY, refH }, lineLoc(child));
          perspective = true; leaf(); break;
        }
        case "scale": {
          const y = cc.num("a floor y");
          const h = cc.num("the height in pixels of a standing adult at that y");
          (room.scale ??= []).push({ y, h });
          room.scale = room.scale.sort((a, b) => a.y - b.y);
          leaf(); break;
        }
        case "walk": (room.walk ??= []).push(poly(cc)); leaf(); break;
        case "entry": room.entry = point(cc, false); entry = true; leaf(); break;
        case "arrive": {
          const from = cc.id("the room you arrive from");
          (room.arrive ??= {})[from] = point(cc, false);
          leaf(); break;
        }
        case "sprite": (room.sprites ??= []).push(spriteLine(cc)); noChildren(child); break;
        case "occluder": {
          cc.kw("floor");
          const y = cc.num("the floor line y");
          (room.occluders ??= []).push(at({ area: poly(cc), y }, lineLoc(child)));
          leaf(); break;
        }
        case "on": {
          cc.kw("enter"); cc.end();
          room.onEnter = effectsAt(child, child.children);
          break;
        }
        case "scene": {
          const cond = optIf(cc) ?? [];
          cc.end();
          (room.scenes ??= []).push(at({ if: cond, do: effectsAt(child, child.children) }, lineLoc(child)));
          break;
        }
        case "hotspot": {
          const hs = hotspotBlock(child);
          if (hotspotIds.has(hs.id)) cc.fail(`hotspot '${hs.id}' is defined twice in ${id}`);
          hotspotIds.add(hs.id);
          room.hotspots.push(hs);
          break;
        }
        case "use": (room.combos ??= []).push(comboBlock(child)); break;
        case "combos": {
          const name = cc.id("a combo group");
          leaf();
          room.combos ??= [];
          includes.push({ room, index: room.combos.length, name, loc: lineLoc(child) });
          break;
        }
        default: cc.fail(`'${kw}' doesn't belong in a room`, cc.toks[0]);
      }
    });
    const missing = [!room.bg && "bg", !perspective && "perspective", !room.walk && "walk", !entry && "entry"].filter(Boolean);
    if (missing.length) errors.push({ ...lineLoc(ln), message: `room '${id}' needs ${missing.join(", ")}` });
    room.walk ??= [];
    out.rooms[id] = room;
  };

  const spriteLine = (c: Cur): SceneSprite => {
    const key = c.id("an image");
    c.kw("at");
    const posStart = c.peek();
    const x = c.num("an x coordinate"); c.p(","); const yTok = c.peek(); const y = c.num("a y coordinate");
    c.kw("size");
    const s: SceneSprite = { key, x, y, size: c.num("a size (1 = a standing adult)") };
    while (!c.done()) {
      const t = c.peek()!;
      const kw = c.id("a sprite option");
      switch (kw) {
        case "visible": s.visible = c.num(); break;
        case "flip": s.flip = true; break;
        case "idle": s.idle = true; break;
        case "speaker": s.speaker = c.id("a character"); break;
        case "for": s.hotspot = c.id("a hotspot"); break;
        case "grade": s.grade = c.str("a CSS filter in quotes"); break;
        case "if": s.showIf = conds(c); break;
        default: c.fail(`'${kw}' isn't a sprite option (visible, flip, idle, speaker, for, grade, if)`, t);
      }
    }
    at(s, lineLoc(c.ln));
    // The position's own span, for tools that drag sprites about.
    locs.set(spritePos(s), { file: c.ln.file, line: c.ln.line, col: posStart!.col, end: yTok!.end });
    return s;
  };

  const hotspotBlock = (ln: Line): Hotspot => {
    const c = new Cur(ln);
    c.kw("hotspot");
    const id = c.id("a hotspot id");
    const name = c.str("the hotspot's name in quotes");
    c.end();
    const hs = at({ id, name, say: {} } as Hotspot, lineLoc(ln));
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("a hotspot property or verb");
      const leaf = (): void => { cc.end(); noChildren(child); };
      if (isVerb(kw)) { verbLine(child, cc, kw, hs); return; }
      switch (kw) {
        case "area": {
          if (cc.isP("(")) hs.area = poly(cc);
          else {
            const start = cc.peek();
            const x = cc.num("x"); cc.p(","); const y = cc.num("y");
            const size = cc.next();
            if (size.t !== "size") throw cc.fail("expected a size like 150x145", size);
            const rect = { x, y, w: size.w, h: size.h };
            hs.area = { rect } as Area;
            at(rect, { file: child.file, line: child.line, col: start!.col, end: size.end });
          }
          leaf(); break;
        }
        case "stand": hs.stand = point(cc, false); leaf(); break;
        case "show": cc.kw("if"); hs.showIf = at(conds(cc), lineLoc(child)); leaf(); break;
        case "person": hs.person = true; leaf(); break;
        case "thing": hs.person = false; leaf(); break;
        case "nowalk": hs.noWalk = true; leaf(); break;
        case "verb": {
          const v = cc.id("a verb");
          if (!isVerb(v)) throw cc.fail(`no verb '${v}'`);
          hs.verb = v; leaf(); break;
        }
        case "article": {
          const a = cc.id("the, a or none");
          if (a !== "the" && a !== "a" && a !== "none") throw cc.fail("article is the, a or none");
          hs.article = a; leaf(); break;
        }
        case "item": hs.item = cc.id("an item"); leaf(); break;
        case "exit": exitLine(cc, hs); noChildren(child); break;
        case "states": cc.kw("none"); hs.states = []; leaf(); break;
        case "state": {
          const cond = optIf(cc) ?? [];
          cc.end();
          const st: NonNullable<Hotspot["states"]>[number] = at({ if: cond }, lineLoc(child));
          for (const sl of child.children) guard(() => {
            const sc = new Cur(sl);
            const skw = sc.id("name, exit or a verb");
            if (isVerb(skw)) verbLine(sl, sc, skw, st);
            else if (skw === "name") { st.name = sc.str(); sc.end(); noChildren(sl); }
            else if (skw === "exit") { exitLine(sc, st); noChildren(sl); }
            else sc.fail(`'${skw}' doesn't belong in a state (name, exit or a verb)`, sc.toks[0]);
          });
          (hs.states ??= []).push(st);
          break;
        }
        default: cc.fail(`'${kw}' doesn't belong in a hotspot`, cc.toks[0]);
      }
    });
    if (!hs.area) errors.push({ ...lineLoc(ln), message: `hotspot '${id}' needs an area` });
    return hs;
  };

  // -------------------------------------------------------------- dialogue

  const dialogueBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("dialogue");
    const id = c.id("a conversation id");
    c.end();
    if (out.dialogues[id]) c.fail(`dialogue '${id}' is defined twice`);
    const tree = at({ id, start: "", nodes: {} } as DialogueTree, lineLoc(ln));
    let start: string | undefined;
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("start or node");
      if (kw === "start") { start = cc.id("a node"); cc.end(); noChildren(child); return; }
      if (kw !== "node") cc.fail(`'${kw}' doesn't belong in a dialogue (start or node)`, cc.toks[0]);
      const nid = cc.id("a node id");
      const speaker = cc.id("a speaker (a character, or narrator)");
      const text = cc.str("the line in quotes");
      cc.end();
      if (tree.nodes[nid]) cc.fail(`node '${nid}' is defined twice in ${id}`);
      const node = at({ id: nid, speaker, text } as DialogueNode, lineLoc(child));
      const doLines: Line[] = [];
      for (const nl of child.children) guard(() => {
        const nc = new Cur(nl);
        if (nc.isP(">")) {
          nc.next();
          const ch = { text: nc.str("the choice in quotes") } as DialogueChoice;
          const cond = optIf(nc);
          nc.p("->");
          ch.to = nc.id("a node, or END");
          nc.end();
          if (cond) ch.if = cond;
          if (nl.children.length) ch.do = effectsAt(nl, nl.children);
          (node.choices ??= []).push(at(ch, lineLoc(nl)));
        } else if (nc.isP("->")) {
          nc.next();
          if (node.next !== undefined) nc.fail("this node already has a next");
          node.next = nc.id("a node, or END");
          nc.end(); noChildren(nl);
        } else doLines.push(nl);
      });
      if (doLines.length) node.do = at(effects(doLines), lineLoc(doLines[0]));
      tree.nodes[nid] = node;
      start ??= nid;
    });
    if (!start) errors.push({ ...lineLoc(ln), message: `dialogue '${id}' has no nodes` });
    tree.start = start ?? "";
    out.dialogues[id] = tree;
  };

  // -------------------------------------------------------------- items, tips, acts

  const itemBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("item");
    const id = c.id("an item id");
    const name = c.str("the item's name in quotes");
    c.end();
    if (out.items[id]) c.fail(`item '${id}' is defined twice`);
    const item = at({ id, name } as Item, lineLoc(ln));
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("look or state");
      if (kw === "look") { item.look = cc.str(); cc.end(); noChildren(child); return; }
      if (kw !== "state") cc.fail(`'${kw}' doesn't belong in an item (look or state)`, cc.toks[0]);
      const st: NonNullable<Item["states"]>[number] = at({ if: optIf(cc) ?? [] }, lineLoc(child));
      cc.end();
      for (const sl of child.children) guard(() => {
        const sc = new Cur(sl);
        const skw = sc.id("name or look");
        if (skw === "name") st.name = sc.str();
        else if (skw === "look") st.look = sc.str();
        else sc.fail(`'${skw}' doesn't belong in an item state (name or look)`, sc.toks[0]);
        sc.end(); noChildren(sl);
      });
      (item.states ??= []).push(st);
    });
    if (item.look === undefined) errors.push({ ...lineLoc(ln), message: `item '${id}' needs a look line` });
    out.items[id] = item;
  };

  /** A block whose only child is a line in quotes (tips, ending lines). */
  const textChild = (ln: Line, c: Cur): string => {
    const lines = ln.children;
    if (lines.length !== 1) c.fail("put the text in quotes on the next line, indented", c.toks[0]);
    const tc = new Cur(lines[0]);
    const text = tc.str("the text in quotes");
    tc.end(); noChildren(lines[0]);
    return text;
  };

  const tipBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("tip");
    const cond = optIf(c) ?? [];
    c.end();
    out.tips.push(at({ if: cond, text: textChild(ln, c) }, lineLoc(ln)));
  };

  const actBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("act");
    const n = c.num("the act number");
    const title = c.str("the act's title in quotes");
    c.end();
    if (out.acts[n]) c.fail(`act ${n} is defined twice`);
    const act = at({ n, title } as ActDef, lineLoc(ln));
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("an act property");
      const leaf = (): void => { cc.end(); noChildren(child); };
      switch (kw) {
        case "start": {
          const room = cc.id("a room");
          if (cc.isId("at")) { cc.next(); act.start = { room, pos: point(cc, false) }; } else act.start = { room };
          leaf(); break;
        }
        case "intro": act.intro = cc.str(); leaf(); break;
        case "outro": act.outro = cc.str(); leaf(); break;
        case "caption": act.caption = cc.str(); leaf(); break;
        case "inventory": {
          const list: string[] = [];
          while (!cc.done()) list.push(cc.id("an item"));
          act.inventory = list; noChildren(child); break;
        }
        case "on": cc.kw("start"); cc.end(); act.onStart = effectsAt(child, child.children); break;
        default: cc.fail(`'${kw}' doesn't belong in an act`, cc.toks[0]);
      }
    });
    if (!act.start) errors.push({ ...lineLoc(ln), message: `act ${n} needs a start room` });
    out.acts[n] = act;
  };

  const endingBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("ending");
    const title = c.str("the closing title in quotes");
    c.end();
    if (out.ending) c.fail("the ending is defined twice");
    const ending = at({ title, lines: [] } as EndingDef, lineLoc(ln));
    for (const child of ln.children) guard(() => {
      const cc = new Cur(child);
      const kw = cc.id("title or line");
      if (kw === "title") {
        cc.kw("if");
        const cond = conds(cc);
        cc.end();
        (ending.titles ??= []).push(at({ if: cond, text: textChild(child, cc) }, lineLoc(child)));
      } else if (kw === "line") {
        const cond = optIf(cc);
        cc.end();
        const line: EndingDef["lines"][number] = cond ? { if: cond, text: textChild(child, cc) } : { text: textChild(child, cc) };
        ending.lines.push(at(line, lineLoc(child)));
      } else cc.fail(`'${kw}' doesn't belong in the ending (title or line)`, cc.toks[0]);
    });
    out.ending = ending;
  };

  const groupBlock = (ln: Line): void => {
    const c = new Cur(ln);
    c.kw("combos");
    const name = c.id("a group name");
    c.end();
    if (out.groups[name]) c.fail(`combo group '${name}' is defined twice`);
    const list: Combo[] = [];
    for (const child of ln.children) guard(() => {
      if (!new Cur(child).isId("use")) new Cur(child).fail("a combo group holds 'use X on Y' blocks");
      list.push(comboBlock(child));
    });
    out.groups[name] = at(list, lineLoc(ln));
  };

  // -------------------------------------------------------------- files

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    for (const ln of parseLines(f.path, f.text, errors)) guard(() => {
      const kw = new Cur(ln).id("room, hotspot, dialogue, item, tip, use, combos, act or ending");
      switch (kw) {
        case "room": roomBlock(ln); break;
        case "dialogue": dialogueBlock(ln); break;
        case "item": itemBlock(ln); break;
        case "tip": tipBlock(ln); break;
        case "use": out.combos.push(comboBlock(ln)); break;
        case "combos": groupBlock(ln); break;
        case "act": actBlock(ln); break;
        case "ending": endingBlock(ln); break;
        default: new Cur(ln).fail(`'${kw}' can't start a block here (room, dialogue, item, tip, use, combos, act, ending)`);
      }
    });
  }
  // Includes splice in back to front so earlier indices stay put.
  for (const inc of [...includes].reverse()) {
    const group = out.groups[inc.name];
    if (!group) { errors.push({ ...inc.loc, message: `no combo group '${inc.name}'` }); continue; }
    inc.room.combos!.splice(inc.index, 0, ...group);
  }

  validate(out, options);
  return out;
}

/** A stable key object for a sprite's position, so the position can have its own Loc. */
const spritePosKeys = new WeakMap<SceneSprite, object>();
export function spritePos(s: SceneSprite): object {
  let k = spritePosKeys.get(s);
  if (!k) { k = {}; spritePosKeys.set(s, k); }
  return k;
}

// ---------------------------------------------------------------- references

/** Check that every name resolves. Unknown names are errors; unused flags are warnings. */
function validate(out: Compiled, options: CompileOptions): void {
  const { rooms, dialogues, items, locs, errors } = out;
  const err = (obj: object | undefined, message: string, warning = false): void => {
    const loc = (obj && locs.get(obj)) ?? { file: "?", line: 0, col: 0 };
    errors.push({ ...loc, message, ...(warning ? { warning } : {}) });
  };
  const flagSet = new Map<string, object>(), flagRead = new Map<string, object>();
  const hasActs = Object.keys(out.acts).length > 0;
  const item = (where: object, id: string): void => { if (!items[id]) err(where, `no item '${id}'`); };
  const music = (where: object, track: string): void => {
    if (options.music && !options.music[track]) err(where, `no music track '${track}'`);
  };
  const cond = (where: object, list?: Cond[]): void => list?.forEach((c) => {
    if ("flag" in c) { if (!flagRead.has(c.flag)) flagRead.set(c.flag, where); }
    else if ("has" in c) item(where, c.has);
    else if ("notHas" in c) item(where, c.notHas);
    else if ("room" in c) { if (!rooms[c.room]) err(where, `no room '${c.room}'`); }
    else if ("act" in c) {
      for (const n of Array.isArray(c.act) ? c.act : [c.act]) if (hasActs && !out.acts[n]) err(where, `no act ${n}`);
    }
    else if ("any" in c) cond(where, c.any);
    else if ("not" in c) cond(where, [c.not]);
  });
  /** A list's first effect that hands the screen over (go, talk, act, win), if any. */
  const terminal = (list?: Effect[]): Effect | undefined => list?.find((e) => TERMINAL_EFFECTS.has(e.k));
  const fx = (list?: Effect[], fallback?: object): void => list?.forEach((e, i) => {
    const where = locs.has(e) ? e : fallback ?? e;
    if (i > 0 && TERMINAL_EFFECTS.has(list[i - 1].k) && !list.slice(0, i - 1).some((p) => TERMINAL_EFFECTS.has(p.k))) {
      err(where, `nothing runs after '${effectWord(list[i - 1])}': move this line above it`);
    }
    switch (e.k) {
      case "flag": case "add": if (!flagSet.has(e.id)) flagSet.set(e.id, where); break;
      case "give": case "take": item(where, e.item); break;
      case "go": if (!rooms[e.room]) err(where, `no room '${e.room}'`); break;
      case "talk": {
        const tree = dialogues[e.tree];
        if (!tree) err(where, `no dialogue '${e.tree}'`);
        else if (e.node && !tree.nodes[e.node]) err(where, `dialogue '${e.tree}' has no node '${e.node}'`);
        break;
      }
      case "act": if (hasActs && !out.acts[e.n]) err(where, `no act ${e.n}`); break;
      case "music": music(where, e.track); break;
    }
  });
  const combo = (c: Combo, room?: Room): void => {
    item(c, c.item);
    if (!items[c.with] && !room?.hotspots.some((h) => h.id === c.with)) {
      err(c, room ? `'${c.with}' is neither an item nor a hotspot in ${room.id}` : `no item '${c.with}'`);
    }
    cond(c, c.if); fx(c.do, c);
  };
  /** Warn about a combo that an earlier one for the same pair always beats (first match wins). */
  const warnedShadow = new Set<Combo>();
  const shadowed = (list: Combo[]): void => list.forEach((c, j) => {
    const earlier = list.slice(0, j).find((p) =>
      ((p.item === c.item && p.with === c.with) || (p.item === c.with && p.with === c.item)) &&
      (!p.if?.length || sameConds(p.if, c.if ?? [])));
    if (!earlier || warnedShadow.has(c)) return;
    warnedShadow.add(c);
    const at = locs.get(earlier);
    err(c, `this combination is never used: the one${at ? ` at ${at.file}:${at.line}` : ""} for the same pair always matches first`, true);
  });
  for (const room of Object.values(rooms)) {
    if (options.images && room.bg && !options.images[room.bg]) err(room, `no image '${room.bg}'`);
    if (room.music) music(room, room.music);
    for (const [from, pt] of Object.entries(room.arrive ?? {})) {
      if (!rooms[from]) err(pt, `no room '${from}' to arrive from`);
    }
    for (const s of room.sprites ?? []) {
      if (options.images && !options.images[s.key]) err(s, `no image '${s.key}'`);
      if (options.characters && s.speaker && !options.characters[s.speaker]) err(s, `no character '${s.speaker}'`);
      if (s.hotspot && !room.hotspots.some((h) => h.id === s.hotspot)) err(s, `no hotspot '${s.hotspot}' in ${room.id}`);
      cond(s, s.showIf);
    }
    fx(room.onEnter, room);
    for (const sc of room.scenes ?? []) { cond(sc, sc.if); fx(sc.do, sc); }
    for (const h of room.hotspots) {
      if (h.item) item(h, h.item);
      cond(h.showIf && locs.has(h.showIf) ? h.showIf : h, h.showIf);
      for (const st of [h, ...(h.states ?? [])]) {
        if ("if" in st) cond(st, st.if);
        for (const list of Object.values(st.do ?? {})) fx(list, st);
      }
    }
    for (const c of room.combos ?? []) combo(c, room);
    shadowed(room.combos ?? []);
  }
  for (const c of out.combos) combo(c);
  shadowed(out.combos);
  for (const tree of Object.values(dialogues)) {
    if (tree.start && !tree.nodes[tree.start]) err(tree, `no node '${tree.start}' to start at`);
    for (const node of Object.values(tree.nodes)) {
      if (options.characters && node.speaker !== "narrator" && !options.characters[node.speaker]) {
        err(node, `no character '${node.speaker}'`);
      }
      fx(node.do, node);
      if (node.next && node.next !== "END" && !tree.nodes[node.next]) err(node, `no node '${node.next}' in ${tree.id}`);
      if (node.choices?.length && node.next !== undefined) {
        err(node, `node '${node.id}' has both choices and '-> ${node.next}': the player picks a choice, so the next would never be used`);
      }
      const nodeEnd = terminal(node.do);
      if (nodeEnd && (node.choices?.length || (node.next !== undefined && node.next !== "END"))) {
        err(locs.has(nodeEnd) ? nodeEnd : node, `'${effectWord(nodeEnd)}' ends the conversation, so this node can't go on to ${node.choices?.length ? "choices" : `'${node.next}'`}`);
      }
      for (const ch of node.choices ?? []) {
        if (ch.to !== "END" && !tree.nodes[ch.to]) err(ch, `no node '${ch.to}' in ${tree.id}`);
        cond(ch, ch.if); fx(ch.do, ch);
        const end = terminal(ch.do);
        if (end && ch.to !== "END") {
          err(locs.has(end) ? end : ch, `'${effectWord(end)}' ends the conversation, so this choice must lead to END, not '${ch.to}'`);
        }
      }
      if (node.choices?.length && node.choices.every((ch) => ch.if?.length) && !complementary(node.choices)) {
        err(node, `every choice on node '${node.id}' has a condition: if none holds the conversation simply ends here`, true);
      }
    }
  }
  for (const it of Object.values(items)) for (const st of it.states ?? []) cond(st, st.if);
  for (const tip of out.tips) cond(tip, tip.if);
  for (const act of Object.values(out.acts)) {
    if (act.start && !rooms[act.start.room]) err(act, `no room '${act.start.room}'`);
    for (const id of act.inventory ?? []) item(act, id);
    fx(act.onStart, act);
  }
  for (const l of [...(out.ending?.lines ?? []), ...(out.ending?.titles ?? [])]) cond(l, l.if);
  // Flags the game sets by itself.
  const auto = (f: string): boolean => f.startsWith("seen:") || f.startsWith("looked:");
  for (const [f, where] of flagRead) if (!flagSet.has(f) && !auto(f)) err(where, `flag '${f}' is read but never set`);
  for (const [f, where] of flagSet) if (!flagRead.has(f)) err(where, `flag '${f}' is set but never read`, true);
}

/** Effects that hand the screen to something else; nothing after one in a list runs. */
const TERMINAL_EFFECTS: ReadonlySet<Effect["k"]> = new Set(["go", "talk", "act", "win"]);

/** How an effect is written, for messages. */
function effectWord(e: Effect): string {
  switch (e.k) {
    case "go": return `go ${e.room}`;
    case "talk": return `talk ${e.tree}${e.node ? " at " + e.node : ""}`;
    case "act": return `act ${e.n}`;
    default: return e.k;
  }
}

/** The opposite of a condition, written the way the compiler itself would write it. */
function negate(c: Cond): Cond {
  if ("has" in c) return { notHas: c.has };
  if ("notHas" in c) return { has: c.notHas };
  if ("not" in c) return c.not;
  if ("flag" in c && !("atLeast" in c)) {
    if (!("is" in c)) return { flag: c.flag, is: false };
    if (c.is === false) return { flag: c.flag };
  }
  return { not: c };
}
const sameConds = (a: Cond[], b: Cond[]): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Whether two of the choices' conditions are each other's opposite, so one of them always
 * shows: `if has x` beside `if not has x`, or `if a and b` beside `if (not a or not b)`.
 */
function complementary(choices: DialogueChoice[]): boolean {
  const conds = choices.map((ch) => ch.if ?? []);
  return conds.some((a) => {
    const opposite: Cond[] = a.length === 1 ? [negate(a[0])] : [{ any: a.map(negate) }];
    return conds.some((b) => b !== a && sameConds(b, opposite));
  });
}

/** `file:line:col: message`, for consoles and test output. */
export function formatError(e: AdvError): string {
  return `${e.file}:${e.line}:${e.col}: ${e.warning ? "warning: " : ""}${e.message}`;
}
