# Reboot acceptance checklist — everything already learned, so it is not lost

This is the "do not regress" list for **The Father and the Fog**. Every content and art agent
reads it with `docs/REBOOT.md`. A room or line that breaks one of these is not done, even if it
compiles.

## A. Perspective, scale and the people in the room

**Rule:** the painted furniture is the ruler. Measure the table/counter/desk/door in the plate,
work out how tall a 1.8 m adult must be at that depth, and set the room's `perspective`/`scale`
from that. **Never** fix a too-big table by shrinking the characters or by walking them up to the
table; make the people the room's size. A standing adult should match the painted door (a door is
just taller than them). Furniture tops: waist/lower chest = correct; collar/eye level = wrong.

Known-good calibrations (carry these forward, and re-check every room after the rewrite):

| Room | Setting | What it fixes |
|---|---|---|
| Customs house / harbourmaster's house | `perspective horizon -200 ref 875 height 560`; walk tab `(60,875) (150,700) (2540,700) (2540,715) (1500,715) (1500,875)`; desk stands at y≈705–710; Bramwick `size 1.15`, no `visible` shrink | desk at chest, not eye level; Bramwick has shoulders |
| Captain's cabin (Vex's cabin) | `scale 700 560`, `scale 800 600`, `scale 875 630`; Vane/Vex and stands at y≈800–810; no floor tab | the 290 px chart table sits at the waist; figures ~600 px, not 480 |
| Chandler's / shipwright | `scale 740 442`, `scale 810 470`, `scale 875 490`; floor tab to y≈800; counter/invoice stands at 800 | counter at waist; ~15% larger figures |
| Arcadia cabin | `perspective 330 875 600`; floor tab to y≈660; desk stands at 700 | desktop at the waist |
| Tavern | Marta `size 1.12` | she was 2.2 m behind the bar |

Room audit (must repeat for the new rooms): capture every room at a natural stand, view it, and
reject any room where a figure floats, sinks, stands on furniture, is cut off unintentionally, or
where the walkable floor lets them stand so far in front of a big object that it towers over them.
The quarterdeck binnacle (hero prop) and the fog bow's high bulwark are deliberate; leave them.

## B. Objects must exist in the picture, and be clickable where they are painted

- The chandler's "spike of invoices" was described but **not painted**; a player could not find
  it. It is now a real prop on the counter with its own hotspot and name.
- The loft shutter's hotspot covered only the stair treads, not the bolted panel above them. The
  hotspot now covers the panel, and is labelled "bolted shutter".
- **Rule:** every object the text talks about must be visible in the painting, and its hotspot
  must cover the painted object, not just the space near it. Hover/Q must name it plainly.
- **Rule:** if a puzzle needs a tool, name the tool in the world: the shutter's look/use/open/push
  lines say "crowbar" when it is held; a one-shot arrival line says it; the H tip says it. A
  player should never have to guess that "something with a bad attitude" means the crowbar.

## C. Dialogue and knowledge

- Plain speech: one idea per line, ≤ ~20 words, **no line over 140 characters** (current target:
  mean ~80, zero over 140). Choices ≤ 10 words / ~60 characters. No em-dash asides or semicolon
  jokes inside spoken lines. Jokes come from character, not vocabulary.
- **Nobody knows a fact they have not learned.** Public knowledge (the father is missing, the fog
  takes ships) may be stated once, early, and then treated as public; private knowledge needs a
  source in the same line/scene ("I stamped his papers for twenty years", "I offered him money
  for that compass twice"). Quill must not mention Fenn's father until Fenn tells her or she sees
  the wreck. Vane/Vex only learn what they are told.
- No character recites family history without saying how they know it.
- **Family friendly:** no nudity, no sexual content, no innuendo a ten-year-old would ask about,
  no objectifying lines, no gore. Romance is chaste (banter, a held hand, one kiss). The dead are
  sad and strange, not disgusting.
- **Attractive, not sexy:** charismatic, good-looking designs, fully dressed. Quill's collar can
  be open at the throat; no cleavage, no pin-up poses, no leering camera. Marta is handsome for
  her age. Onn is dignified. The men get the same treatment (Vex should be dangerously charming).

## D. Systems that must keep working

- Ending card honours the text-size setting and paginates (1 page at 100%, more at 125/150%).
- Top-bar labels, room plate and menus scale with the text setting and never overflow.
- Escape cancels a sentence / leaves a conversation before it pauses; a second Escape pauses.
- Screen-reader announcements: title, ending, page turns, inventory pages, Escape.
- Inventory paging works with the keyboard; the pager buttons take focus.
- Reveal (Q) names everything interactive; the tip ladder (H) always has a next step.
- Casebook → **the chart**, deeds → **the ship's log** (same systems, new copy).
- Save version bump; old saves restart cleanly with a notice, never load into the new story.
- Recap on Continue still works with the new acts.

## E. Story (from docs/REBOOT.md)

- One want (find Elias), one obstacle (the Shroud), one twist (the ghost is real; Vex was the
  red herring). No insurance, no ledgers, no forms, no paperwork puzzles.
- Four acts, the fixed flags, the fixed rooms and the new `lantern_deck`.
- Vex is a reluctant ally, never redeemed and never the hero. Elias is alive. The ghost is
  Mordant's Grey Lantern; the three rules are bell, light and name.
- Two endings: lay the dead to rest (fog lifts) or take the living and run (fog remains); Vex's
  fate follows `vex_trust`.

## F. Technical and test gates (all must be green)

- `npx tsc --noEmit`, `node tools/test-scripts.mjs` (0 errors, 0 warnings, every room has
  atmosphere, every light on the painting), `node --test tests/unit/*.test.mjs`,
  `node tools/editor-test.mjs`, `node tools/playthrough.mjs` (rewritten for the new acts),
  `node tools/fuzz/regression.mjs`, `npm run build`, `npm run package:itch`.
- Content lint: every flag read is set and every flag set is read; every `stand` is inside the
  walk polygon; every hotspot area is on the painting; every dialogue node's speaker exists.
- No asset symlinks may be committed (the `.gitignore` covers both `dir/` and the bare `dir`);
  generated art stays out of git.
- The old game on `main` stays playable until the reboot's suite is green; only then swap
  `scripts-next` → `scripts` and merge to `main`.

## G. Art already produced for the reboot (do not regenerate blindly)

`public/assets/characters/vex.png`, `vex_body.png`, `mordant.png`; refreshed `quill.png`,
`tavernkeep.png`; `public/assets/scenes/lantern_deck_wide.webp`;
`public/assets/props/items/bell_clapper.png`, `lantern.png`. Keys exist in `assets.ts`.

## H. Visual QA status (final pass)

- **Fog grading**: Act III rooms graded cold with haze; figures checked.
- **Reef Gate**: the sunny palisade is replaced by a fog-bound gate plate with the longboat in the
  water and the Grey Lantern's hull half-seen; the gate's logic and the boat's hotspot are kept.
- **Lighthouse and crow's nest**: new plates (the headland light; the nest platform above the
  deck) replace the smoke-yard and the reused deck view.
- **Fog flats**: a grey tidal-flats plate replaces the tropical beach.
- **The Grey Lantern's cabin**: cold grade, a painted nameplate prop on the desk, stale note gone.
- **The great lantern**: a wrapped-canvas prop covers the painted glass once Quill douses it.
- **Still accepted**: the wreck's bell is heard rather than painted (it is a sound), and the wreck's
  nameplate is the Act III item read at the broken-bow timber; the reef wreck hotspot is deliberate.
- **Title tally** now reads "Ship's log: N of M entries"; `deeds.ts` is the new ship's-log list and
  `lines.ts` has no paperwork barks.
