/**
 * Exit legibility audit (static, no browser).
 *
 * Reads the compiled .adv content and reports, for every room, how a player can leave it and
 * whether the way out is legible: does the exit have a stand on walkable ground, is its area a
 * real opening rather than a small mid-air patch, does the target lead back, does the arrival
 * point sit on the path, and does the horizon stay continuous across the cut?
 *
 *   node tools/exit-audit.mjs            # human report
 *   node tools/exit-audit.mjs --json     # machine report
 *
 * This is a detection tool: it does not edit content. Fix findings in the room scripts and
 * re-run it.
 */
import { readScripts, loader } from "./adv-lib.mjs";

const vite = await loader();
const { compile } = await vite.load("/src/adv/compile.ts");
const { CHARACTERS } = await vite.load("/src/content/characters.ts");
const { MANIFEST } = await vite.load("/src/content/assets.ts");
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

const DIRECTION = /(pier|quay|road|path|street|door|stairs?|steps?|ladder|hatch|gangway|alley|lane|deck|cabin|below|town|village|back|out|in|harbour|mouth|ship|boat|gate|cave|light|wreck|up|down|through|entrance|exit|passage|bridge|shore|flats|gate)/i;

function polyOf(area) {
  return "rect" in area
    ? [
        { x: area.rect.x, y: area.rect.y },
        { x: area.rect.x + area.rect.w, y: area.rect.y },
        { x: area.rect.x + area.rect.w, y: area.rect.y + area.rect.h },
        { x: area.rect.x, y: area.rect.y + area.rect.h },
      ]
    : area;
}
function bbox(area) {
  const pts = polyOf(area);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function inside(pt, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
function inWalk(pt, room) {
  return (room.walk ?? []).some((poly) => inside(pt, poly));
}
function centre(area) {
  const b = bbox(area);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
function statesOf(h) {
  return [h, ...(h.states ?? [])];
}
function exitsOf(room) {
  const out = [];
  for (const h of room.hotspots ?? []) {
    for (const state of statesOf(h)) {
      for (const verb of ["walk", "open", "use"]) {
        for (const effect of state.do?.[verb] ?? []) {
          if (effect.k !== "go") continue;
          out.push({ hotspot: h, state, target: effect.room, verb });
        }
      }
    }
  }
  // Deduplicate (a hotspot may reach the same target through base and state).
  const seen = new Set();
  return out.filter((e) => {
    const key = `${e.hotspot.id}->${e.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const report = [];
const graph = new Map(rooms.map((r) => [r.id, new Set()]));
for (const room of rooms) {
  const findings = [];
  const exits = exitsOf(room);
  const add = (level, msg) => findings.push({ level, msg });

  if (!exits.length) add("warn", "no way out of this room");

  for (const e of exits) {
    const target = byId.get(e.target);
    const b = bbox(e.hotspot.area);
    const c = centre(e.hotspot.area);
    graph.get(room.id).add(e.target);
    if (!target) {
      add("error", `${e.hotspot.id}: exit to unknown room '${e.target}'`);
      continue;
    }
    if (e.verb !== "walk") add("warn", `${e.hotspot.id}: exit runs on '${e.verb}', not walk — it will not walk Fenn to the way out first`);
    if (!DIRECTION.test(e.hotspot.name)) add("info", `${e.hotspot.id}: name "${e.hotspot.name}" does not read as a direction/opening`);
    const size = Math.min(b.w, b.h);
    if (size < 60) add("warn", `${e.hotspot.id}: exit area is small (${Math.round(b.w)}x${Math.round(b.h)}) — hard to hit and easy to read as scenery`);
    if (b.w < 120 && b.h < 120) add("warn", `${e.hotspot.id}: exit area is compact (${Math.round(b.w)}x${Math.round(b.h)})`);
    if (e.hotspot.noWalk) add("warn", `${e.hotspot.id}: noWalk exit — no walk-up, no arrival step`);
    const stand = e.hotspot.stand ?? centre(e.hotspot.area);
    if (!inWalk(stand, room)) add("error", `${e.hotspot.id}: stand ${Math.round(stand.x)},${Math.round(stand.y)} is outside the walkable polygon`);
    if (!inWalk(stand, room) && !e.hotspot.stand) add("info", `${e.hotspot.id}: no stand; area centre is used and is off the walk`);
    const nearEdge = b.x < 140 || b.x + b.w > 2420 || b.y + b.h > 830;
    if (!nearEdge) add("info", `${e.hotspot.id}: exit sits mid-frame (${Math.round(c.x)},${Math.round(c.y)}) — confirm it is a painted door/path, not empty air`);
    // Does the target lead back?
    const back = exitsOf(target).some((x) => x.target === room.id);
    if (!back) add("error", `${e.hotspot.id}: one-way exit — ${target.id} has no way back to ${room.id}`);
    // Arrival placement.
    const arrive = target.arrive?.[room.id];
    if (!arrive) add("info", `${e.hotspot.id}: ${target.id} has no arrive point from ${room.id}; it uses its default entry`);
    else if (!inWalk(arrive, target)) add("error", `${e.hotspot.id}: arrive point in ${target.id} (${Math.round(arrive.x)},${Math.round(arrive.y)}) is off its walk`);
    // Horizon continuity.
    const h1 = room.perspective?.horizon, h2 = target.perspective?.horizon;
    if (typeof h1 === "number" && typeof h2 === "number" && Math.abs(h1 - h2) > 90) {
      add("info", `${e.hotspot.id}: horizon jumps ${h1} -> ${h2} (${target.id}) across the cut (expected for interiors)`);
    }
  }

  for (const [i, arrive] of Object.entries(room.arrive ?? {})) {
    if (!byId.has(i)) add("warn", `arrive from unknown room '${i}'`);
    if (i === room.id) add("info", "arrive from itself");
    if (!inWalk(arrive, room)) add("error", `arrive from ${i} (${Math.round(arrive.x)},${Math.round(arrive.y)}) is outside the walk`);
  }
  if (room.entry && !inWalk(room.entry, room)) add("warn", `entry (${Math.round(room.entry.x)},${Math.round(room.entry.y)}) is outside the walk`);

  report.push({ room: room.id, name: room.name, exits: exits.map((e) => ({ to: e.target, hotspot: e.hotspot.id, name: e.hotspot.name, verb: e.verb })), findings });
}

const order = { error: 0, warn: 1, info: 2 };
let errors = 0, warns = 0, infos = 0;
for (const row of report) {
  row.findings.sort((a, b) => order[a.level] - order[b.level]);
  for (const f of row.findings) {
    if (f.level === "error") errors++;
    else if (f.level === "warn") warns++;
    else infos++;
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ errors, warns, infos, rooms: report }, null, 2));
} else {
  console.log(`Exit audit: ${rooms.length} rooms, ${errors} errors, ${warns} warnings, ${infos} notes\n`);
  for (const row of report) {
    const shown = row.findings.filter((f) => f.level !== "info");
    if (!shown.length) continue;
    console.log(`${row.room} — ${row.name}`);
    for (const f of shown) console.log(`  [${f.level}] ${f.msg}`);
  }
  console.log("\n— notes (mid-frame exits, default entries, naming) —");
  for (const row of report) {
    for (const f of row.findings.filter((x) => x.level === "info")) console.log(`${row.room}: ${f.msg}`);
  }
}

// The Vite dev server used to load the TypeScript content keeps the process alive on its own:
// without this the audit prints its report and then sits there, and `npm run test:all` never
// gets past it.
await vite.close();
process.exit(errors ? 1 : 0);
