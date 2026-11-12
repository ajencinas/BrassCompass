// The Continue recap: what the card says about a save, and how it says how long it has been.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { buildRecap, elapsedLabel } = await vite.load("/src/game/recap.ts");

const NOW = 1_800_000_000_000;
const save = (over = {}) => ({
  version: 2, room: "marrow_cabin", facing: 1, flags: {}, inventory: ["compass", "crowbar"],
  act: 2, notes: [], actStarted: true, ...over,
});
const hooks = {
  actTitle: (n) => (n === 2 ? "Act II · The Crew" : null),
  roomName: (id) => ({ marrow_cabin: "The Marrow — Captain's Cabin" }[id] ?? id),
  itemName: (id) => ({ compass: "brass compass", crowbar: "crowbar" }[id] ?? id),
  actCaption: (n) => (n === 2 ? "The Marrow is ours, for what that's worth. Vex at the helm, Quill aloft, Dorrit below, Hobb at the mast. The fog is waiting." : null),
  waitingOnLastChoice: (n) => n === 4,
  sail: () => {}, readCasebook: () => {}, back: () => {},
};
const card = (over = {}) => buildRecap(save(over), hooks, NOW);

test("elapsed time reads the way a person says it", () => {
  const back = (seconds) => elapsedLabel(NOW - seconds * 1000, NOW);
  assert.equal(back(5), "just now");
  assert.equal(back(60), "1 minute ago");
  assert.equal(back(5 * 60), "5 minutes ago");
  assert.equal(back(3600), "1 hour ago");
  assert.equal(back(5 * 3600), "5 hours ago");
  assert.equal(back(86400), "1 day ago");
  assert.equal(back(3 * 86400), "3 days ago");
  assert.equal(back(90 * 86400), "3 months ago");
  // A clock that has gone backwards, or a save with no date, is not a lie.
  assert.equal(elapsedLabel(NOW + 60_000, NOW), "just now");
  assert.equal(elapsedLabel(undefined, NOW), null);
  assert.equal(elapsedLabel(NaN, NOW), null);
});

test("the card names the act, the room, the hint, the notes and the satchel", () => {
  const c = card({
    at: NOW - 3 * 86400_000,
    tip: "Ask Vex what he saw from the helm.",
    notes: [{ id: "a", text: "Vex has Quill's compass.", act: 1 }, { id: "b", text: "The nameplate reads Mordant.", act: 2 }, { id: "c", text: "Vex turned his light away.", act: 2 }],
  });
  assert.equal(c.act, "Act II · The Crew");
  assert.equal(c.when, "Last sailed 3 days ago.");
  assert.equal(c.where, "Fenn was in The Marrow — Captain's Cabin.");
  assert.equal(c.doing, "He was doing: Ask Vex what he saw from the helm.");
  assert.equal(c.knows, "He knows: 3 entries.");
  // The last two, in the order he wrote them.
  assert.deepEqual(c.notes, ["The nameplate reads Mordant.", "Vex turned his light away."]);
  assert.equal(c.carrying, "He is carrying: brass compass and crowbar.");
  assert.equal(c.talking, false);
  assert.equal(c.waiting, false);
});

test("a save with nothing to say still says it plainly", () => {
  const c = card({ notes: [], inventory: [] });
  assert.equal(c.when, "Last sailed: the page doesn't say when.");
  assert.equal(c.doing, "He was doing: something he didn't write down.");
  assert.equal(c.knows, "He knows: 0 entries.");
  assert.deepEqual(c.notes, []);
  assert.equal(c.carrying, "He is carrying: nothing at all.");
  assert.equal(c.act, "Act II · The Crew");
});

test("one entry, one item, a queued line, and the act still to begin", () => {
  assert.equal(card({ notes: [{ id: "a", text: "One.", act: 1 }] }).knows, "He knows: 1 entry.");
  assert.equal(card({ inventory: ["compass"] }).carrying, "He is carrying: brass compass.");
  assert.equal(card({ queue: [{ k: "say", text: "…" }] }).talking, true);
  const opening = card({ actStarted: false, tip: "This hint is not the plan." });
  assert.equal(opening.opening, true);
  assert.equal(opening.doing, "The act hasn't begun. It opens with: “The Marrow is ours, for what that's worth. Vex at the helm, Quill aloft, Dorrit below, Hobb at the mast. The fog is waiting.”");
  // Without a caption there is still something honest to put there.
  const bare = buildRecap(save({ actStarted: false }), { ...hooks, actCaption: () => null }, NOW);
  assert.equal(bare.doing, "The act hasn't begun. Nobody has said anything yet.");
  // The act a save names is the content's, not this card's: an unknown one is still readable.
  assert.equal(buildRecap(save({ act: 9 }), hooks, NOW).act, "Act 9");
});

test("the last choice of a finished voyage is flagged; any other save is not", () => {
  assert.equal(card({ act: 4 }).waiting, true);
  assert.equal(card({ act: 2 }).waiting, false);
});
