# The Brass Compass — Design & Build Plan

**Status:** Act I built and playable · **Date:** 2026-10-30

---

## 1. Deconstruction of the reference

Verified frame-by-frame from the *Secret of Monkey Island* longplay, not from memory:

| Element | Finding |
|---|---|
| Playfield | 320×200, third-person, fixed camera, ~⅓ reserved for UI |
| Interface | **12 verbs** in a 4×3 grid: Open, Close, Push, Pull / Walk to, Pick up, Talk to, Give / Use, Look at, Turn on, Turn off |
| Sentence line | Clicking builds a sentence ("Look at shovel"); the character then performs it |
| Inventory | Text list beside the verb grid |
| Dialogue | Overlay tree, 2–4 numbered choices, picked by line |
| Failure model | **Death is near-impossible**; dead ends are designed out. This is the genre's core promise |
| Puzzle grammar | Object chaining, dialogue-gated info, item trading, map travel, a recurring duel that reuses dialogue as its move set |
| Art | 256-colour VGA, heavy dithering, night blues with warm window light |
| Audio | MT-32 / AdLib FM, short looping themes per location, no voice |

**Legal:** we build in the genre, not a clone. Original title, world, characters, puzzles and
dialogue. No LucasArts assets, names or text are reused. Genre conventions (a verb interface, a
comedy pirate setting, a duel minigame) are not protectable; Guybrush, Melee Island and the
rubber chicken are.

---

## 2. The game

**The Brass Compass** — a harbour clerk in Port Vela needs a berth on a pirate ship, and needs
his paperwork in order by dawn. Dry comedy, puns as a combat system.

Genre set-pieces, replaced with originals:

| Reference trope | Our take |
|---|---|
| Three trials to join a crew | Three *fees*: a debt, a licence, a bribe |
| (dropped) | The planned taunt duel was too close to an existing game's signature mechanic and is cut |
| Map-screen island hopping | A chart table you annotate; routes unlock by gossip |
| Joke examine lines | Every hotspot has a written, characterful "look at" line — that's where the comedy budget goes |

---

## 3. Resolution decision

**1920×1080, not 320×200.** Deliberate, and the single most important art call.

The original's pixel art is beautiful but diffusion models are bad at true low-resolution pixel
art and excellent at painted illustration. Fighting them into 320×200 would waste the pipeline's
main strength, and the result would read as "fake retro" rather than "dishonest" or "modern".

So we took the **Special Edition** route: full-resolution painted scenes, crisp vector-crisp text,
modern UI. Scene occupies `0..880`, verb panel `880..1080`.

Consequences that shaped the build:
- Text is real font rendering, not a bitmap font → no resolution ceiling.
- Hotspots are screen-space polygons at 1080p, so hit targets are precise.
- The "pixelate" step from the first draft is **gone**. A retro mode could be added later as a
  downscale-post-process, but it is not the identity of the game.

---

## 4. Tech stack (as built)

**Vite + TypeScript + Canvas 2D, zero runtime dependencies.** Vite is the only dev dependency.

Rejected: Godot (toolchain too heavy), Pygame (weak distribution and text), ScummVM/AGS (locked
into someone else's authoring format).

```
src/
  engine/   view (DPI scaling), input, assets, audio, text, walkbox (A*)
  game/     game (state machine), ui (panel/dialogue/cursor), verbs, types
  content/  rooms, items, dialogue — pure data
public/assets/   generated art and audio
tools/           generate.py (RunComfy pipeline), normalize_sheet.py
```

**The boundary that matters:** `content/` is data, `game/` is mechanism. Adding a room is adding
an object to `ROOMS` — no engine code.

---

## 5. Art pipeline (validated, in production)

RunComfy Model API, base `https://model-api.runcomfy.net`, async submit → poll → result.

| Job | Model | Price |
|---|---|---|
| Scenes & characters | `bytedance/seedream-5/lite/text-to-image` @ 2848×1600 | $0.028 |
| Music | `acestep-ai/ace-step-1.5/text-to-audio` | $0.0004/sec |

**Scenes:** generate wide 16:9 at 2848×1600, downscale to 1920×880 with LANCZOS plus a light
unsharp mask so brushwork survives, then slight contrast. Cover-crop, never stretch.

**Characters — the hard part.** Diffusion cannot hold a pose across frames, so:
1. Generate on **flat magenta** with an explicit painterly style suffix, so the result sits
   inside painted backgrounds instead of looking pasted on.
2. Chroma-key with a **soft alpha matte + unpremultiply** (`F = (C-(1-a)·BG)/a`), not a hard
   threshold — a threshold leaves a coloured fringe on the silhouette.
3. For walk cycles, ask for "six frames in one horizontal row", then re-pack with
   `normalize_sheet.py`. This is essential: diffusion spaces frames unevenly, and equal slicing
   makes the animation jitter. The normaliser detects each figure and re-lays them into identical
   cells on a shared baseline.

**Caching:** every job hashes `(model_id, payload)` into `.gencache.json`. Re-running never
re-bills. `REPROCESS=1` re-runs only post-processing from cached raw renders — free iteration on
keying and cropping without another generation.

**Gotchas found:** `ace-step` requires `lyrics` even for instrumentals (`"[instrumental]"`);
the catalog schema does not say so.

---

## 6. Audio

Generated looping themes per room, one music bus with crossfade on room change. UI and movement
SFX are **synthesised in WebAudio**, not generated — clicks, footsteps and chimes come out
sharper and cost nothing. Voice is deliberately omitted: the reference had none, and text-only is
both more authentic and far cheaper.

---

## 7. What is built

- 12-verb interface, sentence line, hover outlines, compass cursor
- **Nine wide rooms across two acts**, each with its own calibrated perspective:
  - Act I — Vela Docks, the Customs House, the Salty Keel, Chandler's Lane, the Chandler's,
    the Harbour Loft
  - Act II — the Marrow's main deck, quarterdeck, and captain's cabin
- Scrolling camera with walk-before-exit transitions and per-room `arrive` points
- Occluder layers, so figures stand behind bars, desks and counters correctly
- Feet-anchored, torso-centred sprite frames measured from each generated sheet
- Inventory with item→object and item→item combination, paging past eight items
- Dialogue trees with conditional choices, a character registry, and number-key selection
- Multi-act state: finishing an act carries inventory, flags and the act number into the next,
  and the save survives so "Continue" resumes mid-story
- Skippable cinematics: Act I opening, Act I outro, and an Act II title card
- Act I chain: crowbar → crate → lemon → Marta → key → drawer → stamp → licence →
  manifest → loft → ledger → Bramwick
- Act II spine: spyglass → Quill → quarterdeck → cabin → compass on the chart

**Verified:** `npm test` drives both acts through real pointer events — including both Act I
solution routes — and asserts the act transition, the Act II spine and the ending. Type-check
and production build are clean, and the suite passes on repeated runs.

---

## 8. Cost

| Scope | Spend |
|---|---|
| Everything built so far (30 assets, all art and music) | **$0.84** |

Content generation is not the constraint. Authoring time is. A 45-room full game projects to
roughly **$15–25**.

---

## 9. Next: Acts II–IV

The four-act story, cast and canon are in `docs/STORY.md`. In order:

1. **Act II, expanded** — below decks and the bow in fog; the cook, the bosun, Pell's log, and a
   compass-steered run through the Needle. Ends on the Arcadia's flag.
2. **Act III, "Tidy Weather"** — the wreck, Ansel's log, the fake quarantine on Gullet Key,
   lifting the fog.
3. **Act IV, "All Hands Returned"** — Port Vela at night, exposing Cray at the Salty Keel,
   correcting the ledger, and two endings.
4. **A second walk sheet** so the cast isn't one silhouette.
5. **Voice** — deliberately absent so far; the reference had none either.

The engine needs no new systems for any of this except the duel.

---

### Reference files
- `reference/mi1_deconstruction_montage.png` — 24 frames across the reference playthrough
- `reference/mi1_ui_verbs.png` — the 12-verb panel, dialogue and inventory in detail
- `README.md` — how to run, play, and add content

---

## 10. Improvement pass

- Dev-only fast-forward hooks are gated behind Vite's development mode.
- Clicking a doorway with Walk to now changes rooms after arrival; Use works directly on doors.
- Autosave records the destination room after a transition, the title Continue shortcut works, malformed saves fall back to a new game, and text reveal stays complete after a skip.
- Added a dependency-free Chromium playthrough check (`npm test`) covering the Act I puzzle chain and screenshots.

The playthrough script is checked for JavaScript syntax. Browser execution and the production build still need to be run in an environment where the shell can launch Node commands.

## 11. UI, sprites, and interaction pass

Implemented:
- Fixed Marta's missing dialogue destination and enabled inventory Look at descriptions.
- Preserved item failure narration and updated crate/drawer descriptions after opening.
- Added selected item styling, outlined verbs, action guidance, and stable narration layout.
- Replaced the fixed dialogue box with measured text and wrapped choice rows shared with hit testing.
- Restored the native cursor and bounded hover labels.
- Added accessible pause controls, confirmed restart, title navigation, and persistent master audio settings.
- Added declarative NPC idle/talk motion, color grading, pickup visibility, and background occlusion regions.
- Repositioned Marta behind the tavern bar; the visual result still needs browser inspection.
- Expanded the browser test for dialogue references, examination, pause, and reload.

Validation:
- Node syntax checks passed for changed game, UI, settings, audio, and playthrough code.
- Build, full type checking, and npm test are blocked by the sandbox loopback initialization error.
- New screenshots and the full manual playthrough remain outstanding.
- Playwright migration and extraction of the existing renderer/dialogue runtime remain pending; the current test still uses CDP.


## 12. Keyboard and feedback pass

Implemented:
- Added independent keyboard focus for verbs, inventory, and visible hotspots. Tab and Shift+Tab
  cycle targets, arrows move within a zone, and Enter activates through the existing interactions.
- Added arrow/Enter dialogue and title navigation while preserving number-key and Continue shortcuts.
- Added steady high-contrast focus outlines, focused hotspot names, and brief audiovisual feedback
  for unsupported actions without changing valid custom responses.
- Made the canvas focusable, documented the controls, and prevented an invisible title-screen pause hit area.
- Expanded the CDP playthrough with keyboard and rejection assertions and made browser cleanup wait
  for child processes before removing the temporary profile.

Validation:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm test` passed the full Act I chain and the new keyboard/rejection checks.
- Captured title, keyboard focus, inventory focus, rejection, dialogue, settings, room, and ending
  screenshots; inspected the new focus and feedback frames for legibility and clipping.


## 13. Visual, movement, and cinematic overhaul

Implemented:
- Generated three 2560×880 movement-first backgrounds and four matching character assets for
  $0.196, preserving the originals. Cleaned sheet artifacts locally without additional generation.
- Added a smoothed world-space camera shared by rendering, pointer hit tests, keyboard focus,
  walk meshes, props, and occluders. Room exits still walk to their painted doors before fading.
- Rebuilt every room's walk polygons, hotspots, entries, stand points, depth ranges, and occluders
  around the new art. Marta is behind the tavern bar and Bramwick behind the customs desk.
- Added side/back/front movement selection and stronger depth scaling with persistent facing.
- Authored and rendered an 8-second opening and 8-second Act I outro in HyperFrames, with local
  art/music, original captions, no narration, and no new Act II gameplay.
- Added skippable native-video playback with persisted volume and safe load-failure exits.
- Expanded the CDP test to use camera-aware hotspot clicks and verify camera movement, walking
  before exits, vertical movement, cinematic display/skip, and the complete Act I chain.
- Initialized git with baseline commit 404ccf0; ignored secrets, reference footage, and render caches.

Validation:
- HyperFrames check passed with zero errors or warnings; keyframes, full-size beats, seams, and
  phone-width review sheets were inspected. `cinematic/REVIEW.md` records the creative review.
- Both delivered videos are 1920×1080 H.264/AAC, exactly 8 seconds; decoded frames were inspected
  and audio levels measured (not auditioned).
- `npm test` passed the full Act I chain plus camera, directional movement, and cinematic checks.
- New title, wide/scrolled room, placement, direction, intro, outro, and ending screenshots were
  captured and visually reviewed. `npm run build` (including TypeScript) and `git diff --check`
  passed on the final deliverable.


## 14. Depth, movement and story pass

Problems found (measured, not eyeballed):
- Sprite art carries large transparent margins that were drawn as part of the figure: the crate
  floated 25% of its height, and the walk sheets' figures fill only ~72% of their cells, so the
  player shrank ~21% (side) or ~30% (front/back) whenever he started walking.
- `elias_walk_v2.png` is not baseline-aligned: frames 4–5 sit 350 px lower than frames 0–3, so
  the walking figure jumped up and down every cycle. Its torso also drifts up to 4.5% of body
  height between cells. The idle art faces right but was mirrored when facing right.
- Bramwick and Marta are cut off at the knees/shins; Marta was placed with that cut on the bar
  top, so she stood on the counter at twice the player's height.
- NPCs and props had hand-typed pixel heights unrelated to the player's clamped linear depth
  ramp, so relative size was wrong in every room (the office player was child-sized).
- Walk polygons ran through the bar, through the regulars' table and up the customs steps;
  the bar occluder covered the player in front of it. Paths were 8-direction staircases that
  started with a jog to a grid-cell centre; walk speed and animation ignored depth.
- Story contradictions: the key was both "hidden from myself" and "borrowed by Marta"; the
  licence had to be stamped "by me" yet a self-stamped one was accepted; Marta's motive, the
  "nailed shut" crate (drawn open), the ending's shipping-lane mystery and the title's brass
  compass were never set up. Dialogue offered options the player couldn't yet know.

Implemented:
- Per-room ground-plane perspective calibrated on known objects; world-unit sprite `size`;
  `visible` for cut-off art; per-cell opaque bounds with torso anchoring; occluders with floor
  lines in the depth sort; re-measured walk areas, stand points, hotspots and NPC placement.
- Movement in body heights with depth foreshortening, distance-driven walk cycle and footsteps,
  line-of-sight path smoothing, sheet hysteresis, face-the-target, per-door arrival, and save
  positions clamped to the floor. `?debug` authoring overlay (dev only).
- Story rewrite around one premise (licensed piracy, Regulation fourteen, the card game, the
  father lost in the Straits, the compass). State-aware dialogue; both trades now have a second
  solution through conversation. The winning line is read before the outro starts.

Validation:
- `npx tsc --noEmit`, `npm run build` and `npm test` pass. The test now lints placement and
  verifies both solution routes, door arrival and facing.
- Frame-by-frame filmstrips of side, vertical and diagonal walks were inspected: feet stay on
  the floor line, height is constant on the level and changes smoothly with depth, no sway.
- Room screenshots with the debug overlay were reviewed for every room.
- Not changed: the rendered intro/outro videos (their captions remain consistent with the story).


## 15. Story expansion and Act II spine

The brief was "more scenes, more varied passages, a better story" — and then a second act.

**Story.** Act I gained a real antagonist and a reveal. Silas Cray, a shipping factor, has bought
the last berth and wants Fenn's compass. Old Rook, a washed-up navigator in the tavern, was on the
quay the night the *Arcadia* was written off — three days before she was due. The proof is in the
harbour ledger, and in a manifest copy the chandler hands over only once his invoice is stamped.
Bramwick's refusal now explains itself: Cray's claim holds the last berth, and only proof of fraud voids it.

That turns a fetch quest into a confrontation, and it gives Act II a reason to exist.

**Routes.** Chandler's Lane sits between the docks and the chandler's, with a bolted loft stair
that the crowbar opens. The docks now have four ways out instead of two, and the office, lane,
chandler's and loft form a loop rather than a corridor.

**Act II.** Three rooms on the *Marrow* at dawn — main deck, quarterdeck, cabin. Quill the lookout
blocks the way aft until you return her spyglass; Captain Vane dismisses you until the compass and
her chart disagree in front of her. It ends on the wreck.

**Systems added for this:** a character registry (speakers are ids, not display names), inventory
paging past eight items, a `Combo.if` gate, three-state flag conditions, and true multi-act state
with cinematic chaining. The playthrough test grew to cover both acts, both Act I solution routes,
and the act transition.

**Honest notes.** The pier-head room was cut after three generations: the art kept coming back as
a receding perspective, and the "orthographic" attempt produced flat clip-art that clashed with
everything else. Better no room than a broken one. Act II is a spine, not an act — four puzzles,
and it ends on a card.
