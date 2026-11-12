# The Brass Compass: game plan (current story)

**The Father and the Fog** — a fog-bound pirate adventure in four acts, about two hours long.
Fenn, a cartographer's apprentice, returns to Dreadwater Isle to find his father, missing three
months in the Shroud. The only captain still sailing is Vex, the man everyone blames — and the
fog is hiding a ship that has been taking crews for eighty years.

This file is the build plan for the story now in the game. The canon is
[`STORY.md`](STORY.md); the showrunner spec for the reboot is [`REBOOT.md`](REBOOT.md); the
generated screenplay is [`FULL_SCRIPT.md`](FULL_SCRIPT.md). The old Port Vela / insurance-ledger
plan is not canon and must not be reintroduced.

---

## 1. What the game is for

| Pillar | What it means in practice |
|---|---|
| **Adventure** | A real voyage: a harbour under fog, a ship at sea, a wreck on a reef, a castaway camp, a ghost ship, and a way home. Every act ends somewhere new. |
| **Mystery** | Who took the ships? The answer is the Grey Lantern, her captain Mordant, and the three rules that let a crew survive her. Vex is the red herring, not the villain. |
| **Character** | Fenn is precise, dry and braver than he sounds. Vex is theatrical, vain and useful. Elias apologises for the wrong things. Quill wants the chart table, not the lookout's perch. Hobb wants his brother. |
| **Warmth** | The island is frightened but kind; the horror is weather, sound and absence, never gore. The dead are sad and strange. |

**Family-friendly rules:** no nudity, sexual content, gore or objectifying camera; pirate peril,
ghosts, drinking and cards are fine; romance is chaste. Every spoken line is plain and short.
See [`DIALOGUE_STYLE.md`](DIALOGUE_STYLE.md).

---

## 2. The four acts

### Act I — The Return

Dreadwater Harbour, the Salty Keel, the Harbourmaster's House, Wreckers' Lane, Upper Town, the
Quay, Vex's Warehouse, the Boat Shed, the Shipwright's, the Lighthouse, the Harbour Mouth.

Fenn lands with his father's compass and no ship. Bramwick confirms the loss; Marta knows the
island; Vex will not sail until his spare rudder is back from Pike's wreckers. The Act I jobs are
character scenes, not forms:

- recover Vex's rudder from Pike and clear Dorrit of the stolen stores;
- take Quill's compass back from Vex, and get Hobb's mast band freed with the crowbar;
- fetch Rook's old log from the lighthouse; Rook gives rule one and the chart folded in the back;
- take the deal at the harbour mouth: Vex captains, half the salvage, and the *Marrow* sails.

Upper Town, the well, the father's room and the regulars are texture, not gates.

### Act II — The Crew

The *Marrow*: deck, helm, captain's cabin, crew deck, crow's nest, stern gallery.

Fit-out scenes establish why each of them came. At the bow, Fenn calls the water; the bell rings
with no hand on the rope, the bow lantern dies, and something vast passes under the hull. Silence
and darkness save them: rule two, it hunts light. Below decks the crew finds Vex's salvage —
barrels and a sea-chest marked CORMORANT, KESTREL, ARCADIA. Vex admits the salvage, refuses to turn
back, and takes the *Marrow* deeper. The fog takes her; the crew ends in the longboat with the
wreck behind them and rule three waiting on the reef.

### Act III — The Shroud

The Fog Flats, the Sunken Wreck, the Castaway Camp, the Far Flats, the Reef Gate.

On the flats Vex admits he saw Elias on the reef and turned away. The wreck is an old victim of
the Lantern; Hobb hears Tam's bell — three notes, then one — and works a grey bow timber free. It
is a piece of the Grey Lantern, and it still carries the plate: `M. MORDANT, MASTER`. At the camp
Elias is alive with the chart. The tents are tied shut from the outside and the hut's slate reads
`THE BELL CALLED. WE WENT.` Elias gives the three rules, the Lantern's route and the plan. Hobb
sets his end of it: he cuts the bell. At the reef gate Vex waits until Elias is found, the name is
known and the plan is real; then the longboat goes into the water and the Grey Lantern comes out
of the fog.

### Act IV — The Grey Lantern

The ghost ship's deck and captain's cabin. Three objectives, in any order:

- **The bell** (Hobb). Cut it loose. Tam Hobb is the hand on the rope: thin, tired and alive.
- **The lantern** (Quill). Smother the great green lantern with wet oiled canvas.
- **The name** (Elias). Set the brass plate from the Lantern's bow on Mordant's desk and speak
  the name. The cold at the end of the cabin turns toward them.

Then Mordant: courteous, tired, territorial. Vex asks for something to hold on to — the boat, the
rope, or Fenn's word — from the companionway above. The answer sets `vex_trust`.

### Endings

Both are earned; neither is a fail state.

- **The Fog Lifts** (`ending_fog_lifts`): ring the bell for the dead, free the crews, and let the
  fog go. Elias comes home; the compass points north; Quill charts Quill's Run; Tam Hobb learns
  his son kept counting; Marta has a story with an ending.
- **The Long Way Home** (`ending_long_way`): take the living and run. The fog stays. With
  `vex_trust`, Vex leaves the longboat for Elias and Elias comes home a month later; without it,
  Elias stays on the fog rock with the chart. Fenn answers the bell on quiet nights, which is not
  the same as going back.

Vex is never the hero. The exact lines are in `src/content/scripts/acts.adv`; do not paraphrase
them in other docs.

---

## 3. Content architecture

- **Scripts:** `src/content/scripts/` — rooms, dialogue, items, tips, combos, acts and ending.
  The `.adv` language is documented in [`SCRIPTING.md`](SCRIPTING.md). `src/content/old-scripts/`
  is the archived Port Vela story and is never loaded.
- **Compilation:** `src/adv/compile.ts` produces the live records in `src/content/content.ts`;
  rooms/dialogue/items/hints/combos/acts re-export them under the engine's old names.
- **The Chart** (`J`) is what Fenn has learned, with the next step at the top. **The Ship's log**
  is the optional after-ending layer. The identifiers stay `casebook`/`deeds` in code.
- **Save/Continue:** the recap card names the act, room, last hint, last two chart entries and
  what Fenn carries. Old saves restart at Act I with a notice.
- **Tests:** `tools/test-scripts.mjs` compiles and round-trips every script; the unit tests cover
  save, recap, reach, tips, scale and the compiler; `tools/playthrough.mjs` drives both endings in
  headless Chrome.

---

## 4. Art, audio and video

The painted plates, character bodies and portraits live in the shared asset folder (not tracked;
see README). The story uses 25 rooms, including the new Grey Lantern deck and cabin, plus the
longboat, Vex, Mordant, the bell-clapper and oiled-canvas icons. The old Act I–IV cinematics are
not used: the new acts have no opening or closing films, and the game opens at the dock.

---

## 5. Build order and verification

Story and content are written first; the engine changes only for systems copy (Chart, Ship's log,
save version, act metadata). Every content change runs:

```bash
node tools/test-scripts.mjs
node --test tests/unit/*.test.mjs
npx tsc --noEmit
node tools/playthrough.mjs
```

The playthrough is the gate for both endings, the save/Continue recap, the chart and the ship's
log. Keep the old Port Vela plot, names, paperwork mechanics and cinematics out of the build.

---

## 6. Status

The four acts, both endings, the chart and the ship's log are implemented. This plan tracks the
current story; historical build notes and the old Port Vela proposal are archived in
[`archive/`](archive/) and [`STORY_FATHER_AND_FOG.md`](STORY_FATHER_AND_FOG.md) is kept only as
the reboot proposal's history.
