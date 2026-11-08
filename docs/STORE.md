# Shipping *The Brass Compass*

The copy deck, shot list and checklist for putting the game on a store page. Everything here is
written to be pasted, not paraphrased: the tagline is under 150 characters, the description is
400 words, and the screenshot commands are the ones the shot list was tested with.

The game's name is **The Brass Compass**. The story is **The Father and the Fog**. The tagline is
**a tale of Dreadwater Isle**.

---

## 1. Tagline

**Primary — under 150 characters (itch "short description" wants ≤150):**

> A cartographer's apprentice, a captain nobody trusts, and a fog that keeps every ship it takes. A family-friendly pirate point-and-click.

**Alternate — under 125 characters, for a social card or a header:**

> A family-friendly pirate point-and-click about a missing father, a mistrusted captain, and the fog that keeps the ships.

---

## 2. Description (400 words, in Fenn's voice)

> I came back to Dreadwater Isle three months after my father sailed into the Shroud. The fog
> bank sits offshore and does not move. Ships go in; the fog keeps them.
>
> The harbour is half empty. The other half will not meet my eye. The only captain still sailing
> is Vex, who works the fog's edge and sells what floats out. Everyone blames him for the
> disappearances. He lets them, because fear keeps his prices high. He has a ship, the *Marrow*,
> and he will not take her into the fog without a reason that pays.
>
> I have my father's compass. It is brass, scratched, and it has never once pointed north. Out
> here it points at the fog. I have a chart that stops at the edge of the Shroud, a tavern keeper
> who knows everyone, and a crew to find: a navigator who is tired of being a
> lookout, a cook with forty spoons and something to prove, a carpenter whose brother went into
> the fog and did not come back.
>
> *The Brass Compass* is a point-and-click adventure in the old manner: twelve verbs, a sentence
> line, an inventory that slowly fills with other people's problems, and conversations that
> would go faster if everyone simply answered the question. It runs four
> acts and twenty-four painted rooms, from a half-lit harbour to the deck of a ship that should
> not exist.
>
> The ghost is real. The island blamed the wrong man, and the thing in the fog is older and worse.
> It hunts by sound and by light, and it cannot take a ship whose captain
> speaks its name. Those are the three rules. Everything else is weather.
>
> The voyage ends with a choice: lay the dead to rest and let the fog lift, or take the living and
> run and leave the fog where it is. Vex is never the hero, and what he does at the end depends on
> whether you trusted him.
>
> It is family-friendly: pirate peril, ghosts, drinking and cards, but no gore and no innuendo.
> The comedy is dry. The sea is exactly as dangerous as the fog says.
>
> Everything you learn is pinned to the chart. The hints come in two steps, and the first one
> is only a nudge. The game plays with a mouse, a keyboard, a touchscreen or a screen reader, and
> saves after every action and room.
>
> Bring a good coat.

*Count: 400 words of body copy, not counting the heading. If a page needs it shorter, cut the
paragraph about the chart and hints and keep "Bring a good coat."*

---

## 3. Feature bullets

- **Twelve verbs and a sentence line** — the classic point-and-click grammar, with the natural
  verb lighting up as you hover, so a plain click does the obvious thing. Right-click looks.
- **Twenty-four painted rooms across four acts**, from a half-empty harbour to the deck of the
  Grey Lantern, drawn at 1920×1080 with a camera that pans the wide rooms.
- **A ghost story, not a mystery of missing cargo** — a fog that keeps ships, a crew that keeps
  its watches, and three rules: it hunts by sound, it hunts by light, and it cannot take a ship
  whose captain speaks its name.
- **Two endings, chosen on the ghost ship** — lay the dead to rest and let the fog lift, or take
  the living and run. Both are earned; neither is a fail state. Vex's fate follows the trust you
  gave him.
- **A cast worth listening to**: Vex, the only captain still sailing and the last man to admit
  why; Quill, a lookout who wants the chart table; Dorrit, a cook with forty spoons and a name to
  clear; Hobb, a carpenter with one word and one brother; Marta, who keeps the island's stories;
  Bramwick, who wrote the losses down; Rook, the one man who came back; and Mordant, who is
  polite about the whole thing.
- **The Chart and the Ship's log** — everything Fenn learns is pinned in order, with the next
  step at the top; the optional layer is the ship's log, shown after the ending and tallied on
  the title.
- **Hints in two steps** — a nudge first (a person, a place, an idea), the plain answer second;
  a line history for the line you missed.
- **No fail states** — no combat, no timers, no death. Autosaves after every action and room.
- **Family-friendly** — pirate peril, ghosts, drinking and cards; no gore, no sexual content, no
  objectifying camera, no innuendo.
- **Accessible by design** — full keyboard navigation, screen-reader announcements, adjustable
  text size and speed, reduced-motion support, touch controls, and skippable films if a future
  cut adds one.
- **Runs in the browser** — no install, no account, no engine download.

---

## 4. Screenshot shot list

Capture through the game's own tool, which starts its own Vite server and headless Chrome on a
free port:

```bash
node tools/shoot.mjs <room> <x>,<y> --act <N> --clean --out test-output/qa/ship/act<N>
```

`--clean` drops the debug overlay, `--act` puts the room in its right act, and one `x,y` point
places Fenn where the shot needs him and writes a single frame (without a point, the tool takes
six). Frames are 1920×1080 PNGs, lossless and store-ready. Picking coordinates from the room's
own `entry` keeps Fenn on the walkable floor. Take the title screen from the production build
(§8); `shoot.mjs` only captures rooms.

| # | Beat | Command | File | Caption |
|---|---|---|---|---|
| 1 | **Hero / key art.** Dreadwater Harbour at night, half the berths empty, the *Marrow* the only ship with her gear aloft. | `node tools/shoot.mjs dock 1100,800 --act 1 --clean --out test-output/qa/ship/act1` | `act1/dock-0.png` | Dreadwater Isle. The harbour is half empty. |
| 2 | **The premise.** The harbourmaster's house: a lamp, a desk, and three months of losses. | `node tools/shoot.mjs office 600,790 --act 1 --clean --out test-output/qa/ship/act1` | `act1/office-0.png` | Three months since my father sailed. |
| 3 | **The town.** Upper Town in the blue hour, washing lines and a boy counting ships. | `node tools/shoot.mjs village 760,866 --act 1 --clean --out test-output/qa/ship/act1` | `act1/village-0.png` | Everyone on the island knows whose son I am. |
| 4 | **The tavern.** The Salty Keel, lamplight, Marta behind the bar and Rook in the corner. | `node tools/shoot.mjs tavern 1060,850 --act 1 --clean --out test-output/qa/ship/act1` | `act1/tavern-0.png` | Marta has heard every story in the harbour. Twice. |
| 5 | **The *Marrow* at sea.** Main deck, the crew finding their places, Vex at the helm. | `node tools/shoot.mjs marrow_deck 780,805 --act 2 --clean --out test-output/qa/ship/act2` | `act2/marrow_deck-0.png` | The *Marrow* is ours, for what that's worth. |
| 6 | **The fog run.** The bow in the Shroud, the rail, the bell rope and no hand on it. | `node tools/shoot.mjs bow_fog 700,800 --act 2 --clean --out test-output/qa/ship/act2` | `act2/bow_fog-0.png` | The bell rang with no hand on the rope. |
| 7 | **The wreck.** An old victim of the Lantern on the reef, and a name in brass. | `node tools/shoot.mjs reef_wreck 1180,830 --act 3 --clean --out test-output/qa/ship/act3` | `act3/reef_wreck-0.png` | A ship that should not exist. |
| 8 | **The castaway camp.** Salt pans, empty tents, and Elias still drawing. | `node tools/shoot.mjs salt_camp 1500,800 --act 3 --clean --out test-output/qa/ship/act3` | `act3/salt_camp-0.png` | My father is alive, and still drawing. |
| 9 | **The Grey Lantern.** The ghost ship's deck: torn sails, green light, the crew at their posts. | `node tools/shoot.mjs lantern_deck 1400,820 --act 4 --clean --out test-output/qa/ship/act4` | `act4/lantern_deck-0.png` | Eighty years of stolen ships. |
| 10 | **The name.** Mordant's cabin, the brass plate, and the last rule. | `node tools/shoot.mjs arcadia_cabin 2120,845 --act 4 --clean --out test-output/qa/ship/act4` | `act4/arcadia_cabin-0.png` | It cannot take a ship whose captain speaks its name. |

Extras if a page wants a wider set: `act1/alley-0.png` (Wreckers' Lane), `act1/counting_house-0.png`
(Vex's warehouse), `act1/chandlery-0.png` (the shipwright's), `act2/crows_nest-0.png` (Quill's
office), `act2/marrow_gallery-0.png` (sundown off watch), `act3/far_pans-0.png` (the far flats),
`act3/key_gate-0.png` (the longboat at the reef gate).

For a contact sheet while choosing, tile the PNGs four across at 480×270 — the frames above were
chosen from exactly that.

---

## 5. Thirty-second trailer beat sheet

The new acts have no opening or closing films. Cut the trailer from in-game footage at
1920×1080 — camera pans and short verb interactions captured in the dev build, or stills made
with `tools/shoot.mjs` and moved with a slow push. Do **not** cut from the previous story's
cinematics in `cinematic/`; they belong to the old voyage. Use the game's own music beds
(`music_dock`, `music_tavern`, `music_fog`, `music_sea`) and its synthesised sound.

| Time | Source (room / beat) | Picture | On-screen text | Sound |
|---|---|---|---|---|
| 0:00–0:03 | Title screen | The painted harbour under the title | *The Brass Compass* (title card) | Harbour theme, low |
| 0:03–0:07 | `dock` | A slow pan from the empty berths to the *Marrow* | **Dreadwater Isle. The harbour is half empty.** | Gulls, water, theme continues |
| 0:07–0:11 | `tavern` / `counting_house` | Marta behind the bar; Vex in his warehouse | **The only captain still sailing.** | Tavern murmur, a coin on wood |
| 0:11–0:15 | `bow_fog` | The bow rail, the fog, the bell rope moving with no hand on it | **The fog keeps every ship it takes.** | Bell, then silence |
| 0:15–0:19 | `lantern_deck` | The Grey Lantern's deck, green light in the rigging | **Eighty years of stolen ships.** | Fog theme, low strings |
| 0:19–0:23 | `arcadia_cabin` | The brass plate on the captain's desk | **It cannot take a ship whose captain speaks its name.** | A page turn, a held breath |
| 0:23–0:27 | `key_gate` / `lantern_deck` | The longboat at the gate; the crew at the rail | **Lay them to rest. Or take the living and run.** | Music opens up |
| 0:27–0:30 | End card (title art from the build) | Title and one line of copy | **The Brass Compass** — *a tale of Dreadwater Isle*. Play it now on itch.io. | Final chord, out |

Notes:

- Keep one title card and one end card. The chapter cards are gone; the room footage is the
  chapter.
- The trailer is text-heavy on purpose: every on-screen line is short enough to read at phone
  size and matches the game's dry register — no exclamation marks, no "embark on an epic
  journey".
- If a voiceover is ever added, record it against this cut; do not re-time the picture.
- Check the cut with sound off as well: the story should still read from the text cards.

---

## 6. Press-kit checklist

- [ ] **Store copy** — tagline, short description, 400-word description, feature bullets (this
      file, §1–3).
- [ ] **Screenshots** — 8–10 at 1920×1080, PNG, no debug overlay, no UI mid-transition (§4).
- [ ] **Capsule art** — itch cover 630×500, and a 1920×620 header for the page; title art on a
      transparent background as a PNG.
- [ ] **Trailer** — the 30-second cut above as H.264/AAC MP4, plus a looping 8-second GIF for
      social.
- [ ] **Fact sheet** — title, developer (Alfonso Encinas), release date, platform (web / itch.io),
      price, language (English), length, controls, save behaviour, content notes (family-friendly:
      pirate peril, ghosts, drinking and cards; no gore, no sexual content, no flashing-light
      sequences).
- [ ] **Credits and licence** — `CREDITS.md` and `LICENSE` on the page, plus the AI disclosure
      (§7) in the description.
- [ ] **AI disclosure** — the paragraph in §7, verbatim, near the bottom of the store page.
- [ ] **Press contact** — one address, one line saying a review build is available.
- [ ] **Review build** — the same zip as the public build, versioned, with a one-page "how to
      play" (`README.txt` is already inside it).
- [ ] **One-page press release** — the logline, the four acts in four sentences, the two endings,
      the price and the link. No spoilers past Act I.
- [ ] **Social copy** — three posts: the tagline; one screenshot with a dry caption; one GIF of
      the fog run.
- [ ] **Changelog / version** — the zip name carries the version (§8); note it on the page.
- [ ] **Test the page** — open the itch page on a phone and a laptop, press play, confirm sound
      starts on the first tap and the save survives a refresh.

---

## 7. AI disclosure (store-ready)

> **AI content disclosure.** *The Brass Compass* was written, designed and built by a human
> author using AI-assisted development tools. Its painted backgrounds, character art, props,
> music and cinematics were generated with AI models from the author's own prompts and then
> selected, edited and composed by hand. All story, characters, dialogue and code are original.
> No third-party copyrighted artwork, music or footage is used, and the game is not affiliated
> with any existing adventure game or franchise.

---

## 8. Shipping it: build, verify, package

### Build

```bash
npm ci
npm run build          # tsc + vite build → dist/
```

The build uses a **relative base** (`vite.config.ts`, `base: "./"`), and every runtime URL —
manifest images, music, the act captions — is resolved through `assetUrl()` in
`src/content/assets.ts` against `import.meta.env.BASE_URL` and `document.baseURI`. That is what
makes the upload work under itch.io's `/html/<id>/…` path, where a site-absolute `/assets/…`
would 404 one directory up.

### The subdirectory check (do this before every upload)

Serve `dist/` *inside* a subdirectory, not at the root, and confirm the game boots with no 404s:

```bash
npm run build
mkdir -p /tmp/itch-check/game && rm -rf /tmp/itch-check/game/* && cp -r dist/. /tmp/itch-check/game/
(cd /tmp/itch-check && python3 -m http.server 8123) &
# open http://127.0.0.1:8123/game/ (and /game/index.html)
# in the browser console: no 404s, and the title screen draws the painted dock
```

Quick command-line version:

```bash
curl -s http://127.0.0.1:8123/game/ | grep -E 'src="|href="'      # every ref is ./…
curl -sI http://127.0.0.1:8123/game/assets/scenes/dock_wide.webp | head -1   # HTTP/… 200
curl -sI http://127.0.0.1:8123/game/assets/audio/dock.mp3 | head -1         # HTTP/… 200
```

The check that was run for the previous package went further: headless Chrome loaded both `/sub/`
and `/sub/index.html`, watched every request, and waited for the full background and audio stream
before reporting. Result: **both pass, 0 responses ≥400, and every image and audio request served
from under `/sub/`**, and the title screen rendered from the copied build. The throwaway harness
is `test-output/qa/subdir-check.mjs` (ignored by git) if the check needs to be repeated exactly.

### Package

```bash
npm run package:itch
```

Writes `dist-itch/the-brass-compass-v<version>-itch.zip` with `index.html` at the archive root,
plus `README.txt` (how to play, for itch), `AI-DISCLOSURE.txt`, `LICENSE` and `CREDITS.md`. The
script builds first (`--no-build` packs the existing `dist/`), refuses to pack without an
`index.html`, warns if the art folders are missing, and reads the finished archive back to check
its layout before it reports success. Media is stored rather than re-deflated and timestamps are
fixed, so the same build packs to the same archive; `dist-itch/` is gitignored.

On itch: **Uploads → Upload**, tick "This file will be played in the browser", set the embed to
1280×720 or larger (the game is 1920×1080), and use "Click to launch" — the game needs a gesture
for audio anyway.

### CI

`.github/workflows/ci.yml` runs on every push and pull request: `npm ci`, typecheck, the script
compiler check, the unit tests and the production build — no browser, and no art, both of which
live outside git. A second job, run by hand (`workflow_dispatch`), takes the full browser
playthrough where a machine with Chrome and the art folder is available.

### The short version

```bash
npm run test:fast        # typecheck + scripts + unit
npm run build            # production bundle
npm run package:itch     # dist-itch/the-brass-compass-v0.2.0-itch.zip
```
