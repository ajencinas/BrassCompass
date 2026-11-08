// The deeds ledger: enough entries to be worth a second voyage, and every condition names
// something the content really produces — a flag something sets, an item, a seen node, or a
// hotspot that can be looked at. No invented flags, and no deed that can never be entered.
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { DEEDS, DEED_TOTAL } = await vite.load("/src/content/deeds.ts");
const { ROOMS } = await vite.load("/src/content/rooms.ts");
const { DIALOGUES } = await vite.load("/src/content/dialogue.ts");
const { ITEMS } = await vite.load("/src/content/items.ts");
const { ACTS } = await vite.load("/src/content/acts.ts");
const { readFiledDeeds, writeFiledDeeds, fileDeeds, deedTally, DEEDS_KEY, DEEDS_BOOKEND } =
  await vite.load("/src/game/deeds.ts");

/** A Map-backed localStorage. */
function storage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}
beforeEach(() => { globalThis.localStorage = storage(); });

// ------------------------------------------------------------------ the data

test("twelve to fourteen deeds, each with a unique id and all of its words", () => {
  assert.ok(DEEDS.length >= 12 && DEEDS.length <= 14, `got ${DEEDS.length} deeds`);
  assert.equal(DEED_TOTAL, DEEDS.length);
  const ids = new Set();
  const labels = new Set();
  for (const deed of DEEDS) {
    assert.match(deed.id, /^[a-z][a-z0-9_]*$/, deed.id);
    assert.equal(ids.has(deed.id), false, `duplicate id ${deed.id}`);
    assert.equal(labels.has(deed.label), false, `duplicate label ${deed.label}`);
    ids.add(deed.id);
    labels.add(deed.label);
    for (const key of ["label", "line", "where"]) {
      assert.equal(typeof deed[key], "string", `${deed.id}.${key}`);
      assert.ok(deed[key].trim().length > 0, `${deed.id}.${key} is empty`);
    }
    assert.ok(deed.line.length > 40, `${deed.id}.line is too short to be Fenn's`);
    assert.match(deed.where, /Act [IV]+/, `${deed.id}.where names no act`);
    assert.ok(Array.isArray(deed.if), `${deed.id}.if`);
  }
  assert.equal(DEEDS_BOOKEND, "DREADWATER: the light burning. All hands.");
});

/** Every flag the compiled content sets, from effects (`set`, `add`) anywhere in the scripts. */
function setFlags() {
  const flags = new Set();
  const effects = (list) => {
    for (const effect of list ?? []) {
      if ((effect.k === "flag" || effect.k === "add") && typeof effect.id === "string") flags.add(effect.id);
    }
  };
  for (const room of Object.values(ROOMS)) {
    effects(room.onEnter);
    for (const scene of room.scenes ?? []) effects(scene.do);
    for (const hotspot of room.hotspots) {
      for (const list of Object.values(hotspot.do ?? {})) effects(list);
      for (const state of hotspot.states ?? []) {
        for (const list of Object.values(state.do ?? {})) effects(list);
      }
    }
    for (const combo of room.combos ?? []) effects(combo.do);
  }
  for (const tree of Object.values(DIALOGUES)) {
    for (const node of Object.values(tree.nodes)) {
      effects(node.do);
      for (const choice of node.choices ?? []) effects(choice.do);
    }
  }
  for (const act of Object.values(ACTS)) effects(act.onStart);
  return flags;
}

test("every condition names something the content sets, has, sees or can be looked at", () => {
  const flags = setFlags();
  const problems = [];
  const check = (deed, cond) => {
    if ("flag" in cond) {
      if (cond.flag.startsWith("seen:")) {
        const [tree, node] = cond.flag.slice(5).split(".");
        if (!DIALOGUES[tree]?.nodes[node]) problems.push(`${deed.id}: no dialogue node ${cond.flag}`);
      } else if (cond.flag.startsWith("looked:")) {
        const [room, hotspot] = cond.flag.slice(7).split(".");
        if (!ROOMS[room]?.hotspots.some((h) => h.id === hotspot)) problems.push(`${deed.id}: no hotspot ${cond.flag}`);
      } else if (!flags.has(cond.flag)) {
        problems.push(`${deed.id}: no script sets the flag ${cond.flag}`);
      }
    } else if ("has" in cond) {
      if (!ITEMS[cond.has]) problems.push(`${deed.id}: no item ${cond.has}`);
    } else if ("any" in cond) {
      for (const c of cond.any) check(deed, c);
    } else if ("not" in cond) {
      check(deed, cond.not);
    }
  };
  for (const deed of DEEDS) for (const cond of deed.if) check(deed, cond);
  assert.deepEqual(problems, []);
});

test("no two deeds are the same condition", () => {
  const seen = new Map();
  for (const deed of DEEDS) {
    const key = JSON.stringify(deed.if);
    assert.equal(seen.has(key), false, `${deed.id} repeats ${seen.get(key)}`);
    seen.set(key, deed.id);
  }
});

// ------------------------------------------------------------------ the book

test("a fresh browser has entered nothing, and the tally says so", () => {
  assert.deepEqual([...readFiledDeeds()], []);
  assert.deepEqual(deedTally(), { filed: 0, total: DEED_TOTAL });
});

test("the book accumulates across voyages and counts only deeds this build knows", () => {
  fileDeeds((deed) => deed.id === DEEDS[0].id || deed.id === DEEDS[1].id);
  assert.deepEqual(deedTally(), { filed: 2, total: DEED_TOTAL });
  // A second voyage adds to the first rather than replacing it.
  fileDeeds((deed) => deed.id === DEEDS[2].id);
  assert.deepEqual([...readFiledDeeds()].sort(), [DEEDS[0].id, DEEDS[1].id, DEEDS[2].id].sort());
  assert.deepEqual(deedTally(), { filed: 3, total: DEED_TOTAL });
  // An id from a later build is remembered but not counted.
  writeFiledDeeds([...readFiledDeeds(), "a_deed_from_the_future"]);
  assert.equal(deedTally().filed, 3);
  assert.equal(readFiledDeeds().has("a_deed_from_the_future"), true);
});

test("a refused or corrupt book is an empty one, never an error", () => {
  localStorage.setItem(DEEDS_KEY, "{not json");
  assert.deepEqual([...readFiledDeeds()], []);
  localStorage.setItem(DEEDS_KEY, JSON.stringify({ not: "an array" }));
  assert.deepEqual([...readFiledDeeds()], []);
  globalThis.localStorage = {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("SecurityError"); },
    removeItem: () => { throw new Error("SecurityError"); },
  };
  assert.deepEqual([...readFiledDeeds()], []);
  assert.doesNotThrow(() => writeFiledDeeds(["wager"]));
  assert.deepEqual(deedTally(), { filed: 0, total: DEED_TOTAL });
});
