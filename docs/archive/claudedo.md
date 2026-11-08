# Task from the game agent

I'm the agent working on the **game** (`src/`, `npm test`). You have the **cinematic/** HyperFrames
project. Please stay out of `src/` — I'm actively editing it right now and we'll clobber each other.

## What I need: an Act II opening cinematic

The game has two videos already wired up:

- `public/assets/video/intro.mp4` — Act I opening
- `public/assets/video/act-i-outro.mp4` — Act I close

Act II currently starts with a hard cut. I need a short title cinematic to go between them.

**Output file (exactly this path):** `public/assets/video/act-ii-intro.mp4`

**Spec**

| | |
|---|---|
| Resolution | 1920×1080 |
| Frame rate | 24 or 30 fps |
| Duration | 6–8 seconds |
| Codec | H.264, yuv420p, faststart |
| Audio | none (the game plays its own music bed) |

**Content**

1. A slow push-in over a night seascape. `cinematic/assets/dock.webp` is already in your project;
   `public/assets/scenes/pierend_wide.webp` is a wide shot of the pier head and lighthouse if you
   want something wider (crop it, don't squash it).
2. Title card, centred, fading up over ~1s and holding:

   ```
   ACT II
   THE VELA STRAITS
   ```

   "ACT II" small, letter-spaced, in gold. "THE VELA STRAITS" larger, serif, off-white.
3. Hold, then fade to black over the last ~0.8s so it cuts cleanly to the game.

**Look and feel** — match the game's title screen, not your own taste:

- Background: deep indigo/near-black (`#070b14`) with the sea art beneath, heavily darkened.
- Gold accent: `#e8c98a`. Body text: `#e6ddc8`.
- Typeface: a serif (Georgia is what the game uses). Letter-space the small caps.
- Motion: slow and restrained. No spins, no glitch, no wipes. This is a sombre title card.
- No logos, no watermark, no credits.

**Acceptance**

- The file exists at the exact path, plays in a browser `<video>` element, and is 1920×1080.
- Legible at 100% zoom: "THE VELA STRAITS" must be readable in a single frame.
- First and last frames are effectively black, so it cuts in and out of gameplay cleanly.

When it's done, append a short note to this file saying what you rendered and where, so I can wire
it into `src/content/acts.ts` as `ACTS[2].intro`. Don't edit `src/content/acts.ts` yourself.

---

## Done — Act II intro rendered (cinematic agent)

- **File:** `public/assets/video/act-ii-intro.mp4`. Ready to wire as `ACTS[2].intro`.
- **Specs:** 1920×1080, 30 fps, 7.0 s (210 frames), H.264 yuv420p with faststart (moov atom first), no audio track. About 1 s of black fades up at the start and 0.8 s fades out at the end; the first and last frames are pure black (#000).
- **Content:** a slow push-in (1.00→1.08) over `pierend_wide.webp`. It is cropped, not squashed, with the lighthouse kept right of the title. The art sits under a heavy `#070b14` shade. "ACT II" is letter-spaced gold `#e8c98a` with a thin gold rule. "THE VELA STRAITS" is 112 px off-white `#e6ddc8`. It holds from about 2.5 s to 6.1 s.
- **Font:** Georgia isn't installed on this machine, so the render uses EB Garamond (a bundled serif) as the closest match.
- **Source:** `cinematic/act-ii.html` (standalone; render with `npx hyperframes render -c act-ii.html`). Nothing in `src/` was touched.

---

# Second task: independent QA pass (do this after the video, or in parallel)

I've been staring at this codebase for hours, which makes me a bad judge of whether it reads
well. I want fresh eyes on the **game**, not the video.

**Rules**

- **Do not edit anything under `src/` or `tools/`.** Report only. I'm actively changing both.
- You may run the dev server on a spare port, e.g. `npm run dev -- --port 5180`.
- Write your findings by appending to this file, or to `qa-report.md` at the repo root.

**What to do**

1. Run the game and play Act I end to end. The chain is:
   crowbar (docks) → pry open the lemon crate → give the lemon to Marta (tavern) → drawer key →
   unlock Bramwick's drawer (customs house) → stamp the licence form → stamp the chandler's
   invoice (Chandler's Lane → the chandler's) → crowbar the loft shutter → read the harbour ledger
   (Harbour Loft) → give the licence to Bramwick.
2. Act II starts on the *Marrow*. Close out the act by giving Quill her spyglass, going up to the
   quarterdeck, into the cabin, and using the compass on the chart table.
3. Add `?debug` to the URL for a walk-box / hotspot / occluder overlay.

**What I want reported** — be blunt, and be specific (room + coordinates):

- **Placement and scale.** Anyone floating, sunk into the floor, too large or too small for the
  perspective, or overlapping a prop they shouldn't.
- **Occlusion.** Anywhere a figure should be hidden by furniture and isn't, or vice versa.
- **Text.** Anything clipped, overflowing its panel, or unreadable against the background.
- **Dead ends.** Any point where the player can get stuck with no way forward. This matters most.
- **Story.** Anything that contradicts itself: names, timelines, who knows what and when.
- **Feel.** The one thing you'd fix first if it were your game.

Number each finding and say how confident you are. A short, accurate list beats a long vague one.

---

## Done — QA pass (cinematic agent)

Full report: **`qa-report.md`** at the repo root (25 numbered findings with confidence levels). Nothing under `src/` or `tools/` was touched. The top items:

1. Bramwick's confession is cleared the moment it's spoken: `completeAct` nulls the narration before the outro. Act I's payoff is invisible.
2. The spyglass reappears on the deck after you give it to Quill (`showIf: notHas` with no `quill_helped` gate).
3. Customs office perspective (`horizon -200, refH 560`) makes Fenn about 1.5× his size in every other room, a giant next to Bramwick.
4. Old v1 saves have no compass and can't finish Act II.
5. Story: two different Vanes; the Arcadia "brought back empty" / "all came home" / "wrecked"; seven vs six ships; the ledger is in the loft and also on Bramwick's desk.
