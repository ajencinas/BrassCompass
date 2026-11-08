/**
 * Small proofs that the game heard you: a ring on the floor where a click sent Fenn, the thing
 * he picks up flying into its place in the inventory, and a glow on what's new there.
 * Reduced motion: the ring doesn't grow and nothing flies; the glow holds still and fades.
 */

import { drawText } from "../engine/text";
import type { Pt } from "../engine/walkbox";
import type { Rect } from "./types";

interface Ring { x: number; y: number; size: number; t: number }
interface Flight { id: string; label: string; icon: HTMLImageElement | null; from: Pt; t: number }

const RING_LIFE = 0.55;
const FLIGHT_LIFE = 0.62;
/** How long a new item glows, unless the player gets to it first. */
const GLOW_LIFE = 5;

const easeInOut = (t: number): number => t * t * (3 - 2 * t);

export class Fx {
  private rings: Ring[] = [];
  private flights: Flight[] = [];
  /** Seconds of glow left, per new item. */
  private fresh = new Map<string, number>();

  /** A click sent Fenn to `at` (world); `size` is a person's height there, for perspective. */
  ring(at: Pt, size: number): void {
    this.rings.length = 0;
    this.rings.push({ x: at.x, y: at.y, size, t: 0 });
  }

  /** `id` was picked up at `from` (screen); it flies to its slot and lands glowing. */
  flight(id: string, label: string, from: Pt, icon: HTMLImageElement | null): void {
    this.flights.push({ id, label, icon, from: { ...from }, t: 0 });
    this.fresh.set(id, GLOW_LIFE);
  }

  /** `id` just arrived in the inventory. */
  freshen(id: string): void {
    this.fresh.set(id, GLOW_LIFE);
  }

  /** The player has used or looked at it: it isn't news any more. */
  seen(id: string): void {
    this.fresh.delete(id);
  }

  /** A new room, a new voyage: nothing in flight carries over. */
  clear(): void {
    this.rings.length = 0;
    this.flights.length = 0;
  }

  update(dt: number): void {
    for (const r of this.rings) r.t += dt;
    for (const f of this.flights) f.t += dt;
    if (this.rings.length && this.rings[0].t > RING_LIFE) this.rings.length = 0;
    while (this.flights.length && this.flights[0].t > FLIGHT_LIFE) this.flights.shift();
    for (const [id, left] of this.fresh) {
      if (left - dt <= 0) this.fresh.delete(id);
      else this.fresh.set(id, left - dt);
    }
  }

  /** How brightly each new item glows (0..1): full for most of its life, fading at the end. */
  glows(): Record<string, number> | null {
    if (!this.fresh.size) return null;
    const out: Record<string, number> = {};
    for (const [id, left] of this.fresh) {
      // Not until its flight lands.
      if (this.flights.some((f) => f.id === id)) continue;
      out[id] = Math.min(1, left / 1.2);
    }
    return out;
  }

  /** Floor rings, in world coordinates (the caller has the camera applied). */
  drawWorld(ctx: CanvasRenderingContext2D, reduced: boolean): void {
    for (const r of this.rings) {
      const t = Math.min(1, r.t / RING_LIFE);
      const grow = reduced ? 1 : 0.45 + 0.55 * (1 - (1 - t) * (1 - t));
      const rx = r.size * 0.2 * grow, ry = rx * 0.32;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = "#ecd29a";
      ctx.lineWidth = Math.max(1.5, r.size * 0.012);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Flights, in screen coordinates, over the panel: `slot` says where an item lands. */
  drawScreen(ctx: CanvasRenderingContext2D, slot: (id: string) => Rect | null, reduced: boolean): void {
    if (reduced) return;
    for (const f of this.flights) {
      const to = slot(f.id);
      if (!to) continue;
      const t = easeInOut(Math.min(1, f.t / FLIGHT_LIFE));
      const ex = to.x + to.w / 2, ey = to.y + to.h / 2;
      // A short arc: up and over, landing in the slot.
      const cx = (f.from.x + ex) / 2, cy = Math.min(f.from.y, ey) - 160;
      const x = (1 - t) * (1 - t) * f.from.x + 2 * (1 - t) * t * cx + t * t * ex;
      const y = (1 - t) * (1 - t) * f.from.y + 2 * (1 - t) * t * cy + t * t * ey;
      const scale = 1 - 0.35 * t;
      ctx.save();
      ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (f.icon && f.icon.width > 0) {
        const k = Math.min(72 / f.icon.width, 72 / f.icon.height);
        ctx.drawImage(f.icon, -f.icon.width * k / 2, -f.icon.height * k / 2, f.icon.width * k, f.icon.height * k);
      } else {
        ctx.font = "italic 24px Georgia, serif";
        const w = ctx.measureText(f.label).width + 28;
        ctx.fillStyle = "rgba(20,16,10,0.9)";
        ctx.fillRect(-w / 2, -21, w, 42);
        ctx.strokeStyle = "rgba(255,226,160,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-w / 2 + 1, -20, w - 2, 40);
        drawText(ctx, f.label, 0, -13, { size: 24, color: "#fff3cf", align: "center", weight: "italic", shadow: false });
      }
      ctx.restore();
    }
  }
}
