// Title menu shape: Chapter select is a real second way in, Continue is the default, and a
// replaced voyage gets one quiet undo line.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

const vite = await loader();
after(() => vite.close());
const { titleButtons, defaultTitleButton, hitTitleButton, TITLE_BUTTON } =
  await vite.load("/src/game/title.ts");

test("a finished voyage offers Chapter select after Begin", () => {
  const buttons = titleButtons(false, true);
  assert.deepEqual(buttons.map((b) => b.id), ["start", "explore"]);
  const explore = buttons.find((b) => b.id === "explore");
  assert.match(explore.sub, /walk any scene/);
  assert.match(explore.sub, /nothing is saved/);
});

test("Continue still comes first, and Chapter select is locked until finished", () => {
  const buttons = titleButtons(true, false, false, "Act II · The Crew");
  assert.deepEqual(buttons.map((b) => b.id), ["continue", "start"]);
  assert.equal(buttons[0].sub, "Act II · The Crew");
  assert.equal(defaultTitleButton(buttons), "continue");
});

test("a stashed voyage adds one undo above the menu without moving Continue", () => {
  const plain = titleButtons(true, true, false, "Act II · The Crew");
  const withUndo = titleButtons(true, true, false, "Act II · The Crew", true);
  assert.deepEqual(withUndo.map((b) => b.id), ["previous", "continue", "start", "explore"]);
  assert.ok(withUndo[0].y < plain[0].y, "the undo sits above Continue");
  assert.deepEqual(withUndo.slice(1).map((b) => b.y), plain.map((b) => b.y));
  assert.equal(defaultTitleButton(withUndo), "continue", "undo is never what Enter does");
});

test("the confirmation question still replaces the menu, with no undo among the answers", () => {
  const buttons = titleButtons(true, true, true, "Act II · The Crew", true);
  assert.deepEqual(buttons.map((b) => b.id), ["keep", "confirm"]);
  assert.equal(defaultTitleButton(buttons), "keep");
});

test("with no save, Begin is the default even when an old voyage is stashed", () => {
  const buttons = titleButtons(false, false, false, null, true);
  assert.deepEqual(buttons.map((b) => b.id), ["previous", "start"]);
  assert.equal(defaultTitleButton(buttons), "start");
});

test("the new-voyage question keeps its two safe answers", () => {
  const buttons = titleButtons(true, true, true);
  assert.deepEqual(buttons.map((b) => b.id), ["keep", "confirm"]);
  assert.ok(buttons[1].y > buttons[0].y + TITLE_BUTTON.height, "the dangerous answer sits clear below");
});

test("every answer shares the one hit box", () => {
  for (const b of titleButtons(true, true)) {
    assert.equal(hitTitleButton(b.y, 960, b.y + 20), true);
    assert.equal(hitTitleButton(b.y, TITLE_BUTTON.left - 4, b.y + 20), false);
    assert.equal(hitTitleButton(b.y, 960, b.y + TITLE_BUTTON.height + 20), false);
  }
});
