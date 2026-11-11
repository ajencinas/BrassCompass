/**
 * The title screen. Pure rendering plus the button layout, which the hit-test also uses — so
 * the two can never drift apart.
 */

import { LOGICAL_W, LOGICAL_H } from "../engine/view";
import { drawText } from "../engine/text";
import { fitText } from "./ui";

/** Menu buttons, and the two answers of the new-voyage question. */
export type TitleId = "continue" | "start" | "explore" | "keep" | "confirm";

export interface TitleButton {
  id: TitleId;
  label: string;
  /** A second, smaller line under the label: Continue's "Act II · The Crew". */
  sub?: string;
  /** Top edge of the button in logical pixels. */
  y: number;
}

export const TITLE_BUTTON = { width: 400, height: 62, left: 760, right: 1160 };

const FIRST_Y = 670;
const STEP = 88;
/** How far below "Keep my voyage" the destructive answer sits: clear of any button above it. */
const CONFIRM_DROP = 120;

/**
 * Buttons top to bottom. With a save, Continue comes first (it is what a returning player
 * wants, and what Enter does); Chapter select (walk any scene, nothing saved) once the voyage
 * has been finished, or always on the dev server.
 *
 * `confirmNew` replaces the menu with the question New Voyage asks over a save. "Keep my voyage"
 * takes New Voyage's place, under the pointer that just chose it, and "Yes — start anew" sits
 * well below: a second click, a double-click or an impatient re-click lands on the safe answer.
 *
 * `saveLabel` is Continue's second line: what the save would carry on into. The button is the same
 * size with or without it, so the layout never moves between a save and no save.
 */
export function titleButtons(hasSave: boolean, chapters: boolean, confirmNew = false, saveLabel: string | null = null): TitleButton[] {
  const list: { id: TitleId; label: string; sub?: string }[] = [
    ...(hasSave ? [{ id: "continue" as const, label: "Continue", sub: saveLabel ?? undefined }] : []),
    { id: "start", label: "New Voyage" },
    ...(chapters ? [{ id: "explore" as const, label: "Chapter select" }] : []),
  ];
  const menu = list.map((b, i) => ({ ...b, y: FIRST_Y + i * STEP }));
  if (!confirmNew) return menu;
  const at = menu.find((b) => b.id === "start")!.y;
  return [
    { id: "keep", label: "Keep my voyage", y: at },
    { id: "confirm", label: "Yes — start anew", y: at + CONFIRM_DROP },
  ];
}

/** What Enter does with nothing focused: carry on if there's a voyage to carry on. */
export function defaultTitleButton(buttons: TitleButton[]): TitleId {
  return buttons.some((b) => b.id === "keep") ? "keep"
    : buttons.some((b) => b.id === "continue") ? "continue" : "start";
}

/** Whether a point is on the button whose top edge is `top`. */
export function hitTitleButton(top: number, x: number, y: number): boolean {
  return x > TITLE_BUTTON.left && x < TITLE_BUTTON.right && y > top - 10 && y < top + 68;
}

export interface TitleView {
  bg?: HTMLImageElement;
  buttons: TitleButton[];
  focus: TitleId | null;
  /** The Adventure Editor is a dev-server feature; don't advertise it in a build. */
  dev: boolean;
  /** New Voyage is waiting for its confirmation. */
  confirmNew?: boolean;
  /** What the save holds ("Act II · The Crew"), named in the confirmation. */
  saveLabel?: string | null;
  /** Seconds since the title appeared: it fades up from black, then breathes. */
  time?: number;
  /** Reduced motion: no drift, no glint, no swinging needle. */
  reduced?: boolean;
  /** The player's text scale: the title's chrome (tagline, buttons, help) grows with it. */
  scale?: number;
  /** The focus marker's last move: from which button top (null: it was nowhere), and when. */
  needle?: { fromY: number | null; since: number };
  /**
   * The casebook's collection, set under the menu: deeds entered across voyages, out of all the
   * deeds this build knows. Hidden while the new-voyage question has the menu's place.
   */
  casebook?: { filed: number; total: number } | null;
  /**
   * Drawn over the painting, inside its drift, so whatever it adds (the harbour's own lights,
   * say) moves with the picture.
   */
  decorate?: (ctx: CanvasRenderingContext2D) => void;
}

/** The dark wash over the painting: built once per context, not once a frame. */
const washes = new WeakMap<CanvasRenderingContext2D, CanvasGradient>();
function wash(ctx: CanvasRenderingContext2D): CanvasGradient {
  let g = washes.get(ctx);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, "rgba(3,5,12,0.72)");
    g.addColorStop(0.45, "rgba(3,5,12,0.35)");
    g.addColorStop(1, "rgba(3,5,12,0.88)");
    washes.set(ctx, g);
  }
  return g;
}

/** Seconds the title takes to come up from black. Input works from the first frame. */
const FADE_UP = 1.3;
/** A glint runs across the lettering every GLINT_EVERY seconds, taking GLINT_TAKES. */
const GLINT_EVERY = 9;
const GLINT_TAKES = 1.5;

/** The lettering, drawn once into its own canvas so a glint can be laid over just the letters. */
const LETTERS = { x: LOGICAL_W / 2 - 600, y: 280, w: 1200, h: 240 };
let letters: HTMLCanvasElement | null = null;
let glintScratch: HTMLCanvasElement | null = null;
let band: HTMLCanvasElement | null = null;
function lettering(): HTMLCanvasElement | null {
  if (letters) return letters;
  const c = document.createElement("canvas");
  c.width = LETTERS.w;
  c.height = LETTERS.h;
  const g = c.getContext("2d");
  if (!g) return null;
  drawText(g, "THE BRASS", LETTERS.w / 2, 300 - LETTERS.y, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
  drawText(g, "COMPASS", LETTERS.w / 2, 400 - LETTERS.y, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
  letters = c;
  return c;
}
function glintBand(): HTMLCanvasElement | null {
  if (band) return band;
  const c = document.createElement("canvas");
  c.width = 220;
  c.height = LETTERS.h;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0, "rgba(255,244,214,0)");
  grad.addColorStop(0.5, "rgba(255,244,214,0.95)");
  grad.addColorStop(1, "rgba(255,244,214,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  band = c;
  return c;
}

/** The title lettering, with a light running across it now and then. */
function drawLettering(ctx: CanvasRenderingContext2D, t: number, still: boolean): void {
  const art = lettering();
  if (!art) {
    drawText(ctx, "THE BRASS", LOGICAL_W / 2, 300, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
    drawText(ctx, "COMPASS", LOGICAL_W / 2, 400, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
    return;
  }
  ctx.drawImage(art, LETTERS.x, LETTERS.y);
  if (still || t < FADE_UP + 0.5) return;
  const p = ((t - FADE_UP - 0.5) % GLINT_EVERY) / GLINT_TAKES;
  const light = glintBand();
  if (p > 1 || !light) return;
  glintScratch ??= document.createElement("canvas");
  const sc = glintScratch;
  if (sc.width !== LETTERS.w) { sc.width = LETTERS.w; sc.height = LETTERS.h; }
  const g = sc.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, sc.width, sc.height);
  g.drawImage(art, 0, 0);
  // Only where there are letters: the band, slanted, laid over them.
  g.globalCompositeOperation = "source-atop";
  g.setTransform(1, 0, -0.35, 1, -260 + p * (LETTERS.w + 520), 0);
  g.drawImage(light, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5 * Math.sin(Math.PI * p);
  ctx.drawImage(sc, LETTERS.x, LETTERS.y);
  ctx.restore();
}

/**
 * The focus marker: a small compass whose needle points at the button Enter would press. When
 * focus moves it travels there and swings, settling like a real needle.
 */
function drawNeedle(ctx: CanvasRenderingContext2D, view: TitleView, t: number, still: boolean): void {
  const target = view.buttons.find((b) => b.id === view.focus) ?? view.buttons.find((b) => b.id === defaultTitleButton(view.buttons));
  if (!target) return;
  const since = view.needle?.since ?? -99;
  const from = view.needle?.fromY ?? target.y;
  const tau = Math.max(0, t - since);
  const travel = still ? 1 : 1 - Math.pow(1 - Math.min(1, tau / 0.28), 3);
  const y = from + (target.y - from) * travel + TITLE_BUTTON.height / 2;
  const swing = still ? 0 : 0.6 * Math.exp(-4.2 * tau) * Math.cos(13 * tau);
  const x = TITLE_BUTTON.left - 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(10,16,28,0.75)";
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(232,201,138,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.rotate(swing);
  ctx.fillStyle = "#e8c98a";
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(0, -5.5); ctx.lineTo(0, 5.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#b5452e";
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -5.5); ctx.lineTo(0, 5.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#0b1422";
  ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawTitle(ctx: CanvasRenderingContext2D, view: TitleView): void {
  const t = view.time ?? 1e3;
  const still = view.reduced ?? false;
  const scale = Math.max(1, view.scale ?? 1);
  const bg = view.bg;
  ctx.save();
  if (!still) {
    // The painting drifts and breathes, slowly; never so far that one of its edges shows.
    const k = 1.035 + 0.01 * Math.sin(t * 0.13);
    ctx.translate(LOGICAL_W / 2 + Math.sin(t * 0.09) * 22, LOGICAL_H / 2 + Math.cos(t * 0.11) * 7);
    ctx.scale(k, k);
    ctx.translate(-LOGICAL_W / 2, -LOGICAL_H / 2);
  }
  if (bg) {
    const width = LOGICAL_H * (bg.width / bg.height);
    ctx.drawImage(bg, (LOGICAL_W - width) / 2, 0, width, LOGICAL_H);
  } else {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
  view.decorate?.(ctx);
  ctx.restore();

  ctx.fillStyle = wash(ctx);
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawLettering(ctx, t, still);
  const tagline = fitText(ctx, "a tale of Dreadwater Isle", 1600, Math.round(26 * scale), 16);
  drawText(ctx, tagline.text, LOGICAL_W / 2, 530, {
    size: tagline.size, color: "rgba(200,215,235,0.75)", align: "center", weight: "normal",
  });

  if (view.confirmNew) drawConfirmCard(ctx, view);
  for (const b of view.buttons) drawButton(ctx, b.label, b.y, view.focus === b.id, b.id === "confirm", b.sub, scale);
  drawNeedle(ctx, view, t, still);

  // next-level: casebook — under the menu, a promise that the optional layer is remembered.
  // The tally keeps every voyage, not just this one.
  if (view.casebook && !view.confirmNew && view.buttons.length) {
    const last = view.buttons[view.buttons.length - 1];
    const y = Math.min(956, last.y + TITLE_BUTTON.height + 20);
    const tally = fitText(ctx, `Ship's log: ${view.casebook.filed} of ${view.casebook.total} entries`,
      1600, Math.round(20 * scale), 14);
    drawText(ctx, tally.text, LOGICAL_W / 2, y, {
      size: tally.size, color: "#c3b08a", align: "center",
    });
  }

  const help = fitText(ctx, "Click to act  ·  Tab / arrows + Enter  ·  right-click to look  ·  hold Q for exits and props",
    1840, Math.round(20 * scale), 14);
  drawText(ctx, help.text, LOGICAL_W / 2, 982, {
    size: help.size, color: "#dbe3ee", align: "center",
  });
  const dev = view.dev ? "    ·    F2 — Adventure Editor" : "";
  const keys = fitText(ctx, `Tab / arrows, Enter — keyboard    ·    H — tip    ·    Escape — settings    ·    M — mute${dev}`,
    1840, Math.round(20 * scale), 14);
  drawText(ctx, keys.text, LOGICAL_W / 2, 1018, {
    size: keys.size, color: "#c9d3e0", align: "center",
  });

  if (t < FADE_UP) {
    // Up from black. Nothing waits on it: the buttons work from the first frame.
    const a = 1 - t / FADE_UP;
    ctx.fillStyle = `rgba(0,0,0,${(a * a).toFixed(3)})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
}

/** The question, set on a card that frames both answers. */
function drawConfirmCard(ctx: CanvasRenderingContext2D, view: TitleView): void {
  const keep = view.buttons.find((b) => b.id === "keep");
  const confirm = view.buttons.find((b) => b.id === "confirm");
  if (!keep || !confirm) return;
  // The card widens and its type grows with the scale, but its top edge stays below the painted
  // lettering and its answers keep their own, fixed, hit boxes. The three lines are stacked by
  // their real heights so a larger size can never run them into each other or into the buttons.
  const scale = Math.max(1, view.scale ?? 1);
  const top = keep.y - 158, bottom = confirm.y + TITLE_BUTTON.height + 22;
  const w = Math.round(760 * scale);
  ctx.fillStyle = "rgba(14,9,10,0.9)";
  ctx.fillRect(LOGICAL_W / 2 - w / 2, top, w, bottom - top);
  ctx.strokeStyle = "rgba(255,190,150,0.55)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(LOGICAL_W / 2 - w / 2 + 1, top + 1, w - 2, bottom - top - 2);
  const heading = fitText(ctx, "Start a new voyage?", w - 40, Math.min(32 * scale, 46), 20, "bold");
  const headingY = top + Math.round(26 - 16 * (scale - 1));
  drawText(ctx, heading.text, LOGICAL_W / 2, headingY, {
    size: heading.size, color: "#ffd9b8", align: "center", weight: "bold", shadow: false,
  });
  const what = view.saveLabel ? `your saved voyage (${view.saveLabel})` : "your saved voyage";
  const body = fitText(ctx, `This replaces ${what}.`, w - 40, Math.min(22 * scale, 32), 15);
  const bodyY = Math.max(headingY + heading.size + 12, top + Math.round(76 + 8 * (scale - 1)));
  drawText(ctx, body.text, LOGICAL_W / 2, bodyY, {
    size: body.size, color: "#f0dccb", align: "center", shadow: false,
  });
  const hint = fitText(ctx, "Escape keeps it.", w - 40, Math.min(20 * scale, 28), 14);
  const hintY = Math.max(bodyY + body.size + 10, top + Math.round(108 + 30 * (scale - 1)));
  drawText(ctx, hint.text, LOGICAL_W / 2, hintY, {
    size: hint.size, color: "#c9b8aa", align: "center", shadow: false,
  });
}

function drawButton(ctx: CanvasRenderingContext2D, label: string, y: number, hover: boolean, warn = false, sub?: string, scale = 1): void {
  const w = TITLE_BUTTON.width, h = TITLE_BUTTON.height, x = LOGICAL_W / 2 - w / 2;
  ctx.fillStyle = warn ? (hover ? "rgba(150,52,26,0.9)" : "rgba(96,34,18,0.78)") : hover ? "rgba(232,201,138,0.18)" : "rgba(10,16,28,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = warn ? "rgba(255,190,150,0.95)" : hover ? "rgba(232,201,138,0.9)" : "rgba(201,162,74,0.45)";
  ctx.lineWidth = hover ? 2 : 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // A sub-label shares the button rather than making it taller: the layout is the same either way.
  const fitted = fitText(ctx, label, w - 30, Math.round(26 * scale), 17, "bold");
  drawText(ctx, fitted.text, LOGICAL_W / 2, y + (sub ? 9 : 17) - Math.round((fitted.size - 26) / 2), {
    size: fitted.size, color: hover ? "#fff6e0" : "#d9c9a4", align: "center", weight: "bold",
  });
  if (sub) drawText(ctx, sub, LOGICAL_W / 2, y + 39, {
    size: 16, color: hover ? "#e8d6ae" : "#a99a7a", align: "center",
  });
}
