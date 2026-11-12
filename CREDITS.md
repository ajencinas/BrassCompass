# Credits — The Brass Compass

**The Father and the Fog — a tale of Dreadwater Isle.**

*The Brass Compass* is an original game. Its story, characters, dialogue, puzzles, engine,
tools and art direction were created, written and assembled by one author, working with
generative AI models and open-source software. It is family-friendly: pirate peril, ghosts,
drinking and cards, but no gore and no innuendo.

**Created, written and directed by** Alfonso Encinas
**Version** 0.2.0

---

## Writing and design

- Story, characters, dialogue, room prose, hints, puzzle design, the two endings and the
  closing cards: original work by Alfonso Encinas.
- The story bible is [`docs/STORY.md`](docs/STORY.md); the showrunner spec is
  [`docs/REBOOT.md`](docs/REBOOT.md). The generated screenplay is
  [`docs/FULL_SCRIPT.md`](docs/FULL_SCRIPT.md). Everything the game says is in
  [`src/content/scripts/`](src/content/scripts/), written in the game's own `.adv` language;
  `src/content/old-scripts/` is the archived previous story and is not loaded.
- Interface text, settings, accessibility labels and error messages: original.

## Engine and code

- Game engine, renderer, input, pathfinding, dialogue runtime, save system, accessibility
  layer: original TypeScript in [`src/engine/`](src/engine/) and [`src/game/`](src/game/).
- The `.adv` scripting language, compiler and editor: [`src/adv/`](src/adv/) and
  [`src/editor/`](src/editor/).
- Audio: looping music through Web Audio; every sound effect is synthesised sample by sample in
  [`src/engine/foley.ts`](src/engine/foley.ts) — no sample library.
- Built with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/).

## Art

The painted artwork was generated with AI models through the
[RunComfy](https://www.runcomfy.com/) Model API, from prompts and reference direction by the
author, then selected, colour-corrected, keyed, trimmed, downscaled and placed by hand and by
the tools below.

| Asset | Model |
|---|---|
| Scene backgrounds | `bytedance/seedream-5/lite/text-to-image` at 2848×1600 |
| Characters, portraits, props, inventory icons | `bytedance/seedream-5/lite/text-to-image`, keyed to transparency |
| Music | `acestep-ai/ace-step-1.5/text-to-audio` |

New for *The Father and the Fog*: Vex (portrait and full body), Mordant (portrait and body), the
Grey Lantern's deck plate, the longboat prop, and the bell-clapper and oiled-canvas inventory
icons. Quill's and Marta's portraits were refreshed. Elias reuses the existing father portrait
and body, renamed. The rest of the new cast uses the painted figures already in the set.

The generation pipeline is [`tools/generate.py`](tools/generate.py); the art was then tuned for
the web by [`tools/optimize_assets.py`](tools/optimize_assets.py) (WebP, transparent trimming,
sprite sheets) and measured by [`tools/calibrate.py`](tools/calibrate.py). Walk cycles were
re-packed by [`tools/normalize_sheet.py`](tools/normalize_sheet.py).

## Music and sound

- Music: generated tracks (`acestep-ai/ace-step-1.5`) — themes for the harbour, the
  harbourmaster's house, the tavern, the sea, the fog, the sunset and the salt pans.
- Sound effects: synthesised in-engine by [`src/engine/foley.ts`](src/engine/foley.ts) —
  footsteps by surface, doors, hatches, gulls, fire, lapping water, creaks, page turns, the
  chart and the bell. Foley is seeded and deterministic, so the same action always sounds the
  same.
- Voice: there is no recorded dialogue; the game is read.

## Cinematics (legacy)

The new four acts have no opening or closing films. The previous cut's chapter cards were
composed in [HyperFrames](https://github.com/heygen-com/hyperframes) (0.8.222) with GSAP
timelines over the game's painted scenes and music, then rendered as H.264/AAC MP4s. The
editable project remains in [`cinematic/`](cinematic/) for reference; its films belong to the
previous story and are not loaded by the new acts. The engine's cinematic player stays in
[`src/game/cinematic.ts`](src/game/cinematic.ts) for a future film.

## Tools

- `tools/shoot.mjs`, `tools/playthrough.mjs`, `tools/editor-test.mjs` and
  `tools/fuzz/regression.mjs` drive headless Chrome over the DevTools protocol — no test
  framework, no runtime dependency.
- `tools/test-scripts.mjs` compiles and round-trips every `.adv` script.
- `tools/package-itch.mjs` builds the upload zip with nothing but Node.
- `tools/export-script.mjs` and `tools/script_docx.py` produce the reading script.
- Python tools use [Pillow](https://python-pillow.org/) (MIT-CMU) and
  [NumPy](https://numpy.org/) (BSD-3-Clause); `script_docx.py` optionally uses
  [python-docx](https://python-docx.readthedocs.io/) (MIT) and
  [ffmpeg](https://ffmpeg.org/) (LGPL/GPL, depending on build) for media.

## Third-party software and licences

| Component | Licence | Used for |
|---|---|---|
| [Vite](https://github.com/vitejs/vite) | MIT | development server and production bundling |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | the entire codebase |
| [GSAP](https://gsap.com/) | GSAP Standard "no charge" licence | legacy cinematic timelines (source project only, not shipped in the game bundle) |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | see project | composing and rendering the legacy cinematics (tool only) |
| [Pillow](https://python-pillow.org/) | MIT-CMU | art pipeline |
| [NumPy](https://numpy.org/) | BSD-3-Clause | art pipeline and calibration |
| [python-docx](https://python-docx.readthedocs.io/) | MIT | optional script export |

The game bundles no third-party JavaScript libraries beyond Vite's small module-preload helper.
No fonts are shipped; the interface uses the system's Georgia / Times New Roman serif stack.

## Typefaces

The game draws its text with the operating system's serif faces — Georgia, then Times New Roman,
then the platform serif. The legacy cinematic source asks for EB Garamond and falls back to the
same system serif stack; it does not ship a web font.

## AI disclosure (store-ready)

> **AI content disclosure.** *The Brass Compass* was written, designed and built by a human
> author using AI-assisted development tools. Its painted backgrounds, character art, props,
> and music were generated with AI models from the author's own prompts and then
> selected, edited and composed by hand. The game ships no films or video footage. All story,
> characters, dialogue and code are original. No third-party copyrighted artwork, music or
> footage is used, and the game is not affiliated with any existing adventure game or franchise.

The same disclosure, in legal form, is in [LICENSE](LICENSE) section 5 and in
[`docs/STORE.md`](docs/STORE.md).

## How to credit

> *The Brass Compass* — The Father and the Fog, a tale of Dreadwater Isle. A game by Alfonso
> Encinas. Made with TypeScript, Vite, and generative AI art and music.
