// Walk areas: point-in-polygon, clamping onto the floor, and paths that never leave it.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { pointInPoly, clampToFloor, WalkMesh } = await vite.load("/src/engine/walkbox.ts");

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
// A "U": two legs joined along the bottom; the notch between them is not floor.
const U = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 0 },
  { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];
const left = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
const right = [{ x: 400, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 400, y: 200 }];

const onFloor = (p, polys) => polys.some((poly) => pointInPoly(p, poly));
/** Every point along the path, every couple of pixels, must be on (or a hair from) the floor. */
function assertStaysOn(from, path, polys) {
  let a = from;
  for (const b of path) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= steps; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
      const near = [-2, 0, 2].some((dx) => [-2, 0, 2].some((dy) => onFloor({ x: p.x + dx, y: p.y + dy }, polys)));
      assert.ok(near, `path leaves the floor at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    a = b;
  }
}

test("pointInPoly: inside, outside, and a concave notch", () => {
  assert.equal(pointInPoly({ x: 50, y: 50 }, square), true);
  assert.equal(pointInPoly({ x: 150, y: 50 }, square), false);
  assert.equal(pointInPoly({ x: -1, y: 50 }, square), false);
  assert.equal(pointInPoly({ x: 50, y: 350 }, U), true);
  assert.equal(pointInPoly({ x: 200, y: 100 }, U), false, "the notch of the U is outside");
  assert.equal(pointInPoly({ x: 350, y: 100 }, U), true);
});

test("pointInPoly: points on edges and corners don't throw and stay consistent", () => {
  for (const p of [{ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 }]) {
    assert.equal(typeof pointInPoly(p, square), "boolean");
  }
  // A degenerate (horizontal) edge is handled without dividing by zero.
  assert.equal(pointInPoly({ x: 50, y: 0 + 1e-6 }, square), true);
});

test("clampToFloor: inside points are untouched; outside ones land strictly inside", () => {
  assert.deepEqual(clampToFloor({ x: 30, y: 40 }, [square]), { x: 30, y: 40 });
  for (const p of [{ x: 150, y: 50 }, { x: 50, y: -40 }, { x: -10, y: -10 }, { x: 200, y: 100 }, { x: 120, y: 120 }]) {
    const polys = p.x === 200 ? [U] : [square];
    const q = clampToFloor(p, polys);
    assert.ok(onFloor(q, polys), `${JSON.stringify(p)} -> ${JSON.stringify(q)} should be inside`);
  }
  const q = clampToFloor({ x: 150, y: 50 }, [square]);
  assert.ok(q.x < 100 && q.x > 97, `close to the edge it came from: ${q.x}`);
});

test("path: start and end in the same cell", () => {
  const mesh = new WalkMesh([square], 200, 200);
  const path = mesh.path({ x: 50, y: 50 }, { x: 52, y: 53 });
  assert.equal(path.length, 1);
  assert.deepEqual(path[0], { x: 52, y: 53 });
  const still = mesh.path({ x: 50, y: 50 }, { x: 50, y: 50 });
  assert.deepEqual(still.at(-1), { x: 50, y: 50 });
});

test("path: around a concave notch, never through it", () => {
  const mesh = new WalkMesh([U], 400, 400);
  const from = { x: 50, y: 50 }, to = { x: 350, y: 50 };
  const path = mesh.path(from, to);
  assert.deepEqual(path.at(-1), to);
  assertStaysOn(from, path, [U]);
  assert.ok(path.some((p) => p.y > 290), "goes down and around the bottom of the U");
});

test("path: an unreachable target ends on the walker's own floor, nearest the target", () => {
  const mesh = new WalkMesh([left, right], 600, 200);
  const from = { x: 50, y: 100 };
  const path = mesh.path(from, { x: 500, y: 100 });
  assert.ok(path.length > 0);
  assertStaysOn(from, path, [left]);
  const end = path.at(-1);
  assert.ok(onFloor(end, [left]), "ends on the left floor");
  assert.ok(end.x > 170, `as close to the target as it can get: ${end.x}`);
});

test("path: a target off the floor ends at the nearest floor point", () => {
  const mesh = new WalkMesh([square], 300, 300);
  const from = { x: 20, y: 20 };
  const path = mesh.path(from, { x: 250, y: 50 });
  const end = path.at(-1);
  assert.ok(onFloor(end, [square]), JSON.stringify(end));
  assert.ok(end.x > 90);
  assertStaysOn(from, path, [square]);
});

test("path: no floor at all gives no path", () => {
  const mesh = new WalkMesh([], 200, 200);
  assert.deepEqual(mesh.path({ x: 10, y: 10 }, { x: 100, y: 100 }), []);
});
