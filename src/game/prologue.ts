/**
 * The cold open: the last stamp in the day-book, before the title card.
 *
 * A painted close-up of the customs desk at night, Fenn's voice in typewriter, and one thing
 * to do: stamp the day-book. Then the night bell, Bramwick in the doorway, and the cut to the
 * opening film. Laid out once; the plate is pushed in slowly and stilled under reduced motion.
 *
 * It is deliberately not a room: no walk mesh, no verb panel, no save. Continue never sees it.
 */

import { LOGICAL_W, LOGICAL_H } from "../engine/view";
import { drawText, wrap, typewriterSlice, type TextStyle } from "../engine/text";
import type { Assets } from "../engine/assets";

/** What the cold open needs from the game's audio. */
export interface PrologueAudio {
  stamp(): void;
  nightBell(): void;
}

export interface PrologueOptions {
  assets: Assets;
  audio: PrologueAudio;
  /** Narration characters per second; Infinity when reduced motion shows every line at once. */
  cps: () => number;
  /** Screen-reader narration, one utterance per line. */
  announce?: (text: string) => void;
}

/** Set once the player skips the cold open: later new voyages go straight to the film. */
const SKIP_KEY = "brasscompass.coldopen.v1";

export function coldOpenSkipped(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === "skip"; } catch { return false; }
}
function rememberSkipped(): void {
  try { localStorage.setItem(SKIP_KEY, "skip"); } catch { /* a preference is optional */ }
}

/** How long the cold open runs before the Skip control is offered. */
const SKIP_AFTER = 2;
/** A click or key this soon after it starts belongs to whatever started it, not to the desk. */
const CLICK_GRACE = 0.3;
/** The fade out after the last line, and the quicker one when the player skips. */
const OUT_FADE = 1.2;
const SKIP_FADE = 0.28;
const LOOK_FOR = 6;

/** Where the player can click: generous, the whole open book and the stamp standing on it. */
const BOOK = { x: 420, y: 400, w: 1010, h: 560 };
/** The stamp alone, for looking at it (right-click). */
const STAMP = { x: 720, y: 250, w: 330, h: 440 };
/** Where the stamp's mark lands on the right-hand page, in screen coordinates. */
const INK = { x: 1120, y: 655 };
/** The Skip control, top right. */
const SKIP = { x: 1710, y: 32, w: 160, h: 50 };
/** The sentence line, in the game's own voice and colours. */
const SENT = { x: 150, y: 946, w: 780, h: 58 };
const TEXT_X = 150;
const TEXT_W = 1500;
const TEXT_BOTTOM = 922;

const SENTENCE = "#7fd6d0";

interface Cue {
  speaker: "fenn" | "bramwick";
  text: string;
  /** Seconds the fully typed line stays up before the next. */
  hold: number;
  /** Ring the night bell as this line begins. */
  bell?: boolean;
}

/** The lines over the desk, before the player ever touches it. */
const INTRO: Cue[] = [
  { speaker: "fenn", text: "Last entry of the day. The harbour's quiet now.", hold: 1.9 },
  // The town knows whose son he is; saying it once here earns every later reference to his father.
  { speaker: "fenn", text: "My father's ship went missing three years ago. Everyone in Port Vela knows. Nobody says it.", hold: 3.0 },
  { speaker: "fenn", text: "Three years of other people's voyages in this hand. Tonight I want one of my own.", hold: 2.4 },
  { speaker: "fenn", text: "The date stamp is warm from the lamp. It's the only harbour property I'm allowed to hit.", hold: 2.4 },
];

/** After the stamp: the sound, the bell, and Bramwick in the doorway. */
const AFTER_STAMP: Cue[] = [
  { speaker: "fenn", text: "The stamp goes down. The book takes the date and says nothing.", hold: 1.7 },
  { speaker: "fenn", text: "The night bell rings above the door. Two notes.", hold: 1.5, bell: true },
  { speaker: "bramwick", text: "Fenn. It's past the night bell.", hold: 1.4 },
  { speaker: "fenn", text: "I'm dating the day-book, sir.", hold: 1.2 },
  { speaker: "bramwick", text: "You're avoiding the door.", hold: 2.2 },
  { speaker: "fenn", text: "He's right. I've been on this page for an hour.", hold: 2.4 },
];

const LOOK_BOOK = "The day-book. Every arrival, every departure, and a column for the weather. The weather never signs.";
const LOOK_BOOK_STAMPED = "Dated. The page looks the same. That's the point.";
const LOOK_STAMP = "The date stamp. Brass, wood, and a wheel of numbers that only agrees with me.";

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const inside = (x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Prologue {
  private t = 0;
  private seq: Cue[] = INTRO;
  private index = 0;
  /** Characters of the current cue revealed. */
  private shown = 0;
  /** Seconds since the current cue was fully revealed. */
  private held = 0;
  /** When the current cue began, for its small entrance. */
  private cueAt = 0;
  /** When the stamp landed (t), or -1 before. */
  private stampedAt = -1;
  private bellAt = -1;
  /** The player skipped: a quick fade, then out. */
  private skipAt = -1;
  /** The last line is over: the slow fade to black. */
  private outAt = -1;
  private finished = false;
  private hoverAction = false;
  private hoverSkip = false;
  private look: { text: string; at: number } | null = null;

  constructor(private opts: PrologueOptions, private onDone: () => void) {
    // The first line belongs to the screen reader as much as the rest of them.
    this.say(INTRO[0]);
  }

  get active(): boolean {
    return !this.finished;
  }

  /** The OS cursor over the canvas while the cold open has it. */
  get cursor(): string {
    return this.hoverAction || this.hoverSkip ? "pointer" : "default";
  }

  /** Where the day-book is on screen: for the tests' real click. */
  get actionRect(): { x: number; y: number; w: number; h: number } {
    return { ...BOOK };
  }
  get skipRect(): { x: number; y: number; w: number; h: number } {
    return { ...SKIP };
  }
  /** The stamp itself, for the right-click test. */
  get stampRect(): { x: number; y: number; w: number; h: number } {
    return { ...STAMP };
  }

  /** Whether the day-book has been stamped (the one action is spent). */
  get stamped(): boolean {
    return this.stampedAt >= 0;
  }
  /** The line a right-click is showing, if any. */
  get lookText(): string | null {
    return this.look?.text ?? null;
  }
  /** Seconds since the cold open began (the tests step it with the game's clock). */
  get clock(): number {
    return this.t;
  }

  /** Whether the Skip control has appeared yet (offered after a beat, and until the cut). */
  get skippable(): boolean {
    return this.t >= SKIP_AFTER && this.skipAt < 0 && this.outAt < 0;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.t += dt;
    if (this.skipAt >= 0) {
      if (this.t - this.skipAt >= SKIP_FADE) this.finish();
      return;
    }
    if (this.outAt >= 0) {
      if (this.t - this.outAt >= OUT_FADE) this.finish();
      return;
    }
    if (this.look && this.t - this.look.at > LOOK_FOR) this.look = null;
    const cue = this.seq[this.index];
    if (!cue) return;
    if (this.shown < cue.text.length) {
      const cps = this.opts.cps();
      this.shown = Number.isFinite(cps)
        ? Math.min(cue.text.length, this.shown + dt * cps)
        : cue.text.length;
    } else {
      this.held += dt;
      // The desk waits: the last line of the opening stays up until the player stamps.
      if (this.seq === INTRO && this.index === INTRO.length - 1) return;
      if (this.held >= cue.hold) this.nextCue();
    }
  }

  move(x: number, y: number): void {
    const live = !this.finished && this.skipAt < 0 && this.outAt < 0;
    this.hoverAction = live && this.stampedAt < 0 && inside(x, y, BOOK);
    this.hoverSkip = live && this.skippable && inside(x, y, SKIP);
  }

  /** A click on the canvas. Right-click looks; left-click stamps (or skips). */
  click(x: number, y: number, button: number): void {
    if (this.finished || this.skipAt >= 0 || this.outAt >= 0) return;
    if (this.t < CLICK_GRACE) return;
    if (button === 2) {
      if (this.stampedAt < 0 && inside(x, y, STAMP)) this.showLook(LOOK_STAMP);
      else if (inside(x, y, BOOK)) this.showLook(this.stampedAt >= 0 ? LOOK_BOOK_STAMPED : LOOK_BOOK);
      return;
    }
    if (inside(x, y, SKIP) && this.skippable) {
      this.skip();
      return;
    }
    if (inside(x, y, BOOK) && this.stampedAt < 0) this.stamp();
  }

  key(k: string, event?: { preventDefault(): void }): void {
    if (this.finished || this.skipAt >= 0 || this.outAt >= 0) return;
    if (k !== "Enter" && k !== " ") return;
    // The key that started the voyage is not also its skip.
    if (this.t < CLICK_GRACE) return;
    event?.preventDefault();
    this.skip();
  }

  skip(): void {
    if (this.finished || this.skipAt >= 0 || this.outAt >= 0) return;
    rememberSkipped();
    this.skipAt = this.t;
    this.hoverAction = false;
    this.hoverSkip = false;
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.onDone();
  }

  private showLook(text: string): void {
    this.look = { text, at: this.t };
  }

  private stamp(): void {
    if (this.stampedAt >= 0) return;
    this.stampedAt = this.t;
    this.opts.audio.stamp();
    // The stamp is the answer to whatever the player was looking at.
    this.look = null;
    this.seq = AFTER_STAMP;
    this.index = 0;
    this.shown = 0;
    this.held = 0;
    this.cueAt = this.t;
    this.hoverAction = false;
    this.say(AFTER_STAMP[0]);
  }

  private nextCue(): void {
    if (this.seq === INTRO && this.index === INTRO.length - 1) {
      // The desk is waiting: the last line stays up until the player stamps.
      this.held = 0;
      return;
    }
    if (this.index + 1 < this.seq.length) {
      this.index++;
      this.shown = 0;
      this.held = 0;
      this.cueAt = this.t;
      this.say(this.seq[this.index]);
      return;
    }
    if (this.outAt < 0) this.outAt = this.t;
  }

  /** Announce a line to the screen reader, and ring the bell if it belongs to this one. */
  private say(cue: Cue): void {
    if (cue.bell && this.bellAt < 0) {
      this.bellAt = this.t;
      this.opts.audio.nightBell();
    }
    const who = cue.speaker === "bramwick" ? "Bramwick: " : "";
    this.opts.announce?.(who + cue.text);
  }

  // ------------------------------------------------------------ drawing

  render(ctx: CanvasRenderingContext2D, reduced: boolean, scale: number): void {
    const age = this.t - this.stampedAt;
    ctx.fillStyle = "#03050a";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // The plate, with the smallest possible push in, and a jolt when the stamp lands.
    const k = reduced ? 1 : 1 + 0.025 * Math.min(1, this.t / 30);
    const jolt = this.stampedAt >= 0 && age < 0.16 ? Math.sin(age * 80) * 2.2 * (1 - age / 0.16) : 0;
    ctx.save();
    ctx.translate(LOGICAL_W / 2, 620 + jolt);
    ctx.scale(k, k);
    ctx.translate(-LOGICAL_W / 2, -620);
    this.drawPlate(ctx);
    ctx.restore();

    if (this.hoverAction) this.drawHover(ctx);
    if (this.stampedAt >= 0) this.drawInk(ctx, age);
    this.drawDoorwayLight(ctx);
    this.drawWash(ctx);
    this.drawLocation(ctx, scale);
    this.drawLook(ctx, scale);
    this.drawCue(ctx, scale, reduced);
    if (this.stampedAt < 0) this.drawSentence(ctx, scale);
    this.drawSkip(ctx, scale);

    const out = this.skipAt >= 0
      ? clamp01((this.t - this.skipAt) / SKIP_FADE)
      : this.outAt >= 0 ? clamp01((this.t - this.outAt) / OUT_FADE) : 0;
    if (out > 0) {
      ctx.fillStyle = `rgba(0,0,0,${out})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
  }

  /** The painting itself, or the office plate cropped close, or a drawn desk if art is absent. */
  private drawPlate(ctx: CanvasRenderingContext2D): void {
    const img = this.opts.assets.img("bg_coldopen");
    if (img && img.width > 0) {
      ctx.drawImage(img, 0, 0, LOGICAL_W, LOGICAL_H);
      return;
    }
    const office = this.opts.assets.img("bg_office_wide");
    if (office && office.width > 0) {
      // A scaled crop of the office toward Bramwick's desk, darkened into a close-up.
      const s = Math.max(LOGICAL_W / office.width, LOGICAL_H / office.height);
      const dw = office.width * s, dh = office.height * s;
      const fx = (1760 / 2560) * office.width, fy = (520 / 880) * office.height;
      const ox = Math.max(LOGICAL_W - dw, Math.min(0, LOGICAL_W / 2 - fx * s));
      const oy = Math.max(LOGICAL_H - dh, Math.min(0, LOGICAL_H / 2 - fy * s));
      ctx.drawImage(office, ox, oy, dw, dh);
      ctx.fillStyle = "rgba(4,8,18,0.5)";
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      return;
    }
    this.drawFallbackDesk(ctx);
  }

  /** Last resort, with no art at all: the desk, the book and the stamp, painted in code. */
  private drawFallbackDesk(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, "#070d18");
    bg.addColorStop(0.55, "#101827");
    bg.addColorStop(1, "#05070d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const lamp = ctx.createRadialGradient(250, 330, 12, 250, 330, 780);
    lamp.addColorStop(0, "rgba(255,214,140,0.5)");
    lamp.addColorStop(0.35, "rgba(220,170,90,0.16)");
    lamp.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // The lamp's brass base at the left.
    ctx.fillStyle = "#7b5a25";
    ctx.beginPath();
    ctx.ellipse(250, 690, 130, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,222,160,0.75)";
    ctx.beginPath();
    ctx.ellipse(250, 540, 46, 86, 0, 0, Math.PI * 2);
    ctx.fill();
    // Desk surface.
    const desk = ctx.createLinearGradient(0, 760, 0, LOGICAL_H);
    desk.addColorStop(0, "#2b2218");
    desk.addColorStop(1, "#0b0907");
    ctx.fillStyle = desk;
    ctx.fillRect(0, 760, LOGICAL_W, LOGICAL_H - 760);
    // The day-book: two pages and a gutter.
    ctx.save();
    ctx.translate(1000, 660);
    ctx.rotate(-0.015);
    ctx.fillStyle = "#e9ddc2";
    ctx.fillRect(-590, -230, 580, 460);
    ctx.fillRect(10, -230, 580, 460);
    ctx.strokeStyle = "rgba(90,70,40,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -230);
    ctx.lineTo(-2, 230);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,95,60,0.28)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 13; i++) {
      const y = -190 + i * 34;
      ctx.beginPath();
      ctx.moveTo(-550, y);
      ctx.lineTo(-40, y);
      ctx.moveTo(40, y);
      ctx.lineTo(550, y);
      ctx.stroke();
    }
    // The date stamp standing on the page.
    ctx.fillStyle = "#8a6526";
    ctx.beginPath();
    ctx.ellipse(-140, 20, 105, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5f2c";
    ctx.fillRect(-158, -150, 36, 160);
    ctx.beginPath();
    ctx.ellipse(-140, -160, 46, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The page warms under the pointer: the only thing on this desk to touch, said without a box
   * around it. Reduced motion does not change it; it is a state, not an animation.
   */
  private drawHover(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(1010, 600, 60, 1010, 600, 470);
    g.addColorStop(0, "rgba(255,214,150,0.13)");
    g.addColorStop(0.55, "rgba(255,200,120,0.06)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(420, 300, 1100, 700);
    ctx.restore();
  }

  /** The ink: the mark, its ring, and a few blots still spreading. */
  private drawInk(ctx: CanvasRenderingContext2D, age: number): void {
    if (age < 0) return;
    const p = easeOut(clamp01(age / 0.45));
    const flash = Math.max(0, 1 - age / 0.22);
    ctx.save();
    ctx.translate(INK.x, INK.y);
    ctx.scale(1, 0.74);
    const r = 62 * (0.8 + 0.25 * p);
    if (flash > 0) {
      const impact = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.1);
      impact.addColorStop(0, `rgba(255,238,200,${flash * 0.22})`);
      impact.addColorStop(1, "rgba(255,238,200,0)");
      ctx.fillStyle = impact;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    const ink = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    ink.addColorStop(0, `rgba(12,16,30,${0.86 * p})`);
    ink.addColorStop(0.62, `rgba(18,22,38,${0.76 * p})`);
    ink.addColorStop(0.86, `rgba(26,30,46,${0.38 * p})`);
    ink.addColorStop(1, "rgba(26,30,46,0)");
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // The stamp face's ring, and the little hollow of the date wheel.
    ctx.strokeStyle = `rgba(16,20,32,${0.5 * p})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(16,20,32,${0.34 * p})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    // Blots: fixed offsets, so the mark is the same on every run.
    const blots: [number, number, number][] = [[-r * 1.05, r * 0.42, 9], [r * 0.96, -r * 0.3, 7], [r * 0.36, r * 1.12, 5], [-r * 0.5, -r * 0.95, 4]];
    for (const [bx, by, br] of blots) {
      const g = easeOut(clamp01((age - 0.06) / 0.7));
      if (g <= 0) continue;
      ctx.fillStyle = `rgba(24,28,44,${0.5 * g})`;
      ctx.beginPath();
      ctx.arc(bx, by, br * g, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A wedge of lamplight from the doorway, once the bell has brought somebody to it. */
  private drawDoorwayLight(ctx: CanvasRenderingContext2D): void {
    if (this.bellAt < 0) return;
    const a = clamp01((this.t - this.bellAt) / 0.9);
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const light = ctx.createLinearGradient(0, 0, 1180, 0);
    light.addColorStop(0, `rgba(255,206,132,${0.16 * a})`);
    light.addColorStop(0.55, `rgba(255,190,110,${0.06 * a})`);
    light.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(0, 190);
    ctx.lineTo(0, 960);
    ctx.lineTo(1120, 880);
    ctx.lineTo(1120, 300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The bottom of the picture goes dark, so the words sit on it and the painting still reads. */
  private drawWash(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 600, 0, LOGICAL_H);
    g.addColorStop(0, "rgba(3,5,10,0)");
    g.addColorStop(0.55, "rgba(3,5,10,0.62)");
    g.addColorStop(1, "rgba(3,5,10,0.94)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 600, LOGICAL_W, LOGICAL_H - 600);
    const v = ctx.createRadialGradient(LOGICAL_W / 2, 480, 300, LOGICAL_W / 2, 480, LOGICAL_H * 0.9);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  private drawLocation(ctx: CanvasRenderingContext2D, scale: number): void {
    const a = this.t < 0.5 ? this.t / 0.5 : this.t < 3.4 ? 1 : Math.max(0, 1 - (this.t - 3.4) / 1.1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, "PORT VELA  ·  THE CUSTOMS HOUSE  ·  A QUARTER TO MIDNIGHT", 76, 52, {
      size: Math.round(21 * Math.min(scale, 1.25)), color: "#d4b064", weight: "normal",
    });
    ctx.fillStyle = "rgba(201,162,74,0.6)";
    ctx.fillRect(76, 86, 520, 1);
    ctx.restore();
  }

  private drawLook(ctx: CanvasRenderingContext2D, scale: number): void {
    if (!this.look) return;
    const age = this.t - this.look.at;
    const a = Math.min(1, age / 0.25, (LOOK_FOR - age) / 0.5);
    if (a <= 0) return;
    const size = Math.round(25 * Math.min(scale, 1.3));
    const lh = Math.round(size * 1.34);
    const style: TextStyle = { size, color: "#e6ddc8", lineHeight: lh };
    const lines = wrap(ctx, this.look.text, 860, style);
    const h = lines.length * lh + 34;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(5,13,22,0.88)";
    ctx.fillRect(120, 118, 900, h);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(120, 118, 4, h);
    lines.forEach((line, i) => drawText(ctx, line, 146, 132 + i * lh, style));
    ctx.restore();
  }

  /** Fenn's voice, and Bramwick's, above the sentence line. */
  private drawCue(ctx: CanvasRenderingContext2D, scale: number, reduced: boolean): void {
    const cue = this.seq[this.index];
    if (!cue) return;
    const size = Math.round(33 * Math.min(scale, 1.3));
    const lh = Math.round(size * 1.32);
    const style: TextStyle = { size, color: cue.speaker === "bramwick" ? "#efe5cd" : "#d8cfb8", lineHeight: lh };
    const lines = wrap(ctx, cue.text, TEXT_W, style);
    const top = TEXT_BOTTOM - lines.length * lh;
    const rise = reduced ? 0 : (1 - easeOut(Math.min(1, (this.t - this.cueAt) / 0.3))) * 6;
    ctx.save();
    if (cue.speaker === "bramwick") {
      drawText(ctx, "HARBOURMASTER BRAMWICK", TEXT_X, top - 40 + rise, {
        size: Math.round(22 * Math.min(scale, 1.3)), color: "#d4b064", weight: "bold",
      });
    }
    let left = this.shown;
    lines.forEach((line, i) => {
      const take = Math.min(left, line.length);
      if (take <= 0) return;
      drawText(ctx, typewriterSlice(line, take), TEXT_X, top + i * lh + rise, style);
      left -= line.length + 1;
    });
    ctx.restore();
  }

  /** "Stamp the day-book": the sentence line, the only sentence the cold open has. */
  private drawSentence(ctx: CanvasRenderingContext2D, scale: number): void {
    const s = SENT;
    const size = Math.round(30 * Math.min(scale, 1.25));
    ctx.save();
    ctx.fillStyle = "rgba(5,13,22,0.88)";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = this.hoverAction ? "rgba(232,201,138,0.95)" : "rgba(201,162,74,0.5)";
    ctx.lineWidth = this.hoverAction ? 2 : 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
    ctx.fillStyle = this.hoverAction ? "#e8c98a" : "rgba(201,162,74,0.85)";
    ctx.fillRect(s.x, s.y, 4, s.h);
    const y = s.y + Math.round((s.h - size) / 2) - 1;
    drawText(ctx, "Stamp", s.x + 22, y, {
      size, color: this.hoverAction ? "#a9fff5" : SENTENCE, weight: "bold",
    });
    ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
    const at = s.x + 22 + ctx.measureText("Stamp").width;
    drawText(ctx, " the day-book", at, y, {
      size, color: this.hoverAction ? "#fff0c4" : "#ecd29a", weight: "bold",
    });
    drawText(ctx, "click the book to stamp · right-click to look", s.x + 2, s.y + s.h + 13, {
      size: Math.round(20 * Math.min(scale, 1.3)), color: "#b9c8d3", shadow: false,
    });
    ctx.restore();
  }

  private drawSkip(ctx: CanvasRenderingContext2D, scale: number): void {
    if (!this.skippable) return;
    const a = Math.min(1, (this.t - SKIP_AFTER) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    const r = SKIP;
    const size = Math.round(22 * Math.min(scale, 1.2));
    ctx.fillStyle = this.hoverSkip ? "rgba(201,162,74,0.22)" : "rgba(8,14,24,0.55)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = this.hoverSkip ? "#f0dcae" : "rgba(201,162,74,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
    drawText(ctx, "Skip  ›", r.x + r.w / 2, r.y + Math.round((r.h - size) / 2) - 1, {
      size, color: this.hoverSkip ? "#fff3cf" : "#e6d6b4", align: "center",
    });
    drawText(ctx, "Enter", r.x - 18, r.y + 15, {
      size: 18, color: "rgba(230,214,180,0.55)", align: "right", shadow: false,
    });
    ctx.restore();
  }
}
