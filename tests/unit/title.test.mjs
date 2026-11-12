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

test("the chapter-select act marks are derived from the acts that exist", async () => {
  const { actMarks } = await vite.load("/src/game/title.ts");
  const { LAST_ACT } = await vite.load("/src/content/acts.ts");
  const marks = actMarks();
  assert.equal(marks.length, LAST_ACT);
  assert.ok(marks.every((m) => typeof m === "string" && m.length > 0 && m !== "undefined"));
  assert.equal(marks[0], "I");
  assert.deepEqual(actMarks(2), ["I", "II"]);
  assert.deepEqual(actMarks(0), []);
  assert.ok(actMarks(99).every(Boolean), "an absurd count never yields a blank mark");
});

test("an unreadable save offers Recover instead of Continue; the picker replaces the menu", () => {
  const recover = { open: false, pages: [{ label: "Act II · The Crew", sub: "damaged page" }, { label: "Act I · The Harbour" }] };
  const closed = titleButtons(false, false, false, null, false, recover);
  assert.deepEqual(closed.map((b) => b.id), ["recover", "start"]);
  assert.equal(defaultTitleButton(closed), "start", "Recover is never what Enter does");
  assert.ok(closed[0].y < closed[1].y);
  // With an undo line too, both sit above the menu without overlapping each other or Begin.
  const both = titleButtons(false, false, false, null, true, recover);
  assert.deepEqual(both.map((b) => b.id), ["recover", "previous", "start"]);
  assert.ok(both[0].y + TITLE_BUTTON.height < both[1].y + 1 && both[1].y + TITLE_BUTTON.height <= both[2].y);
  // Open: the pages, then Back, and nothing else.
  const open = titleButtons(true, true, false, "Act I", true, { ...recover, open: true });
  assert.deepEqual(open.map((b) => b.id), ["page0", "page1", "back"]);
  assert.equal(open[0].label, "Act II · The Crew");
  assert.ok(open.every((b, i) => i === 0 || b.y > open[i - 1].y + TITLE_BUTTON.height - 1));
  // The new-voyage question still wins over the Recover line.
  assert.deepEqual(titleButtons(true, true, true, "Act I", false, recover).map((b) => b.id), ["keep", "confirm"]);
  // No pages, no line.
  assert.deepEqual(titleButtons(true, false, false, null, false, { open: false, pages: [] }).map((b) => b.id), ["continue", "start"]);
});

test("the Recover list pages through every archived page (the archive keeps 8, the window shows 4)", async () => {
  const { RECOVER_SHOWN, recoverStart } = await vite.load("/src/game/title.ts");
  const pages = Array.from({ length: 8 }, (_, i) => ({ label: `Page ${i}` }));
  const first = titleButtons(true, false, false, null, false, { open: true, pages });
  assert.deepEqual(first.map((b) => b.id), ["page0", "page1", "page2", "page3", "more", "back"]);
  assert.equal(first.find((b) => b.id === "more").sub, "1–4 of 8");
  const second = titleButtons(true, false, false, null, false, { open: true, pages, offset: RECOVER_SHOWN });
  assert.deepEqual(second.map((b) => b.id), ["page4", "page5", "page6", "page7", "more", "back"]);
  assert.equal(second.find((b) => b.id === "more").sub, "5–8 of 8");
  assert.ok(second.every((b, i) => i === 0 || b.y > second[i - 1].y + TITLE_BUTTON.height - 1), "no overlap");
  // Past the end wraps to the newest; a partial last window is fine.
  assert.equal(recoverStart(8, 8), 0);
  assert.equal(recoverStart(6, 4), 4);
  const six = titleButtons(true, false, false, null, false, { open: true, pages: pages.slice(0, 6), offset: 4 });
  assert.deepEqual(six.map((b) => b.id), ["page4", "page5", "more", "back"]);
  // A short list has no More button.
  assert.deepEqual(titleButtons(true, false, false, null, false, { open: true, pages: pages.slice(0, 3) }).map((b) => b.id),
    ["page0", "page1", "page2", "back"]);
});
