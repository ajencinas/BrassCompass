/**
 * Per-room scale.
 *
 * A single `perspective` (horizon + reference height) assumes the background was drawn on one
 * vanishing point. These backgrounds were not: the far wall is painted small and the near
 * furniture enormous, so no horizon fits both. A measured curve — pixel height of a standing
 * adult at a floor y — fits whatever the art actually does.
 *
 * Knots are sorted by y and interpolated linearly; outside the range the end segment is
 * extended, so a two-knot room behaves like the old model but a four-knot room can bend.
 */

export interface ScaleKnot { y: number; h: number }

export function scaleHeight(knots: ScaleKnot[], y: number): number {
  if (knots.length === 0) return 0;
  if (knots.length === 1) return Math.max(1, knots[0].h);
  let i = 0;
  while (i < knots.length - 2 && y > knots[i + 1].y) i++;
  const a = knots[i], b = knots[i + 1];
  const span = b.y - a.y;
  const t = span === 0 ? 0 : (y - a.y) / span;
  return Math.max(1, a.h + (b.h - a.h) * t);
}

/** Height of a standing adult at floor `y`, preferring the measured curve when there is one. */
export function personHeightAt(
  room: { scale?: ScaleKnot[]; perspective: { horizon: number; refY: number; refH: number } },
  y: number
): number {
  if (room.scale && room.scale.length) return scaleHeight(room.scale, y);
  const p = room.perspective;
  const span = p.refY - p.horizon;
  return Math.max(1, (p.refH * (y - p.horizon)) / (span || 1));
}
