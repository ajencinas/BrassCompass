/**
 * Fast checks for the .adv scripts (a second or two, no browser):
 *
 *  1. every script compiles, with every name resolving (items, rooms, conversations, nodes,
 *     speakers, images); warnings are printed;
 *  2. the language round-trips: writing the compiled data back out as scripts and compiling
 *     that gives exactly the same data, so the compiler and serialize.ts agree;
 *  3. every room's atmosphere (lights, water, haze, motes, beacon, emitters) sits on its painting;
 *  4. with --against REV, the compiled data equals the hand-written TypeScript content of that
 *     git revision (the conversion proof; 1014f5e is the last TypeScript revision).
 *
 *   npm run test:scripts
 *   npm run test:scripts -- --against 1014f5e
 */

import assert from "node:assert/strict";
import { contentAt, contentOf, differences, loader, readScripts } from "./adv-lib.mjs";
import { resolve } from "node:path";

const vite = await loader();
try {
  const { compile, formatError } = await vite.load("/src/adv/compile.ts");
  const ser = await vite.load("/src/adv/serialize.ts");
  const { CHARACTERS } = await vite.load("/src/content/characters.ts");
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  const options = { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio };

  const files = readScripts(process.env.ADV_DIR ? resolve(process.env.ADV_DIR) : undefined);
  const t0 = performance.now();
  const result = compile(files, options);
  const ms = performance.now() - t0;
  const errors = result.errors.filter((e) => !e.warning);
  const warnings = result.errors.filter((e) => e.warning);
  if (warnings.length) console.log("script warnings:\n  " + warnings.map(formatError).join("\n  "));
  if (errors.length) console.log("script errors:\n  " + errors.map(formatError).join("\n  "));
  assert.equal(errors.length, 0, "the scripts must compile cleanly");
  console.log(`compiled ${files.length} scripts in ${ms.toFixed(0)} ms: ${Object.keys(result.rooms).length} rooms, ` +
    `${Object.keys(result.dialogues).length} conversations, ${Object.keys(result.items).length} items`);

  // 2. compile(serialize(compile(scripts))) == compile(scripts)
  const groupStart = new Map(Object.entries(result.groups).map(([name, list]) => [list[0], { name, size: list.length }]));
  const again = [
    ...Object.values(result.rooms).map((r) => ({ path: `rooms/${r.id}.adv`, text: ser.room(r, (c) => groupStart.get(c)) })),
    ...Object.values(result.dialogues).map((t) => ({ path: `dialogue/${t.id}.adv`, text: ser.dialogue(t) })),
    { path: "items.adv", text: ser.items(Object.values(result.items)) },
    { path: "tips.adv", text: ser.tips(result.tips) },
    { path: "combos.adv", text: ser.combos(result.combos, result.groups) },
    { path: "acts.adv", text: ser.acts(Object.values(result.acts), result.ending) },
  ];
  const second = compile(again, options);
  assert.deepEqual(second.errors.filter((e) => !e.warning).map(formatError), []);
  assert.deepEqual(differences(contentOf(result), contentOf(second)), [], "serialize and compile must agree");
  console.log("round trip: serialize -> compile gives identical data");

  // A few deliberate mistakes, to keep the error messages honest.
  const bad = compile([{ path: "bad.adv", text: [
    'room r "R"',
    "  bg bg_dock_wide",
    "  perspective horizon 1 ref 2 height 3",
    "  walk (0,0) (10,0) (10,10)",
    "  entry 5,5",
    '  hotspot h "H"',
    "    area 0,0 10x10",
    '    look "x"',
    "      give lemmon",
    '    lok "typo"',
    "  light 10,10 radius 5 torch",
  ].join("\n") }]);
  const msgs = bad.errors.map(formatError);
  assert.ok(msgs.includes("bad.adv:9:7: no item 'lemmon'"), msgs.join("\n"));
  assert.ok(msgs.some((m) => m.startsWith("bad.adv:10:5: 'lok' doesn't belong in a hotspot")), msgs.join("\n"));
  assert.ok(msgs.some((m) => m.startsWith("bad.adv:11:24: no light kind 'torch'")), msgs.join("\n"));
  console.log("error locations: ok");

  // 3. the atmosphere sits on the painting: a point off the plate is a typo, not an effect.
  const SCENE_H = 880;
  const off = [];
  for (const r of Object.values(result.rooms)) {
    const width = r.width ?? 1920;
    const at = (what, p) => { if (p.x < 0 || p.x > width || p.y < 0 || p.y > SCENE_H) off.push(`${r.id}: ${what} at ${p.x},${p.y} is off the ${width}x${SCENE_H} painting`); };
    (r.lights ?? []).forEach((l, i) => at(`light ${i + 1}`, l.at));
    (r.water ?? []).forEach((w, i) => w.area.forEach((p) => at(`water ${i + 1}`, p)));
    (r.motes ?? []).forEach((m, i) => m.area.forEach((p) => at(`${m.kind} ${i + 1}`, p)));
    (r.emitters ?? []).forEach((e) => e.at && at(`emit ${e.kind}`, e.at));
    if (r.beacon) at("beacon", r.beacon.at);
    for (const h of r.haze ?? []) if (h.top < 0 || h.bottom > SCENE_H + 200) off.push(`${r.id}: haze ${h.top}-${h.bottom} is off the painting`);
  }
  assert.deepEqual(off, [], "atmosphere placement");
  // A room with no atmosphere at all is the other half of the same typo: it is how two rooms
  // added late were missed while this check printed "every point on its painting".
  const bare = Object.values(result.rooms).filter((r) =>
    !r.footsteps && !r.lights?.length && !r.water?.length && !r.haze?.length &&
    !r.motes?.length && !r.beacon && !r.emitters?.length).map((r) => r.id);
  assert.deepEqual(bare, [], "every room needs atmosphere (footsteps, a light, water or a sound)");
  const counts = Object.values(result.rooms).reduce((n, r) => n + (r.lights?.length ?? 0), 0);
  console.log(`atmosphere: ${counts} lights; every point on its painting; no bare rooms`);

  // 4. the conversion proof
  const i = process.argv.indexOf("--against");
  if (i > 0) {
    const rev = process.argv[i + 1];
    const old = await contentAt(rev);
    const diff = differences(contentOf(old), contentOf(result));
    if (diff.length) console.log(diff.join("\n"));
    assert.deepEqual(diff, [], `the scripts must match ${rev}`);
    console.log(`identical to the TypeScript content of ${rev}`);
  }
} finally {
  await vite.close();
}
