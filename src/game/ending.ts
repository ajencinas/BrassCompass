/**
 * The ending, as a ceremony. The voyage's last painting, softened and darkened, fills the screen
 * (no verb panel, no top bar); the title comes up, then each line in turn, the book's own line
 * last and in gold. A click or Enter shows the page at once; the next turns the page, and the
 * last goes home.
 *
 * The type follows the player's text scale. At 100% the card is laid out exactly as it has always
 * been (shrinking to fit one band); a larger scale makes the type larger instead of shrinking it,
 * and the entries paginate, a page at a time, rather than spilling over the painting.
 *
 * Laid out once per scale, not once a frame. Reduced motion: lines fade in place and the painting
 * is still.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H } from "../engine/view";
import { drawText, wrap } from "../engine/text";
import { fitText } from "./ui";
import type { Assets } from "../engine/assets";
import type { Pt } from "../engine/walkbox";

export interface EndingCard {
  title: string;
  lines: string[];
  /** The painting the card rises over (an asset key)... */
  image: string;
  /** ...and the point of it to centre on, in its room's world coordinates. */
  focus?: Pt;
}

/** The world the scene paintings are drawn into, which `focus` is measured in. */
const WORLD_W = 2560;
/** Seconds: the painting comes up from black, then the title, then a line every STAGGER. */
const PAINTING_FADE = 1.4;
const TITLE_AT = 0.5;
const FIRST_LINE = 1.5;
const STAGGER = 0.9;
/** A page turned by the player needs no second entrance: its lines follow quickly. */
const PAGE_LEAD = 0.25;
const PAGE_STAGGER = 0.5;
/** The book's own last line waits a beat longer. */
const LAST_BEAT = 0.5;
const FADE = 0.8;
const RISE = 14;
/** The band the entries live in, between the title's room and the footer's. */
const TOP = 250;
const BOTTOM = 960;

interface Block { lines: string[]; y: number; gold: boolean }

interface PageLayout {
  /** Indices into the card's lines that this page holds. A wrapped line is never split. */
  indices: number[];
  blocks: Block[];
  titleY: number;
  ruleY: number;
  footerY: number;
}

interface Book {
  scale: number;
  size: number;
  lh: number;
  titleSize: number;
  footerSize: number;
  pages: PageLayout[];
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

export class EndingScreen {
  private t = 0;
  private backdrop: HTMLCanvasElement | null = null;
  private painted = false;
  private book: Book | null = null;
  /** Zero-based page on show. */
  private page = 0;
  /** When each page after the first started, on the card's own clock. */
  private pageStarts: number[] = [];

  constructor(
    private card: EndingCard,
    private assets: Assets,
    /** Read a page turn out; the live region is the game's. */
    private say: (text: string) => void = () => {}
  ) {}

  /** How many pages the card is, at the scale it was last laid out and drawn at. */
  get pageCount(): number {
    return this.book?.pages.length ?? 1;
  }
  get pageNumber(): number {
    return this.page + 1;
  }

  /** When entry `j` of page `p` comes up. Page 0 keeps the original ceremony exactly. */
  private entryAt(p: number, j: number): number {
    const page = this.book?.pages[p];
    const i = page?.indices[j] ?? j;
    const last = i === this.card.lines.length - 1 && i > 0;
    if (p === 0) return FIRST_LINE + i * STAGGER + (last ? LAST_BEAT : 0);
    return this.pageStart(p) + PAGE_LEAD + j * PAGE_STAGGER + (last ? LAST_BEAT : 0);
  }
  private pageStart(p: number): number {
    return p === 0 ? 0 : this.pageStarts[p] ?? this.t;
  }
  private pageDoneAt(p: number): number {
    const page = this.book?.pages[p];
    const entries = page ? page.indices.length : this.card.lines.length;
    return this.entryAt(p, Math.max(0, entries - 1)) + FADE;
  }
  /** The page on show is fully up. */
  get revealed(): boolean {
    return this.t >= this.pageDoneAt(this.page);
  }

  update(dt: number): void {
    this.t += dt;
  }

  /**
   * A click or Enter. The first brings the page up; once it all is, the next turns the page. On
   * the last page, after everything is up, true: time to go home.
   */
  advance(): boolean {
    const done = this.pageDoneAt(this.page);
    if (this.t < done) {
      this.t = Math.max(this.t, done);
      return false;
    }
    const pages = this.pageCount;
    if (this.page < pages - 1) {
      this.page += 1;
      this.pageStarts[this.page] = this.t;
      const page = this.book?.pages[this.page];
      const lines = page ? page.indices.map((i) => this.card.lines[i]).join(" ") : "";
      this.say(`page ${this.page + 1} of ${pages}. ${lines}`.trim());
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, reduced: boolean, scale: number): void {
    this.bake();
    const book = this.lay(ctx, scale);
    this.page = Math.min(this.page, book.pages.length - 1);
    const page = book.pages[this.page];
    ctx.fillStyle = "#03050c";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (this.backdrop) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.t / PAINTING_FADE);
      if (!reduced) {
        // A slow push in, as if the painting were being looked into.
        const k = 1.02 + 0.03 * Math.min(1, this.t / 40);
        ctx.translate(LOGICAL_W / 2, LOGICAL_H / 2);
        ctx.scale(k, k);
        ctx.translate(-LOGICAL_W / 2, -LOGICAL_H / 2);
      }
      ctx.drawImage(this.backdrop, 0, 0);
      ctx.restore();
    }
    const shown = (from: number) => Math.max(0, Math.min(1, (this.t - from) / FADE));
    const rise = (a: number) => (reduced ? 0 : (1 - easeOut(a)) * RISE);

    ctx.save();
    if (this.page === 0) {
      const title = fitText(ctx, this.card.title, 1700, book.titleSize, 24, "bold");
      let a = shown(TITLE_AT);
      ctx.globalAlpha = a;
      drawText(ctx, title.text, LOGICAL_W / 2, page.titleY + rise(a), {
        size: title.size, color: "#c9a24a", align: "center", weight: "bold",
      });
      a = shown(TITLE_AT + 0.35);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(201,162,74,0.6)";
      ctx.fillRect(LOGICAL_W / 2 - 70 * scale * a, page.ruleY, 140 * scale * a, 2);
    }
    page.blocks.forEach((b, j) => {
      const a = shown(this.entryAt(this.page, j));
      if (a <= 0) return;
      ctx.globalAlpha = a;
      b.lines.forEach((line, k) => drawText(ctx, line, LOGICAL_W / 2, b.y + k * book.lh + rise(a), {
        size: book.size, color: b.gold ? "#c9a24a" : "#e6ddc8", align: "center", weight: b.gold ? "bold" : "normal",
      }));
    });
    if (this.page === book.pages.length - 1) {
      const a = shown(this.pageDoneAt(this.page));
      if (a > 0) {
        ctx.globalAlpha = a;
        const footer = fitText(ctx, "click or press Enter to return to the title  ·  Chapter select is open to you now",
          1820, book.footerSize, 14);
        drawText(ctx, footer.text, LOGICAL_W / 2, page.footerY, {
          size: footer.size, color: "#d4b064", align: "center",
        });
      }
    }
    if (book.pages.length > 1) {
      // Where in the card this page is: small, out of the words' way, and never on a one-page card
      // (so 100% is exactly the card it always was).
      ctx.globalAlpha = 1;
      const counter = fitText(ctx, `${this.page + 1} / ${book.pages.length}`, 260, Math.round(18 * scale), 12);
      drawText(ctx, counter.text, LOGICAL_W - 80, 54, {
        size: counter.size, color: "rgba(212,176,100,0.85)", align: "right", shadow: false,
      });
    }
    ctx.restore();
  }

  /**
   * Where everything goes. The 100% size is the one the card has always chosen: start at 28 and
   * shrink until the entries fit, never below 18. A larger text scale multiplies *that* size, and
   * the entries paginate into the band instead of shrinking back down.
   */
  private lay(ctx: CanvasRenderingContext2D, scale: number): Book {
    if (this.book?.scale === scale) return this.book;
    const band = BOTTOM - TOP;
    const maxWidth = 1300;
    const count = this.card.lines.length;
    const isGold = (i: number) => i === count - 1 && count > 1;
    const wrapAll = (size: number) => this.card.lines.map((text, i) =>
      wrap(ctx, text, maxWidth, { size, color: "", weight: isGold(i) ? "bold" : "normal" }));
    const heightOf = (size: number, lines: string[][]) =>
      lines.reduce((h, ls) => h + ls.length * Math.round(size * 1.4) + Math.round(size * 0.6), 0);
    // The 100% size: the fit the card has always made. At a larger setting this is the base for
    // the player's scale, so their 125% really is a quarter larger than their 100%.
    let base = 28;
    let baseLines = wrapAll(base);
    while (base > 18 && heightOf(base, baseLines) > band) baseLines = wrapAll(--base);
    const size = scale <= 1 ? base : Math.round(base * scale);
    const lines = scale <= 1 ? baseLines : wrapAll(size);
    const lh = Math.round(size * 1.4);
    const gap = Math.round(size * 0.6);
    // Whole entries per page: a thought is never cut in half across two pages.
    const rows: number[][] = [];
    let current: number[] = [];
    let used = 0;
    lines.forEach((ls, i) => {
      const h = ls.length * lh + gap;
      if (current.length && used + h > band) { rows.push(current); current = []; used = 0; }
      current.push(i);
      used += h;
    });
    if (current.length) rows.push(current);
    if (!rows.length) rows.push([]);
    const pages = rows.map((indices): PageLayout => {
      const height = indices.reduce((h, i) => h + lines[i].length * lh + gap, 0);
      let y = TOP + Math.max(0, (band - height) / 3);
      const startY = y;
      const blocks = indices.map((i) => {
        const block = { lines: lines[i], y: y + (isGold(i) ? size * 0.4 : 0), gold: isGold(i) };
        y += lines[i].length * lh + gap;
        return block;
      });
      return {
        indices, blocks,
        titleY: startY - Math.round(120 * scale),
        ruleY: startY - Math.round(50 * scale),
        footerY: Math.min(1040, Math.max(1000, y + 30)),
      };
    });
    this.book = {
      scale, size, lh, pages,
      titleSize: Math.round(40 * scale),
      footerSize: Math.round(20 * scale),
    };
    return this.book;
  }

  /**
   * The backdrop, made once: the painting covering the screen around its focus, softened by
   * drawing it small and scaling it back up (a blur no canvas filter is needed for), then
   * darkened so the words read. Made again if the painting arrives after the card does.
   */
  private bake(): void {
    const img = this.assets.img(this.card.image);
    if (this.backdrop && (this.painted || !img)) return;
    const c = this.backdrop ?? document.createElement("canvas");
    c.width = LOGICAL_W;
    c.height = LOGICAL_H;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#03050c";
    g.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (img && img.width > 0) {
      const sw = 320, sh = 180;
      const small = document.createElement("canvas");
      small.width = sw;
      small.height = sh;
      const s = small.getContext("2d");
      if (s) {
        s.imageSmoothingQuality = "high";
        const k = Math.max(sw / img.width, sh / img.height);
        const dw = img.width * k, dh = img.height * k;
        const fx = ((this.card.focus?.x ?? WORLD_W / 2) / WORLD_W) * img.width;
        const fy = ((this.card.focus?.y ?? SCENE_H / 2) / SCENE_H) * img.height;
        const ox = Math.max(sw - dw, Math.min(0, sw / 2 - fx * k));
        const oy = Math.max(sh - dh, Math.min(0, sh / 2 - fy * k));
        s.drawImage(img, ox, oy, dw, dh);
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.drawImage(small, 0, 0, LOGICAL_W, LOGICAL_H);
        this.painted = true;
      }
    }
    const wash = g.createLinearGradient(0, 0, 0, LOGICAL_H);
    wash.addColorStop(0, "rgba(3,5,12,0.58)");
    wash.addColorStop(0.45, "rgba(3,5,12,0.5)");
    wash.addColorStop(1, "rgba(3,5,12,0.84)");
    g.fillStyle = wash;
    g.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const vignette = g.createRadialGradient(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.3, LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.95);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.backdrop = c;
  }
}
