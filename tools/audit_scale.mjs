#!/usr/bin/env node
/**
 * Character scale audit, every room, every standing body.
 *
 * The room's scale curve is the height of a standing adult at a floor y. A character's `size`
 * should therefore be ~1 for an adult (and ~0.72 for Tam, the one child): using `size` again to
 * fake depth shrinks a figure twice. This prints the whole table and fails on:
 *   - an adult outside 0.97..1.03 (or Tam outside 0.65..0.80)
 *   - a foot point outside the walkable polygon
 *   - a screen height outside 60..650 px at 1920
 *   - a room with no perspective/scale curve
 *
 * Run: node tools/audit_scale.mjs [--json out.json]
 */
import { loader } from "./adv-lib.mjs";

const vite = await loader();
const { ROOMS } = await vite.load("/src/content/rooms.ts");
const { CHARACTERS } = await vite.load("/src/content/characters.ts");
const bodies = new Map();
for (const c of Object.values(CHARACTERS)) if (c.body) bodies.set(c.body, c.id);
bodies.set("char_elias", "fenn");

const ADULT = new Set([...bodies.values()].filter((id) => id !== "tam"));
const EPS = 0.03;

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

const rows = [];
for (const room of Object.values(ROOMS).sort((a, b) => a.id.localeCompare(b.id))) {
  if (!room.perspective && !room.scale?.length) {
    rows.push({ room: room.id, id: "-", size: 0, px: 0, flags: ["NO_SCALE"] });
    continue;
  }
  if (room.entry) {
    const h = personHeight(room, room.entry.y);
    const px = Math.round((h * 1920) / (room.width || 1920));
    rows.push({
      room: room.id, id: "fenn", x: room.entry.x, y: room.entry.y, size: 1, px,
      flags: px < 60 || px > 650 ? ["HEIGHT"] : [], notes: [],
    });
  }
  for (const s of room.sprites ?? []) {
    const id = bodies.get(s.key);
    if (!id) continue;
    const h = personHeight(room, s.y) * s.size;
    const px = Math.round((h * 1920) / (room.width || 1920));
    const flags = [], notes = [];
    if (id === "tam") {
      if (s.size < 0.65 || s.size > 0.8) flags.push("CHILD_SIZE");
    } else if (s.size < 1 - EPS || s.size > 1 + EPS) flags.push("ADULT_SIZE");
    if (px < 60 || px > 650) flags.push("HEIGHT");
    if (!room.walk.some((poly) => inside(s.x, s.y, poly))) {
      // An NPC painted behind a counter/rail may stand outside the walkable floor, as long as
      // their interaction stand is reachable. That is a deliberate note, not a scale failure.
      const hs = room.hotspots?.find((h) => h.id === s.hotspot);
      if (hs?.stand && room.walk.some((poly) => inside(hs.stand.x, hs.stand.y, poly))) notes.push("BEHIND_SCENERY");
      else flags.push("OFF_WALK");
    }
    rows.push({ room: room.id, id, x: s.x, y: s.y, size: s.size, px, flags, notes });
  }
}
const bad = rows.filter((r) => r.flags.length);
for (const r of rows) {
  const flag = r.flags.length ? r.flags.join(",") : r.notes?.length ? r.notes.join(",") : "ok";
  console.log(
    `${r.room.padEnd(20)} ${String(r.id).padEnd(8)} ${String(r.x ?? "").padEnd(5)} ${String(r.y ?? "").padEnd(4)} size ${Number(r.size).toFixed(2)}  ${String(r.px).padStart(4)}px  ${flag}`
  );
}
console.log(`\n${rows.filter((r) => r.id !== "-").length} character placements; ${bad.length} flagged, ${rows.filter((r) => r.notes?.length && !r.flags.length).length} behind-scenery notes.`);
if (bad.length) process.exitCode = 1;
const j = process.argv.indexOf("--json");
if (j >= 0) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.argv[j + 1], JSON.stringify(rows, null, 2));
}
await vite.close();
