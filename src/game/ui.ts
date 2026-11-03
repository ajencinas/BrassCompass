/**
 * UI — the verb panel, sentence line, inventory, dialogue overlay and cursor.
 * Layout constants are shared between drawing and hit-testing so they can
 * never drift apart.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import { drawText, drawWrapped, wrap, typewriterSlice } from "../engine/text";
import { VERBS } from "./verbs";
import type { VerbId } from "./types";

export interface Chip { id: string; name: string }

/** Slots per inventory page. Beyond this the panel pages. */
export const INV_PER_PAGE = 8;

export interface PanelModel {
  verb: VerbId | null;
  objA: string | null;
  objB: string | null;
  narration: string | null;
  narrationFull: string | null;
  inventory: Chip[];
  /** Zero-based inventory page. */
  page: number;
  hoverVerb: VerbId | null;
  hoverItem: string | null;
  focusVerb: VerbId | null;
  focusItem: string | null;
  selectedItem: string | null;
  /** The natural verb for whatever the pointer is over: lit up as a suggestion. */
  suggestVerb: VerbId | null;
  /** "Talk to Marta": what a right-click on the hovered thing would do. */
  suggestLine: string | null;
}

export type PanelHit =
  | { kind: "verb"; id: VerbId }
  | { kind: "item"; id: string }
  | { kind: "page"; delta: number }
  | { kind: "sentence" }
  | null;

export function inventoryPages(count: number): number {
  return Math.max(1, Math.ceil(count / INV_PER_PAGE));
}

/** The items on the model's current page. */
export function pageItems(model: PanelModel): Chip[] {
  const page = Math.min(model.page, inventoryPages(model.inventory.length) - 1);
  return model.inventory.slice(page * INV_PER_PAGE, page * INV_PER_PAGE + INV_PER_PAGE);
}

// ---------------------------------------------------------------- layout

const PANEL_Y = SCENE_H;

const V_X = 40;
const V_Y = 892;
const V_W = 152;
const V_H = 40;
const V_GAP_X = 6;
const V_GAP_Y = 8;

const SENT_X = 40;
const SENT_Y = 992;
const SENT_W = 940;

const INV_X = 1010;
const INV_Y = 918;
const INV_W = 205;
const INV_H = 74;
const INV_GAP = 10;

export const COLORS = {
  verb: "#93a3bb",
  verbHover: "#ffffff",
  verbActive: "#e8c98a",
  sentence: "#7fd6d0",
  narration: "#d8cfb8",
  item: "#c9a2e0",
  itemHover: "#f0dcff",
  gold: "#c9a24a",
};

export function verbRect(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % 6;
  const row = Math.floor(i / 6);
  return {
    x: V_X + col * (V_W + V_GAP_X),
    y: V_Y + row * (V_H + V_GAP_Y),
    w: V_W,
    h: V_H,
  };
}

function itemRect(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    x: INV_X + col * (INV_W + INV_GAP),
    y: INV_Y + row * (INV_H + INV_GAP),
    w: INV_W,
    h: INV_H,
  };
}

// Pager, only drawn when there is more than one page.
const PAGE_PREV = { x: 1690, y: 880, w: 32, h: 28 };
const PAGE_NEXT = { x: 1782, y: 880, w: 32, h: 28 };

function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function hitTestPanel(x: number, y: number, model: PanelModel): PanelHit {
  if (y < PANEL_Y) return null;

  for (let i = 0; i < VERBS.length; i++) {
    if (inRect(x, y, verbRect(i))) return { kind: "verb", id: VERBS[i].id };
  }
  const shown = pageItems(model);
  for (let i = 0; i < shown.length; i++) {
    if (inRect(x, y, itemRect(i))) return { kind: "item", id: shown[i].id };
  }
  if (inventoryPages(model.inventory.length) > 1) {
    if (inRect(x, y, PAGE_PREV)) return { kind: "page", delta: -1 };
    if (inRect(x, y, PAGE_NEXT)) return { kind: "page", delta: 1 };
  }
  if (inRect(x, y, { x: SENT_X, y: SENT_Y - 8, w: SENT_W, h: 84 })) {
    return { kind: "sentence" };
  }
  return null;
}

// ---------------------------------------------------------------- drawing

export function drawPanel(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  // backdrop
  const g = ctx.createLinearGradient(0, PANEL_Y, 0, LOGICAL_H);
  g.addColorStop(0, "rgba(10,14,24,0.96)");
  g.addColorStop(1, "rgba(4,6,12,0.99)");
  ctx.fillStyle = g;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, LOGICAL_H - PANEL_Y);

  // gold rule along the top of the panel
  ctx.strokeStyle = "rgba(201,162,74,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PANEL_Y + 1);
  ctx.lineTo(LOGICAL_W, PANEL_Y + 1);
  ctx.stroke();

  // subtle inner shadow beneath the rule
  const sh = ctx.createLinearGradient(0, PANEL_Y, 0, PANEL_Y + 26);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, PANEL_Y, LOGICAL_W, 26);

  drawVerbs(ctx, model);
  drawSentence(ctx, model);
  drawInventory(ctx, model);
}

function drawVerbs(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  VERBS.forEach((v, i) => {
    const r = verbRect(i);
    const active = model.verb === v.id;
    const hover = model.hoverVerb === v.id;
    const focused = model.focusVerb === v.id;
    const suggested = !active && model.suggestVerb === v.id;

    ctx.fillStyle = "rgba(130,160,180,0.07)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(140,166,179,0.16)";
    ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    if (active) {
      ctx.fillStyle = "rgba(201,162,74,0.16)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(232,201,138,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
    } else if (suggested) {
      ctx.fillStyle = "rgba(232,201,138,0.13)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(232,201,138,0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
    } else if (hover) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (focused) {
      ctx.strokeStyle = "#fff3cf";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }

    drawText(ctx, v.label, r.x + 14, r.y + 9, {
      size: 21,
      color: focused || active || suggested ? COLORS.verbActive : hover ? COLORS.verbHover : COLORS.verb,
      weight: active ? "bold" : "normal",
      shadow: false,
    });
  });
}

function drawSentence(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  if (model.narration) {
    const lines = wrap(ctx, model.narrationFull ?? model.narration, 1760, { size: 26, color: "" });
    const height = Math.max(92, lines.length * 34 + 46);
    const top = SCENE_H - height - 12;
    ctx.fillStyle = "rgba(5,13,22,0.94)";
    ctx.fillRect(40, top, 1840, height);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(40, top, 4, height);
    drawWrapped(ctx, model.narration, 68, top + 20, {
      size: 26, color: COLORS.narration, maxWidth: 1760, lineHeight: 34,
    });
  }

  const verbLabel = model.verb ? VERBS.find((v) => v.id === model.verb)?.label ?? "" : "";
  const a = model.objA ?? "";
  const b = model.objB ?? "";
  const line1 = [verbLabel, a].filter(Boolean).join(" ");

  if (line1) {
    drawText(ctx, line1, SENT_X, SENT_Y + 4, {
      size: 27,
      color: COLORS.sentence,
      weight: "bold",
    });
  } else if (model.suggestLine) {
    drawText(ctx, model.suggestLine, SENT_X, SENT_Y + 4, {
      size: 27, color: "rgba(232,201,138,0.85)", weight: "bold",
    });
    drawText(ctx, "right-click to do it · or choose another verb", SENT_X, SENT_Y + 42, {
      size: 20, color: "#b6c9d0", shadow: false,
    });
  } else {
    drawText(ctx, "Click to walk · Choose a verb · J — casebook", SENT_X, SENT_Y + 6, {
      size: 22,
      color: "#a9bac7",
      weight: "normal",
      shadow: false,
    });
  }

  if (b) {
    drawText(ctx, `${model.verb === "give" ? "to" : "with"} ${b}`, SENT_X, SENT_Y + 42, {
      size: 25,
      color: COLORS.sentence,
    });
  } else if (model.objA && (model.verb === "use" || model.verb === "give")) {
    drawText(ctx, model.verb === "give" ? "Choose who receives it" : "Choose an object to use it with", SENT_X, SENT_Y + 42, {
      size: 20, color: "#b6c9d0", shadow: false,
    });
  }
}

function drawInventory(ctx: CanvasRenderingContext2D, model: PanelModel): void {
  drawText(ctx, "INVENTORY", INV_X, 890, {
    size: 13,
    color: "rgba(201,162,74,0.75)",
    weight: "bold",
    shadow: false,
  });
  ctx.font = "bold 13px Georgia, serif";
  const w = ctx.measureText("INVENTORY").width;
  ctx.fillStyle = "rgba(201,162,74,0.28)";
  ctx.fillRect(INV_X + w + 12, 897, 220, 1);

  if (model.inventory.length === 0) {
    drawText(ctx, "empty pockets", INV_X, INV_Y + 22, {
      size: 19,
      color: "rgba(160,150,170,0.5)",
      weight: "normal",
      shadow: false,
    });
    return;
  }

  const pages = inventoryPages(model.inventory.length);
  const page = Math.min(model.page, pages - 1);
  if (pages > 1) {
    const arrow = (r: { x: number; y: number; w: number; h: number }, glyph: string, enabled: boolean) => {
      ctx.fillStyle = enabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawText(ctx, glyph, r.x + r.w / 2, r.y + 3, {
        size: 20,
        color: enabled ? COLORS.item : "rgba(160,150,170,0.28)",
        align: "center",
        shadow: false,
      });
    };
    arrow(PAGE_PREV, "\u2039", page > 0);
    arrow(PAGE_NEXT, "\u203A", page < pages - 1);
    drawText(ctx, `${page + 1}/${pages}`, (PAGE_PREV.x + PAGE_NEXT.x + PAGE_NEXT.w) / 2, 886, {
      size: 16,
      color: "rgba(201,162,74,0.7)",
      align: "center",
      shadow: false,
    });
  }

  const shown = pageItems(model);
  shown.forEach((it, i) => {
    const r = itemRect(i);
    const selected = model.selectedItem === it.id;
    const hover = selected || model.hoverItem === it.id;
    const focused = model.focusItem === it.id;
    ctx.fillStyle = hover ? "rgba(201,162,74,0.18)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = hover ? "rgba(232,201,138,0.6)" : "rgba(201,162,74,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    if (selected) {
      ctx.fillStyle = COLORS.gold; ctx.fillRect(r.x, r.y, 4, r.h);
    }
    if (focused) {
      ctx.strokeStyle = "#fff3cf";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }
    const lines = wrap(ctx, it.name, r.w - 24, { size: 18, color: "" });
    lines.slice(0, 2).forEach((ln, li) => {
      drawText(ctx, ln, r.x + 12, r.y + 14 + li * 22, {
        size: 18,
        color: focused || hover ? COLORS.itemHover : COLORS.item,
        shadow: false,
      });
    });
  });
}

// ---------------------------------------------------------------- cursor

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string | null,
  rejected = false
): void {
  if (label) {
    ctx.save();
    ctx.font = "italic 20px Georgia, serif";
    const w = ctx.measureText(label).width;
    const bx = Math.max(8, Math.min(x + 24, LOGICAL_W - w - 28));
    const by = Math.max(8, Math.min(y + 22, LOGICAL_H - 44));
    ctx.fillStyle = "rgba(4,6,12,0.82)";
    ctx.fillRect(bx - 8, by - 4, w + 16, 30);
    ctx.fillStyle = "#f2e7c9";
    ctx.textBaseline = "top";
    ctx.fillText(label, bx, by + 2);
    ctx.restore();
  }
  if (rejected) {
    ctx.save();
    ctx.strokeStyle = "rgba(239,139,110,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 14, y + 16, 9, 0, Math.PI * 2);
    ctx.moveTo(x + 9, y + 11);
    ctx.lineTo(x + 19, y + 21);
    ctx.moveTo(x + 19, y + 11);
    ctx.lineTo(x + 9, y + 21);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- dialogue

export interface DialogueModel {
  speaker: string;
  /** Accent colour for the speaker name, from the character registry. */
  speakerAccent?: string | null;
  text: string;
  reveal: number;
  portraitKey: string | null;
  portrait: HTMLImageElement | null;
  choices: { text: string; index: number }[];
  hoverIndex: number;
  layout: DialogueLayout;
}

interface DialogueLayout {
  top: number; height: number; size: number; lineHeight: number;
  bodyY: number; rects: { x: number; y: number; w: number; h: number }[];
}

export function dialogueLayout(ctx: CanvasRenderingContext2D, text: string, choices: string[]): DialogueLayout {
  let size = 27, lineHeight = 38;
  let bodyHeight = 0, heights: number[] = [], height = 0;
  do {
    lineHeight = size + 11;
    bodyHeight = wrap(ctx, text, 1430, { size, color: "" }).length * lineHeight;
    heights = choices.map(c => Math.max(48, wrap(ctx, c, 1350, { size: size - 2, color: "" }).length * lineHeight + 16));
    height = Math.max(420, 140 + bodyHeight + heights.reduce((sum, h) => sum + h + 6, 0));
    if (height <= 940 || size <= 16) break;
    size--;
  } while (true);
  const top = Math.max(40, 1040 - height);
  let y = top + 88 + bodyHeight + 18;
  return { top, height, size, lineHeight, bodyY: top + 76,
    rects: heights.map(h => { const r = { x: 386, y, w: 1430, h }; y += h + 6; return r; }) };
}

export function drawDialogue(ctx: CanvasRenderingContext2D, m: DialogueModel): void {
  const l = m.layout;
  ctx.fillStyle = "rgba(2,4,10,0.72)";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = "rgba(10,23,34,0.98)";
  ctx.fillRect(60, l.top, 1800, l.height);
  ctx.strokeStyle = "#9a8052"; ctx.lineWidth = 2;
  ctx.strokeRect(61, l.top + 1, 1798, l.height - 2);
  if (m.portrait) {
    const p = { x: 96, y: l.top + 40, w: 248, h: Math.min(330, l.height - 80) };
    ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    const s = Math.max(p.w / m.portrait.width, p.h / m.portrait.height);
    ctx.drawImage(m.portrait, p.x + (p.w - m.portrait.width * s) / 2,
      p.y + (p.h - m.portrait.height * s) / 2, m.portrait.width * s, m.portrait.height * s);
    ctx.restore();
  }
  drawText(ctx, m.speaker, 386, l.top + 30, { size: 22, color: m.speakerAccent ?? "#edce91", weight: "bold" });
  drawWrapped(ctx, typewriterSlice(m.text, m.reveal), 386, l.bodyY, {
    size: l.size, color: "#f0e7d6", maxWidth: 1430, lineHeight: l.lineHeight,
  });
  m.choices.forEach((choice, i) => {
    const r = l.rects[i], hover = m.hoverIndex === i;
    ctx.fillStyle = hover ? "#304955" : "#152e3c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawText(ctx, String(i + 1), r.x + 14, r.y + 12, { size: l.size - 2, color: "#e8c98a" });
    drawWrapped(ctx, choice.text, r.x + 56, r.y + 10, {
      size: l.size - 2, color: hover ? "#ffffff" : "#cbd9de", maxWidth: 1350, lineHeight: l.lineHeight,
    });
  });
  drawText(ctx, m.choices.length ? "Number keys choose · Right-click closes" : "Click to continue",
    386, l.top + l.height - 28, { size: 16, color: "#a4b9c3", shadow: false });
}

export function dialogueHit(x: number, y: number, m: DialogueModel): number | null {
  const i = m.layout.rects.findIndex(r => inRect(x, y, r));
  return i < 0 ? null : i;
}
