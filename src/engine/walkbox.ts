/**
 * Walk areas — polygons in screen space plus grid A* pathfinding.
 * The player's "feet" position is what moves; the sprite is drawn upward
 * from it, which gives natural depth scaling for free.
 */

export type Pt = { x: number; y: number };
export type Poly = Pt[];

export function pointInPoly(p: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function nearestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { ...a };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Closest point on a polygon's boundary. */
function nearestOnPoly(p: Pt, poly: Poly): Pt {
  let best = poly[0];
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const q = nearestOnSegment(p, poly[i], poly[(i + 1) % poly.length]);
    const d = dist2(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * A point strictly inside `poly` next to `q`, a point on (or just off) its boundary: projected
 * edges are ambiguous to the even-odd test, so step a pixel or two inward.
 */
function inward(q: Pt, from: Pt, poly: Poly): Pt {
  if (pointInPoly(q, poly)) return q;
  // Away from the outside point is into the polygon, for a projection onto its nearest edge.
  let dx = q.x - from.x, dy = q.y - from.y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    // On the boundary already: head for the centroid instead.
    const c = poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, y: acc.y + p.y / poly.length }), { x: 0, y: 0 });
    dx = c.x - q.x; dy = c.y - q.y; len = Math.hypot(dx, dy) || 1;
  }
  for (const step of [1, 2, 3, 5]) {
    const p = { x: q.x + (dx / len) * step, y: q.y + (dy / len) * step };
    if (pointInPoly(p, poly)) return p;
  }
  // A sliver or a sharp corner: try every direction before giving up.
  for (let a = 0; a < 16; a++) {
    const p = { x: q.x + Math.cos((a * Math.PI) / 8), y: q.y + Math.sin((a * Math.PI) / 8) };
    if (pointInPoly(p, poly)) return p;
  }
  return q;
}

/** Nearest point inside one of the walkable polygons (a hair inside, never on an edge). */
export function clampToFloor(p: Pt, polys: Poly[]): Pt {
  if (polys.some((poly) => pointInPoly(p, poly))) return { ...p };
  let best: Pt | null = null;
  let bestPoly: Poly | null = null;
  let bestD = Infinity;
  for (const poly of polys) {
    if (poly.length < 3) continue;
    const q = nearestOnPoly(p, poly);
    const d = dist2(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
      bestPoly = poly;
    }
  }
  return best && bestPoly ? inward(best, p, bestPoly) : { ...p };
}

interface Box { x0: number; y0: number; x1: number; y1: number }
const boxOf = (poly: Poly): Box => ({
  x0: Math.min(...poly.map((p) => p.x)), y0: Math.min(...poly.map((p) => p.y)),
  x1: Math.max(...poly.map((p) => p.x)), y1: Math.max(...poly.map((p) => p.y)),
});

const CELL = 20;

export class WalkMesh {
  private cols: number;
  private rows: number;
  private walkable: Uint8Array;
  private polys: Poly[];
  private boxes: Box[];

  constructor(polys: Poly[], width: number, height: number) {
    this.polys = polys.filter((poly) => poly.length >= 3);
    this.boxes = this.polys.map(boxOf);
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.walkable = new Uint8Array(this.cols * this.rows);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
        this.walkable[r * this.cols + c] = this.inside(p) ? 1 : 0;
      }
    }
  }

  /** Whether p is on the floor; bounding boxes first, so most polygons cost four compares. */
  private inside(p: Pt): boolean {
    for (let i = 0; i < this.polys.length; i++) {
      const b = this.boxes[i];
      if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
      if (pointInPoly(p, this.polys[i])) return true;
    }
    return false;
  }

  /** Whether p is within `tol` pixels of a floor edge (the floor's own outline counts as floor). */
  private nearEdge(p: Pt, tol: number): boolean {
    for (let i = 0; i < this.polys.length; i++) {
      const b = this.boxes[i];
      if (p.x < b.x0 - tol || p.x > b.x1 + tol || p.y < b.y0 - tol || p.y > b.y1 + tol) continue;
      if (dist2(p, nearestOnPoly(p, this.polys[i])) < tol * tol) return true;
    }
    return false;
  }

  private idx(c: number, r: number): number {
    return r * this.cols + c;
  }

  private isWalkable(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.walkable[this.idx(c, r)] === 1;
  }

  private cellOf(p: Pt): { c: number; r: number } {
    return { c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) };
  }

  private centre(i: number): Pt {
    const c = i % this.cols;
    const r = (i - c) / this.cols;
    return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
  }

  /** The walkable cell whose centre is closest to p, or null when there's no floor at all. */
  private nearestCell(p: Pt): { c: number; r: number } | null {
    const { c, r } = this.cellOf(p);
    if (this.isWalkable(c, r)) return { c, r };
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.walkable.length; i++) {
      if (!this.walkable[i]) continue;
      const d = dist2(p, this.centre(i));
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return null;
    const bc = best % this.cols;
    return { c: bc, r: (best - bc) / this.cols };
  }

  /** The floor polygon holding a cell's centre. */
  private polyAt(p: Pt): Poly | null {
    return this.polys.find((poly) => pointInPoly(p, poly)) ?? null;
  }

  /**
   * Where a walk toward `to` should end, given the cell the search reached: `to` itself when it
   * is on the floor and in plain sight of that cell, otherwise the nearest point of the
   * polygon that cell lies in — never a spot on some other, unconnected floor.
   */
  private endPoint(to: Pt, cell: number): Pt {
    const c = this.centre(cell);
    if (this.inside(to) && this.clear(c, to)) return { ...to };
    const poly = this.polyAt(c);
    if (!poly) return c;
    const q = clampToFloor(to, [poly]);
    return this.clear(c, q) ? q : c;
  }

  /**
   * A* from `from` to `to`; returns screen-space waypoints (excluding start). When `to` can't be
   * reached, the walk goes as close to it as the floor allows.
   */
  path(from: Pt, to: Pt): Pt[] {
    const start = this.nearestCell(from);
    const goal = this.nearestCell(to);
    if (!start || !goal) return [];
    const s = this.idx(start.c, start.r);
    const g = this.idx(goal.c, goal.r);
    if (s === g) return [this.endPoint(to, g)];

    const n = this.cols * this.rows;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    gScore[s] = 0;

    const h = (c: number, r: number): number =>
      Math.hypot(c - goal.c, r - goal.r);

    // Small binary heap
    const heap: { i: number; f: number }[] = [];
    const push = (i: number, f: number): void => {
      heap.push({ i, f });
      let k = heap.length - 1;
      while (k > 0) {
        const parent = (k - 1) >> 1;
        if (heap[parent].f <= heap[k].f) break;
        [heap[parent], heap[k]] = [heap[k], heap[parent]];
        k = parent;
      }
    };
    const pop = (): { i: number; f: number } | undefined => {
      if (heap.length === 0) return undefined;
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r2 = l + 1;
          let m = k;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r2 < heap.length && heap[r2].f < heap[m].f) m = r2;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };

    push(s, h(start.c, start.r));
    const DIRS = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];
    // The reachable cell nearest the goal, in case the goal itself is cut off.
    let closest = s;
    let closestD = dist2(this.centre(s), to);
    let reached = false;

    while (heap.length) {
      const cur = pop()!;
      if (cur.i === g) { reached = true; break; }
      if (closed[cur.i]) continue;
      closed[cur.i] = 1;
      const d = dist2(this.centre(cur.i), to);
      if (d < closestD) { closestD = d; closest = cur.i; }

      const cc = cur.i % this.cols;
      const cr = (cur.i - cc) / this.cols;

      for (const [dc, dr, cost] of DIRS) {
        const nc = cc + dc, nr = cr + dr;
        if (!this.isWalkable(nc, nr)) continue;
        // prevent corner-cutting through diagonal gaps
        if (dc !== 0 && dr !== 0) {
          if (!this.isWalkable(cc + dc, cr) || !this.isWalkable(cc, cr + dr)) continue;
        }
        const ni = this.idx(nc, nr);
        const tentative = gScore[cur.i] + cost;
        if (tentative < gScore[ni]) {
          gScore[ni] = tentative;
          came[ni] = cur.i;
          push(ni, tentative + h(nc, nr));
        }
      }
    }

    const last = reached ? g : closest;
    if (last === s) return [this.endPoint(to, s)];

    // Reconstruct
    const cells: number[] = [];
    let cur = last;
    while (cur !== -1) {
      cells.push(cur);
      if (cur === s) break;
      cur = came[cur];
    }
    cells.reverse();
    const raw = cells.map((i) => this.centre(i));

    // Start from where the walker actually stands and end exactly on the requested spot (when it
    // can be reached), so there is no little jog to and from grid-cell centres.
    return this.smooth([from, ...raw, this.endPoint(to, last)]);
  }

  /**
   * String-pulls a grid path: from each waypoint, head straight for the furthest later one the
   * floor allows. Grid A* only knows eight headings; people walk in straight lines. Neighbours
   * are joined unchecked: linked cell centres, the walker's own cell, and an end point that
   * `endPoint` already saw from the last cell.
   */
  private smooth(pts: Pt[]): Pt[] {
    const out: Pt[] = [];
    const last = pts.length - 1;
    let i = 0;
    while (i < last) {
      let j = last;
      while (j > i + 1 && !this.clear(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /** Whether the straight walk from a to b stays on the floor (with a hair of tolerance for edges). */
  private clear(a: Pt, b: Pt): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let i = 1; i < steps; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
      if (this.inside(p) || this.nearEdge(p, 1.5)) continue;
      return false;
    }
    return true;
  }
}
