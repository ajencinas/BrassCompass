#!/usr/bin/env python3
"""
Calibrate a room's scale from its background.

Why this exists
---------------
The engine used to describe a room's scale with two hand-tuned numbers (a horizon and a
reference height). That only works if the background was drawn on one vanishing point. These
were not: the far wall is painted small and the near furniture enormous, so no pair of numbers
fits. Rooms ended up with figures floating above the floor or standing two-thirds too small.

The fix is to measure the horizon instead of guessing it.

A pinhole camera looking at a flat floor gives, for a floor row y:

    depth(y)  ∝ 1 / (y − y_h)          and      personHeight(y) = C · (y − y_h)

with y_h the horizon. So if we know per-pixel depth, 1/depth is *linear in y*, and the y where
it reaches zero is the horizon. C is then the only free constant — the ratio of adult height to
camera height, about 1.2 for these backgrounds (camera a little below standing eye level).

Usage
-----
    python3 tools/calibrate.py                 # report every room
    python3 tools/calibrate.py tavern dock     # specific rooms
    python3 tools/calibrate.py --apply tavern  # write `scale` lines into the .adv script

The background images are not in this repository; point --assets at the folder that has them.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "src", "content", "scripts", "rooms")
CACHE = os.path.join(ROOT, ".calibration")
DEFAULT_ASSETS = os.path.join(ROOT, "public", "assets", "scenes")

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
# Adult height / camera height. The camera in these backgrounds sits a little below standing
# eye level; 1.2 makes a bar reach the waist and a door stand two metres.
C = 1.2


# ----------------------------------------------------------------------------- parsing the script

def parse_room(path: str) -> dict | None:
    """Pull the few things we need out of a .adv room script, without a full parser."""
    src = open(path).read()
    bg = re.search(r"^\s*bg\s+([\w.-]+)", src, re.M)
    width = re.search(r"^\s*width\s+(\d+)", src, re.M)
    persp = re.search(r"^\s*perspective\s+horizon\s+(-?[\d.]+)\s+ref\s+(-?[\d.]+)\s+height\s+(-?[\d.]+)", src, re.M)
    walk = re.search(r"^\s*walk\s+(.+)$", src, re.M)
    if not (bg and walk):
        return None
    pts = [(float(a), float(b)) for a, b in re.findall(r"\((-?[\d.]+),(-?[\d.]+)\)", walk.group(1))]
    entry = re.search(r"^\s*entry\s+(-?[\d.]+),(-?[\d.]+)", src, re.M)
    arrives = dict(
        (m.group(1), (float(m.group(2)), float(m.group(3))))
        for m in re.finditer(r"^\s*arrive\s+(\w+)\s+(-?[\d.]+),(-?[\d.]+)", src, re.M)
    )
    return {
        "path": path,
        "id": os.path.basename(path)[:-4],
        "entry": (float(entry.group(1)), float(entry.group(2))) if entry else None,
        "arrive": arrives,
        "bg": bg.group(1),
        "width": int(width.group(1)) if width else 1920,
        "perspective": tuple(float(x) for x in persp.groups()) if persp else None,
        "walk": pts,
        "has_scale": bool(re.search(r"^\s*scale\s", src, re.M)),
    }


def point_in_poly(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1:
            inside = not inside
    return inside


# ----------------------------------------------------------------------------- depth

_model = None


def depth_of(png_path: str) -> np.ndarray:
    """Relative depth for an image, cached to .calibration/."""
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.basename(png_path).rsplit(".", 1)[0]
    cached = os.path.join(CACHE, key + ".npy")
    if os.path.exists(cached):
        return np.load(cached)

    global _model
    import torch
    from PIL import Image
    from transformers import AutoModelForDepthEstimation

    if _model is None:
        _model = AutoModelForDepthEstimation.from_pretrained(MODEL).eval()

    im = Image.open(png_path).convert("RGB")
    # Keep the aspect ratio: a square resize would distort the vertical gradient we rely on.
    w = 518
    h = max(56, int(round(w * im.height / im.width / 14)) * 14)
    arr = np.asarray(im.resize((w, h), Image.BICUBIC)).astype(np.float32) / 255.0
    arr = (arr - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    with torch.no_grad():
        out = _model(pixel_values=torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0))
    d = out.predicted_depth.squeeze().numpy().astype(np.float32)
    np.save(cached, d)
    return d


# ----------------------------------------------------------------------------- fitting

def fit_horizon(depth: np.ndarray, room: dict, scene_h: int = 880) -> tuple[float, float, int]:
    """
    Regress 1/depth against y over the walkable floor. Returns (horizon_y, r2, sample_count).
    The y where disparity hits zero is the horizon, where the floor's depth runs to infinity.
    """
    dh, dw = depth.shape
    sx = dw / room["width"]
    sy = dh / scene_h
    xs = [p[0] for p in room["walk"]]
    ys = [p[1] for p in room["walk"]]
    x0, x1 = max(0, min(xs)), min(room["width"], max(xs))
    y0, y1 = max(0, min(ys)), min(scene_h, max(ys))

    pts: list[tuple[float, float]] = []
    for y in np.arange(y0 + 8, y1 - 4, 6.0):
        for x in np.arange(x0 + 8, x1 - 8, 24.0):
            if not point_in_poly(x, y, room["walk"]):
                continue
            iy, ix = int(y * sy), int(x * sx)
            iy = min(dh - 1, max(0, iy)); ix = min(dw - 1, max(0, ix))
            # a small median keeps painted detail from spiking the sample
            patch = depth[max(0, iy - 2):iy + 3, max(0, ix - 2):ix + 3]
            # DepthAnything emits inverse depth (disparity): larger = nearer. That is the
            # quantity that is linear in y on a ground plane, not its reciprocal.
            d = float(np.median(patch))
            if d <= 1e-4:
                continue
            pts.append((y, d))

    if len(pts) < 12:
        return (0.0, 0.0, len(pts))
    a = np.array(pts)
    y, inv = a[:, 0], a[:, 1]
    # disparity = m*(y - horizon)  ->  fit disparity = m*y + b, horizon = -b/m
    m, b = np.polyfit(y, inv, 1)
    pred = m * y + b
    ss_res = float(((inv - pred) ** 2).sum())
    ss_tot = float(((inv - inv.mean()) ** 2).sum()) or 1e-9
    r2 = 1 - ss_res / ss_tot
    if abs(m) < 1e-9:
        return (0.0, 0.0, len(pts))
    return (-b / m, r2, len(pts))


def knots_for(horizon: float, walk: list[tuple[float, float]], k: float,
              scene_h: int = 880, n: int = 3) -> list[tuple[float, float]]:
    ys = sorted({round(p[1]) for p in walk})
    lo, hi = min(ys), max(ys)
    lo = max(lo, int(horizon) + 40)
    out = []
    for i in range(n):
        y = lo + (hi - lo) * i / (n - 1)
        out.append((round(y), round(k * (y - horizon))))
    return out


def confidence(horizon: float, walk: list[tuple[float, float]], r2: float) -> str:
    """
    A line fitted across a 40 px floor band and extrapolated 100 px to a zero crossing is
    numerology, however good its r2 looks. Judge the extrapolation, not the fit.
    """
    ys = [p[1] for p in walk]
    span = max(ys) - min(ys)
    reach = min(abs(horizon - min(ys)), abs(horizon - max(ys)))
    if r2 < 0.75:
        return "weak fit"
    if span < 120:
        return "thin floor band"
    if reach > span * 1.5:
        return "far extrapolation"
    return "ok"


# ----------------------------------------------------------------------------- apply

def apply_to_script(path: str, knots: list[tuple[float, float]]) -> None:
    src = open(path).read()
    # remove any existing scale lines
    src = re.sub(r"^\s*scale\s+.*\n", "", src, flags=re.M)
    lines = "\n".join(f"  scale {y} {h}" for y, h in knots)
    # insert straight after the perspective line
    m = re.search(r"^(\s*perspective\s+.*)$", src, re.M)
    if not m:
        raise SystemExit(f"{path}: no perspective line to anchor the scale lines to")
    src = src[: m.end()] + "\n" + lines + src[m.end():]
    open(path, "w").write(src)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("rooms", nargs="*", help="room ids (default: all)")
    ap.add_argument("--assets", default=DEFAULT_ASSETS, help="folder holding the scene webp files")
    ap.add_argument("--apply", action="store_true", help="write scale lines into the .adv scripts")
    ap.add_argument("--json", help="also write the results here")
    ap.add_argument("--anchor-y", type=float, help="a floor y you trust")
    ap.add_argument("--anchor-h", type=float, help="the height a standing adult should be at that y")
    args = ap.parse_args()

    paths = sorted(f for f in os.listdir(SCRIPTS) if f.endswith(".adv"))
    if args.rooms:
        want = set(args.rooms)
        paths = [f for f in paths if f[:-4] in want]

    rows = []
    for f in paths:
        room = parse_room(os.path.join(SCRIPTS, f))
        if not room:
            continue
        # asset keys are `bg_<name>` while the files are `<name>.webp`
        stem = room["bg"][3:] if room["bg"].startswith("bg_") else room["bg"]
        img = os.path.join(args.assets, stem + ".webp")
        if not os.path.exists(img):
            print(f"{room['id']:22} skip (no image: {room['bg']})")
            continue
        horizon, r2, n = fit_horizon(depth_of(img), room)
        if n < 12:
            print(f"{room['id']:22} skip (only {n} floor samples)")
            continue
        # k is adult height / camera height; anchored per room when we know one height.
        k = C
        if args.anchor_y is not None and args.anchor_h is not None:
            denom = args.anchor_y - horizon
            if denom > 1:
                k = args.anchor_h / denom
        knots = knots_for(horizon, room["walk"], k)
        conf = confidence(horizon, room["walk"], r2)
        old = room["perspective"]
        rows.append({"room": room["id"], "horizon": round(horizon, 1), "r2": round(r2, 2),
                     "confidence": conf, "k": round(k, 3), "samples": n, "knots": knots,
                     "perspective": old})
        print(f"{room['id']:22} {conf:18} horizon {horizon:7.1f}  r2 {r2:5.2f}  k {k:5.2f}  n {n:4d}   "
              + "  ".join(f"{y}:{h}" for y, h in knots))
        if args.apply and conf == "ok":
            apply_to_script(room["path"], knots)
        elif args.apply:
            print(f"{'':22} not applied ({conf})")

    if args.json:
        json.dump(rows, open(args.json, "w"), indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
