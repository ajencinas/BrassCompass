/**
 * The calibration overlay (`D`): walk areas, occluders, hotspot rectangles, the horizon, and a
 * labelled 1.75 m silhouette at sample points across the floor.
 *
 * It lives apart from the game because it is a measuring instrument, not gameplay: the only
 * thing it needs is the room, a way to ask how tall a person is at a given floor row, and the
 * editor's currently-dragged handle.
 */

import { LOGICAL_W } from "../engine/view";
import { drawText } from "../engine/text";
import type { Poly, Pt } from "../engine/walkbox";
import type { Room } from "./types";

export interface DebugHost {
  ctx: CanvasRenderingContext2D;
  room: Room;
  devHandle: Pt | null;
  personHeight(y: number): number;
}

export function drawDebugOverlay(host: DebugHost): void {
  const { ctx, room } = host;
  const poly = (p: Poly) => {
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  };

  ctx.save();
  ctx.lineWidth = 2;

  ctx.strokeStyle = "#3f6";
  for (const p of room.walk) { poly(p); ctx.stroke(); }

  ctx.strokeStyle = "#f3c";
  for (const o of room.occluders ?? []) {
    poly(o.area);
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(o.area[0].x, o.y);
    ctx.lineTo(Math.max(...o.area.map((q) => q.x)), o.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#39f";
  for (const h of room.hotspots) {
    if ("rect" in h.area) {
      ctx.strokeRect(h.area.rect.x, h.area.rect.y, h.area.rect.w, h.area.rect.h);
    } else {
      poly(h.area);
      ctx.stroke();
    }
    if (h.stand) {
      ctx.fillStyle = "#39f";
      ctx.fillRect(h.stand.x - 5, h.stand.y - 5, 10, 10);
    }
  }

  ctx.strokeStyle = "#ff0";
  ctx.beginPath();
  ctx.moveTo(0, room.perspective.horizon);
  ctx.lineTo(room.width ?? LOGICAL_W, room.perspective.horizon);
  ctx.stroke();

  drawScaleGauge(host);

  // Vertices, the entry and arrival points: the handles the dev editor can drag.
  const dot = (p: Pt, color: string, r = 4) => {
    ctx.fillStyle = color;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  };
  for (const p of room.walk) p.forEach((q) => dot(q, "#3f6"));
  for (const o of room.occluders ?? []) o.area.forEach((q) => dot(q, "#f3c"));
  for (const h of room.hotspots) if (!("rect" in h.area)) (h.area as Poly).forEach((q) => dot(q, "#39f", 3));
  dot(room.entry, "#fff", 6);
  for (const p of Object.values(room.arrive ?? {})) dot(p, "#fc6", 6);

  if (host.devHandle) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(host.devHandle.x - 9, host.devHandle.y - 9, 18, 18);
  }
  ctx.restore();
}

/**
 * A 1.75 m human silhouette at sample points across the floor — the only way to see a wrong
 * scale before it ships. If the figure is not the height of the furniture beside it, the room's
 * perspective is wrong.
 */
function drawScaleGauge(host: DebugHost): void {
  const { ctx, room } = host;
  const samples: Pt[] = [];
  for (const p of room.walk) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      for (let t = 0.2; t < 1; t += 0.3) {
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }

  ctx.save();
  for (const s of samples) {
    const h = host.personHeight(s.y);
    if (h < 24) continue;
    const w = h * 0.15;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(s.x - w * 0.75, s.y - h * 0.44);
    ctx.lineTo(s.x - w * 0.62, s.y - h * 0.86);
    ctx.lineTo(s.x + w * 0.62, s.y - h * 0.86);
    ctx.lineTo(s.x + w * 0.75, s.y - h * 0.44);
    ctx.lineTo(s.x + w * 0.5, s.y);
    ctx.lineTo(s.x - w * 0.5, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.x, s.y - h * 0.93, h * 0.068, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s.x - w * 0.9, s.y);
    ctx.lineTo(s.x + w * 0.9, s.y);
    ctx.stroke();

    drawText(ctx, `${Math.round(h)}`, s.x + w, s.y - h * 0.99, {
      size: 13,
      color: "rgba(255,255,255,0.75)",
      shadow: false,
    });
  }
  ctx.restore();
}
