#!/usr/bin/env python3
"""
Put every cell of a walk strip on the same figure scale as a reference strip.

    python3 tools/normalize_walk_sheet.py <sheet.png> --match <reference.png>
    python3 tools/normalize_walk_sheet.py <sheet.png> --target-height 937

The game normalises a figure by its measured opaque height when it draws, so a mismatched source
scale is not visible on screen — but it makes the source sheets lie about the character's size and
defeats any later pass that compares them. This measures each cell's opaque extents, scales the
figure to the requested height (or the median frame height of a reference strip), and re-packs the
cells on one shared baseline with the frame-to-frame horizontal sway preserved. It is deliberately
a tool rather than a model prompt: diffusion repaints a strip as a whole and will not leave one
cell alone, and it has no reliable sense of absolute scale.

Run it after `tools/optimize_assets.py` has done its final shrink. The output is already at the
shipped 1100 px height, so a later optimize pass treats it as a no-op.
"""
from __future__ import annotations

import argparse
import statistics
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAD_X = 18
PAD_BOTTOM = 7  # matches the 1092 baseline of the existing 1100 px strips


def bounds(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 16)
    if not len(ys):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def cell_heights(path: Path, frames: int) -> list[int]:
    im = Image.open(path).convert("RGBA")
    cw = im.width // frames
    out = []
    for i in range(frames):
        box = bounds(np.asarray(im.crop((i * cw, 0, (i + 1) * cw, im.height)))[:, :, 3])
        if box:
            out.append(box[3] - box[1] + 1)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--frames", type=int, default=6)
    ap.add_argument("--match", help="reference strip to match, cell by cell")
    ap.add_argument("--target-height", type=int, help="explicit figure height in pixels")
    ap.add_argument("--height", type=int, default=1100, help="canvas height (default 1100)")
    args = ap.parse_args()

    if bool(args.match) == bool(args.target_height):
        ap.error("give exactly one of --match or --target-height")

    if args.match:
        ref = Path(args.match)
        if not ref.is_absolute():
            ref = ROOT / ref
        heights = cell_heights(ref, args.frames)
        if not heights:
            ap.error(f"no opaque figures measured in reference: {ref}")
        target = round(statistics.median(heights))
        print(f"reference {ref.name}: frame heights {heights}, median {target} px")
    else:
        target = args.target_height

    path = Path(args.sheet)
    if not path.is_absolute():
        path = ROOT / path
    im = Image.open(path).convert("RGBA")
    cw = im.width // args.frames
    cells = [im.crop((i * cw, 0, (i + 1) * cw, im.height)) for i in range(args.frames)]

    figs = []
    before = []
    for i, cell in enumerate(cells):
        box = bounds(np.asarray(cell)[:, :, 3])
        if not box:
            raise SystemExit(f"cell {i + 1} has no opaque figure in {path}")
        l, t, r, b = box
        fig = cell.crop((l, t, r + 1, b + 1))
        before.append(fig.height)
        s = target / fig.height
        fig = fig.resize(
            (max(1, round(fig.width * s)), target), Image.LANCZOS, reducing_gap=3.0
        )
        # Preserve the cell's horizontal sway: the offset of the figure's centre from the cell's
        # centre, scaled with the figure. Re-centring every cell would flatten the stride.
        offset = ((l + r + 1) / 2 - cw / 2) * s
        figs.append((fig, offset))

    fig_w = max(f.width for f, _ in figs)
    nw = fig_w + PAD_X * 2
    nh = args.height
    baseline = nh - PAD_BOTTOM

    sheet = Image.new("RGBA", (nw * args.frames, nh), (0, 0, 0, 0))
    for i, (fig, offset) in enumerate(figs):
        cx = i * nw + nw / 2 + offset
        x = round(cx - fig.width / 2)
        y = baseline - fig.height + 1
        sheet.alpha_composite(fig, (x, y))

    sheet.save(path)
    print(
        f"{path.name}: {args.frames} frames, figure {target} px (was {min(before)}-{max(before)}), "
        f"cell {nw}x{nh}, total {sheet.width}x{sheet.height}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
