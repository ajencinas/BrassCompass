/**
 * The calibration overlay (`D`): walk areas, occluders, hotspot rectangles, the horizon, the
 * atmosphere (light radii, water and mote areas, fog bands and their floor lines, the beacon and
 * sound emitters), and a labelled 1.75 m silhouette at sample points across the floor.
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

  drawAtmosphere(host);
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
  for (const l of room.lights ?? []) dot(l.at, "#f93", 5);
  for (const w of room.water ?? []) w.area.forEach((q) => dot(q, "#3cf"));
  for (const m of room.motes ?? []) m.area.forEach((q) => dot(q, "#c9f"));
  if (room.beacon) dot(room.beacon.at, "#ff9", 5);
  for (const e of room.emitters ?? []) if (e.at) dot(e.at, "#f6f", 5);

  if (host.devHandle) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(host.devHandle.x - 9, host.devHandle.y - 9, 18, 18);
  }
  ctx.restore();
}

/** Where the room's atmosphere is: each effect in its own colour, labelled. */
function drawAtmosphere(host: DebugHost): void {
  const { ctx, room } = host;
  const label = (text: string, x: number, y: number, color: string) =>
    drawText(ctx, text, x, y, { size: 13, color, shadow: true });
  const outline = (p: Poly) => {
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
  };
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const l of room.lights ?? []) {
    ctx.strokeStyle = "#f93";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(l.at.x, l.at.y, l.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(l.at.x, l.at.y, l.radius * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    label(`${l.kind}${l.showIf ? " (if)" : ""}`, l.at.x + 8, l.at.y + 6, "#fc9");
  }
  ctx.strokeStyle = "#3cf";
  for (const w of room.water ?? []) { outline(w.area); label(`water ${w.ripple}`, w.area[0].x + 6, w.area[0].y + 4, "#9ef"); }
  ctx.strokeStyle = "#c9f";
  for (const m of room.motes ?? []) { outline(m.area); label(`${m.kind} ${m.count}`, m.area[0].x + 6, m.area[0].y + 4, "#dbf"); }
  const width = room.width ?? LOGICAL_W;
  for (const h of room.haze ?? []) {
    ctx.strokeStyle = "rgba(220,220,230,0.8)";
    ctx.setLineDash([3, 7]);
    for (const y of [h.top, h.bottom]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.setLineDash([14, 6]);
    ctx.beginPath(); ctx.moveTo(0, h.floor); ctx.lineTo(width, h.floor); ctx.stroke();
    ctx.setLineDash([]);
    label(`haze ${h.top}-${h.bottom}, floor ${h.floor}`, 12, h.floor - 18, "#eee");
  }
  if (room.beacon) {
    const { x, y } = room.beacon.at;
    ctx.strokeStyle = "#ff9";
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke();
    label(`beacon ${room.beacon.period}s`, x + 18, y + 10, "#ffc");
  }
  for (const e of room.emitters ?? []) {
    if (!e.at) continue;
    ctx.strokeStyle = "#f6f";
    ctx.beginPath();
    ctx.moveTo(e.at.x, e.at.y - 10); ctx.lineTo(e.at.x + 10, e.at.y); ctx.lineTo(e.at.x, e.at.y + 10); ctx.lineTo(e.at.x - 10, e.at.y); ctx.closePath();
    ctx.stroke();
    label(e.kind, e.at.x + 12, e.at.y - 6, "#fbf");
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
