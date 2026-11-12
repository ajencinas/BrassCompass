/**
 * Room-connectivity audit (static, no browser).
 *
 * Reads the compiled .adv content and the authored connectivity table, then reports the whole
 * room graph: every exit's side and kind, the room and entry side it leads to, whether the two
 * paintings actually meet, and which cuts need a short passage shot. It fails on:
 *
 *   - an exit with no destination or no authored side/kind;
 *   - a return link that does not exist (a one-way door);
 *   - an exit into a room that does not exist;
 *   - a disconnected cut with no passage shot, or a passage shot on a cut that does not need one;
 *   - a stale side/kind or passage entry that no room owns.
 *
 *   node tools/connect-audit.mjs            # human report
 *   node tools/connect-audit.mjs --json     # machine report
 *
 * Exit code 1 on any error, so it can gate `test:all`.
 */
import { readScripts, loader } from "./adv-lib.mjs";

const vite = await loader();
const { compile } = await vite.load("/src/adv/compile.ts");
const { CHARACTERS } = await vite.load("/src/content/characters.ts");
const { MANIFEST } = await vite.load("/src/content/assets.ts");
const { EXITS, PASSAGES, roomArea, opposite } = await vite.load("/src/game/connect.ts");

const result = compile(readScripts(), {
  characters: CHARACTERS,
  images: MANIFEST.images,
  music: MANIFEST.audio,
});
const fatal = result.errors.filter((e) => !e.warning);
if (fatal.length) {
  for (const e of fatal) console.error(`${e.file}:${e.line}: ${e.message}`);
  process.exit(1);
}

const rooms = Object.values(result.rooms);
const byId = new Map(rooms.map((r) => [r.id, r]));
const SIDES = new Set(["left", "right", "above", "below"]);
const KINDS = new Set(["door", "hatch", "stair", "path"]);

function bbox(area) {
  if ("rect" in area) {
    return { x: area.rect.x, y: area.rect.y, w: area.rect.w, h: area.rect.h };
  }
  const xs = area.map((p) => p.x), ys = area.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Every `go` reachable from a hotspot or one of its states, de-duplicated by target. */
function exitsOf(room) {
  const out = [];
  for (const h of room.hotspots ?? []) {
    for (const state of [h, ...(h.states ?? [])]) {
      for (const verb of ["walk", "open", "use"]) {
        for (const effect of state.do?.[verb] ?? []) {
          if (effect.k !== "go") continue;
          out.push({ hotspot: h, state, target: effect.room, verb });
        }
      }
    }
  }
  const seen = new Set();
  return out.filter((e) => {
    const key = `${e.hotspot.id}->${e.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Which half of the target painting a landing point is in. */
function sideOfPoint(point, room, vertical) {
  if (vertical) return point.y < 440 ? "above" : "below";
  return point.x < (room.width ?? 1920) / 2 ? "left" : "right";
}

const rows = [];
const errors = [];
const warnings = [];
const seenKeys = new Set();

for (const room of rooms) {
  const exits = exitsOf(room);
  for (const exit of exits) {
    const key = `${room.id}.${exit.hotspot.id}`;
    seenKeys.add(key);
    const target = byId.get(exit.target);
    const link = EXITS[key] ?? null;
    const box = bbox(exit.hotspot.area);
    const row = {
      from: room.id,
      exit: exit.hotspot.id,
      name: exit.hotspot.name,
      side: link?.side ?? null,
      kind: link?.kind ?? null,
      to: exit.target,
      entry: null,
      landing: null,
      visual: null,
      passage: PASSAGES[key] ?? null,
      areaChanged: false,
      horizonDelta: null,
      bbox: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) },
    };

    if (!link) {
      errors.push(`${key}: exit has no side/kind in src/game/connect.ts`);
    } else {
      if (!SIDES.has(link.side)) errors.push(`${key}: side '${link.side}' is not left/right/above/below`);
      if (!KINDS.has(link.kind)) errors.push(`${key}: kind '${link.kind}' is not door/hatch/stair/path`);
    }

    if (!target) {
      errors.push(`${key}: exit leads to unknown room '${exit.target}'`);
      rows.push(row);
      continue;
    }

    // Does the target lead back? This is the asymmetric-return check.
    if (!exitsOf(target).some((back) => back.target === room.id)) {
      errors.push(`${key}: one-way exit — ${target.id} has no way back to ${room.id}`);
    }

    const landing = target.arrive?.[room.id] ?? target.entry;
    if (!target.arrive?.[room.id]) {
      warnings.push(`${key}: ${target.id} has no arrive from ${room.id}; it uses its default entry`);
    }
    const vertical = link?.kind === "stair" || link?.kind === "hatch";
    const landingSide = landing ? sideOfPoint(landing, target, vertical) : null;
    const expected = link && link.kind !== "door" ? opposite(link.side) : null;
    const entry = expected ?? landingSide;

    const areaChanged = roomArea(room.id) !== roomArea(target.id);
    const h1 = room.perspective?.horizon;
    const h2 = target.perspective?.horizon;
    const horizonDelta = typeof h1 === "number" && typeof h2 === "number" ? Math.abs(h1 - h2) : null;
    // A path is genuinely apart when the landing reverses the side (the same side of both
    // paintings means the walk doubled back), when the two rooms belong to different painted
    // areas, or when the horizon jumps far enough to break the shared ground line. Doors,
    // hatches and stairs are thresholds: the painted opening is the bridge.
    const sideReversed = Boolean(expected && landingSide && expected !== landingSide);
    const apart = Boolean(link && link.kind === "path" && (sideReversed || areaChanged || (horizonDelta ?? 0) > 120));

    row.entry = entry;
    row.landing = landingSide;
    row.areaChanged = areaChanged;
    row.horizonDelta = horizonDelta;
    if (link) {
      row.visual = link.kind === "path" ? (apart ? "APART" : "connected") : "threshold";
    }

    if (link?.kind === "path") {
      if (apart && !row.passage) {
        errors.push(`${key}: disconnected cut (${room.id} -> ${target.id}) has no passage shot; add it to PASSAGES`);
      }
      if (!apart && row.passage) {
        errors.push(`${key}: PASSAGES declares a shot for a connected path; remove it or justify the cut`);
      }
    } else if (row.passage) {
      errors.push(`${key}: PASSAGES declares a shot for a ${link?.kind ?? "non-path"} threshold; hard cuts are fine`);
    }

    rows.push(row);
  }
}

// Stale authored data: an entry that no room owns would silently do nothing.
for (const key of Object.keys(EXITS)) {
  if (!seenKeys.has(key)) errors.push(`EXITS has a stale entry '${key}' (no such exit)`);
}
for (const key of Object.keys(PASSAGES)) {
  if (!seenKeys.has(key)) errors.push(`PASSAGES has a stale entry '${key}' (no such exit)`);
}

// Reachability: every authored room must be reachable from an act's start room by room exits.
// The acts themselves are the roots; the graph between them is what this tool is checking.
const startRooms = Object.values(result.acts ?? {}).map((act) => act.start?.room).filter((id) => id && byId.has(id));
const roots = startRooms.length ? startRooms : ["dock"];
const reached = new Set(roots);
const queue = [...roots];
while (queue.length) {
  const id = queue.shift();
  const room = byId.get(id);
  if (!room) continue;
  for (const exit of exitsOf(room)) {
    if (!byId.has(exit.target) || reached.has(exit.target)) continue;
    reached.add(exit.target);
    queue.push(exit.target);
  }
}
for (const room of rooms) {
  if (!reached.has(room.id)) warnings.push(`${room.id}: unreachable from every act start by room exits`);
}

// ------------------------------------------------------------------ report

const uniqueLinks = new Set(rows.map((r) => [r.from, r.to].sort().join(" <> ")));
const count = (kind) => rows.filter((r) => r.kind === kind).length;
const apartRows = rows.filter((r) => r.visual === "APART");
const connectedPaths = rows.filter((r) => r.kind === "path" && r.visual === "connected");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    rooms: rooms.length,
    exits: rows.length,
    links: uniqueLinks.size,
    doors: count("door"),
    stairs: count("stair"),
    hatches: count("hatch"),
    paths: count("path"),
    apart: apartRows.length,
    connectedPaths: connectedPaths.length,
    errors,
    warnings,
    rows,
  }, null, 2));
} else {
  console.log(
    `Connectivity audit: ${rooms.length} rooms, ${rows.length} exits, ${uniqueLinks.size} links, ` +
    `${apartRows.length} passage shots\n` +
    `  doors ${count("door")} · stairs ${count("stair")} · hatches ${count("hatch")} · paths ${count("path")} ` +
    `(connected ${connectedPaths.length}, apart ${apartRows.length})\n`,
  );

  const byRoom = new Map();
  for (const row of rows.sort((a, b) => a.from.localeCompare(b.from) || a.exit.localeCompare(b.exit))) {
    if (!byRoom.has(row.from)) byRoom.set(row.from, []);
    byRoom.get(row.from).push(row);
  }
  for (const [id, list] of byRoom) {
    console.log(`${id} — ${byId.get(id)?.name ?? "?"}`);
    for (const r of list) {
      const side = (r.side ?? "?").padEnd(6);
      const kind = (r.kind ?? "?").padEnd(6);
      const to = r.to.padEnd(17);
      const entry = (r.entry ?? "-").padEnd(6);
      const land = (r.landing ?? "-").padEnd(6);
      const visual = (r.visual ?? "?").padEnd(10);
      const via = r.passage ?? "-";
      console.log(`  ${r.exit.padEnd(19)} ${side} ${kind} -> ${to} entry ${entry} land ${land} ${visual} ${via}`);
    }
  }

  if (apartRows.length) {
    console.log("\n— passage shots (the cuts that are genuinely apart) —");
    for (const r of apartRows) {
      console.log(`  ${r.from}.${r.exit} (${r.side}, ${r.kind}) -> ${r.to}: ${r.passage ?? "MISSING"} ` +
        `[entry ${r.entry ?? "?"}, landing ${r.landing ?? "?"}${r.areaChanged ? ", different area" : ""}` +
        `${r.horizonDelta !== null ? `, horizon Δ${r.horizonDelta}` : ""}]`);
    }
  }

  if (warnings.length) {
    console.log("\n— warnings —");
    for (const w of warnings) console.log(`  ${w}`);
  }
  if (errors.length) {
    console.log("\n— errors —");
    for (const e of errors) console.log(`  ${e}`);
  }
  console.log(errors.length ? `\nFAIL: ${errors.length} connectivity error(s).` : "\nOK: every exit has a side, a destination and a way back.");
}

process.exit(errors.length ? 1 : 0);
