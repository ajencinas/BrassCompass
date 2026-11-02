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

/** Nearest point that is inside one of the walkable polygons. */
export function clampToFloor(p: Pt, polys: Poly[]): Pt {
  if (polys.some((poly) => pointInPoly(p, poly))) return { ...p };
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const poly of polys) {
    const q = nearestOnPoly(p, poly);
    const d = dist2(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best ?? { ...p };
}

const CELL = 20;

export class WalkMesh {
  private cols: number;
  private rows: number;
  private walkable: Uint8Array;
  private polys: Poly[];

  constructor(polys: Poly[], width: number, height: number) {
    this.polys = polys;
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.walkable = new Uint8Array(this.cols * this.rows);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
        const ok = polys.some((poly) => pointInPoly(p, poly));
        this.walkable[r * this.cols + c] = ok ? 1 : 0;
      }
    }
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

  /** Find the closest walkable cell to p (BFS ring search). */
  private nearestCell(p: Pt): { c: number; r: number } {
    const { c, r } = this.cellOf(p);
    if (this.isWalkable(c, r)) return { c, r };
    for (let rad = 1; rad < 40; rad++) {
      for (let dc = -rad; dc <= rad; dc++) {
        for (let dr = -rad; dr <= rad; dr++) {
          if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
          if (this.isWalkable(c + dc, r + dr)) return { c: c + dc, r: r + dr };
        }
      }
    }
    return { c, r };
  }

  /** A* from `from` to `to`; returns screen-space waypoints (excluding start). */
  path(from: Pt, to: Pt): Pt[] {
    const start = this.nearestCell(from);
    const goal = this.nearestCell(to);
    if (start.c === goal.c && start.r === goal.r) {
      return [clampToFloor(to, this.polys)];
    }

    const n = this.cols * this.rows;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);

    const s = this.idx(start.c, start.r);
    const g = this.idx(goal.c, goal.r);
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

    while (heap.length) {
      const cur = pop()!;
      if (cur.i === g) break;
      if (closed[cur.i]) continue;
      closed[cur.i] = 1;

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

    if (came[g] === -1 && g !== s) return [clampToFloor(to, this.polys)];

    // Reconstruct
    const cells: number[] = [];
    let cur = g;
    while (cur !== -1) {
      cells.push(cur);
      if (cur === s) break;
      cur = came[cur];
    }
    cells.reverse();

    const raw: Pt[] = cells.map((i) => {
      const c = i % this.cols;
      const r = (i - c) / this.cols;
      return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
    });

    // Start from where the walker actually stands and end exactly on the requested spot, so
    // there is no little jog to and from grid-cell centres.
    return this.smooth([from, ...raw, clampToFloor(to, this.polys)]);
  }

  /**
   * String-pulls a grid path: from each waypoint, head straight for the furthest later one the
   * floor allows. Grid A* only knows eight headings; people walk in straight lines.
   */
  private smooth(pts: Pt[]): Pt[] {
    const out: Pt[] = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
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
      if (this.polys.some((poly) => pointInPoly(p, poly))) continue;
      if (this.polys.some((poly) => dist2(p, nearestOnPoly(p, poly)) < 2.25)) continue;
      return false;
    }
    return true;
  }
}
