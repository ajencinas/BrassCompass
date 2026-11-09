// The scale contract for every standing character in every room.
//
// A room's scale curve already gives the height of a standing adult at a floor y, so an adult's
// sprite size must be ~1. Using size again to fake depth shrinks the figure twice. Tam is the one
// child and is deliberately 0.72. NPCs painted behind a counter may stand off the walkable floor,
// provided their interaction stand is reachable.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { ROOMS } = await vite.load("/src/content/rooms.ts");
const { CHARACTERS } = await vite.load("/src/content/characters.ts");
const bodies = new Map();
for (const c of Object.values(CHARACTERS)) if (c.body) bodies.set(c.body, c.id);
bodies.set("char_elias", "fenn");

function personHeight(room, y) {
  if (room.scale?.length) {
    const k = room.scale;
    let i = 0;
    while (i < k.length - 2 && y > k[i + 1].y) i++;
    const a = k[i], b = k[i + 1];
    const t = (y - a.y) / ((b.y - a.y) || 1);
    return Math.max(1, a.h + (b.h - a.h) * t);
  }
  const p = room.perspective;
  return Math.max(1, (p.refH * (y - p.horizon)) / ((p.refY - p.horizon) || 1));
}

function inside(x, y, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) hit = !hit;
  }
  return hit;
}

test("every room has a scale curve", () => {
  for (const room of Object.values(ROOMS)) {
    assert.ok(room.perspective || room.scale?.length, `${room.id} has no perspective/scale`);
  }
});

test("every standing adult is at human scale, and Tam is a child", () => {
  for (const room of Object.values(ROOMS)) {
    for (const sprite of room.sprites ?? []) {
      const id = bodies.get(sprite.key);
      if (!id) continue;
      const where = `${room.id}/${id} at ${sprite.x},${sprite.y}`;
      if (id === "tam") {
        assert.ok(sprite.size >= 0.65 && sprite.size <= 0.8, `${where}: child size ${sprite.size}`);
      } else {
        assert.ok(Math.abs(sprite.size - 1) <= 0.03, `${where}: adult size ${sprite.size}`);
      }
      const px = (personHeight(room, sprite.y) * sprite.size * 1920) / (room.width || 1920);
      assert.ok(px >= 60 && px <= 650, `${where}: ${Math.round(px)}px is outside 60..650`);
    }
  }
});

test("Fenn is at human scale at every room entry", () => {
  for (const room of Object.values(ROOMS)) {
    if (!room.entry) continue;
    const px = (personHeight(room, room.entry.y) * 1920) / (room.width || 1920);
    assert.ok(px >= 60 && px <= 650, `${room.id} entry: ${Math.round(px)}px`);
  }
});

test("every standing character is reachable or deliberately behind scenery", () => {
  for (const room of Object.values(ROOMS)) {
    for (const sprite of room.sprites ?? []) {
      const id = bodies.get(sprite.key);
      if (!id) continue;
      if (room.walk.some((poly) => inside(sprite.x, sprite.y, poly))) continue;
      const hs = room.hotspots?.find((h) => h.id === sprite.hotspot);
      assert.ok(
        hs?.stand && room.walk.some((poly) => inside(hs.stand.x, hs.stand.y, poly)),
        `${room.id}/${id} is off the walk with no reachable stand`
      );
    }
  }
});
