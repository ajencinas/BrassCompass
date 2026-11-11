# Visual restart: paintings first

The title screen and the atlas are paintings before they are interfaces. A player should be able
to look at either and see Dreadwater Isle — not a map that happens to be pretty, not a screen that
happens to have art behind it.

## The rule: no signs, no labels

Nothing informational is painted into a plate.

- No lettering of any kind: no shop signs, nameboards, painted names, numbers, arrows or
  wayfinding. A hanging board may exist as a shape, but it is blank, weathered wood.
- No chart furniture: no compass rose, rhumb lines, soundings, sea serpent, torn paper edge or
  parchment texture. The old `bg_island_map` chart keeps those for the archived acts; the restart's
  paintings have none of them.
- No UI in the art: no frames, borders, title cards, buttons or watermarks.
- All text — the title, the tagline, the Begin control, the atlas key, room names — belongs to the
  game's own type layer, drawn over the painting.

The place has to read from light, silhouette and weather alone. If a label is needed to explain
what a shape is, repaint the light on it instead.

## The light

One shared language across the title and all five area plates:

- **Warm lantern key.** A few small amber cores (`~#e8b25a`) per frame — windows, stern lamps,
  the tavern. Light falls off fast, so the frame stays mostly dark.
- **Cold fog rim.** Every silhouette is separated from the fog by a silver-blue rim
  (`~#9fb6c9`), strongest behind the roofs, masts and rigging.
- **Coloured shadows.** Deep indigo and slate-blue, never flat black. The darks carry the same
  blue as the fog.
- **Emerald is reserved.** Green belongs to the Grey Lantern and the wreck's rigging; a faint
  green glow is the only unnatural hue in the world. It is never decoration.
- **Wet surfaces.** Cobbles, quay stone and deck planks catch broken, elongated reflections.
- **Volumetric air.** Fog is lit, not grey paint: visible shafts, soft edges, distance dissolving
  into pale blue.

## The composition

- **Full bleed.** Every plate runs to all four edges; nothing is framed.
- **One anchor.** A single focal subject per plate (the town and lighthouse, the Marrow, the
  wreck, the green lantern); the rest recedes into fog rather than competing.
- **Empty of people.** Establishing views carry no figures — the player supplies the life.
- **Anchored geography.** The five plates keep the old area plates' subject placement, so the
  atlas markers over them still land on the right quarter of the frame.

## Title

`bg_title` — 1920×1080, drawn cover-fitted to screen height and centred, then drifted and
breathed under a dark wash. Keep these zones quiet:

- **Top ~28%** — calm dark sky/high fog: the painted lettering sits here (y ≈ 280–400).
- **y ≈ 500–560** — tagline: keep it free of hard detail.
- **y ≈ 660–920** — the menu column: dark water or unlit foreground only.
- The island, harbour, lighthouse beam and green ghost-light sit in the central band, above the
  wash's darkest foot, so the painting is legible under the type.

## Atlas

`bg_atlas_island` is the **same painting** as `bg_title` under its own key, so the island view and
the title can never diverge. The atlas draws its markers (seen/here/visited) directly over it.
Area cards use the five `_v2` plates, which are establishing paintings in their own right — the
key panel beside them is the only place a name appears.

## Assets

| Key | File | Size | Manifest name |
| --- | --- | --- | --- |
| `bg_title` | `public/assets/scenes/title_night.webp` | 1920×1080 | `bg_title` |
| `bg_atlas_island` | same file as `bg_title` | 1920×1080 | — (alias) |
| `bg_area_harbour_v2` | `public/assets/scenes/area_harbour_v2.webp` | 2560×880 | `bg_area_harbour_v2` |
| `bg_area_town_v2` | `public/assets/scenes/area_town_v2.webp` | 2560×880 | `bg_area_town_v2` |
| `bg_area_marrow_v2` | `public/assets/scenes/area_marrow_v2.webp` | 2560×880 | `bg_area_marrow_v2` |
| `bg_area_shroud_v2` | `public/assets/scenes/area_shroud_v2.webp` | 2560×880 | `bg_area_shroud_v2` |
| `bg_area_lantern_v2` | `public/assets/scenes/area_lantern_v2.webp` | 2560×880 | `bg_area_lantern_v2` |

The original `island_map` and `area_*` plates stay in the manifest for the archived acts, the
ending art and the old story. Images are gitignored: they live in the shared asset folder.

## Regenerating

Prompts and crop live in `tools/generate.py` (`RESTART_STYLE`, the `visual restart` block of
`MANIFEST`, `TITLE_PLATES` / `AREA_PLATES_V2`). The area plates render at 21:9 and are cover-cropped
to 2560×880, exactly like the `_wide` room plates; the title renders at 16:9 and is cropped to
1920×1080. Jobs are cached by payload hash, so re-running only pays for changed prompts. Roughly
$0.03 per image.
