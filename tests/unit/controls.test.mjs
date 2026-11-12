// The controls sheet must name every shortcut the chrome advertises, including the Map key.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { CONTROLS, SHORTCUTS } = await vite.load("/src/game/controls.ts");

const row = (key) => CONTROLS.find(([k]) => k === key);
const text = CONTROLS.map(([k, v]) => `${k} ${v}`).join("\n");

test("the A (Map) key is in the sheet and says what it opens", () => {
  assert.equal(SHORTCUTS.map, "A");
  const line = row("A");
  assert.ok(line, "A row for Map");
  assert.match(line[1], /island chart/i);
  assert.match(line[1], /travel/i);
});

test("every advertised shortcut has a row", () => {
  for (const [name, key] of Object.entries(SHORTCUTS)) {
    assert.ok(CONTROLS.some(([k]) => k.includes(key)), `${name} (${key}) is missing from the sheet`);
  }
  for (const key of ["Q", "L", "H", "J", "A", "M", "PageUp", "PageDown", "Escape"]) {
    assert.ok(text.includes(key), `${key} is not taught anywhere`);
  }
});

test("the sheet's rows are usable: a key and what it does", () => {
  assert.ok(CONTROLS.length >= 20);
  for (const [keys, what] of CONTROLS) {
    assert.ok(keys.trim().length > 0, "empty key label");
    assert.ok(what.trim().length > 0, `no description for ${keys}`);
  }
  const keys = CONTROLS.map(([k]) => k);
  assert.equal(new Set(keys).size, keys.length, "duplicate key row");
});

test("touch controls are named, since a finger cannot hover", () => {
  assert.ok(CONTROLS.some(([k]) => /^Touch: tap a thing/.test(k)));
  assert.ok(CONTROLS.some(([k]) => /^Touch: long-press/.test(k)));
  assert.ok(CONTROLS.some(([k, v]) => /top-bar icon/.test(k) && /again/.test(v)));
});
