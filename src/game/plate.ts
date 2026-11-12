/**
 * The brass-plate language of the title screen, for the in-play chrome.
 *
 * The title's buttons are dark glass plates with a brass edge, a hairline inside and corner
 * ticks. The verb matrix, the satchel, the top bar and the sentence line used to be thin outlined
 * boxes beside them. These helpers add the same material to what those already draw: they never
 * replace a cell's own border or fill (those carry the contrast and high-contrast rules), they
 * lay a dark inner panel, a bevel and rivets inside it, and warm it when it is lit.
 *
 * Everything here is plain fills and strokes, no gradients or shadows built per frame.
 */

export interface PlateLook {
  /** The pointer or the keyboard is on it: the glass warms. */
  hover?: boolean;
  /** A chosen thing: warmer still, and bevelled inward as if pressed. */
  active?: boolean;
  /** Corner radius of the surface this is laid in (0 for a square cell). */
  radius?: number;
  /** Brass studs in the corners (large plates only). */
  rivets?: boolean;
  /** Skip the dark inner panel: the surface already has its own fill. */
  bare?: boolean;
}

const BRASS_HI = "rgba(240,208,142,";
// Every colour the bevel and studs use, built once: this runs for each plate on every frame, and a
// string concatenated per call is a string allocated per call.
const PANEL = { active: "rgba(46,35,17,0.5)", hover: "rgba(36,28,16,0.46)", rest: "rgba(4,7,14,0.42)" };
const BEVEL_TOP = { pressed: "rgba(120,90,38,0.5)", lit: BRASS_HI + "0.5)", rest: BRASS_HI + "0.3)" };
const BEVEL_BOTTOM = { pressed: BRASS_HI + "0.34)", normal: "rgba(0,0,0,0.55)" };
const STUD = { lit: BRASS_HI + "0.8)", rest: BRASS_HI + "0.5)" };
const TAU = Math.PI * 2;

/**
 * A dark glass panel inset 2 px from the edge of the box, a bevel (light on the top and left,
 * dark on the bottom and right; swapped when pressed) and four studs. Call it after the cell's own
 * fill and border so its edge stays the outermost line.
 */
export function brassInset(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, look: PlateLook = {}): void {
  const r = look.radius ?? 0;
  const lit = look.hover || look.active;
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  ctx.save();
  if (!look.bare) {
    // The inner panel: a darker, slightly warm pane inside the edge, so the label sits on glass.
    ctx.fillStyle = look.active ? PANEL.active : look.hover ? PANEL.hover : PANEL.rest;
    if (r > 0) {
      roundedPath(ctx, ix, iy, iw, ih, Math.max(0, r - 2));
      ctx.fill();
    } else {
      ctx.fillRect(ix, iy, iw, ih);
    }
  }
  // The bevel: two lit edges and two shaded ones, inset a pixel past the border.
  const inset = 3.5 + r * 0.55;
  const pressed = look.active === true;
  const top = pressed ? BEVEL_TOP.pressed : lit ? BEVEL_TOP.lit : BEVEL_TOP.rest;
  const bottom = pressed ? BEVEL_BOTTOM.pressed : BEVEL_BOTTOM.normal;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.strokeStyle = top;
  ctx.beginPath();
  ctx.moveTo(x + inset, y + 2.5); ctx.lineTo(x + w - inset, y + 2.5);
  ctx.moveTo(x + 2.5, y + inset); ctx.lineTo(x + 2.5, y + h - inset);
  ctx.stroke();
  ctx.strokeStyle = bottom;
  ctx.beginPath();
  ctx.moveTo(x + inset, y + h - 2.5); ctx.lineTo(x + w - inset, y + h - 2.5);
  ctx.moveTo(x + w - 2.5, y + inset); ctx.lineTo(x + w - 2.5, y + h - inset);
  ctx.stroke();
  if (look.rivets && w >= 90 && h >= 30) {
    ctx.fillStyle = lit ? STUD.lit : STUD.rest;
    const k = 5.5 + r * 0.3;
    // Four studs in one path: no array of corners built per plate per frame.
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const px = i & 1 ? x + w - k : x + k, py = i & 2 ? y + h - k : y + k;
      ctx.moveTo(px + 1.25, py);
      ctx.arc(px, py, 1.25, 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}

/** The colour of the pale lip an engraved letter leaves on its lower edge. */
export const ENGRAVE_LIP = "rgba(255,226,160,0.16)";
/** The dark cut above it. */
export const ENGRAVE_CUT = "rgba(0,0,0,0.7)";

/** A rounded-rectangle path by hand, so it never depends on roundRect support. */
function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}
