# Calibrating a room's scale

Rooms used to describe their scale with two hand-tuned numbers:

```
perspective horizon 450 ref 875 height 440
```

That model assumes the background was drawn on one vanishing point. These were not. The far
wall is painted small and the near furniture enormous, so no pair of numbers fits, and the
symptom is familiar: figures floating above the floor, or standing two-thirds too small next to
a bar.

`tools/calibrate.py` measures the horizon instead of guessing it, and writes a **scale curve**:

```
perspective horizon 450 ref 875 height 440
scale 705 268
scale 792 426
scale 880 585
```

Each `scale` line is `<floor y> <pixel height of a standing adult at that y>`. Two or more knots;
the engine interpolates linearly between them and extends the end segments. When a curve is
present it overrides `perspective` entirely, so you can keep the old line for the editor's
horizon guide and tune the curve independently.

## Why depth gives you the horizon

A pinhole camera looking at a flat floor gives, for a floor row `y`:

```
disparity(y) ∝ y − horizon          personHeight(y) = k · (y − horizon)
```

Depth Anything emits disparity (larger = nearer), which is linear in `y` on the floor. Regress it
against `y` over the walkable polygon and the zero crossing **is** the horizon. Most rooms fit
with r² 0.85–1.00, which is the model telling you the floor really is a ground plane.

`k` is adult height divided by camera height — one number, not two. It is the *only* thing you
have to supply, and it is intuitive: how big should a person be at a floor row you trust?

## Usage

```bash
python3 tools/calibrate.py                      # report every room, write nothing
python3 tools/calibrate.py tavern dock          # just these
python3 tools/calibrate.py tavern --anchor-y 800 --anchor-h 440 --apply
```

`--anchor-y/--anchor-h` says "at floor y=800 a standing adult should be 440 px tall". Pick the
row you are most confident about — usually where a person stands next to a bar, counter or door
whose real height you know. `--apply` writes the knots into the `.adv` script after the
`perspective` line and refuses to touch a room whose measurement it does not trust.

Requires the background images (not in this repo — see the README). Depth is cached in
`.calibration/`, so repeat runs are instant.

## Reading the report

```
tavern    ok    horizon 557.6  r2 0.94  k 1.82  n 889   705:268  792:426  880:585
```

The `confidence` column is deliberately pessimistic:

| Verdict | Meaning |
|---|---|
| `ok` | safe to apply |
| `weak fit` | r² < 0.75 — the floor is not a clean plane in this art |
| `thin floor band` | the walk polygon is under 120 px tall, so the horizon is extrapolated from too little |
| `far extrapolation` | the horizon is more than 1.5× the band's height away |

A high r² over a 40 px band extrapolated 100 px is numerology, which is why the last two
verdicts exist. Rooms that fail keep their `perspective` and are simply not calibrated.

## Checking it by eye

Press `D` in the game (or add `?debug` to the URL). The overlay draws a 1.75 m silhouette at
sample points across the floor, labelled with its height in pixels, alongside the walk polygon,
occluder floor lines, hotspot rectangles and the horizon. If the figure is not the height of the
furniture beside it, the curve is wrong.
