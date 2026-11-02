/** The editor's observer panels: State, Log and the puzzle Map. */

import type { TraceEvent } from "../game/game";
import { CONTENT } from "../content/content";
import { effect as effectText } from "../adv/serialize";
import type { EditorCtx } from "./editor";
import { analyse, PROBLEM_TEXT, renderMap } from "./puzzle";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const show = (v: unknown): string => (v === undefined ? "unset" : typeof v === "string" ? JSON.stringify(v) : String(v));

// ---------------------------------------------------------------- State

export class StatePanel {
  active = false;
  private last = "";
  private names = "";
  private fill: () => void;
  private live: HTMLElement;

  constructor(private ctx: EditorCtx, private root: HTMLElement) {
    const el = root;
    el.innerHTML = `
      <div class="adv-controls">
        <label>Act <span class="adv-acts"></span></label>
        <label>Room <select class="adv-room"></select><button class="adv-go">Go</button></label>
        <label>Item <select class="adv-item"></select><button class="adv-give">Give</button></label>
        <label>Flag <input class="adv-flag" placeholder="name" size="14"> = <input class="adv-val" value="true" size="5"><button class="adv-set">Set</button></label>
      </div>
      <div class="adv-live"></div>`;
    this.live = el.querySelector(".adv-live")!;
    const q = <T extends HTMLElement>(s: string): T => el.querySelector(s) as T;
    this.fill = (): void => {
      q(".adv-acts").innerHTML = Object.values(CONTENT.acts).map((a) => `<button data-act="${a.n}" title="${esc(a.title)}">${a.n}</button>`).join("");
      q(".adv-room").innerHTML = Object.values(CONTENT.rooms).sort((a, b) => a.id.localeCompare(b.id))
        .map((r) => `<option value="${r.id}">${esc(r.id)} · ${esc(r.name)}</option>`).join("");
      q(".adv-item").innerHTML = Object.values(CONTENT.items).sort((a, b) => a.id.localeCompare(b.id))
        .map((i) => `<option value="${i.id}">${esc(i.id)}</option>`).join("");
    };
    this.fill();
    q(".adv-acts").onclick = (e) => {
      const n = Number((e.target as HTMLElement).dataset.act);
      if (n) { ctx.game.devAct(n); ctx.status(`Started act ${n}.`); this.refresh(); }
    };
    q(".adv-go").onclick = () => { ctx.game.devGoRoom(q<HTMLSelectElement>(".adv-room").value); this.refresh(); };
    q(".adv-give").onclick = () => { ctx.game.devGive(q<HTMLSelectElement>(".adv-item").value); this.refresh(); };
    q(".adv-set").onclick = () => {
      const id = q<HTMLInputElement>(".adv-flag").value.trim();
      const raw = q<HTMLInputElement>(".adv-val").value.trim();
      if (!id) return;
      let v: unknown = raw;
      if (raw === "true" || raw === "") v = true;
      else if (raw === "false") v = false;
      else if (raw === "unset") v = undefined;
      else if (!Number.isNaN(Number(raw))) v = Number(raw);
      ctx.game.devSetFlag(id, v);
      this.refresh();
    };
    this.live.onclick = (e) => {
      const t = e.target as HTMLElement;
      const g = ctx.game;
      if (t.dataset.take) { g.devTake(t.dataset.take); this.refresh(); }
      else if (t.dataset.toggle) {
        const v = g.devState().flags[t.dataset.toggle];
        g.devSetFlag(t.dataset.toggle, typeof v === "number" ? v + 1 : !(v === true));
        this.refresh();
      } else if (t.dataset.unset) { g.devSetFlag(t.dataset.unset, undefined); this.refresh(); }
      else if (t.dataset.tree) {
        const tree = CONTENT.dialogues[t.dataset.tree];
        ctx.openObj(t.dataset.node ? tree?.nodes[t.dataset.node] : tree);
      } else if (t.dataset.room) ctx.openObj(CONTENT.rooms[t.dataset.room]);
      else if (t.dataset.itemdef) ctx.openObj(CONTENT.items[t.dataset.itemdef]);
    };
    window.setInterval(() => { if (this.active) this.refresh(); }, 400);
  }

  refresh(): void {
    // New rooms, items or acts after an Apply.
    const names = [Object.keys(CONTENT.rooms), Object.keys(CONTENT.items), Object.keys(CONTENT.acts)].join("|");
    if (names !== this.names) { this.names = names; this.fill(); }
    const s = this.ctx.game.devState();
    const key = JSON.stringify(s);
    if (key === this.last) return;
    this.last = key;
    const roomSel = this.root.querySelector<HTMLSelectElement>(".adv-room")!;
    if (s.room && document.activeElement !== roomSel) roomSel.value = s.room;
    const flags = Object.entries(s.flags).sort(([a], [b]) => a.localeCompare(b));
    const group = (test: (k: string) => boolean) => flags.filter(([k]) => test(k));
    const story = group((k) => !k.startsWith("seen:") && !k.startsWith("looked:"));
    const seen = group((k) => k.startsWith("seen:"));
    const looked = group((k) => k.startsWith("looked:"));
    const chip = ([k, v]: [string, unknown]): string =>
      `<span class="adv-chip${v === false ? " off" : ""}"><a data-toggle="${esc(k)}" title="click to toggle">${esc(k)}${v === true ? "" : ` = ${esc(show(v))}`}</a><a data-unset="${esc(k)}" title="unset">×</a></span>`;
    const room = s.room ? CONTENT.rooms[s.room] : undefined;
    const where = s.title ? "title screen" : `${s.explore ? "exploring " : ""}<a data-room="${esc(s.room ?? "")}">${esc(s.room ?? "?")}</a> · ${esc(room?.name ?? "")} at ${s.x},${s.y}`;
    this.live.innerHTML = `
      <dl>
        <dt>Act</dt><dd>${s.act} · ${esc(CONTENT.acts[s.act]?.title ?? "")}</dd>
        <dt>Room</dt><dd>${where}</dd>
        <dt>Dialogue</dt><dd>${s.dialogue ? `<a data-tree="${esc(s.dialogue.tree)}" data-node="${esc(s.dialogue.node)}">${esc(s.dialogue.tree)} · ${esc(s.dialogue.node)}</a>` : "none"}</dd>
        <dt>Queued</dt><dd>${s.queue ? s.queue.map((e) => `<code>${esc(effectText(e))}</code>`).join(" → ") : "nothing"}</dd>
      </dl>
      <h4>Inventory (${s.inventory.length})</h4>
      <div class="adv-chips">${s.inventory.map((id) => `<span class="adv-chip item"><a data-itemdef="${esc(id)}" title="open its script">${esc(id)}</a><a data-take="${esc(id)}" title="take">×</a></span>`).join("") || "<i>empty</i>"}</div>
      <h4>Story flags (${story.length})</h4>
      <div class="adv-chips">${story.map(chip).join("") || "<i>none</i>"}</div>
      <details><summary>seen: (${seen.length})</summary><div class="adv-chips">${seen.map(chip).join("")}</div></details>
      <details><summary>looked: (${looked.length})</summary><div class="adv-chips">${looked.map(chip).join("")}</div></details>`;
    // Keep open <details> open across refreshes.
    this.live.querySelectorAll("details").forEach((d, i) => {
      if (this.openDetails.has(i)) d.open = true;
      d.addEventListener("toggle", () => { if (d.open) this.openDetails.add(i); else this.openDetails.delete(i); });
    });
  }
  private openDetails = new Set<number>();
}

// ---------------------------------------------------------------- Log

interface Entry { n: number; kind: string; text: string; obj?: object; depth: number }
const KINDS: [string, string][] = [["verb", "sentences"], ["say", "lines"], ["effect", "effects"], ["room", "rooms"], ["dialogue", "dialogue"]];

export class LogPanel {
  private entries: Entry[] = [];
  private list: HTMLElement;
  private filter: HTMLInputElement;
  private on = new Set(KINDS.map(([k]) => k));
  private n = 0;
  private pending = false;

  constructor(ctx: EditorCtx, el: HTMLElement) {
    el.innerHTML = `
      <div class="adv-controls">
        ${KINDS.map(([k, label]) => `<label class="adv-k-${k}"><input type="checkbox" data-kind="${k}" checked> ${label}</label>`).join("")}
        <input class="adv-logfilter" placeholder="filter" size="12">
        <button class="adv-copy">Copy</button><button class="adv-clear">Clear</button>
      </div>
      <div class="adv-log"></div>`;
    this.list = el.querySelector(".adv-log")!;
    this.filter = el.querySelector(".adv-logfilter")!;
    el.querySelectorAll<HTMLInputElement>("[data-kind]").forEach((cb) => {
      cb.onchange = () => { if (cb.checked) this.on.add(cb.dataset.kind!); else this.on.delete(cb.dataset.kind!); this.render(); };
    });
    this.filter.oninput = () => this.render();
    (el.querySelector(".adv-clear") as HTMLElement).onclick = () => { this.entries = []; this.render(); };
    (el.querySelector(".adv-copy") as HTMLElement).onclick = () => {
      void navigator.clipboard?.writeText(this.visible().map((e) => "  ".repeat(e.depth) + e.text).join("\n"));
      ctx.status("Log copied.");
    };
    this.list.onclick = (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>("[data-n]")?.dataset.n;
      const entry = this.entries.find((x) => String(x.n) === i);
      if (entry?.obj) ctx.openObj(entry.obj);
    };
  }

  add(e: TraceEvent): void {
    const push = (kind: string, text: string, obj?: object, depth = 1): void => {
      this.entries.push({ n: ++this.n, kind, text, obj, depth });
    };
    switch (e.kind) {
      case "verb": push("verb", e.text, e.hotspot, 0); break;
      case "combo": push("verb", e.text + (e.combo ? "" : "  (no combination: a refusal)"), e.combo, 0); break;
      case "say": push("say", `“${e.text}”`); break;
      case "effect": push("effect", effectText(e.effect), e.effect, 2); break;
      case "room": push("room", `→ room ${e.room}`, CONTENT.rooms[e.room], 0); break;
      case "node": push("dialogue", `${e.tree}.${e.node.id} · ${e.node.speaker}: “${e.node.text}”`, e.node); break;
      case "choice": push("dialogue", `> “${e.choice.text}” -> ${e.choice.to}`, e.choice, 0); break;
      case "act": push("room", `== act ${e.n} ==`, CONTENT.acts[e.n], 0); break;
    }
    if (this.entries.length > 3000) this.entries.splice(0, this.entries.length - 2500);
    // Batch renders: a burst of effects arrives in one frame.
    if (!this.pending) { this.pending = true; requestAnimationFrame(() => { this.pending = false; this.render(); }); }
  }

  private visible(): Entry[] {
    const q = this.filter.value.trim().toLowerCase();
    return this.entries.filter((e) => this.on.has(e.kind) && (!q || e.text.toLowerCase().includes(q)));
  }

  private render(): void {
    const atEnd = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 30;
    this.list.innerHTML = this.visible().slice(-600).map((e) =>
      `<div class="k-${e.kind}${e.obj ? " link" : ""}" data-n="${e.n}" style="padding-left:${6 + e.depth * 16}px">${esc(e.text)}</div>`).join("") ||
      `<div class="empty">Nothing yet. Play: every sentence, line, effect and room change shows up here.</div>`;
    if (atEnd) this.list.scrollTop = this.list.scrollHeight;
  }
}

// ---------------------------------------------------------------- Map

export class MapPanel {
  private act: number | "all" = 1;
  private body: HTMLElement;
  private issues: HTMLElement;
  private zoom = 1;
  private objOf = new Map<string, object>();

  constructor(private ctx: EditorCtx, private el: HTMLElement) {
    el.innerHTML = `
      <div class="adv-controls">
        <span class="adv-mapacts"></span>
        <label>Zoom <input type="range" class="adv-zoom" min="0.4" max="1.4" step="0.1" value="1"></label>
        <span class="adv-legend"><i class="item"></i>item <i class="flag"></i>flag <i class="site"></i>where it happens <i class="bad"></i>problem</span>
      </div>
      <div class="adv-issues"></div>
      <div class="adv-map"></div>`;
    this.body = el.querySelector(".adv-map")!;
    this.issues = el.querySelector(".adv-issues")!;
    el.querySelector<HTMLElement>(".adv-mapacts")!.onclick = (e) => {
      const a = (e.target as HTMLElement).dataset.act;
      if (a) { this.act = a === "all" ? "all" : Number(a); this.refresh(); }
    };
    el.querySelector<HTMLInputElement>(".adv-zoom")!.oninput = (e) => {
      this.zoom = Number((e.target as HTMLInputElement).value);
      this.applyZoom();
    };
    this.body.onclick = (e) => {
      const key = (e.target as Element).closest("[data-key]")?.getAttribute("data-key");
      if (key) ctx.openObj(this.objOf.get(key));
    };
    this.body.onmouseover = (e) => {
      const key = (e.target as Element).closest("[data-key]")?.getAttribute("data-key") ?? null;
      this.body.querySelectorAll(".edge").forEach((p) => {
        p.classList.toggle("hot", key !== null && (p.getAttribute("data-from") === key || p.getAttribute("data-to") === key));
      });
    };
  }

  refresh(): void {
    if (!this.el.classList.contains("on")) return;
    const acts = Object.values(CONTENT.acts).map((a) => a.n);
    this.el.querySelector(".adv-mapacts")!.innerHTML = [...acts.map(String), "all"]
      .map((a) => `<button data-act="${a}" class="${String(this.act) === a ? "on" : ""}">${a === "all" ? "All" : `Act ${a}`}</button>`).join("");
    const { problems, sites } = analyse();
    const unreached = sites.filter((s) => !s.acts.size);
    const parts = [
      ...problems.map((p, i) => `<a data-p="${i}">${esc(p.ref.id)}</a> <small>${PROBLEM_TEXT[p.kind]}</small>`),
      ...unreached.map((s, i) => `<a data-u="${i}">${esc(s.label)}</a> <small>no act reaches this (${esc(s.where)})</small>`),
    ];
    this.issues.innerHTML = parts.length
      ? `<b>${parts.length} problem${parts.length > 1 ? "s" : ""}:</b> ` + parts.join(" · ")
      : "No problems: every item can be obtained and is used, every flag read is set and every flag set is read, and every place can be reached in some act.";
    this.issues.querySelectorAll<HTMLElement>("[data-p]").forEach((a) => { a.onclick = () => this.ctx.openObj(problems[Number(a.dataset.p)].obj); });
    this.issues.querySelectorAll<HTMLElement>("[data-u]").forEach((a) => { a.onclick = () => this.ctx.openObj(unreached[Number(a.dataset.u)].obj); });
    const { svg, objOf, count } = renderMap(this.act);
    this.objOf = objOf;
    this.body.innerHTML = svg;
    this.body.title = `${count.refs} items and flags, ${count.sites} places`;
    this.applyZoom();
  }

  private applyZoom(): void {
    const svg = this.body.querySelector("svg");
    if (!svg) return;
    const w = Number(svg.getAttribute("viewBox")!.split(" ")[2]), h = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    svg.setAttribute("width", String(w * this.zoom));
    svg.setAttribute("height", String(h * this.zoom));
  }
}
