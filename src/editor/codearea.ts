/**
 * A small code editor: a plain textarea over a syntax-coloured copy of its text, with a line
 * number gutter that marks errors. No dependencies.
 */

export interface Mark { line: number; col: number; message: string; warning?: boolean }

const BLOCKS = new Set(["room", "hotspot", "dialogue", "node", "item", "tip", "act", "ending", "use", "combos", "state", "scene", "on", "title", "line"]);
const PROPS = new Set(["bg", "width", "music", "ambience", "grade", "stars", "perspective", "walk", "entry", "arrive", "sprite",
  "occluder", "area", "stand", "show", "person", "thing", "nowalk", "verb", "article", "item", "exit", "states", "name", "start",
  "intro", "outro", "caption", "inventory", "consume", "keep"]);
const VERBS = new Set(["open", "close", "push", "pull", "walk", "pickup", "talk", "give", "use", "look", "turnon", "turnoff"]);
const EFFECTS = new Set(["say", "set", "add", "give", "take", "go", "talk", "act", "win", "sound", "music", "nothing"]);
const WORDS = new Set(["if", "and", "or", "not", "has", "at", "on", "for", "size", "flip", "idle", "speaker", "visible",
  "horizon", "ref", "height", "floor", "true", "false", "unset", "enter", "none", "END"]);

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One line of script as coloured HTML. `parentIsVerb`: the line sits where effects go. */
function highlightLine(line: string, parentIsVerb: boolean): string {
  let out = "";
  let i = 0;
  let first = true;
  const lead = /^ */.exec(line)![0];
  out += lead;
  i = lead.length;
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === "#") { out += `<span class="c">${esc(rest)}</span>`; break; }
    if ((m = /^"(?:[^"\\]|\\.)*"?/.exec(rest))) { out += `<span class="s">${esc(m[0])}</span>`; i += m[0].length; first = false; continue; }
    if ((m = /^(?:->|>=|>)/.exec(rest))) { out += `<span class="o">${esc(m[0])}</span>`; i += m[0].length; first = false; continue; }
    if ((m = /^-?\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?/.exec(rest))) { out += `<span class="n">${m[0]}</span>`; i += m[0].length; first = false; continue; }
    if ((m = /^[A-Za-z_][A-Za-z0-9_:.]*/.exec(rest))) {
      const w = m[0];
      let cls = "";
      if (first) {
        if (parentIsVerb && EFFECTS.has(w)) cls = "e";
        else if (BLOCKS.has(w)) cls = "k";
        else if (VERBS.has(w)) cls = "v";
        else if (EFFECTS.has(w)) cls = "e";
        else if (PROPS.has(w)) cls = "p";
      } else if (WORDS.has(w)) cls = "w";
      out += cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w);
      i += w.length;
      first = false;
      continue;
    }
    // `talk: talk marta4`: an effect follows the colon.
    if (rest[0] === ":") { first = true; parentIsVerb = true; }
    out += esc(rest[0]);
    i++;
  }
  return out;
}

function highlight(text: string): string {
  const lines = text.split("\n");
  const indents: { indent: number; word: string }[] = [];
  return lines.map((line) => {
    const indent = /^ */.exec(line)![0].length;
    const word = line.trimStart().startsWith(">") ? ">" : /^ *([A-Za-z_]+)/.exec(line)?.[1] ?? "";
    while (indents.length && indents[indents.length - 1].indent >= indent) indents.pop();
    const parent = indents[indents.length - 1]?.word ?? "";
    if (line.trim()) indents.push({ indent, word });
    const underEffects = VERBS.has(parent) || ["on", "scene", "use", "node", ">"].includes(parent);
    return highlightLine(line, underEffects);
  }).join("\n") + "\n";
}

export class CodeArea {
  readonly el: HTMLElement;
  private gutter: HTMLElement;
  private pre: HTMLElement;
  readonly ta: HTMLTextAreaElement;
  private marks: Mark[] = [];
  private changeHandlers: (() => void)[] = [];

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "adv-code";
    this.el.innerHTML = `<div class="adv-gutter"></div><div class="adv-text"><pre class="adv-hl" aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea></div>`;
    this.gutter = this.el.querySelector(".adv-gutter")!;
    this.pre = this.el.querySelector(".adv-hl")!;
    this.ta = this.el.querySelector("textarea")!;
    this.ta.addEventListener("input", () => { this.render(); this.changeHandlers.forEach((h) => h()); });
    this.ta.addEventListener("scroll", () => this.syncScroll());
    this.ta.addEventListener("keydown", (e) => this.onKey(e));
  }

  get text(): string { return this.ta.value; }
  set text(v: string) {
    if (this.ta.value === v) return;
    const top = this.ta.scrollTop, left = this.ta.scrollLeft, sel = this.ta.selectionStart;
    this.ta.value = v;
    this.ta.selectionStart = this.ta.selectionEnd = Math.min(sel, v.length);
    this.render();
    this.ta.scrollTop = top;
    this.ta.scrollLeft = left;
    this.syncScroll();
  }
  /** Replace the text as a fresh document (scrolled to the top). */
  load(v: string): void {
    this.ta.value = v;
    this.ta.selectionStart = this.ta.selectionEnd = 0;
    this.render();
    this.ta.scrollTop = 0;
    this.ta.scrollLeft = 0;
    this.syncScroll();
  }
  onChange(h: () => void): void { this.changeHandlers.push(h); }

  setMarks(marks: Mark[]): void {
    this.marks = marks;
    this.renderGutter();
  }

  /** Put the caret at a line (1-based) and scroll it into view, a third of the way down. */
  goto(line: number, col = 1): void {
    const lines = this.ta.value.split("\n");
    const l = Math.max(1, Math.min(line, lines.length));
    let offset = 0;
    for (let i = 0; i < l - 1; i++) offset += lines[i].length + 1;
    offset += Math.max(0, Math.min(col - 1, lines[l - 1].length));
    this.ta.focus({ preventScroll: true });
    this.ta.setSelectionRange(offset, offset);
    const lh = this.lineHeight();
    this.ta.scrollTop = Math.max(0, (l - 1) * lh - this.ta.clientHeight / 3);
    this.ta.scrollLeft = 0;
    this.flash(l);
    this.syncScroll();
  }

  private flashLine = 0;
  private flash(line: number): void {
    this.flashLine = line;
    this.renderGutter();
    window.setTimeout(() => { if (this.flashLine === line) { this.flashLine = 0; this.renderGutter(); } }, 1600);
  }

  private lineHeight(): number {
    return parseFloat(getComputedStyle(this.ta).lineHeight) || 18;
  }

  private render(): void {
    this.pre.innerHTML = highlight(this.ta.value);
    this.renderGutter();
  }

  private renderGutter(): void {
    const n = this.ta.value.split("\n").length;
    const byLine = new Map<number, Mark[]>();
    for (const m of this.marks) byLine.set(m.line, [...(byLine.get(m.line) ?? []), m]);
    let html = "";
    for (let i = 1; i <= n; i++) {
      const ms = byLine.get(i);
      const cls = [ms ? (ms.every((m) => m.warning) ? "warn" : "err") : "", i === this.flashLine ? "flash" : ""].filter(Boolean).join(" ");
      const title = ms ? ` title="${esc(ms.map((m) => m.message).join("\n")).replace(/"/g, "&quot;")}"` : "";
      html += `<div${cls ? ` class="${cls}"` : ""}${title}>${i}</div>`;
    }
    this.gutter.innerHTML = html;
    this.syncScroll();
  }

  private syncScroll(): void {
    this.pre.style.transform = `translate(${-this.ta.scrollLeft}px, ${-this.ta.scrollTop}px)`;
    this.gutter.style.transform = `translateY(${-this.ta.scrollTop}px)`;
  }

  /** Tab indents by two spaces; Enter keeps the indent. */
  private onKey(e: KeyboardEvent): void {
    const ta = this.ta;
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = ta;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      if (s === end && !e.shiftKey) {
        ta.setRangeText("  ", s, end, "end");
      } else {
        const blockEnd = end > s && value[end - 1] === "\n" ? end - 1 : end;
        const block = value.slice(lineStart, blockEnd);
        const changed = e.shiftKey ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, "  ");
        ta.setRangeText(changed, lineStart, blockEnd, "select");
      }
      ta.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
      const indent = /^ */.exec(ta.value.slice(lineStart))![0];
      ta.setRangeText("\n" + indent, s, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    }
  }
}
