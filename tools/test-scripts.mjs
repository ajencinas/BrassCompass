/**
 * Fast checks for the .adv scripts (a second or two, no browser):
 *
 *  1. every script compiles, with every name resolving (items, rooms, conversations, nodes,
 *     speakers, images); warnings are printed;
 *  2. the language round-trips: writing the compiled data back out as scripts and compiling
 *     that gives exactly the same data, so the compiler and serialize.ts agree;
 *  3. with --against REV, the compiled data equals the hand-written TypeScript content of that
 *     git revision (the conversion proof; 1014f5e is the last TypeScript revision).
 *
 *   npm run test:scripts
 *   npm run test:scripts -- --against 1014f5e
 */

import assert from "node:assert/strict";
import { contentAt, contentOf, differences, loader, readScripts } from "./adv-lib.mjs";

const vite = await loader();
try {
  const { compile, formatError } = await vite.load("/src/adv/compile.ts");
  const ser = await vite.load("/src/adv/serialize.ts");
  const { CHARACTERS } = await vite.load("/src/content/characters.ts");
  const { MANIFEST } = await vite.load("/src/content/assets.ts");
  const options = { characters: CHARACTERS, images: MANIFEST.images, music: MANIFEST.audio };

  const files = readScripts();
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
  ].join("\n") }]);
  const msgs = bad.errors.map(formatError);
  assert.ok(msgs.includes("bad.adv:9:7: no item 'lemmon'"), msgs.join("\n"));
  assert.ok(msgs.some((m) => m.startsWith("bad.adv:10:5: 'lok' doesn't belong in a hotspot")), msgs.join("\n"));
  console.log("error locations: ok");

  // 3. the conversion proof
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
