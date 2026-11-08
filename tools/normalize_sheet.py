#!/usr/bin/env python3
"""
Normalise a generated sprite strip into evenly-sized, baseline-aligned cells.

Diffusion produces an unpredictable spread of poses across the sheet, so we
detect each figure, then re-pack them into identical cells with a shared
baseline. That removes the per-frame bob that makes walk cycles look broken.
"""
import sys
import numpy as np
from PIL import Image

MIN_RUN = 40          # ignore slivers of background noise
PAD_X = 18
PAD_BOTTOM = 8


def runs_of(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= MIN_RUN:
                out.append((start, i - 1))
            start = None
    if start is not None and len(mask) - start >= MIN_RUN:
        out.append((start, len(mask) - 1))
    return out


def main(src, dst):
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    alpha = a[:, :, 3] > 16

    col_runs = runs_of(alpha.any(axis=0))
    if len(col_runs) < 2:
        print(f"only {len(col_runs)} figure(s) found — leaving {dst} untouched")
        return

    boxes = []
    for x0, x1 in col_runs:
        sub = alpha[:, x0 : x1 + 1]
        ys = np.where(sub.any(axis=1))[0]
        if len(ys) == 0:
            continue
        boxes.append((x0, ys.min(), x1, ys.max()))

    if not boxes:
        return

    max_w = max(b[2] - b[0] for b in boxes)
    baseline = max(b[3] for b in boxes)
    cell_w = max_w + PAD_X * 2
    cell_h = baseline + 1 + PAD_BOTTOM

    sheet = Image.new("RGBA", (cell_w * len(boxes), cell_h), (0, 0, 0, 0))
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        fig = im.crop((x0, y0, x1 + 1, y1 + 1))
        # centre horizontally, sit the feet on the shared baseline
        px = i * cell_w + (cell_w - fig.width) // 2
        py = baseline - fig.height + 1
        sheet.alpha_composite(fig, (px, py))

    sheet.save(dst)
    print(f"{dst}: {len(boxes)} frames, cell {cell_w}x{cell_h}, total {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
