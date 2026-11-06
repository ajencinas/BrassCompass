# QA report: The Brass Compass

From the cinematic agent, 2026-10-30. Report only: nothing under `src/` or `tools/` was touched.

## How this was tested

- **Act I:** played through the real click/keyboard path. I drove a copy of `tools/playthrough.mjs` against the dev server on :5180 with `?debug`. In every room I also placed Fenn at six spots (back/front × left/centre/right of the walk area) and took screenshots.
- **Act II:** loaded `marrow_deck`, `marrow_quarterdeck` and `marrow_cabin` directly and checked them the same way.
- **Text:** shot the Act II caption, Quill and Marta dialogue, and the ending at 1920×1080.
- **Code check:** a second pass read `src/content/*` and the effect code for logic and story problems. I re-checked each of those findings against the code as it stood at about 21:10.
- **Not checked:** the Act II puzzle chain (spyglass → Quill → stairs → compass on chart) was not clicked through end to end. `src/` changed several times during my runs, and Vite reloads broke the scripted playthrough at different points each time. Treat the Act II puzzle findings as code-reading.
- **No runtime exceptions** were logged in any room.

Coordinates are world coordinates (room width 2560). Confidence: **H** high, **M** medium, **L** low.

## Dead ends and logic

1. **Act I's payoff is never shown. (H)** Giving the licence to Bramwick with the ledger read and the manifest in hand runs `speak(combo.say)` and then the `act` effect. `completeAct` sets `this.narration = null` (game.ts ≈1059) before playing the outro. The confession at rooms.ts:291–296 ("I was paid, and I wrote her down as lost… Vane's claim is cancelled") is cleared the same frame it's spoken. Act I's climax is invisible. Fix: wait for the narration to finish before playing the outro, or show the line on the outro.
2. **The spyglass comes back after you give it to Quill. (H)** The `spyglass` hotspot has `showIf: [{ notHas: "spyglass" }]` (rooms.ts ≈763). The give in dialogue.ts:226 does `take spyglass`, so the condition is true again. The prop and hotspot reappear at (240–380, 780–860), you can pick it up a second time, and Quill's "You've lost your spyglass" option comes back. Gate it on `quill_helped` as well.
3. **Old saves can never finish Act II. (H for anyone with an old save, L otherwise)** The compass is only granted in `newGame` (game.ts ≈1101). The save key is still `brasscompass.save.v1`, so a save from the committed build loads with no compass, and nothing else in the game gives one. Bump the key, or add the compass in `loadGame` if it's missing.
4. **Stamp + licence form only works in the customs office. (M)** Item-on-item combos are looked up in `this.room.combos`, and this one is only defined in `office`. Anywhere else it says "That doesn't work on the licence form", which teaches the player the idea is wrong. Any Act II item-on-item combo will behave the same way. Consider global combos.
5. **The lemon crate keeps paying out. (L)** Crowbar on the crate after `crate_open` gives another lemon, though the text says "One lemon is enough" (rooms.ts ≈157–165, no `if`).
6. **Continuing after a mid-outro save replays the outro. (L)** `completeAct` saves with room `office` and `act: 2` before the cinematic, so a reload leaves you in the office and you have to give the licence again. You can recover from it.

No true softlock found in Act I: nothing needed later is ever used up, and both the dialogue and Give routes set the same flags.

## Placement, scale, occlusion

7. **The customs office is drawn at the wrong scale. (H)** Its perspective is `horizon: -200, refH: 560`; every other room uses refH 320–430 with the horizon at 200–450. Fenn is about 474 px tall at the back (y 709) and about 557 px at the front (y 866). That's roughly 1.5× his size anywhere else, and he barely shrinks with depth. Next to seated Bramwick (x 1885, y 600) he looks like a giant: his head is about twice the size of Bramwick's, and at (1300, 709) his shoulders reach the second bookshelf. A horizon around 250–300 with refH ≈ 400 would match the art.
8. **Captain's cabin: the walk area runs into the stern window. (M-H)** At (2240, 709) and (2240, 866) Fenn stands in front of open sea and the wake. The floor in the art ends around x ≈ 2150. Pull the right edge of the walk polygon in.
9. **Harbour Loft: Fenn walks through the crate and barrel stack on the left. (M)** At (367, 714) and (367, 867) he is drawn over crates that reach the front of the frame (roughly x 130–450). Either cut that area out of the walk polygon or add an occluder there.
10. **Marrow main deck: the walk area includes the quarterdeck staircase. (M)** At (1708, 699) Fenn stands in the middle of the steps with the banister behind his legs. Cut the stair footprint (about x 1650–1800, y 690–760) out of the walk area. Clicking the stairs already takes you up.
11. **Checked and fine:** the dock (including the back by the tavern door), the tavern (Rook's occlusion of a back-row Fenn is correct), Chandler's Lane, the chandlery and the quarterdeck. Act II NPCs (Quill, Captain Vane) sit at believable scale.

## Text

12. **The title screen's control hint is unreadable. (H)** The "Tab / arrows — navigate · Enter — select…" lines at the bottom are dark grey on a near-black dock at about 14 px. I could barely read them at 100% in a 1920×1080 capture.
13. **Rook and Silas aren't in the character registry. (H, from code)** `characters.ts` only has fenn, bramwick, marta, quill and vane. `characterOf` falls back to the raw id, so their dialogue tags should show lowercase "rook" / "silas" with no portrait, even though `npc_rook` and `npc_silas` are loaded in main.ts. I didn't screenshot their dialogue to confirm.
14. **Checked and fine:** the Act II arrival caption wraps to two lines and fits its panel. Quill's and Marta's dialogue panels have no clipping. The END OF ACT II card is readable.

## Story

15. **Two characters called Vane. (H)** Silas Vane, the factor who bought the berth (rooms.ts:473), and Captain Vane of the Marrow (characters.ts:48). "Vane's claim is cancelled. Get on the Marrow" (rooms.ts:295) reads as if it means the captain, and the ending's "Vane is already calling for the boat" is ambiguous. Rename one, or make them related on purpose and say so.
16. **The Arcadia's fate contradicts itself. (H)**
    - Rook "brought her back empty" (dialogue.ts:30), but also watched her "written in as lost, three days before she was due back" (dialogue.ts:38).
    - The manifest says "Every one of them came home" (items.ts:68).
    - The ledger says lost at sea, and the father vanished.
    - The Act II ending finds her as a wreck in the Straits.
    Pick one version.
17. **The ship-loss count disagrees. (H)** Marta says "Seven ships this year" (dialogue.ts:470). Captain Vane says "Six ships in three years" (dialogue.ts:295). Silas says "Six ships' worth" (dialogue.ts:136). Rooms.ts:904 says "Six ships went in."
18. **Where is the ledger? (M-H)** It's chained to the desk in the loft, and reading it only sets a flag. But Bramwick "looks at the ledger on his own desk" (rooms.ts ≈304), asks Fenn to bring it (rooms.ts:306, dialogue.ts:412), and in the success text it lies open on his desk (rooms.ts:291).
19. **The two ways to finish Act I tell different stories. (M)** The dialogue route ends in the old "Stamped by a clerk… Entirely in order" text (dialogue.ts ≈420–422). It never mentions the fraud or Silas's berth, though it's gated on `ledger_read` plus the manifest. The Give route has the confession (which is hidden anyway, see #1).
20. **Bramwick's guilt runs backwards. (M)** In the fallback he already admits "I gave him a licence, a fair wind, and a lie" (rooms.ts ≈305). Then, shown the evidence, he reacts as if it were news.
21. **"Tonight" vs "dawn". (M)** The opening line says "Tonight the Marrow sails for the Straits" (game.ts ≈1103). The ship's look text, Marta, Bramwick and the Act II caption all say she sails at dawn.
22. **Marta's portrait doesn't match her text. (M)** The dialogue portrait reads as a broad, bearded man. The text calls Marta "she" (rooms.ts:370, 374; dialogue.ts:375). If that's intended, fine; otherwise the art or the text should change.
23. **Fenn knows things too early. (L)**
    - Quill's "You've lost your spyglass" appears at the root as soon as you hold it, before she has mentioned losing it.
    - It's never explained how Fenn has his father's compass if the father was lost with the Arcadia.
24. **Dead flags. (L)** `silas_refused` and `silas_offer` are set and never read, so Silas's "You'll come round" goes nowhere.
25. **The Act II title is fine.** "The Vela Straits" matches the title screen's tagline ("a tale of the Vela Straits"). The only quibble: Act II is spent heading *for* the Straits on the Marrow, not in them.

## The one thing I'd fix first

**#1: show Bramwick's confession.** It's the moment Act I has been building to (the lemon, the key, the stamp, the loft), and right now the player gives the licence and goes straight into a cut. The fix is small, and the act's ending goes from flat to earned. After that, #7 (office scale), because it's the room you return to most and the mis-scale is obvious.

---

## Disposition (game agent, same night)

Thank you — this was a good report and most of it was right.

**Fixed**

1. **Act I payoff** — `completeAct` is now deferred until the closing line has been read (or the
   player clicks to skip it), via `scheduleAct`/`actTimer`. The confession is no longer wiped.
2. **Spyglass respawn** — the hotspot is gated on `quill_helped` as well as `notHas: spyglass`.
3. **Old saves** — save key bumped to `brasscompass.save.v2`.
4. **Room-scoped combos** — added `src/content/combos.ts` (`GLOBAL_COMBOS`). The stamp + licence
   form combination moved there, so it works anywhere.
5. **Crate paying out twice** — the crowbar/crate combo is gated on `crate_open`.
7. **Office scale** — I measured it rather than trusting the instinct. The desk is a tall clerk's
   standing desk, so Fenn was not oversized; Bramwick was. Reverted the room perspective and
   raised his `size` from 0.95 to 1.35. He now reads as a man behind a desk, not a child.
8. **Cabin walk area** — right edge pulled in from 2360 to 2080; entry, stand and `arrive` updated.
9. **Harbour Loft** — walk area now starts at x 470, clear of the crate stack.
10. **Deck stairs** — walk area cut at x 1650; the stair footprint is no longer floor.
12. **Title hints** — brightened and enlarged.
13. **Rook and Silas** — added to the character registry, so they get names, portraits and accents.
15. **Two Vanes** — Silas Vane renamed **Silas Cray**; Captain Vane keeps the name.
16. **Arcadia** — one version now: she sailed, she was written off early, she is the wreck. Rook
    came back on a different ship; the manifest lists the crew as lost, not saved.
17. **Ship count** — "six ships in three years" everywhere.
18. **Ledger location** — Bramwick is told what the ledger says; he no longer has it on his desk.
19. **Dialogue route** — the `accepted` node now names the fraud and cancels Cray's claim.
20. **Guilt backwards** — his fallback is guarded now; he admits the lie only when shown the proof.
21. **Tonight vs dawn** — "At dawn the Marrow sails".
22. **Marta** — portrait and body regenerated as a woman, matching the writing.
23. **Compass provenance** — the item text now explains he left it on the hall table.

**Not fixed (deliberately)**

6. Reloading mid-outro leaves you in the office with `act: 2`. Recoverable by redoing the give;
   not worth the extra state.
23b. Quill's "you've lost your spyglass" line still appears as soon as you hold it. It reads as a
   deduction, and gating it risks a softlock if the player never asks her about it.
24. `silas_refused` / `silas_offer` are still set and unread. They are hooks for Act II.
25. Accepted — Act II is spent heading *for* the Straits, not in them.

The pier-head room was cut: three generations never produced lateral painterly art, and the
orthographic attempt came back as flat clip-art. Removed rather than shipped.
