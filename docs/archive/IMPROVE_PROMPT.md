# Prompt: improve "The Brass Compass"

Copy everything below the line into Claude Code or Codex, from the repo root.

---

You are working on an existing, working codebase. Do not rewrite it. Read this whole brief,
then read `PLAN.md` and `README.md`, then explore the code before changing anything.

## What this is

A point-and-click adventure game in the SCUMM tradition — twelve verbs, a sentence line,
inventory puzzles, dialogue trees — rendered at 1920×1080 with AI-generated painted artwork.
Original IP (pirate comedy set in Port Vela); it is *inspired by* classic point-and-click
adventures but shares no characters, text, or assets with them. Keep it that way.

**Act I is complete and finishable.** Your job is to make it better, not to start over.

## Stack and commands

- Vite + TypeScript + Canvas 2D. **Zero runtime dependencies** — Vite is the only dev dependency.
- `npm run dev` → http://localhost:5173
- `npx tsc --noEmit` → must stay clean
- `npm run build` → must stay clean
- Assets are generated via `python3 tools/generate.py` (RunComfy API, `RUNCOMFY_API` in `.env`)

## Architecture — respect these boundaries

```
src/engine/     view (DPI scaling), input, assets, audio, text, walkbox (A* pathfinding)
src/game/       game (state machine + render), ui (panel/dialogue/cursor), verbs, types
src/content/    rooms.ts, items.ts, dialogue.ts  <-- PURE DATA, no logic
public/assets/  generated art and audio
tools/          generate.py, normalize_sheet.py
```

- **`src/content/` is data, `src/game/` is mechanism.** Adding a room must never require
  engine changes. Preserve this: no `if (roomId === 'tavern')` anywhere.
- Rendering is a single 1920×1080 logical space. Scene is `y 0..880`, verb panel `880..1080`.
  Never draw in device pixels.
- Actors and props share one depth-sorted draw list keyed on feet-Y. Keep it that way.

## Hard constraints

1. **No runtime dependencies.** No React, no game engine, no date/utility libs.
2. **Do not regenerate paid assets.** Every generation is cached in `.gencache.json` by
   `(model_id, payload)` hash. To iterate on keying/cropping only, use
   `REPROCESS=1 python3 tools/generate.py <name>` — it post-processes the cached raw render at
   zero cost. Never delete `.gencache.json` entries casually.
3. **Keep the playthrough completable.** The Act I chain must still work end to end.
4. **No copyrighted content.** No third-party names, dialogue, art, or puzzle solutions.
5. Keep TypeScript strict and the build clean.

## Verify every change — this is not optional

There is **no committed test suite**. Your first job is to add one, then use it:

1. Write `tools/playthrough.mjs` (Playwright) that drives the full Act I chain through **real
   pointer events** and asserts the game reaches `won: true`. Wire it to `npm test`.
2. **Critical caveat:** headless Chromium throttles `requestAnimationFrame` to ~1 fps, so
   animation- and timer-dependent behaviour will appear broken when it isn't. The game exposes
   `window.__game` (live instance) and `window.__ff(n)` (advance n frames at 50 ms). Use `__ff`
   to fast-forward after each click. Convert logical coordinates to CSS pixels via the canvas
   bounding rect — never hardcode viewport pixels.
3. Take screenshots at: title, docks, tavern, office, dialogue, ending. Compare visually against
   `reference/screens/`. Save new ones there.

If you cannot verify a change, do not claim it works.

## Known weaknesses — prioritised. Pick a coherent slice; don't do all of it badly.

### P0 — Hygiene (do this first, it unblocks everything else)

1. **Dev hooks ship in production.** `window.__game` and `window.__ff` are assigned
   unconditionally in `Game.start()` (`src/game/game.ts` ~line 84). Gate them behind
   `import.meta.env.DEV` so they are stripped from the build, *without* breaking the test path
   (run tests against `npm run dev`, or use a `?test` query flag).
2. **No committed tests.** See above. This is the highest-value change in the repo.
3. **`src/game/game.ts` is 1020 lines** mixing input handling, state, effects, dialogue and all
   rendering. Split into focused modules (`interaction.ts`, `renderer.ts`, `dialogue-runner.ts`,
   `effects.ts`) without changing behaviour. Prove it with the playthrough test before/after.
4. **Silent autosave, no way out.** Progress autosaves on every mutation. There is no pause menu,
   no restart, no load, no volume control. `Escape` only cancels a sentence. Add a proper
   pause/settings overlay (resume, restart, mute/volume, and a note that progress is automatic).

### P1 — Feel and usability

5. **`cursor: none` in `src/style.css`** means the only pointer is the one the canvas draws. If
   the game loop stalls, the player has no cursor at all. Draw the cursor on a rAF-independent
   path, or restore the native cursor as a fallback.
6. **No keyboard navigation.** Verbs, inventory and hotspots are mouse-only. Add number/arrow key
   selection for verbs and Tab cycling between hotspots, with a visible focus indicator.
7. **Hover label can occlude the object** being described. Offset it away from screen edges.
8. **Dialogue box is fixed-height** (`D_BOX` in `src/game/ui.ts`). Long lines plus four choices
   can overflow. Make layout measure content and clamp.
9. **Audio has no master volume and doesn't persist mute.** One `HTMLAudioElement` per room with
   a manual fade. Add a master gain, persist settings to `localStorage`.
10. **Weak feedback on illegal actions** — a sentence line only. Add a subtle cursor/verb
    rejection cue so failures feel intentional rather than broken.

### P2 — The thing that makes it its own game

11. **The Taunt Duel is not built.** This is the signature mechanic: a rhyming boast duel where
    the move set *is* the dialogue tree — NPCs teach boasts, each boast counters a subset, and
    winning gates progress. Implement it data-first (`src/content/duels.ts`) with a small
    resolver in `src/game/`, so content authors can add opponents without touching engine code.
    This is the single highest-impact feature for making the game not-a-pastiche.
12. **Only one character walk sheet exists.** Recurring NPCs are static sprites. Either add a
    cheap procedural idle/talk animation (bob + breathing, already done for the player) or
    generate sheets via the existing pipeline (see `tools/normalize_sheet.py` — diffusion spaces
    frames unevenly, so never slice evenly).
13. **Act II doesn't exist.** Three rooms, ~8 puzzle steps. If you extend content, hold the
    design rules: every puzzle has ≥2 viable solutions, no state can become unwinnable.

### P3 — Visual coherence (the biggest quality gap)

14. **Characters read stylised/cartoon against painterly backgrounds.** They were regenerated
    with a painterly style suffix (`CHAR_STYLE` in `tools/generate.py`) and improved, but the
    mismatch is still visible. Options, in order of cost: (a) a cheap post-process on character
    PNGs — slight desaturation, film grain, matching colour grade, so they sit in the scene;
    (b) a stronger style anchor using `flux-1-kontext` image-to-image against an approved
    background crop. Try (a) first; it's free and reversible.
15. **No foreground occluder layer.** The player is always drawn on top of everything, so walking
    "behind" the bar or a table is impossible. Add an optional `foreground` sprite per room,
    drawn after actors, with the same depth rules. This is a real architectural limitation —
    fixing it makes every scene feel more physical.
16. **Minor placement bugs.** Marta's feet intersect a seated patron in the tavern (`sprites` in
    `src/content/rooms.ts`). Audit every sprite's feet-Y against the background art using the
    grid-overlay technique (draw 100 px grid on the background, screenshot, read coordinates).

### P4 — Polish

17. Title screen has no credits or settings. Ending is a static card. No ambient audio layer
    (crowd murmur in the tavern, lapping water on the docks).

## Definition of done

- `npx tsc --noEmit` and `npm run build` clean.
- `npm test` runs the playthrough and passes.
- The game is still completable by hand.
- No runtime dependencies added.
- Content stays declarative.
- You added screenshots to `reference/screens/` for any visual change.
- You updated `README.md` (controls, how to test) and `PLAN.md` (what changed) if you altered
  behaviour.

## Working style

- Read before you write. The codebase is small (≈2.8k lines) and idiomatic — match it.
- Make the smallest change that achieves the goal. Do not reformat untouched files.
- State your plan before editing, and report what you actually verified versus assumed.
- If a change is visual, show a screenshot. If it's behavioural, show the test.
