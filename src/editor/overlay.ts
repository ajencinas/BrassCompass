/**
 * The Overlay panel: the game's calibration overlay (walk areas, occluders, hotspots, stand
 * points, horizon) on the live scene, with handles you can drag. A dropped handle moves the
 * live data at once and rewrites the coordinates in the script text, in place; Save keeps it.
 */

import type { Poly, Pt } from "../engine/walkbox";
import type { Rect, Room, SceneSprite } from "../game/types";
import { CONTENT, locOf } from "../content/content";
import { spritePos, type Loc } from "../adv/compile";
import type { EditorCtx } from "./editor";

type Owner =
  | { kind: "pt"; pt: Pt }
  | { kind: "poly"; poly: Poly }
  | { kind: "rect"; rect: Rect; corner: "move" | "size" }
  | { kind: "sprite"; sprite: SceneSprite };

interface Handle { at: Pt; label: string; owner: Owner; vertex?: Pt; walk?: boolean }

/** The text a handle's owner is written as. */
function text(o: Owner): string {
  switch (o.kind) {
    case "pt": return `${o.pt.x},${o.pt.y}`;
    case "poly": return o.poly.map((p) => `(${p.x},${p.y})`).join(" ");
    case "rect": return `${o.rect.x},${o.rect.y} ${o.rect.w}x${o.rect.h}`;
    case "sprite": return `${o.sprite.x},${o.sprite.y}`;
  }
}
const locKey = (o: Owner): object => (o.kind === "pt" ? o.pt : o.kind === "poly" ? o.poly : o.kind === "rect" ? o.rect : spritePos(o.sprite));
const numbers = (s: string): number[] => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

function handles(room: Room): Handle[] {
  const out: Handle[] = [];
  room.walk.forEach((poly, i) => poly.forEach((p, j) => out.push({ at: p, label: `walk ${i + 1} point ${j + 1}`, owner: { kind: "poly", poly }, vertex: p, walk: true })));
  (room.occluders ?? []).forEach((o, i) => o.area.forEach((p, j) => out.push({ at: p, label: `occluder ${i + 1} point ${j + 1}`, owner: { kind: "poly", poly: o.area }, vertex: p })));
  for (const h of room.hotspots) {
    if ("rect" in h.area) {
      const r = h.area.rect;
      out.push({ at: { x: r.x, y: r.y }, label: `${h.id} area (move)`, owner: { kind: "rect", rect: r, corner: "move" } });
      out.push({ at: { x: r.x + r.w, y: r.y + r.h }, label: `${h.id} area (size)`, owner: { kind: "rect", rect: r, corner: "size" } });
    } else {
      const poly = h.area as Poly;
      poly.forEach((p, j) => out.push({ at: p, label: `${h.id} area point ${j + 1}`, owner: { kind: "poly", poly }, vertex: p }));
    }
  }
  for (const s of room.sprites ?? []) out.push({ at: { x: s.x, y: s.y }, label: `sprite ${s.key}`, owner: { kind: "sprite", sprite: s } });
  out.push({ at: room.entry, label: "entry", owner: { kind: "pt", pt: room.entry } });
  for (const [from, p] of Object.entries(room.arrive ?? {})) out.push({ at: p, label: `arrive from ${from}`, owner: { kind: "pt", pt: p } });
  // Stand points last, so they win a tie: they're what you'll move most.
  for (const h of room.hotspots) if (h.stand) out.push({ at: h.stand, label: `${h.id} stand`, owner: { kind: "pt", pt: h.stand } });
  return out;
}

export class OverlayPanel {
  private drag = true;
  private dragging: { h: Handle; before: number[]; start: Pt; orig: Pt; rect?: Rect } | null = null;
  private edits: { label: string; loc: Loc; text: string }[] = [];
  private listEl: HTMLElement;
  private hoverEl: HTMLElement;

  constructor(private ctx: EditorCtx, private el: HTMLElement) {
    el.innerHTML = `
      <div class="adv-controls">
        <label><input type="checkbox" class="adv-ov"> Show overlay</label>
        <label><input type="checkbox" class="adv-drag" checked> Drag handles to edit</label>
        <button class="adv-saveall">Save changed files</button>
      </div>
      <p class="adv-help">
        <i style="background:#3f6"></i>walk area <i style="background:#f3c"></i>occluder and its floor line
        <i style="background:#39f"></i>hotspot and stand point <i style="background:#fff"></i>entry
        <i style="background:#fc6"></i>arrival points <i style="background:#ff0"></i>horizon.
        Drag any square; the script line is rewritten in place (then Save). Walk areas take effect when dropped.
      </p>
      <div class="adv-hover"></div>
      <h4>Edits</h4>
      <div class="adv-edits"></div>`;
    this.listEl = el.querySelector(".adv-edits")!;
    this.hoverEl = el.querySelector(".adv-hover")!;
    const ov = el.querySelector<HTMLInputElement>(".adv-ov")!;
    ov.onchange = () => ctx.game.devOverlay(ov.checked);
    el.querySelector<HTMLInputElement>(".adv-drag")!.onchange = (e) => { this.drag = (e.target as HTMLInputElement).checked; };
    el.querySelector<HTMLElement>(".adv-saveall")!.onclick = () => void this.saveAll();
    this.listEl.onclick = (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i;
      if (i !== undefined) ctx.open(this.edits[Number(i)].loc);
    };
    window.addEventListener("mousedown", (e) => this.down(e), true);
    window.addEventListener("mousemove", (e) => this.move(e), true);
    window.addEventListener("mouseup", (e) => this.up(e), true);
    this.refresh();
  }

  refresh(): void {
    (this.el.querySelector(".adv-ov") as HTMLInputElement).checked = this.ctx.game.devOverlay();
    this.listEl.innerHTML = this.edits.length
      ? this.edits.map((e, i) => `<div data-i="${i}">${e.loc.file}:${e.loc.line} · ${e.label} → <code>${e.text}</code></div>`).join("")
      : "<i>None yet.</i>";
  }

  private room(): Room | undefined {
    const id = this.ctx.game.devState().room;
    return id ? CONTENT.rooms[id] : undefined;
  }

  private nearest(e: MouseEvent): Handle | null {
    const room = this.room();
    const p = this.ctx.game.devWorld(e.clientX, e.clientY);
    if (!room || !p) return null;
    let best: Handle | null = null, bestD = 14;
    for (const h of handles(room)) {
      const d = Math.hypot(h.at.x - p.x, h.at.y - p.y);
      if (d <= bestD) { best = h; bestD = d; }
    }
    return best;
  }

  private active(e: MouseEvent): boolean {
    return this.drag && this.ctx.game.devOverlay() && (e.target as HTMLElement).id === "game" && !e.altKey;
  }

  private down(e: MouseEvent): void {
    if (e.button !== 0 || !this.active(e)) return;
    const h = this.nearest(e);
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    const loc = locOf(locKey(h.owner));
    if (!loc) { this.ctx.status(`No script position for ${h.label}.`, "warn"); return; }
    const start = this.ctx.game.devWorld(e.clientX, e.clientY)!;
    this.dragging = { h, before: numbers(text(h.owner)), start, orig: { ...h.at }, rect: h.owner.kind === "rect" ? { ...h.owner.rect } : undefined };
  }

  private move(e: MouseEvent): void {
    if (!this.dragging) {
      if (!this.active(e)) { if (this.ctx.game.devHandle) this.ctx.game.devHandle = null; return; }
      const h = this.nearest(e);
      this.ctx.game.devHandle = h ? h.at : null;
      this.hoverEl.textContent = h ? `${h.label}: ${Math.round(h.at.x)},${Math.round(h.at.y)}` : "";
      return;
    }
    const p = this.ctx.game.devWorld(e.clientX, e.clientY);
    if (!p) return;
    e.stopPropagation();
    const d = this.dragging;
    const x = Math.round(d.orig.x + p.x - d.start.x), y = Math.round(d.orig.y + p.y - d.start.y);
    const o = d.h.owner;
    if (o.kind === "pt") { o.pt.x = x; o.pt.y = y; }
    else if (o.kind === "poly") { d.h.vertex!.x = x; d.h.vertex!.y = y; }
    else if (o.kind === "sprite") { o.sprite.x = x; o.sprite.y = y; }
    else if (o.corner === "move") { o.rect.x = x; o.rect.y = y; }
    else { o.rect.w = Math.max(4, x - d.rect!.x); o.rect.h = Math.max(4, y - d.rect!.y); }
    d.h.at = o.kind === "pt" ? o.pt : d.h.vertex ?? { x, y };
    this.ctx.game.devHandle = d.h.at;
    this.hoverEl.textContent = `${d.h.label}: ${x},${y}`;
  }

  private up(e: MouseEvent): void {
    const d = this.dragging;
    if (!d) return;
    this.dragging = null;
    e.stopPropagation();
    const ok = this.writeBack(d.h, d.before);
    if (!ok) this.undo(d);
    if (d.h.walk) this.ctx.game.devReload();
    this.refresh();
  }

  private undo(d: NonNullable<OverlayPanel["dragging"]>): void {
    const o = d.h.owner;
    if (o.kind === "pt") Object.assign(o.pt, d.orig);
    else if (o.kind === "poly") Object.assign(d.h.vertex!, d.orig);
    else if (o.kind === "sprite") { o.sprite.x = d.orig.x; o.sprite.y = d.orig.y; }
    else Object.assign(o.rect, d.rect);
  }

  /** Rewrite the owner's coordinates in its script line; false if the line has moved on. */
  private writeBack(h: Handle, before: number[]): boolean {
    const loc = locOf(locKey(h.owner));
    const buf = loc && this.ctx.buffers.get(loc.file);
    if (!loc || !buf || loc.end === undefined) return false;
    const lines = buf.text.split("\n");
    const line = lines[loc.line - 1] ?? "";
    const span = line.slice(loc.col - 1, loc.end - 1);
    if (numbers(span).join() !== before.join()) {
      this.ctx.status(`${loc.file}:${loc.line} has changed since the last Apply: Apply first, then drag.`, "err");
      return false;
    }
    let next = text(h.owner);
    // Points written as (x,y) stay in parentheses.
    if (span.startsWith("(") && h.owner.kind === "pt") next = `(${next})`;
    if (next === span) return true;
    lines[loc.line - 1] = line.slice(0, loc.col - 1) + next + line.slice(loc.end - 1);
    loc.end = loc.col + next.length;
    buf.text = lines.join("\n");
    this.ctx.edited(loc.file);
    this.edits.push({ label: h.label, loc: { ...loc }, text: next });
    this.ctx.status(`${loc.file}:${loc.line}: ${h.label} → ${next}. Save to keep it.`);
    return true;
  }

  private async saveAll(): Promise<void> {
    const dirty = [...this.ctx.buffers.values()].filter((b) => b.text !== b.saved);
    for (const b of dirty) await this.ctx.save(b.path);
    if (!dirty.length) this.ctx.status("Nothing to save.");
  }
}
