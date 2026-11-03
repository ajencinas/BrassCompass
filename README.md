# The Brass Compass

A point-and-click adventure in the classic SCUMM tradition — twelve verbs, a sentence line,
inventory puzzles and a talking-to-people problem — rendered at **1920×1080** with
AI-generated painted artwork.

Fenn has spent three years as a clerk in the Port Vela customs house, stamping other people's
voyages. At dawn the *Marrow* — a licensed pirate brig, which in Port Vela is a perfectly
respectable thing to be — sails for the Straits, where his father's ship vanished. She only
takes licensed hands. He has one night to get his paperwork in order.

The story bible, cast and four-act outline are in [`docs/STORY.md`](docs/STORY.md).

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires Node 18+. No runtime dependencies — Vite is the only dev dependency.

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the build
npm test           # scripts check, editor test, then play all four acts end to end in Chromium
npm run test:scripts   # just the .adv scripts: compile, round trip (a second)
```

---

## Art and audio

The generated art — scene backgrounds, character sprites, portraits and props — is **not in this
repository**. It is a little over 80 MB of WebP and PNG, which belongs in a shared folder rather
than in git history alongside the code.

**Images are available on request.** Everything needed to run the game is in a private folder:

```
Brass Compass Assets/
  scenes/       backgrounds, 2560x880
  characters/   sprites and dialogue portraits
  props/        scene props
  audio/        music (already in this repo, ~2 MB)
  video/        cinematics (already in this repo's gitignore)
```

Drop the folders into `public/assets/` and the game runs unchanged — the asset paths in
`src/content/assets.ts` are relative to that directory. Music and the code to regenerate both
live here, so the folder only needs to supply the painted art.

Missing images fail soft: the asset loader warns and continues, and the renderer skips absent
images rather than crashing, so the game still boots and can be walked around. (The test suite
has not been run against a tree with the art removed.)

To regenerate any asset from its prompt, see `tools/generate.py` (requires `RUNCOMFY_API`).

---

## How to play

| Action | Input |
|---|---|
| Select a verb | Click it in the bottom-left grid |
| Act on something | Click the object in the scene |
| Keyboard navigation | `Tab` / `Shift+Tab` cycle verbs, inventory and hotspots; arrows move within a zone; `Enter` activates |
| Two-object verbs (`Use`, `Give`) | Pick the verb, click the item, then click the target |
| Walk somewhere | Click the floor with no verb selected; click a doorway to enter |
| Cancel action or close dialogue | Right-click |
| Casebook — everything you've learned | `J`, or the Casebook button |
| Pause / settings | `Escape` or the Pause button |
| Restart / return to title | Pause menu |
| Master volume | Slider in pause menu; settings are remembered |
| Skip text | Click or press a key |
| Skip cinematic | Click, `Enter`, or `Escape`; Continue bypasses the opening |
| Mute music | `M` |
| Start / continue from title | `Enter` starts; `C` continues |
| Dialogue choices | Number keys, or arrows and `Enter` |

Hovering anything interactive draws a soft outline, and the cursor shows its name. Keyboard
focus uses a steady high-contrast outline and works independently of pointer hover.

**Walkthrough** (spoilers): Bramwick can't stamp after the night bell, but a clerk may stamp in
his "legal absence" — and the stamp is locked in his drawer, whose key he lost to Marta at cards.
Take the crowbar, use it on the packed lemon crate, and trade the lemon to Marta for the key
(Give it, or offer it when she asks). Take a licence form from the desk, unlock the drawer, and
stamp the form.

A stamped licence isn't enough. Bramwick refuses to sign until he's seen what he wrote about your
father's ship, so he wants **two** things: the Arcadia's manifest copy and the harbour ledger.

- The manifest is at **the chandler's**, off Chandler's Lane. Stamp the unpaid invoice on the
  spike; the chandler hands over the copy.
- The ledger is in the **loft above the chandler's**. Crowbar the bolted shutter in the lane,
  climb up, and read the entry — the Arcadia was written off three days before she was due.

Take the licence, the manifest and what you've learned back to Bramwick.

**Act II** opens on the *Marrow* at dawn. Quill the lookout won't let a clerk aft; her spyglass is
lying between two crates on the deck. Return it, climb to the quarterdeck, and take the cabin door
to Captain Vane — then put your father's compass on her chart table.

---

## Project layout

```
src/
  engine/          framework-agnostic: view scaling, input, assets, audio, text, pathfinding
  game/            the game itself: state machine, verbs, sentence model, UI, dialogue runtime
  content/         the content: scripts/*.adv (rooms, dialogue, items, tips, acts) + characters, assets
  adv/             the .adv script compiler (and the serializer used by the tools)
  editor/          the Adventure Editor (dev server only)
public/assets/     generated art, audio, and rendered cinematics
cinematic/         editable HyperFrames opening/chapter compositions
tools/generate.py  RunComfy asset pipeline (manifest-driven, cached)
tools/normalize_sheet.py  re-packs a generated sprite strip into even, baseline-aligned cells
```

The important boundary: **`src/content/` is data, `src/game/` is mechanism.** Adding a room
means writing a script, not code: every room, hotspot, combination, conversation, item, tip
and act lives in a plain-text `.adv` file under `src/content/scripts/`, compiled at startup into
the same `ROOMS`/`DIALOGUES`/`ITEMS`/`TIPS`/`ACTS` data the engine reads. The language is
documented in [docs/SCRIPTING.md](docs/SCRIPTING.md); a taste:

```
  hotspot marta "Marta"
    area 1890,460 140x125
    stand 1500,800
    look "Marta, who runs the Salty Keel and, by most accounts, Port Vela."
    talk: talk tavernkeeper

  use lemon on marta if not marta_paid
    "A lemon! The punch lives."
    take lemon
    give drawer_key
    set marta_paid
```

---

## Rendering

The whole game draws into a fixed 1920×1080 logical viewport and is scaled to the window with a
DPI-aware transform. Scene art occupies `0..880`; the verb panel occupies `880..1080`.
Each room declares a world width; the new backgrounds are 2560×880 and a smoothed, clamped camera
follows the player and keyboard focus. Pointer hit tests, walking, props, occluders, and actors all
share the same world-to-screen transform.

Backgrounds are generated at 2848×1600 and cover-fitted with a light unsharp mask. Their prompts
reserve clear walking lanes and deliberate exits. Characters are generated on flat magenta,
chroma-keyed, normalized into side/back/front cycles, and composited with feet-Y depth sorting.

### Depth, size and movement

- **One perspective per room.** `perspective: { horizon, refY, refH }` says a standing adult
  whose feet are at `refY` is `refH` px tall, shrinking linearly to nothing at the `horizon`.
  It is calibrated against known objects in the painting (a door, a bar, a desk) and used for
  the player, NPCs and props alike, unclamped, so everything at one depth agrees on scale.
- **Sizes are real-world.** A sprite declares `size` relative to a standing adult (the player
  is 1, the crate 0.42), not pixels. Art that stops short of the feet — waist-up NPCs behind a
  counter — declares `visible` (e.g. 0.72) and is sized as a whole person.
- **Feet come from the art.** Opaque bounds are measured per image and per sheet cell at load.
  Each frame is scaled from its own opaque rows and pinned to the floor at the feet, anchored on
  the torso, so generated sheets with uneven baselines or spacing don't bob, sway or resize.
- **Occluders have a floor line.** `occluders: [{ area, y }]` repaints the background over things
  whose feet are behind `y` and joins the same depth sort, so the bar hides Marta's legs but
  never the player standing in front of it.
- **Movement is in body heights.** Speed scales with on-screen size, vertical screen motion is
  foreshortened, the walk cycle and footsteps advance with distance (no foot sliding), paths are
  string-pulled into straight lines, sheet changes use hysteresis, and the player turns to face
  what they act on. Rooms can set `arrive` points so you come out of the door you went in.
- **`?debug`** (dev server only) draws walk areas, occluders with their floor lines, hotspots,
  stand points and the horizon. `npm test` lints that every entry, arrival and stand point is
  on the floor, nothing walkable is behind an occluder's floor line, and cut-off figures are hidden.

---

## Asset pipeline

All art and music comes from the RunComfy Model API. Requires `RUNCOMFY_API` in `.env`.

```bash
python3 tools/generate.py                      # everything (cached)
python3 tools/generate.py bg_tavern            # one asset by name
```

Every job is cached by a hash of `(model_id, payload)` in `.gencache.json`, so re-running never
re-bills a successful generation. Delete an entry to force a redo.

| Asset | Model | Cost |
|---|---|---|
| Scene backgrounds | `bytedance/seedream-5/lite/text-to-image` @ 2848×1600 | $0.028 |
| Characters & props | same, keyed to transparency | $0.028 |
| Music | `acestep-ai/ace-step-1.5/text-to-audio` | $0.0004/sec |

Note: `ace-step` requires `lyrics` even for instrumentals — pass `"[instrumental]"`.

### Adding a character

1. Add a manifest entry ending in a magenta-background prompt.
2. Run the generator; it chroma-keys and trims automatically.
3. Add a `sprite` line to the room's script in `src/content/scripts/rooms/`.

For walk cycles, ask for "six frames in one horizontal row", then run
`normalize_sheet.py` — diffusion spaces frames unevenly, and the normaliser re-packs them into
identical cells with a shared baseline so the animation doesn't jitter.

The movement-first pass generated three wide backgrounds and four character assets for **$0.196**.
The older art remains available beside the new `_wide` and `_v2` files.

### Cinematics

The editable HyperFrames project is in `cinematic/`. It contains an 8-second opening and an
8-second Act I outro, with local art/music and no narration. Run `npm run check` in that directory
for the full video gate, `npx hyperframes preview --background` to edit in Studio, and
`npx hyperframes render --quality delivery --output cinematic.mp4` to render the 16-second source.
The delivered web files are `public/assets/video/intro.mp4` and `act-i-outro.mp4`, split into two
8-second H.264/AAC MP4s with audio fades and fast-start metadata. `cinematic/REVIEW.md` records the
visual review; sound levels were measured, not auditioned.

---

## Dev notes

`window.__game` exposes the live game instance and `window.__ff(n)` fast-forwards `n` frames.
These exist because headless test browsers throttle `requestAnimationFrame` to ~1 fps, which
makes timing-dependent playtests impossible otherwise.

Save data lives in `localStorage` under `brasscompass.save.v3` and is written after every action,
room change and conversation. Older v2 saves keep their flags and restart at the beginning of their
act. The ending clears it. Dev hooks (`__game`, `__ff`, `__act(n)`) exist only under `npm run dev`.

**Explore Scenes** on the title screen lets you walk any room without solving anything: R opens a
menu of every scene, D toggles the walk-area/hotspot overlay, and nothing is saved.
`node tools/shoot.mjs <room> [x,y …] [--act N] [--clean]` takes calibration screenshots with
Fenn placed at given points.

### The Adventure Editor (F2)

Under `npm run dev`, **F2** opens the Adventure Editor beside the running game (the title
screen's hint line mentions it in dev builds only; none of it is in the production bundle).
Keys typed in the panel never reach the game.

- **Script**: every `.adv` file, with line numbers, syntax colours, and errors marked in the
  gutter as you type (`rooms/tavern.adv:28:5: 'lok' doesn't belong in a hotspot`).
  **Apply** (Ctrl+Enter) recompiles everything and hot-swaps it into the running game: the
  room reloads in place and the act, position, inventory, flags and open conversation are
  kept. **Save** (Ctrl+S) writes the file through a dev-server endpoint that only accepts
  `.adv` files under `src/content/scripts/`. **Alt+click** a hotspot in the scene, or a line in
  a conversation, to jump to its script line.
- **State**: act, room and position, the open conversation and node, queued effects,
  inventory and flags (story, `seen:`, `looked:`). Click a flag to toggle it, × to unset or take,
  and jump to any room or act, or give any item.
- **Log**: a running trace of what fired — sentence, lines, effects, room changes, dialogue
  nodes and choices — filterable, copyable, clearable; click an entry to open its script.
- **Map**: the puzzle map per act, generated from the scripts: items and flags, and every place
  that needs or makes one (hotspot verbs, combinations, dialogue choices, scenes, act starts),
  laid out left to right. Red marks items nobody can obtain or nobody uses, flags read but never
  set or set but never read, and anything no act can reach. Click a node to open its script.
- **Overlay**: walk areas, occluders, hotspots, stand points, entry and arrival points and the
  horizon on the live scene. Drag a square to move it: the game updates at once and the
  coordinates are rewritten in place in the script line (then Save).

`npm run test:editor` drives all of this in headless Chrome and saves screenshots to
`reference/screens/editor-*.png`.

### Tests

`npm test` launches the Vite dev server and headless Chromium, lints room placement, drives the
complete Act I chain with real pointer events, then verifies the alternative dialogue route for
both trades, and exercises title, verb, inventory, hotspot, and dialogue keyboard controls. It derives scene clicks from live hotspot/camera coordinates and also checks camera
scrolling, walk-before-exit transitions, directional frames, cinematic display/skip, rejection
feedback, dialogue links, examination, pause/resume, and save/reload. Screenshots are saved to
`reference/screens/test-*.png`. Set `CHROME_BIN` if Chromium is installed under another name.
The test requires Node 22+ (the game itself supports Node 18+). It uses Chrome DevTools Protocol
directly, so it adds no package dependency.

---

## What is built

The complete game: four acts, twenty-one rooms, from a licence stamped at night to a dawn
choice on the pier.

- **Act I, A Licence to Sail** (Port Vela, night): seven rooms (the docks, the Customs House,
  the Salty Keel, Chandler's Lane, the Chandler's, the Harbour Loft, Upper Town). Stamp your own
  licence, prove Cray's claim on the last berth is a fraud; the IOU and the regulars' wager are
  optional seeds that pay off later.
- **Act II, The Vela Straits** (aboard the Marrow): deck, quarterdeck, cabin, below decks, the
  bow in fog and the crow's nest. Win Vane's three terms, the optional night watch, and the fog
  run by compass.
- **Act III, Tidy Weather** (the reef and Gullet Key): the wreck, her cabin, the lagoon shore,
  the quarantine gate, the Weather Works and the salt camp. The forms war with Pike, the
  halyard, Form 9, the reunion and flag sixteen.
- **Act IV, All Hands Returned** (Port Vela, the night after): the Act I rooms with their Act IV
  people (Cray in Bramwick's office, Bramwick and Rook in the Keel, Quill and Ansel on the
  Marrow's rail) plus Cray & Co.'s counting house and the pier end. Gather the evidence, hold
  the inquiry at the Salty Keel with Marta presiding, reinstate Bramwick, correct the ledger, and
  choose: sea or desk. The ending card changes with the choice and with what you did on the way
  (affection, the night watch, the wager, the kelp).
- 12-verb interface with a sentence line; **verb suggestions** (the natural verb lights up on
  hover, and right-click does it); full keyboard navigation
- **Tips**: the Tip button or H gives one plain line about the next step, and tip mode keeps it
  on screen; looking at the compass gives the same nudge in character
- **Explore Scenes** from the title: jump to any room of any act, with the calibration overlay
- Dialogue trees that remember the whole voyage (`seen:`/`looked:` flags, affection),
  conditional hotspot states, sprites and arrival scenes per act, depth-sorted figures and
  occluders, night grades
- Skippable cinematics between acts (HyperFrames, in `cinematic/`), save/load, generated music,
  synthesised SFX
- `npm test` plays the whole game through with real clicks and lints the content and placement

The canon is [`docs/STORY.md`](docs/STORY.md); the scene-by-scene script is
[`docs/SCRIPT.md`](docs/SCRIPT.md); the build plan is [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md).

## Interface and scene improvements

The verb panel now outlines actions and highlights selected inventory items. Narration uses a
separate panel above the controls, and two-object actions explain what to select next.
Dialogue choices wrap and share their measured layout with pointer hit testing.

Keyboard focus is independent of pointer hover, with steady outlines on panel controls and
hotspots plus a focused hotspot name. Unsupported actions retain their narration and add a
short denial sound and cursor cue.

Escape opens an accessible settings dialog with resume, confirmed restart, return to title,
mute, and master volume. Music and effects share the volume setting, which persists separately
from your saved voyage. Right-click remains the action/dialogue cancel control.

Room sprites support subtle idle/talk motion and a rendering color grade. Collected props
disappear with their hotspots. Rooms can declare foreground polygons restored from the
background over actors; the tavern uses this to place Marta behind the bar and the office uses
it to keep Bramwick behind the desk.

Validation for this pass: TypeScript type checking, the production build, HyperFrames checks,
and the Chromium playthrough pass. The 8-second videos were decoded and inspected, and new
camera, placement, directional-walk, and cinematic screenshots were captured and reviewed.
