/**
 * The title screen. Pure rendering plus the button layout, which the hit-test also uses — so
 * the two can never drift apart.
 *
 * A full-bleed chart of Dreadwater Isle, the lettering over it, and one strong way in. No legend,
 * no tally, no instructions: the painting, the name of the game, and the compass.
 */

import { LOGICAL_W, LOGICAL_H } from "../engine/view";
import { drawText } from "../engine/text";
import { fitText } from "./ui";

/** Menu buttons, the two answers of the new-voyage question, and the undo of a replaced voyage. */
export type TitleId = "previous" | "continue" | "start" | "explore" | "keep" | "confirm";

export interface TitleButton {
  id: TitleId;
  label: string;
  /** A second, smaller line under the label: Continue's "Act II · The Crew". */
  sub?: string;
  /** Top edge of the button in logical pixels. */
  y: number;
}

/** The hit box shared by every answer: wide enough for the compass plate and for a quiet line. */
export const TITLE_BUTTON = { width: 520, height: 68, left: 700, right: 1220 };

/** Act marks on the Chapter select plate. */
const ROMAN = ["I", "II", "III", "IV"];

const FIRST_Y = 796;
const STEP = 82;
/** How far below "Keep my voyage" the destructive answer sits: clear of any button above it. */
const CONFIRM_DROP = 104;

/**
 * Buttons top to bottom. With a save, Continue comes first (it is what a returning player
 * wants, and what Enter does); Chapter select (walk any scene, nothing saved) once the voyage
 * has been finished, or always on the dev server.
 *
 * `confirmNew` replaces the menu with the question a new voyage asks over a save. "Keep my
 * voyage" takes the new voyage's place, under the pointer that just chose it, and "Begin anew"
 * sits well below: a second click, a double-click or an impatient re-click lands on the safe
 * answer.
 *
 * `hasPrevious` adds one quiet line above the menu when a replaced voyage is stashed: the undo
 * of "Begin anew" / "Restart". It is not the default, and it sits clear of the buttons below.
 */
export function titleButtons(hasSave: boolean, chapters: boolean, confirmNew = false,
  saveLabel: string | null = null, hasPrevious = false): TitleButton[] {
  const list: { id: TitleId; label: string; sub?: string }[] = [
    ...(hasSave ? [{ id: "continue" as const, label: "Continue", sub: saveLabel ?? undefined }] : []),
    { id: "start", label: "Begin" },
    ...(chapters ? [{ id: "explore" as const, label: "Chapter select", sub: "walk any scene · nothing is saved" }] : []),
  ];
  const menu = list.map((b, i) => ({ ...b, y: FIRST_Y + i * STEP }));
  if (!confirmNew) {
    return hasPrevious
      ? [{ id: "previous", label: "Take up last voyage", y: FIRST_Y - STEP }, ...menu]
      : menu;
  }
  const at = menu.find((b) => b.id === "start")!.y;
  return [
    { id: "keep", label: "Keep my voyage", y: at },
    { id: "confirm", label: "Begin anew", y: at + CONFIRM_DROP },
  ];
}

/** What Enter does with nothing focused: carry on if there's a voyage to carry on. */
export function defaultTitleButton(buttons: TitleButton[]): TitleId {
  return buttons.some((b) => b.id === "keep") ? "keep"
    : buttons.some((b) => b.id === "continue") ? "continue" : "start";
}

/** Whether a point is on the button whose top edge is `top`. */
export function hitTitleButton(top: number, x: number, y: number): boolean {
  return x > TITLE_BUTTON.left && x < TITLE_BUTTON.right && y > top - 8 && y < top + TITLE_BUTTON.height + 8;
}

export interface TitleView {
  bg?: HTMLImageElement;
  buttons: TitleButton[];
  focus: TitleId | null;
  /** The Adventure Editor is a dev-server feature; kept for the caller, never advertised. */
  dev: boolean;
  /** New Voyage is waiting for its confirmation. */
  confirmNew?: boolean;
  /** What the save holds ("Act II · The Crew"), named in the confirmation. */
  saveLabel?: string | null;
  /** Seconds since the title appeared: it fades up from black, then breathes. */
  time?: number;
  /** Reduced motion: no drift, no glint, no swinging needle. */
  reduced?: boolean;
  /** The player's text scale: the buttons grow with it. */
  scale?: number;
  /** The focus marker's last move: from which button top (null: it was nowhere), and when. */
  needle?: { fromY: number | null; since: number };
  /** Kept for the caller: no count is drawn on the title any more. */
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
    g.addColorStop(0, "rgba(3,5,12,0.66)");
    g.addColorStop(0.42, "rgba(3,5,12,0.18)");
    g.addColorStop(0.72, "rgba(3,5,12,0.42)");
    g.addColorStop(1, "rgba(3,5,12,0.9)");
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
const LETTERS = { x: LOGICAL_W / 2 - 600, y: 258, w: 1200, h: 250 };
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
  drawText(g, "THE BRASS", LETTERS.w / 2, 286 - LETTERS.y, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
  drawText(g, "COMPASS", LETTERS.w / 2, 386 - LETTERS.y, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
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
    drawText(ctx, "THE BRASS", LOGICAL_W / 2, 286, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
    drawText(ctx, "COMPASS", LOGICAL_W / 2, 386, { size: 96, color: "#e8c98a", align: "center", weight: "bold" });
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

// ---------------------------------------------------------------- ornaments

/** A letter-spaced line, centred on `cx`. Used only for the title's small tagline. */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number,
  color: string, tracking: number, weight = "normal"): number {
  ctx.save();
  ctx.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(0, text.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
  ctx.restore();
  return total;
}

/** A four-point compass star, the small mark beside a quiet answer. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.34 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The compass rose: a ring, eight points, a dark heart. */
function drawRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number,
  color = "#e8c98a", alpha = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.rotate(rot);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    const long = i % 2 === 0;
    ctx.fillStyle = long ? color : "rgba(232,201,138,0.45)";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.1, -r * 0.16);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.1, -r * 0.16);
    ctx.closePath();
    ctx.fill();
    if (long) {
      // The south-running half, in the old chart's red.
      ctx.fillStyle = "rgba(181,69,46,0.72)";
      ctx.beginPath();
      ctx.moveTo(0, r * 0.9);
      ctx.lineTo(r * 0.1, r * 0.16);
      ctx.lineTo(0, 0);
      ctx.lineTo(-r * 0.1, r * 0.16);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = "#0b1422";
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
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
  const swing = still ? 0 : 0.55 * Math.exp(-4.2 * tau) * Math.cos(13 * tau);
  const x = TITLE_BUTTON.left - 38;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(8,13,22,0.72)";
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(232,201,138,0.8)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.rotate(swing);
  ctx.fillStyle = "#e8c98a";
  ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(0, -4.4); ctx.lineTo(0, 4.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#b5452e";
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(0, -4.4); ctx.lineTo(0, 4.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#0b1422";
  ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- screen

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

  // A single ornament above the name, turning with the picture.
  drawRose(ctx, LOGICAL_W / 2, 196, 27, still ? 0 : t * 0.07, "#e8c98a", 0.8);

  drawLettering(ctx, t, still);

  if (view.confirmNew) drawConfirmCard(ctx, view);
  for (const b of view.buttons) {
    if (b.id === "confirm") {
      // The dangerous answer is quiet, underlined, and well below the safe one.
      drawQuietButton(ctx, b.label, b.y, view.focus === b.id, scale, true);
    } else if (b.id === "explore") {
      // A chart plate: the second way in, quieter than the compass but unmistakably a control.
      drawChartButton(ctx, b, t, view.focus === b.id, still, scale);
    } else if (b.id === defaultTitleButton(view.buttons) || b.id === "keep") {
      drawCompassButton(ctx, b, t, view.focus === b.id, still, scale);
    } else {
      drawQuietButton(ctx, b.label, b.y, view.focus === b.id, scale, false, b.sub);
    }
  }
  drawNeedle(ctx, view, t, still);

  if (t < FADE_UP) {
    // Up from black. Nothing waits on it: the buttons work from the first frame.
    const a = 1 - t / FADE_UP;
    ctx.fillStyle = `rgba(0,0,0,${(a * a).toFixed(3)})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
}

/**
 * The one strong way in: a brass compass plate, the label to its right, a slow rose turning in
 * the dark glass. The sub-label (Continue's act) sits under the name, so the layout never moves.
 */
function drawCompassButton(ctx: CanvasRenderingContext2D, b: TitleButton, t: number, focus: boolean,
  still: boolean, scale: number): void {
  const w = TITLE_BUTTON.width, h = TITLE_BUTTON.height;
  const x = LOGICAL_W / 2 - w / 2, y = b.y;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, focus ? "rgba(47,39,25,0.92)" : "rgba(17,26,38,0.86)");
  grad.addColorStop(1, focus ? "rgba(25,20,13,0.94)" : "rgba(6,10,18,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = focus ? "rgba(255,226,160,0.95)" : "rgba(201,162,74,0.55)";
  ctx.lineWidth = focus ? 2 : 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (focus) {
    // Corner ticks: the focus ring reads from across the room, without a box around the box.
    ctx.strokeStyle = "#ffe6a8";
    ctx.lineWidth = 2;
    const k = 16;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * 2, cy + dy * 2 + dy * k);
      ctx.lineTo(cx + dx * 2, cy + dy * 2);
      ctx.lineTo(cx + dx * 2 + dx * k, cy + dy * 2);
      ctx.stroke();
    }
  }
  // The glass: a rose in a square of its own, divided by a hairline.
  drawRose(ctx, x + 38, y + h / 2, 21, still ? 0 : t * 0.16, focus ? "#ffe6a8" : "#d9b877", 0.95);
  ctx.strokeStyle = focus ? "rgba(255,230,168,0.45)" : "rgba(201,162,74,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 76, y + 12); ctx.lineTo(x + 76, y + h - 12); ctx.stroke();

  const label = fitText(ctx, b.label.toUpperCase(), w - 124, Math.round(25 * scale), 16, "bold");
  const sub = b.sub ? fitText(ctx, b.sub, w - 124, Math.round(15 * scale), 11) : null;
  const cx = x + 76 + (w - 76) / 2;
  const labelY = y + (sub ? 13 : Math.round((h - label.size) / 2) - 1);
  drawSpaced(ctx, label.text, cx, labelY, label.size, focus ? "#fff6e0" : "#ecd8ab", 4.5, "bold");
  if (sub) {
    drawText(ctx, sub.text, cx, y + h - sub.size - 13, {
      size: sub.size, color: focus ? "#e8d6ae" : "#a99a7a", align: "center", shadow: false,
    });
  }
}

/**
 * Chapter select: a low chart plate under the main way in. A rose in its own square, the name,
 * a line saying plainly that it walks scenes without saving, and four small act marks — the
 * shape of the thing it opens, not a bare line of type. Still secondary to Continue and Begin.
 */
function drawChartButton(ctx: CanvasRenderingContext2D, b: TitleButton, t: number, focus: boolean,
  still: boolean, scale: number): void {
  const w = TITLE_BUTTON.width, h = TITLE_BUTTON.height;
  const x = LOGICAL_W / 2 - w / 2, y = b.y;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, focus ? "rgba(34,40,38,0.94)" : "rgba(12,24,31,0.82)");
  grad.addColorStop(1, focus ? "rgba(19,22,18,0.95)" : "rgba(5,12,18,0.9)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = focus ? "rgba(255,231,172,0.9)" : "rgba(201,162,74,0.42)";
  ctx.lineWidth = focus ? 1.8 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // Two faint chart rules inside the plate: plotting lines, not a box around the box.
  ctx.save();
  ctx.strokeStyle = focus ? "rgba(232,201,138,0.22)" : "rgba(232,201,138,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 84, y + 14); ctx.lineTo(x + w - 108, y + 14);
  ctx.moveTo(x + 84, y + h - 14); ctx.lineTo(x + w - 108, y + h - 14);
  ctx.stroke();
  ctx.restore();
  // The rose, in its own square: the same instrument as the compass button, one size down.
  drawRose(ctx, x + 40, y + h / 2, 18, still ? 0 : t * 0.12, focus ? "#ffe6a8" : "#c9a24a", 0.86);
  ctx.strokeStyle = focus ? "rgba(255,230,168,0.4)" : "rgba(201,162,74,0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 78, y + 11); ctx.lineTo(x + 78, y + h - 11); ctx.stroke();
  const label = fitText(ctx, b.label.toUpperCase(), w - 212, Math.round(18 * scale), 13, "bold");
  drawSpaced(ctx, label.text, x + (w - 30) / 2, y + 12, label.size, focus ? "#fff6e0" : "#e0cfa6", 3.6, "bold");
  if (b.sub) {
    const sub = fitText(ctx, b.sub, w - 212, Math.round(14 * scale), 11);
    drawText(ctx, sub.text, x + (w - 30) / 2, y + h - sub.size - 11, {
      size: sub.size, color: focus ? "#e3d2ad" : "#b8a98a", align: "center", shadow: false,
    });
  }
  // Four act marks: the chapters that are behind the plate.
  ctx.save();
  ctx.font = `600 ${Math.round(11 * scale)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = focus ? "rgba(255,231,172,0.95)" : "rgba(201,162,74,0.62)";
  for (let i = 0; i < 4; i++) ctx.fillText(ROMAN[i + 1], x + w - 86 + i * 19, y + h / 2);
  ctx.restore();
  if (focus) {
    // Corner ticks, the same grammar as the compass plate's focus.
    ctx.strokeStyle = "#ffe6a8";
    ctx.lineWidth = 2;
    const k = 13;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * 2, cy + dy * 2 + dy * k);
      ctx.lineTo(cx + dx * 2, cy + dy * 2);
      ctx.lineTo(cx + dx * 2 + dx * k, cy + dy * 2);
      ctx.stroke();
    }
  }
}

/** Continue's quiet neighbours: a line of type, a diamond when it has the focus. */
function drawQuietButton(ctx: CanvasRenderingContext2D, label: string, top: number, focus: boolean,
  scale: number, danger = false, sub?: string): void {
  const fitted = fitText(ctx, label.toUpperCase(), TITLE_BUTTON.width - 40, Math.round(18 * scale), 13);
  const cx = LOGICAL_W / 2;
  const y = top + (TITLE_BUTTON.height - fitted.size) / 2;
  const color = danger
    ? (focus ? "#ffcbb4" : "#d09a83")
    : focus ? "#fff6e0" : "#d8cbb0";
  const glow = focus ? "rgba(255,230,168,0.95)" : "rgba(216,203,176,0.55)";
  if (focus) {
    drawStar(ctx, cx - fitted.text.length * 4.6 - 34, top + TITLE_BUTTON.height / 2, 6, glow);
    drawStar(ctx, cx + fitted.text.length * 4.6 + 34, top + TITLE_BUTTON.height / 2, 6, glow);
  } else if (/CHAPTER SELECT/.test(fitted.text)) {
    // Quiet, but unmistakably a second way in: a brass rule and a diamond, no button box.
    const w = fitted.text.length * fitted.size * 0.62;
    ctx.save();
    ctx.strokeStyle = "rgba(201,162,74,0.52)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 24, y + fitted.size + 8); ctx.lineTo(cx + w / 2 + 24, y + fitted.size + 8);
    ctx.stroke();
    drawStar(ctx, cx - w / 2 - 34, top + TITLE_BUTTON.height / 2, 4, "rgba(216,203,176,0.7)");
    ctx.restore();
  }
  drawSpaced(ctx, fitted.text, cx, y, fitted.size, color, 4.2);
  if (danger) {
    ctx.save();
    ctx.strokeStyle = "rgba(208,154,131,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const w = fitted.text.length * (fitted.size * 0.62);
    ctx.moveTo(cx - w / 2, y + fitted.size + 8);
    ctx.lineTo(cx + w / 2, y + fitted.size + 8);
    ctx.stroke();
    ctx.restore();
  }
  if (sub) {
    drawText(ctx, sub, cx, top + TITLE_BUTTON.height + 2, {
      size: Math.round(14 * scale), color: "#a99a7a", align: "center", shadow: false,
    });
  }
  if (focus) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,230,168,0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - TITLE_BUTTON.width / 2 + 90, top, TITLE_BUTTON.width - 180, TITLE_BUTTON.height);
    ctx.restore();
  }
}

/** The question, set on a card that frames both answers. */
function drawConfirmCard(ctx: CanvasRenderingContext2D, view: TitleView): void {
  const keep = view.buttons.find((b) => b.id === "keep");
  const confirm = view.buttons.find((b) => b.id === "confirm");
  if (!keep || !confirm) return;
  // The card widens and its type grows with the scale, but its answers keep their fixed hit boxes.
  const scale = Math.max(1, view.scale ?? 1);
  const top = keep.y - 150, bottom = confirm.y + TITLE_BUTTON.height + 20;
  const w = Math.round(760 * scale);
  const x = LOGICAL_W / 2 - w / 2;
  ctx.save();
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, "rgba(16,11,10,0.93)");
  grad.addColorStop(1, "rgba(9,7,7,0.96)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, top, w, bottom - top);
  ctx.strokeStyle = "rgba(201,162,74,0.5)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, top + 0.5, w - 1, bottom - top - 1);
  drawRose(ctx, LOGICAL_W / 2, top + 40, 16, 0, "#c9a24a", 0.6);
  const heading = fitText(ctx, "Begin again?", w - 60, Math.round(30 * scale), 22, "bold");
  drawText(ctx, heading.text, LOGICAL_W / 2, top + 72, {
    size: heading.size, color: "#ffd9b8", align: "center", weight: "bold", shadow: false,
  });
  const what = view.saveLabel ? `your saved voyage (${view.saveLabel})` : "your saved voyage";
  const body = fitText(ctx, `This replaces ${what}; it can be taken up again from the title.`,
    w - 60, Math.round(20 * scale), 15);
  drawText(ctx, body.text, LOGICAL_W / 2, top + 118, {
    size: body.size, color: "#e6d3bf", align: "center", shadow: false,
  });
  ctx.restore();
}
