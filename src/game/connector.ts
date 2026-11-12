/**
 * The short passage shot between two rooms that do not share a painted threshold.
 *
 * It is deliberately a *shot*, not a card: a one-point perspective street, stair, quay or plank
 * corridor (or a small boat on the Shroud) with lamps sliding past the camera. No words, no
 * title, no progress mark. The whole thing runs on game time for 0.5–0.9 s while the curtain is
 * black, so it feels like walking through the gap rather than waiting behind it.
 *
 * The direction follows the exit side: leaving left sends the lamps and the camera left, leaving
 * right sends them right. The arrival wipe then reveals the next painting from the opposite
 * side, so the two rooms continue one movement.
 */

import { LOGICAL_H, LOGICAL_W } from "../engine/view";
import type { ExitSide, PassageKind } from "./connect";

const W = LOGICAL_W;
const H = LOGICAL_H;
const TAU = Math.PI * 2;

type Rgb = readonly [number, number, number];

interface Look {
  skyTop: string;
  skyBottom: string;
  floorFar: string;
  floorNear: string;
  wall: string;
  wallEdge: string;
  beam: string;
  lamp: Rgb;
  fog: Rgb;
  planks?: boolean;
  steps?: boolean;
  water?: boolean;
  overhead?: boolean;
}

const STREET: Look = {
  skyTop: "#07111b", skyBottom: "#112231", floorFar: "#18232a", floorNear: "#2a3036",
  wall: "#0b0d10", wallEdge: "#2b251f", beam: "#1a1511",
  lamp: [255, 196, 108], fog: [150, 180, 204], overhead: true,
};
const STEPS: Look = {
  ...STREET,
  skyTop: "#06101a", skyBottom: "#142836", floorFar: "#1c252a", floorNear: "#33322e",
  wall: "#0a0b0d", wallEdge: "#312a22", steps: true,
};
const QUAY: Look = {
  skyTop: "#050f19", skyBottom: "#0e2331", floorFar: "#15242d", floorNear: "#253039",
  wall: "#080f15", wallEdge: "#233640", beam: "#101b22",
  lamp: [255, 205, 128], fog: [148, 180, 201], water: true,
};
const PLANKS: Look = {
  skyTop: "#09080a", skyBottom: "#1a1714", floorFar: "#24160e", floorNear: "#332014",
  wall: "#100b08", wallEdge: "#3b2617", beam: "#24160e",
  lamp: [255, 176, 92], fog: [116, 138, 154], planks: true, overhead: true,
};

/** Seconds each passage holds. All inside the 0.5–0.9 s brief. */
const DURATION: Record<PassageKind, number> = {
  steps: 0.60,
  street: 0.66,
  quay: 0.62,
  water: 0.86,
  planks: 0.54,
};

function rgba(c: Rgb, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function smooth(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function lookFor(kind: PassageKind): Look {
  switch (kind) {
    case "steps": return STEPS;
    case "quay": return QUAY;
    case "planks": return PLANKS;
    case "street": return STREET;
    case "water": return QUAY;
  }
}

/** A warm needle of light, with its wet-stone reflection beneath it. */
function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: Rgb, strength: number): void {
  if (r < 1) return;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
  halo.addColorStop(0, rgba(colour, 0.9 * strength));
  halo.addColorStop(0.22, rgba(colour, 0.42 * strength));
  halo.addColorStop(1, rgba(colour, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = rgba(colour, 0.95 * strength);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.2, r * 0.07), 0, TAU);
  ctx.fill();
  // The reflection is a narrow, broken ladder down the wet floor.
  const low = ctx.createLinearGradient(0, y, 0, y + r * 5);
  low.addColorStop(0, rgba(colour, 0.18 * strength));
  low.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = low;
  ctx.fillRect(x - r * 0.16, y, r * 0.32, r * 5);
}

/** The receding street / corridor shared by every dry passage. */
function corridor(ctx: CanvasRenderingContext2D, t: number, side: ExitSide, look: Look): void {
  const dir = side === "left" ? -1 : 1;
  const vx = W * 0.5 + dir * W * 0.08;
  const vy = H * 0.47;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, look.skyTop);
  sky.addColorStop(0.62, look.skyBottom);
  sky.addColorStop(1, "#04070a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const fog = ctx.createRadialGradient(vx, vy, 0, vx, vy, W * 0.44);
  fog.addColorStop(0, rgba(look.fog, 0.34));
  fog.addColorStop(0.42, rgba(look.fog, 0.12));
  fog.addColorStop(1, rgba(look.fog, 0));
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);

  const ground = ctx.createLinearGradient(0, vy, 0, H);
  ground.addColorStop(0, look.floorFar);
  ground.addColorStop(1, look.floorNear);
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(W, H);
  ctx.lineTo(vx + W * 0.075, vy + H * 0.035);
  ctx.lineTo(vx - W * 0.075, vy + H * 0.035);
  ctx.closePath();
  ctx.fillStyle = ground;
  ctx.fill();

  // A lane of planks running away from the camera.
  if (look.planks) {
    ctx.strokeStyle = "rgba(8,5,3,0.55)";
    ctx.lineWidth = Math.max(1, W * 0.0016);
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * W * 0.078, H);
      ctx.lineTo(vx + i * W * 0.011, vy + H * 0.035);
      ctx.stroke();
    }
  }

  // A narrow, cold channel of water on the outer edge of the quay.
  if (look.water) {
    const seaX = dir < 0 ? W * 0.78 : 0;
    const seaW = W * 0.22;
    const sea = ctx.createLinearGradient(seaX, vy, seaX, H);
    sea.addColorStop(0, "rgba(20,54,68,0.65)");
    sea.addColorStop(1, "rgba(7,22,31,0.9)");
    ctx.fillStyle = sea;
    ctx.fillRect(seaX, vy + H * 0.06, seaW, H);
    for (let i = 0; i < 9; i++) {
      const y = vy + H * 0.12 + i * H * 0.085 + Math.sin(t * 4 + i) * 3;
      const x = seaX + ((i * 0.37 + t * 0.8) % 1) * seaW;
      ctx.strokeStyle = `rgba(170,205,222,${0.05 + (i % 3) * 0.02})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - W * 0.04, y);
      ctx.lineTo(x + W * 0.04, y);
      ctx.stroke();
    }
  }

  // Layers of wall, lamps and floor seams. A layer moves from the far dark toward the camera
  // and wraps, which is what makes it read as walking rather than a still.
  const phase = (t * 1.55) % 1;
  const layers: { z: number; s: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const z = (i / 8 - phase + 1) % 1;
    layers.push({ z, s: 1 - z * 0.93 });
  }
  layers.sort((a, b) => b.z - a.z);

  for (const { s } of layers) {
    const leftX = vx - W * 0.56 * s;
    const rightX = vx + W * 0.56 * s;
    const top = vy - H * 0.46 * s;
    const bottom = vy + H * 0.48 * s;

    // The walls are painted out to the frame edge, so the passage has no visible boundary.
    ctx.fillStyle = look.wall;
    ctx.beginPath();
    ctx.moveTo(0, top - H * 0.3);
    ctx.lineTo(leftX, top);
    ctx.lineTo(leftX, bottom);
    ctx.lineTo(0, bottom + H * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, top - H * 0.3);
    ctx.lineTo(rightX, top);
    ctx.lineTo(rightX, bottom);
    ctx.lineTo(W, bottom + H * 0.3);
    ctx.closePath();
    ctx.fill();

    // The lit inner edge is the only line that says how far away the wall is.
    ctx.strokeStyle = look.wallEdge;
    ctx.lineWidth = Math.max(1, W * 0.0022 * s);
    ctx.beginPath();
    ctx.moveTo(leftX, top);
    ctx.lineTo(leftX, bottom);
    ctx.moveTo(rightX, top);
    ctx.lineTo(rightX, bottom);
    ctx.stroke();

    if (look.overhead) {
      ctx.fillStyle = look.beam;
      ctx.fillRect(leftX, top + H * 0.018 * s, rightX - leftX, Math.max(1, H * 0.014 * s));
    }

    // Two warm windows/lanterns on the inner walls, sliding out toward the viewer.
    const lampY = vy - H * 0.16 * s;
    lamp(ctx, leftX + W * 0.022 * s, lampY, W * 0.07 * s, look.lamp, 0.55 + 0.45 * s);
    lamp(ctx, rightX - W * 0.022 * s, lampY, W * 0.07 * s, look.lamp, 0.55 + 0.45 * s);

    // A floor seam, or the riser of a stone step.
    const seamY = vy + H * 0.41 * s;
    if (look.steps) {
      // A broad stone stair: the riser is dark, the nosing catches the cold rim light.
      const stepH = Math.max(2, H * 0.026 * s);
      ctx.fillStyle = "rgba(15,19,23,0.94)";
      ctx.fillRect(vx - W * 0.50 * s, seamY, W * 1.0 * s, stepH);
      ctx.strokeStyle = "rgba(188,205,212,0.30)";
      ctx.lineWidth = Math.max(1, W * 0.0012 * s);
      ctx.beginPath();
      ctx.moveTo(vx - W * 0.50 * s, seamY);
      ctx.lineTo(vx + W * 0.50 * s, seamY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.moveTo(vx - W * 0.50 * s, seamY + stepH);
      ctx.lineTo(vx + W * 0.50 * s, seamY + stepH);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(190,208,218,${0.10 * s})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vx - W * 0.48 * s, seamY);
      ctx.lineTo(vx + W * 0.48 * s, seamY);
      ctx.stroke();
    }
  }

  // Foreground mooring posts give the quay its measure; the passage had been all middle
  // distance and no near thing to pass.
  if (look.water) {
    for (const sideX of [W * 0.075, W * 0.90]) {
      ctx.fillStyle = "#050a0d";
      ctx.fillRect(sideX, H * 0.82, W * 0.022, H * 0.20);
      ctx.fillStyle = "rgba(150,178,194,0.16)";
      ctx.fillRect(sideX - W * 0.004, H * 0.82, W * 0.030, H * 0.012);
      ctx.strokeStyle = "rgba(120,145,160,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sideX + W * 0.011, H * 0.84, W * 0.012, 0, TAU);
      ctx.stroke();
    }
  }

  // The far end of the passage: a lit doorway (or the top of the stair) waiting at the vanish.
  const doorW = W * 0.055;
  const doorTop = vy - H * 0.11;
  const doorH = H * 0.19;
  const door = ctx.createLinearGradient(0, doorTop, 0, doorTop + doorH);
  door.addColorStop(0, rgba(look.lamp, 0.5));
  door.addColorStop(1, rgba(look.lamp, 0.06));
  ctx.fillStyle = door;
  ctx.fillRect(vx - doorW / 2, doorTop, doorW, doorH);
  lamp(ctx, vx, doorTop + doorH * 0.42, W * 0.10, look.lamp, 0.7);

  // Speed streaks: a few faint lines crossing the frame opposite the walk, so even a still
  // corridor has the direction of travel in it.
  ctx.strokeStyle = rgba(look.fog, 0.10);
  ctx.lineWidth = Math.max(1, W * 0.0014);
  for (let i = 0; i < 7; i++) {
    const y = H * (0.24 + i * 0.085);
    const x = ((i * 0.19 + t * 1.7) % 1) * W;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * W * 0.16, y);
    ctx.stroke();
  }
}

/** The longboat crossing to the wreck: fog, a low horizon and a green lantern in the distance. */
function water(ctx: CanvasRenderingContext2D, t: number, side: ExitSide): void {
  const dir = side === "left" ? -1 : 1;
  const horizon = H * 0.47;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#050e18");
  sky.addColorStop(0.7, "#102534");
  sky.addColorStop(1, "#1c3642");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, "#173b45");
  sea.addColorStop(0.35, "#0d2833");
  sea.addColorStop(1, "#06151e");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);

  // Fog sitting on the water, and a cold rim on the horizon.
  const band = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.18);
  band.addColorStop(0, "rgba(158,186,203,0)");
  band.addColorStop(0.32, "rgba(158,186,203,0.18)");
  band.addColorStop(1, "rgba(158,186,203,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, horizon - H * 0.12, W, H * 0.3);

  // The far shore, then the wreck and its unnatural green light.
  ctx.fillStyle = "#071219";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 4);
  for (let x = 0; x <= W; x += W / 12) {
    ctx.lineTo(x, horizon - 2 - Math.sin(x * 0.006 + 1.7) * H * 0.012);
  }
  ctx.lineTo(W, horizon + H * 0.06);
  ctx.lineTo(0, horizon + H * 0.06);
  ctx.closePath();
  ctx.fill();

  const wx = W * (dir < 0 ? 0.71 : 0.29);
  const wy = horizon + H * 0.02;
  ctx.fillStyle = "#04090c";
  ctx.beginPath();
  ctx.moveTo(wx - W * 0.11, wy);
  ctx.lineTo(wx + W * 0.11, wy);
  ctx.lineTo(wx + W * 0.075, wy + H * 0.045);
  ctx.lineTo(wx - W * 0.085, wy + H * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(4,9,12,0.95)";
  ctx.lineWidth = Math.max(1.5, W * 0.003);
  for (const [mx, mh] of [[-0.055, 0.2], [0.01, 0.25], [0.06, 0.17]] as const) {
    ctx.beginPath();
    ctx.moveTo(wx + W * mx, wy);
    ctx.lineTo(wx + W * mx + W * 0.012, wy - H * mh);
    ctx.stroke();
  }
  lamp(ctx, wx + W * 0.01, wy - H * 0.15, W * 0.09, [121, 230, 164], 0.9);

  // The longboat: a dark side-on hull with a lantern at the bow, rowing across the frame.
  const bx = W * 0.5 - dir * W * 0.06;
  const by = H * 0.77 + Math.sin(t * TAU * 1.4) * H * 0.008;
  const bow = dir < 0 ? -1 : 1;
  ctx.fillStyle = "#050a0d";
  ctx.beginPath();
  ctx.moveTo(bx - W * 0.21 * bow, by);
  ctx.lineTo(bx + W * 0.18 * bow, by - H * 0.004);
  ctx.lineTo(bx + W * 0.13 * bow, by + H * 0.055);
  ctx.lineTo(bx - W * 0.10 * bow, by + H * 0.052);
  ctx.lineTo(bx - W * 0.20 * bow, by + H * 0.024);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(3,7,9,0.9)";
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.beginPath();
  ctx.moveTo(bx - W * 0.14 * bow, by - H * 0.002);
  ctx.lineTo(bx + W * 0.22 * bow, by + H * 0.06);
  ctx.moveTo(bx + W * 0.14 * bow, by - H * 0.002);
  ctx.lineTo(bx - W * 0.22 * bow, by + H * 0.06);
  ctx.stroke();
  lamp(ctx, bx - W * 0.19 * bow, by - H * 0.02, W * 0.075, [255, 193, 105], 1);

  // Wake and reflected light.
  ctx.strokeStyle = "rgba(172,205,220,0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = by + H * (0.06 + i * 0.013);
    const x = bx - bow * W * (0.18 + i * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - bow * W * (0.06 + i * 0.018), y + H * 0.006);
    ctx.stroke();
  }
  const reflect = ctx.createLinearGradient(0, by, 0, H);
  reflect.addColorStop(0, "rgba(255,193,105,0.16)");
  reflect.addColorStop(1, "rgba(255,193,105,0)");
  ctx.fillStyle = reflect;
  ctx.fillRect(bx - W * 0.2 * bow - W * 0.035, by, W * 0.07, H - by);

  // Ripple bands, moving with the boat.
  for (let i = 0; i < 12; i++) {
    const y = horizon + H * 0.06 + i * H * 0.041;
    const drift = ((i * 0.31 + t * 1.1) % 1) * W;
    ctx.strokeStyle = `rgba(154,190,207,${0.04 + (i % 3) * 0.012})`;
    ctx.beginPath();
    ctx.moveTo(drift - W * 0.1, y + Math.sin(i + t * 3) * 2);
    ctx.lineTo(drift + W * 0.1, y + Math.sin(i + t * 3) * 2);
    ctx.stroke();
  }

  // Low fog drifting across the middle distance.
  for (let i = 0; i < 3; i++) {
    const x = ((i * 0.41 + t * 0.35) % 1) * W;
    const y = horizon + H * 0.03 + i * H * 0.035;
    const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.24);
    g.addColorStop(0, "rgba(150,181,199,0.10)");
    g.addColorStop(1, "rgba(150,181,199,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Darken the frame's edges without touching the centre of the passage. */
function vignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.18, W * 0.5, H * 0.48, W * 0.68);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.72, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export class Connector {
  private spec: { kind: PassageKind; side: ExitSide; from: string; to: string } | null = null;
  private elapsed = 0;
  private duration = 0.65;

  get active(): boolean {
    return this.spec !== null;
  }

  get kind(): PassageKind | null {
    return this.spec?.kind ?? null;
  }

  begin(kind: PassageKind, side: ExitSide, from: string, to: string): void {
    this.spec = { kind, side, from, to };
    this.elapsed = 0;
    this.duration = DURATION[kind];
  }

  /** Advance the shot. Returns true once it has run its full length. */
  update(dt: number): boolean {
    if (!this.spec) return true;
    this.elapsed += dt;
    return this.elapsed >= this.duration;
  }

  end(): void {
    this.spec = null;
    this.elapsed = 0;
  }

  /**
   * `height` is the logical height of the canvas being drawn into: the shot is composed for the
   * full 1080-high frame, so on the phone's 880-high scene canvas it is squeezed to fit rather
   * than losing its bottom 200 px.
   */
  draw(ctx: CanvasRenderingContext2D, reduced: boolean, height = H, centerX = W / 2): void {
    if (!this.spec) return;
    const t = clamp01(this.elapsed / this.duration);
    const kind = this.spec.kind;
    ctx.save();
    if (height > 0 && height < H) ctx.scale(1, height / H);
    ctx.fillStyle = "#020406";
    ctx.fillRect(0, 0, W, H);
    // A portrait phone sees only a slice of the width: compose the shot around that slice's
    // middle, so the vanishing point is where the player is looking (the fill above already
    // covers the canvas; the shot is wider than the slice, so it covers the slice).
    if (centerX !== W / 2) ctx.translate(centerX - W / 2, 0);
    if (reduced) {
      // Reduced motion gets no travelling shot. The room's own fade is enough.
      ctx.restore();
      return;
    }
    if (kind === "water") water(ctx, t, this.spec.side);
    else corridor(ctx, t, this.spec.side, lookFor(kind));
    vignette(ctx);
    // Ease in from black and back out to black, so the shot has no hard first or last frame.
    const cover = 1 - smooth(0, 0.16, t) * smooth(0, 0.2, 1 - t);
    if (cover > 0.001) {
      ctx.fillStyle = `rgba(2,4,6,${cover})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
