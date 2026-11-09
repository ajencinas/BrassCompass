# The Brass Compass

**A tale of Dreadwater Isle.** A point-and-click adventure in the classic SCUMM tradition —
twelve verbs, a sentence line, inventory puzzles and a talking-to-people problem — rendered at
**1920×1080** with AI-generated painted artwork.

Fenn is a cartographer's apprentice, back on Dreadwater Isle three months after his father sailed
into the Shroud — the permanent fog bank offshore that keeps every ship it takes. The harbour is
half empty, the island is frightened, and the only captain still sailing is Vex, the man everyone
blames for the disappearances. Vex wants a price. The fog wants more.

*The Brass Compass* is still the game's name; **The Father and the Fog** is the story. It is
family-friendly: pirate peril, ghosts, drinking and cards, but no gore, no innuendo, and no
bureaucracy plot. The mystery is the ghost and the fog.

The story bible, cast and four-act outline are in [`docs/STORY.md`](docs/STORY.md); the generated
screenplay is [`docs/FULL_SCRIPT.md`](docs/FULL_SCRIPT.md).

## What's new in v0.2

- **A new voyage** — *The Father and the Fog*: four acts on Dreadwater Isle, 24 painted rooms,
  two endings, and a ghost ship that has been taking crews for eighty years.
- **A new captain and a new ghost** — Vex, the only captain still sailing, and Mordant of the
  Grey Lantern, with new painted portraits and bodies; the Grey Lantern's deck, the longboat and
  the bell-clapper and oiled-canvas icons join the art set.
- **The Chart and the Ship's log** — `J` opens the chart: what Fenn has learned, with the next
  step at the top. The optional layer is the ship's log, shown after the ending and tallied on
  the title in two columns (entered / not yet).
- **Previously** — Continue opens a recap card: the act, how long ago, the room, the hint Fenn was
  working on, the last two chart entries, what he is carrying, and whether the act had begun.
- **The chart earns its keep** — a *NEXT* block at the top (the nudge, not the answer), a toast
  and a gold glow when an entry is pinned, and a plan you can read without leaving the game.
- **Readable for everyone** — the ending card honours the text size and paginates, the top bar and
  menus scale, Escape cancels instead of pausing first, and the canvas controls are announced.
- **Ship-ready** — relative production build, `npm run package:itch`, licence, credits, AI
  disclosure, store deck and CI.


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
npm test           # script lint, editor test, then the browser playthrough in Chromium
npm run test:scripts   # just the .adv scripts: compile, round trip (a second)
npm run test:unit  # the unit tests (save, recap, reach, prefs, tips, compile, fuzz helpers, scale)
npm run test:scale # every character's size, screen height and reachable stand, all 25 rooms
npm run test:fuzz  # the state-machine fuzzer's regression suite in Chromium (about a minute)
```

The browser playthrough is being retargeted to the new acts alongside the story work; the script
lint, editor test and unit tests are the fast gates that stay green while it is rewritten.

---

## Ship it

The build is portable. Asset URLs are relative (`vite.config.ts` builds with `base: "./"`, and
every runtime URL goes through `assetUrl()` in [`src/content/assets.ts`](src/content/assets.ts)),
so the same `dist/` works at a domain root, in a subdirectory — itch.io serves a packaged game
from `/html/<id>/index.html` — or opened from the filesystem.

```bash
npm run build         # type-check + production bundle into dist/
npm run package:itch  # build, then dist-itch/the-brass-compass-v0.2.0-itch.zip
```

`package:itch` puts `index.html` at the archive root, writes the itch `README.txt`, the AI
disclosure, the licence and the credits beside it, and reads the finished zip back to check its
layout before it reports success. `--no-build` packs an existing `dist/` instead.

Store copy, the screenshot shot list (rooms, beats and the exact `tools/shoot.mjs` commands) and
a 30-second trailer beat sheet are in [`docs/STORE.md`](docs/STORE.md). Section 8 there also has
the pre-upload check: serve `dist/` from a subdirectory and confirm the game boots with no 404s.
Credits are in [`CREDITS.md`](CREDITS.md), the AI disclosure is repeated there and in
[`docs/STORE.md`](docs/STORE.md), and the licence is [LICENSE](LICENSE). CI
(`.github/workflows/ci.yml`) runs typecheck, scripts, unit tests and the build on every push and
pull request, and refuses a build whose HTML has root-absolute URLs.

---

## Art and audio

The generated art — scene backgrounds, character sprites, portraits and props — is **not in this
repository**. It is a little over 80 MB of WebP and PNG, which belongs in a shared folder rather
than in git history alongside the code.

New for the reboot: **Vex** (portrait and body), **Mordant** (portrait and body), the **Grey
Lantern deck** plate (`bg_lantern_deck_wide`), the **longboat** prop, and the **bell-clapper** and
**oiled-canvas** inventory icons. Quill's and Marta's portraits were refreshed; Elias reuses the
existing father portrait and body, renamed. The old cinematics are not part of this story; the
new acts have no opening or closing films.

To be precise: the art is no longer *tracked*, but earlier commits did contain it, so a clone still
downloads it as part of the history. Removing it from history means rewriting every commit with
`git filter-repo` and force-pushing, which breaks existing clones; that is the owner's call and has
not been done.

**Images are available on request.** Everything needed to run the game is in a private folder:

```
Brass Compass Assets/
  scenes/       backgrounds, 2560x880
  characters/   sprites and dialogue portraits
  props/        scene props, and inventory icons in props/items/
  audio/        music (already in this repo, ~2 MB)
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
| Do the obvious thing (talk, take, open, look) | Left-click it — the verb it would use lights up as you hover |
| Look at something | Right-click it (in the scene or your inventory) |
| A specific verb | Click it in the bottom-left grid, then click the object |
| Two-object verbs (`Use`, `Give`) | Pick the verb, click the item, then click the target |
| Walk somewhere | Click the floor; double-click (or click the same spot again) to run |
| Go through a door or exit | Click it to walk through; double-click to leave at once |
| Cancel a sentence or leave a conversation | Right-click anywhere that isn't an object |
| Reveal everything interactive | Hold `Q`, or toggle the Reveal button in the top bar |
| Keyboard navigation | `Tab` / `Shift+Tab` move between the scene, the verbs and the inventory (the scene first); arrows move within one; `Enter` activates (with no verb chosen, the lit-up one). Hints switch to key names while you play by keyboard |
| Map — the island chart, the area views and travel | `A`, or the Map button |
| Chart — everything you've learned | `J`, or the Chart button |
| History — the last 30 lines | `L`, or the History button |
| Pause / settings | `Escape` or the Pause button |
| Restart / return to title | Pause menu |
| Skip text | Click or press a key. A line's box fades once it has been read; `L` keeps it |
| Mute music | `M` |
| Start / continue from title | With a save, Continue comes first and `Enter` continues (`C` too); otherwise `Enter` starts. New Voyage over a save asks first: "Keep my voyage" sits where the button was, and "Yes — start anew" only counts as a separate, later choice |
| Dialogue choices | Click, number keys, or arrows and `Enter` |
| Touch | Tap a thing to see its name and verb, tap again to act; long-press to look; tap the floor to walk, double-tap to run |

The pause menu holds the settings, remembered per browser: master, music and effects volume;
text speed (Slow / Normal / Fast / Instant); **Wait for click** (lines that something is waiting
on stay up until you click, instead of moving on once read); text size (Automatic, which is 125%
when the game is drawn small, as at 1366×768, or 100 / 125 / 150%); reduced motion (follows the
OS unless set; it shows text at once, so the speed setting is disabled while it's on, and it
stills breathing, camera glides, door zooms and the title's drift); fullscreen; and a controls
reference. Restart asks first, the same way New Voyage does. Escape, H and L work from the pause
menu as its footer says.

Hovering anything interactive draws a soft outline, the cursor shows its name, and the pointer
changes over things and exits. Keyboard focus uses a steady high-contrast outline and works
independently of pointer hover; focus changes, rooms and lines are announced to screen readers.

Finishing the voyage unlocks **Chapter select** on the title screen (walk any scene; nothing is
saved). The final save is kept, so Continue returns you to just before the last choice. The
closing card rises line by line over the voyage's last painting: a click or `Enter` shows it all,
the next returns to the title.

**Act I starter** (spoilers): Land at Dreadwater Harbour and talk to **Bramwick** in the
harbourmaster's house — he confirms Elias is gone and points you to Marta and Vex. At the **Salty
Keel**, Marta points you at Rook, Dorrit and Vex's warehouse on Wreckers' Lane.

Vex will not sail until his spare **rudder** is back from Pike's wreckers. Search the **boat shed**
in Wreckers' Lane: the real thief is Wen, a fog survivor hiding behind the stores. He confesses
that Pike paid him and tells you where the rudder is. Take that to **Pike**; he returns the
rudder. Give it to **Vex**, who agrees to the voyage and hands back **Quill's compass**. Take the
compass to Quill at **The Shipwright's**.

Two more crew members: fetch **Rook's old log** from the keeper's store at **the lighthouse** and
bring it back to him at the Salty Keel — he gives you **rule one** and your father's **chart**.
At the shipwright's, take the **crowbar** from the counter and use it on the *Marrow*'s seized
mast band; **Hobb** joins. Tell **Dorrit** he is cleared (Wen's confession did that) and she
joins. With Vex, Quill, Dorrit, Hobb, the rudder and the chart in hand, go to **the harbour mouth**
at the end of the pier and talk to Vex. He takes the oars, and Act II opens on the *Marrow*.

**Act II** begins at the helm: Vex sends you to the bow to "call the water", the bell rings with no
hand on it, and the first attempt at the Shroud nearly ends the voyage. The hold below decks is
the next answer — and then the fog takes the *Marrow*. From there the longboat, the wreck and the
castaway camp lead to Elias and the three rules; the reef gate leads aboard the Grey Lantern.

---

## Project layout

```
src/
  engine/          framework-agnostic: view scaling, input, assets, audio, text, pathfinding
  game/            the game itself: state machine, verbs, sentence model, UI, dialogue runtime
  content/         scripts/*.adv (rooms, dialogue, items, tips, acts) + characters, assets;
                   old-scripts/ is the archived previous story and is never loaded
  adv/             the .adv script compiler (and the serializer used by the tools)
  editor/          the Adventure Editor (dev server only)
public/assets/     generated art and audio
cinematic/         legacy HyperFrames project from the previous cut; the new acts use no films
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
    area 1888,330 170x405
    stand 1500,800
    look "Marta, behind the bar. She's been wiping the same glass since I walked in."
    talk: talk marta

  use compass on rook
    "He turns it over once. 'Your father's. It still points at the fog.'"
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

### Cinematics (legacy)

The new acts have **no opening or closing films**. The old HyperFrames project remains in
`cinematic/` for reference, but its films are not loaded by the game and are not part of the new
story. The cinematic player itself stays in `src/game/cinematic.ts` for a future film:
give an act an `intro` or `outro` in `acts.adv` and register its transcript, and the existing
skip, transcript and audio-duck paths work unchanged.

---

## Dev notes

`window.__game` exposes the live game instance and `window.__ff(n)` fast-forwards `n` frames.
These exist because headless test browsers throttle `requestAnimationFrame` to ~1 fps, which
makes timing-dependent playtests impossible otherwise.

Save data lives in `localStorage` under `brasscompass.save.v4` (save shape 3) and is written after
every action, room change and conversation; a `seen:` or `looked:` flag with nothing else to save
follows within half a second, or at once when the tab is hidden or closed. Saves from the old
voyage are not migrated: the game starts the new voyage at Act I and says "The old voyage is over.
A new one begins." A save that can't be read, or storage that refuses to write, is reported in a
banner under the top bar until it has been on screen long enough to read. The ending keeps the
save (Continue returns to just before the final choice) and sets `brasscompass.completed`, which
unlocks Chapter select. Dev hooks (`__game`, `__ff`, `__act(n)`) exist only under `npm run dev`.

**Chapter select** on the title screen (always under `npm run dev`; for players once they have
finished) lets you walk any room without solving anything: R opens a menu of every scene, D (dev
only) toggles the walk-area/hotspot overlay, and nothing is saved.
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
`test-output/screens/editor-*.png` (ignored by git).

### Tests

`npm test` launches the Vite dev server and headless Chromium, lints room placement, then runs the
browser playthrough with real pointer events (the playthrough is being retargeted to the new acts
in parallel). It exercises title, verb, inventory, hotspot and dialogue keyboard controls, derives
scene clicks from live hotspot/camera coordinates, and checks camera scrolling, walk-before-exit
transitions, directional frames, rejection feedback, dialogue links, examination, pause/resume and
save/reload. Screenshots are saved to
`test-output/screens/test-*.png` (ignored by git; the curated shots in `reference/screens/` are
kept by hand). Set `CHROME_BIN` if Chromium is installed under another name.
The test requires Node 22+ (the game itself supports Node 18+). It uses Chrome DevTools Protocol
directly, so it adds no package dependency.

`npm run test:fuzz` (about a minute; not part of `test:fast`) is the state-machine fuzzer's
regression suite (`tools/fuzz/regression.mjs`): every hotspot with every verb and act item in a
sample of rooms with the game's invariants checked after each, the whole of Act II's state space
searched for softlocks, a random-input run, and one named check per bug the full fuzzer found. A
check marked `todo` waits for a fix from another branch: it reports, but doesn't fail the run.
`FUZZ_URL=http://127.0.0.1:5173/` points it at a dev server that's already running. The fuzzer
drives the game through `window.__game` and the dev-only `devSnapshot()`/`devRestore()`.

The browser tests share their start-up (`tools/browser-env.mjs`): each starts this checkout's own
dev server on a free port — never one that was already listening, which may be another checkout's
— and stops its servers and browsers and deletes their profiles however the run ends.

---

## What is built

The complete new story: four acts, 24 painted rooms, from Fenn's return to Dreadwater to the last
choice on the Grey Lantern's deck. Family-friendly throughout: pirate peril, ghosts, drinking and
cards, but no gore and no innuendo.

- **Act I, The Return** (Dreadwater Isle, night): the harbour, the harbourmaster's house, the
  Salty Keel, Wreckers' Lane, the boat shed, Vex's warehouse, the shipwright's, Upper Town, the
  lighthouse and the harbour mouth. Get Vex's rudder back from Pike, clear Dorrit's name, recover
  Quill's compass, fetch Rook's log for the chart and rule one, and free the *Marrow*'s mast so
  Hobb joins. Vex offers the deal at the harbour mouth.
- **Act II, The Crew** (aboard the *Marrow*): deck, helm, captain's cabin, crew deck, crow's nest,
  stern gallery and the bow in the Shroud. The first attempt at the fog, the hold full of salvage,
  the confrontation with Vex, and the loss of the *Marrow*.
- **Act III, The Shroud** (the fog flats): the flats, the sunken wreck, the castaway camp, the far
  flats and the reef gate. Vex's admission, Elias alive, the three rules, Hobb's bell plan and the
  boarding of the Grey Lantern.
- **Act IV, The Grey Lantern**: the ghost ship's deck and captain's cabin. Cut the bell (and free
  Tam Hobb), douse the great lantern, read Mordant's nameplate — in any order — then face Mordant and
  choose: **The Fog Lifts** or **The Long Way Home**. Vex's fate follows the trust you gave him.
- 12-verb interface with a sentence line; **verb suggestions** (the natural verb lights up on
  hover, and a plain click does it; right-click looks); hold Q to reveal every hotspot; full
  keyboard navigation, touch controls and screen-reader announcements
- **The atlas** (`A`) — the island chart, then the area the room belongs to, then the room; the
  area is always named above the room name, and visited places can be travelled to.
- **The Chart** (`J`) and **the Ship's log** — what Fenn has learned, the next step at the top,
  and the optional layer shown after the ending
- **Tips** in two steps: the Tip button or H first gives a nudge (the person, place or idea),
  and asking again gives the plain next step; tip mode keeps the nudge on screen until you ask;
  looking at the compass nudges in character
- **Chapter select** from the title (after finishing, or on the dev server): jump to any room of
  any act
- Dialogue trees that remember the whole voyage (`seen:`/`looked:` flags), conditional hotspot
  states, sprites and arrival scenes per act, depth-sorted figures and occluders, night grades
- Save/load, generated music, synthesised SFX, and no fail states; the new acts play without
  opening or closing films
- `npm test` lints the scripts, runs the editor test and drives the browser playthrough; the
  playthrough is being retargeted to the new acts in parallel

The canon is [`docs/STORY.md`](docs/STORY.md), with [`docs/REBOOT.md`](docs/REBOOT.md) as the
showrunner spec; the generated screenplay is [`docs/FULL_SCRIPT.md`](docs/FULL_SCRIPT.md).

## Interface and scene improvements

The verb panel now outlines actions and highlights selected inventory items. Narration uses a
separate panel above the controls, and two-object actions explain what to select next.
Dialogue choices wrap and share their measured layout with pointer hit testing.

Keyboard focus is independent of pointer hover, with steady outlines on panel controls and
hotspots plus a focused hotspot name. Unsupported actions retain their narration and add a
short denial sound and cursor cue.

Escape opens an accessible settings dialog with resume, confirmed restart, return to title,
mute, master/music/effects volume, text speed, wait-for-click, text size, reduced motion,
fullscreen and a controls reference; all persist separately from your saved voyage. Right-click
looks at a thing, and cancels a sentence or a conversation anywhere else.

Room sprites support subtle idle/talk motion and a rendering color grade. Collected props
disappear with their hotspots. Rooms can declare foreground polygons restored from the
background over actors; the tavern uses this to place Marta behind the bar and the office uses
it to keep Bramwick behind the desk.

Validation gates: TypeScript type checking, script lint, unit tests, the editor test and the
production build; new rooms and the new cast are screenshot-reviewed with `tools/shoot.mjs`. The
full browser playthrough is retargeted to the new acts alongside the content work.
