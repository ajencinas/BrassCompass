# The Brass Compass: full game plan

A four-act **romantic pirate comedy**, about two hours long: a clerk who has never left his
desk goes to sea with a licensed pirate crew, falls for their lookout, and finds his lost father,
with conversations worth clicking on. Original story and cast; the canon is in
[`STORY.md`](STORY.md). This file is the build plan: what each act contains, how it plays,
what it costs, and in what order it gets made.

---

## 1. What the game is for

Four things, woven together rather than in separate scenes:

| Pillar | What it means in practice |
|---|---|
| **Adventure** | A real journey: a harbour at night, a ship at sea, a wreck on a reef, a secret island, home again. Every act ends somewhere new and every puzzle moves the voyage on. |
| **Love** | A swashbuckling romance (Fenn and Quill) under sail and moonlight, growing through the whole game, plus smaller loves that pay off: a father and son, an old pair of card players, a captain and her dead navigator's last sentence. |
| **Comedy** | Character and bureaucracy, never winks at the player. Paperwork is Fenn's superpower; each act has one big comic set piece. |
| **Dialogue** | Conversations that change: people remember what you said, reveal more as they trust you, and answer back. Every NPC has a voice you could pick out with the names hidden. |

**What it is not:** no sword fights, no magic, no ghosts. The villain is a man with an
insurance scheme and very good manners. Everything strange has a paperwork explanation, and
that is the joke and the point.

---

## 2. The emotional spine

The plot (`STORY.md`) is a mystery: who empties the ships? The heart is a different question:
**what do you do when the world writes you down as lost?**

- **Fenn** has lived three years behind a desk because his father was written off. He starts
  the game stamping other people's voyages and ends it choosing his own.
- **Quill** wants to be seen as more than a lookout. Fenn is the first person who treats her
  ambitions as paperwork that simply hasn't been filed yet.
- **Ansel**, the father, kept raising a homemade flag for three years so nobody would forget
  his crew. His son is the one who saw it.
- **Bramwick** wrote the lie. **Rook** took the money. Both get a chance to write it right.

### The romance: Fenn and Quill

**A romantic pirate story.** Quill is a pirate in every way that counts: barefoot in the
rigging, quick with a knife and a retort, sworn to a licensed pirate crew and proud of it.
Fenn is the most unpiratical man in Port Vela. The romance is the old pirate fantasy turned
round: she's the one who sweeps him off his feet (once literally, onto a halyard), and he wins
her by being the one person who takes her dreams seriously enough to write them down.
Moonlight in the rigging, a dawn the two of them see first from the crow's nest, a rescue
that goes both ways, a farewell on the dock, and a choice at the end about whether the clerk
turns pirate.

It is a slow burn told in banter. She calls him "cargo"; by the end she calls him by his name, once,
at the moment that counts. No meter on screen: affection is a hidden flag score from kind,
funny or brave dialogue choices, and it changes lines, not the plot. You can't fail the game
by being unromantic, but you can miss the best scenes.

| Act | Beat | What happens |
|---|---|---|
| I | Not yet met | Marta mentions the Marrow's lookout "can spot a lie at two miles and a compliment at none". |
| II | Meeting | She blocks his way, calls him cargo. He returns her spyglass; she's annoyed to be grateful. |
| II | The night watch | Optional scene in the crow's nest after the sextant: she teaches him three stars, he teaches her how a logbook entry makes a thing true. "Write it down, then. Quill, navigator." She pretends not to care that he did. |
| II | The fog | She takes the wheel while he calls bearings from the bow. The shouted back-and-forth is the first time they're a team. |
| III | Ashore | She insists on coming to the island ("Someone has to stop you filling in forms at a man with a cutlass"). In the wreck she finds Ansel's log entry about Fenn's mother and reads it to him when he can't. |
| III | The camp | Ansel spots it in five seconds and embarrasses them both. |
| IV | The parting | She has to sail the Marrow out at dawn whatever happens in Port Vela. The dock scene: what Fenn says decides what the ending says. |
| III | The rescue | When Pike's men corner them in the Weather Works, she swings Fenn out across the braziers on a halyard ("Hold on to me, cargo." "I am holding on to you." "Good. Keep doing that."). Later he talks her out of a cell with a form she didn't know existed. |
| End | The choice | **Turn pirate** (sign the Marrow's articles as purser and sail beside her) or keep the **desk** (keep the ledger honest, and she sails into Port Vela every season with a new star to show him). Both are happy; the romance lines differ with the affection score. The pirate ending ends on the crow's nest at dawn. |

### The other loves

- **Bramwick and Marta.** Thirty years of cards. The "IOU to Marta" in his drawer (Act I) is
  a love letter he never sent and wrote as a debt so he'd have an excuse to keep it. Act IV:
  disgraced and suspended, he finally pays it. She makes him play one more hand for it.
- **Vane and Pell.** Her navigator died mid-sentence. Pell's log in his sea-chest ends on that
  sentence (Act II) and she gets to hear how it ended. She doesn't cry. Quill does, and denies it.
- **Ansel and Fenn.** A father who explains nothing and apologises for everything else.
  The reunion is comic, then not, then comic again.
- **Rook and his captain.** The sealed purse he never opened, returned to Ansel in Act IV.

---

## 3. How the dialogue is written

House rules for every line (enforced by review, partly by the content lint):

1. **Every line does two jobs**: character plus information, or joke plus clue. A line that
   only conveys a fact gets rewritten.
2. **Voices are distinct.** Bramwick recites regulations as hints. Marta trades in stories.
   Rook navigates by self-deprecation. Cray is unfailingly polite. Quill is blunt and
   competitive. Vane is dry contempt over grief. Ansel is cheerful about catastrophe.
3. **Conversations remember.** Nodes use `seen:`/`looked:` flags so people react to what you
   have done ("You've been in the loft. You smell of ledger.").
4. **Options sound like Fenn**: polite, precise, occasionally devastating. Each conversation
   offers at least one funny option and one sincere one; the sincere ones raise affection.
5. **Short lines.** Dialogue nodes under ~240 characters, narration under ~200. Big moments
   are split across nodes so they land.
6. **No repeats.** Each joke shape is used once per game. The lint flags duplicate sentences.
7. **The callback rule.** Every act pays off at least three lines planted in earlier acts.

---

## 4. The Adventure Editor

Built right after the script is agreed (section 7), so the new acts are built with it and
Acts I to II are converted into it.

**Status: built.** All four acts are in `.adv` scripts (reference: `docs/SCRIPTING.md`), and the
editor and observer panels are in `src/editor/` (README, "The Adventure Editor").

### 4.1 Script language (`.adv` files)

One file per room and per conversation in `src/content/scripts/`. Readable pseudocode that
compiles to the game's existing data (`Room`, `DialogueTree`, `Item`, `ActDef`), so the engine
doesn't change. Sketch:

```
room tavern "The Salty Keel" act 1
  bg bg_tavern_wide  width 2560  music music_tavern
  perspective horizon 450 ref 875 height 327
  walk (470,875) (640,790) (820,772) (850,705) (985,705) (1000,736) (1320,738) (1735,880)
  sprite npc_marta_body_v2 at 1960,728 size 1.25 for marta idle speaker marta

  hotspot marta "Marta" person
    area 1890,460 140x125   stand 1500,800
    look  "Marta, who runs the Salty Keel and, by most accounts, Port Vela."
    talk  "I catch Marta's eye. It takes some catching."
      -> talk tavernkeeper

  use lemon on marta
    say "A lemon! The punch lives."
    take lemon
    give drawer_key
    set marta_paid

dialogue tavernkeeper
  root marta "Clerk! Here for a drink, or here to inspect my shelves?"
    > "What's everyone celebrating?"            -> marrow
    > "I need a favour."  if not knows_key       -> favour
    > "Nothing. Goodnight."                      -> bye
```

- Errors report the script file and line ("tavern.adv:14: no item 'lemmon'").
- The existing content lint runs on the compiled data, so every check keeps working.
- **Conversion proof:** Acts I–II are converted, and a test compiles the scripts and
  deep-compares the result with today's TypeScript data before the old files are deleted.

### 4.2 In-browser editor (dev mode, F2)

- A side panel over the running game: file list, editor with line numbers and syntax colours,
  error gutter.
- **Apply** recompiles in the page and hot-swaps the room or conversation without losing game
  state; **Save** writes the file through a small Vite dev-server endpoint (dev only, no file
  access in the built game).
- "Edit this": click a hotspot or a dialogue line with Alt held to jump to its script line.

### 4.3 Observer panels

| Panel | Shows | Can do |
|---|---|---|
| **State** | Act, room, position, inventory, every flag (grouped: story, seen, looked), open conversation and node, parked effect queue | Toggle flags, give or take items, jump to a room or act |
| **Event log** | A running trace: `use stamp on stew → say "…" → set dinner → talk dorrit` | Filter, copy, clear |
| **Puzzle map** | A generated diagram per act: items and flags as nodes, hotspots/combos/dialogue choices as edges, from "obtained" to "used". Unreachable items, flags read but never set, and items never used are shown in red. | Click a node to open its script line |
| **Overlay** | Walk areas, hotspots, stand points, occluders, horizon (today's D in Explore mode) | Drag a stand point or polygon vertex and write it back to the script |

The tool phase also folds in Explore Scenes, `tools/shoot.mjs` and the test harness helpers,
so there is one place to look at the game.

---

## 5. The four acts

Counts are approximate. "Reused" rooms cost no art. Each act lists its comic set piece, its
love beat, and the conversations that carry it.

### Act I: A Licence to Sail (Port Vela, night). Built; polish only.

**Rooms (6):** dock, customs house, Salty Keel, Chandler's Lane, the Chandler's, Harbour Loft.
**Chain:** crowbar → lemon → Marta's key → stamp → licence; stamp → Tallow's invoices →
manifest; crowbar → loft → ledger; confront Bramwick → confession → berth.

**Additions for the full game:**
- **Love seeds:** Marta's line about the Marrow's lookout; the IOU in Bramwick's drawer
  becomes readable (Look at it: "For one game of cards, unpaid. Also, it says, in very small
  writing: 'and everything else.'").
- **Better dialogue:** a Marta–Bramwick exchange if you ask her about the key after seeing
  the IOU ("He'll never pay it. Paying would mean it's over.").
- **Comic set piece (exists):** stamping your own licence in the Harbourmaster's "legal
  absence".
- **One more optional puzzle** for texture: the regulars' wager on the Marrow (bet that she'll
  come back, using Bramwick's IOU as stake; Act IV pays out).

### Act II: The Vela Straits (the Marrow, dawn to fog). Expand.

**Rooms (6):** deck, quarterdeck, cabin (reused) + **below decks** (art done), **the bow in
fog**, **crow's nest at night** (deck art with a night grade, plus one small new prop).
**New cast:** Dorrit the cook (ex-customs, won't serve unstamped food), Hobb the bosun
(tattoos of everyone he's lost; one says TAM).

**Chain (about 12 steps, two branches):**
1. Spyglass → Quill → aft access.
2. Compass on Vane's chart → the reveal → Vane's terms: "A navigator who'll swear to that
   line, a crew that'll sail it, and a reason Pell would have."
3. *Branch A:* Hobb guards Pell's sea-chest ("Nobody opens it till dinner"). Dorrit won't ring
   the gong until the stew is "officially passed". **Stamp the stew** → gong → Hobb goes to
   dinner → open chest → sextant and Pell's log.
4. Give the sextant to Quill → she takes a sight and swears to the line → acting navigator.
   **Love beat:** the night-watch scene unlocks in the crow's nest.
5. *Branch B:* Hobb won't sail south "for money, only for blood". Show him the Arcadia's
   manifest: Tam Hobb, able seaman, his brother → the crew agree.
6. Read Pell's log aloud to Vane: his last entry is the unfinished sentence, and it ends
   "…she should trust the boy." She takes the Needle.
7. **Comic set piece: steering by committee.** At the bow in fog, use the compass and call
   bearings to Quill at the wheel, with Dorrit relaying, Hobb overruling, and Vane correcting
   everyone's grammar. Three calls; a wrong call scrapes the reef and gets a joke, never a fail.
8. The fog thins: a wreck on the reef, masts up, flying a homemade flag → act ends.

**Optional:** crowbar on the deck crates finds kelp briquettes stamped with Cray's cloud
("Who ships smoke?"): a clue for Act III. **Outro video:** the flag in the fog.

### Act III: Tidy Weather (the reef and Gullet Key). New.

**Rooms (6):** the reef and wreck, the Arcadia's cabin, the quarantine gate, the salt camp, the
Weather Works (braziers), the lagoon shore. **New cast:** Ansel Fenn, Pike (a Weather sentry who
obeys any correctly completed form), the camp crews (painted, plus one or two speaking hands).

**Chain (about 12 steps):**
1. Quill rows Fenn to the wreck (she won't stay with the boat; **love beat**, banter in the boat).
2. Crowbar the jammed hatch. Inside: Ansel's log, a blank Bill of Health, a portrait of
   Fenn's mother. Quill reads the log to him when he stops reading.
3. The log explains the trick: yellow flag, fog, "quarantine". The crews are on the key.
4. **Comic set piece: the forms war with Pike.** Every paper from outside must be smoked
   (fumigation, a real historical practice), stamped, countersigned and dated. Fenn out-forms
   a man whose only weapon is forms: smoke the Bill at a brazier, stamp it, have Quill
   countersign as "acting navigator" (her title, written down, matters to her), date it with
   Pike's own calendar (stolen from his hut while he reads the regulations aloud).
5. Douse the main brazier with seawater (bucket from the wreck) → the fog thins.
6. Pike lets them into the camp "for inspection".
7. **The reunion.** Ansel, sunburnt, cheerful, on flag number fifteen. Comic first ("You're
   taller. Is that regulation?"), then not ("I left it for you because I knew you'd bring it.
   I didn't know it'd take three years. I'm sorry I made you wait."). Ansel clocks Quill at once.
8. Ansel won't leave without every crew. Signal the Marrow: raise flag sixteen on the wreck,
   which needs the fog down (step 5) and Ansel's new flag.
9. The Marrow comes in; the crews row out. Cray's cutter, which was watching, runs for Port
   Vela. **Outro video:** boats on the lagoon, the cutter's sails on the horizon.

### Act IV: All Hands Returned (Port Vela, night). New, mostly reused rooms.

**Rooms (8):** Act I's six rooms reused at night with changed states and characters, plus
**Cray & Co.'s counting house** and **the pier end** (both new art).
**Setup:** Cray got home first. Bramwick is suspended; Cray is Acting Harbourmaster and at the
dawn bell will enter the Marrow, crews and all, as lost under quarantine law. The returning
ship can't land her people until a harbourmaster lifts it.

**Chain (about 12 steps):**
1. The dock: the crews can't come ashore. Quill has to sail the Marrow back out at dawn
   whatever happens (**love beat**: their scene on the dock, short and important).
2. The tavern: suspended Bramwick and Rook drinking together. Regulation two: a harbourmaster
   suspended by a party to fraud is reinstated on proof of the fraud.
3. Rook: tell him his captain is alive. He hands over Cray's sealed purse, still unopened.
4. The counting house: Nib, Cray's clerk, who never reads anything. Get a requisition form,
   stamp it, and requisition "one claims book, insurance, all of it" → the six ships paid out
   "for weather".
5. The loft: crowbar the chain off the harbour ledger (Act I's "it's chained to the desk").
6. The pier end: Cray's cutter crew unloading kelp briquettes; a manifest that says
   "QUARANTINE STN, G.K." Optional extra proof.
7. **Comic set piece and climax: the inquiry at the Salty Keel.** Cray holds a dawn toast to
   his appointment. Fenn turns it into a hearing with Marta presiding (a licensed premises
   counts, under a regulation Bramwick swears exists). Cray rebuts each charge politely; Fenn
   answers with the right evidence (ledger, log, purse, claims book). Wrong evidence gets a
   withering line and another try. Rook's testimony is the turning point.
8. Bramwick is reinstated; Fenn hands him back his stamp. He lifts the quarantine. Marta
   finally hears the whole story ("Took you long enough").
9. Bramwick pays the IOU. Marta makes him play one more hand for it. (**Love beat**, comic.)
10. The ledger: Fenn writes "Arcadia: returned. All hands."
11. **The choice at the dock at dawn:** the sea or the desk. Ending lines depend on the
    choice, the affection score, and optional deeds (the wager, the kelp proof, the night
    watch).

### Endings

Two main endings (sea, desk), each with romance variants, plus epilogue lines:

- Quill named navigator of the Marrow (always).
- Vane's insurance claim finally paid (if the claims book was read to her).
- Rook back at sea, sober, "mostly".
- Bramwick and Marta: married, or playing cards for it (depends on the wager).
- Ansel opens an instrument shop, selling compasses that point at home.
- Cray, in a cell, filing an appeal "in triplicate, as is his right".

---

## 6. Art, music and video

| Act | New backgrounds | New characters (portrait + body) | Props | Images |
|---|---|---|---|---|
| II | bow in fog (below decks done); crow's nest = deck plus night grade | Dorrit, Hobb | night-sky prop, gong-struck variant optional | 6 |
| III | reef and wreck, Arcadia cabin, quarantine gate, salt camp, Weather Works, lagoon shore | Ansel, Pike, one camp hand | flag on mast, bucket | 14 |
| IV | counting house, pier end | Nib; night variants of Bramwick (seated in tavern) | evidence props | 6 |
| All | — | Quill alternate pose for the romance scenes (sitting) | — | 2 |

- **Images:** about 28 at $0.028, roughly **$0.80**, about **$1.20** with retries.
- **Music:** about four new tracks (open sea, fog and wreck, a love theme, the finale), roughly
  $0.30 if the audio model is priced like the earlier runs. One test run first to read its cost.
- **Video (local, free):** outro for Act II; intro and outro for Act III; intro for Act IV; a
  finale. All HyperFrames, built from game art with the existing title-card template.
- **Engine extras for art:** a room-level colour `grade` (night versions of rooms without new
  art); conditional sprites (`showIf`, already built) for characters who move between acts.

Total spend so far: about $0.56. Projected total: about $2, inside the $5 budget.

---

## 7. Build order

**Story and dialogue come first.** The whole game is written as a script and agreed before
any gameplay or tooling is built, because everything else (puzzles, rooms, art) serves it.

| Phase | Work | Checkpoint |
|---|---|---|
| **S1** | Story bible rewritten for the romantic pirate tone: the full plot, every character's arc and voice sheet, the romance beat by beat, the callbacks list (`STORY.md`) | Your review |
| **S2** | **The script** (`docs/SCRIPT.md`): every scene of all four acts written out as it plays, with the key conversations in full (branches marked), the narration, and the comic set pieces | Your review, act by act |
| **S3** | Rewrite Acts I–II in the game to match the approved script | Read-through in game; `npm test` |
| **T1** | Script language + compiler; convert Acts I–II; round-trip test proves identical data | `npm test` passes on compiled scripts |
| **T2** | In-browser editor with apply/save, error gutter, Alt-click to source | Edit a line live, save, reload, still there |
| **T3** | Observer: state panel, event log, puzzle map, draggable overlay | Puzzle map of Acts I–II shows no red |
| **A2** | Act II expansion (rooms, cast, chain, crow's nest, fog scene, outro) | Full-click test through Act II; puzzle map clean |
| **A3** | Act III | Same, plus Act III screenshots reviewed |
| **A4** | Act IV and the endings | Full-click test of the whole game; all endings via `__act(4)` |
| **P** | Polish: timing, music, hints, a full manual playthrough against the two-hour target | Your playthrough |

Each phase ends with type-check, build, the full test, screenshots reviewed by eye, and a
commit after your go-ahead.

---

## 8. Verification

- **Content lint** (exists): references, flags, arrivals, line lengths; adds duplicate-sentence
  and per-act puzzle-map checks.
- **Full-click playthrough** of all four acts with real input, plus per-act runs via `__act(n)`,
  every alternative route, every wrong-evidence loop, both endings and the romance variants.
- **Script round-trip test** guarding the editor's compiler.
- **Calibration screenshots** of every room with Fenn at the walk area's corners.
- **Manual playthrough** timed against the two-hour target, reading every line aloud for voice.
