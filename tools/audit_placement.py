#!/usr/bin/env python3
"""
Find places where a character would appear to float.

The engine stands a figure with its feet at (x, y) and draws it upward. If y is on a floor that
recedes away from the camera, the art just below the feet is nearer than the art above it. If y is
on a vertical face — a counter front, a wall, a crate — the depth barely changes with height, and
the figure reads as hovering in front of the surface rather than standing on it.

Depth Anything gives disparity, where larger is nearer, so on a floor:

    disparity(y) > disparity(y - 30)        (looking up the screen is looking further away)
    slope s = disparity(y - 30) - disparity(y)  is clearly negative

On a vertical face s is near zero. That is the test.

Usage:
    python3 tools/audit_placement.py              # every room
    python3 tools/audit_placement.py chandlery    # one
    python3 tools/audit_placement.py --json out.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import calibrate as cal  # parse_room, depth_of, point_in_poly, SCRIPTS, DEFAULT_ASSETS

# A floor point should lose at least this much disparity over 30 px of height. Tuned against
# rooms known to be correct; vertical faces score near zero.
MIN_SLOPE = 0.035
LOOK_UP = 30


def slope_at(depth: np.ndarray, room: dict, x: float, y: float) -> float | None:
    dh, dw = depth.shape
    sx, sy = dw / room["width"], dh / 880.0

    def sample(px: float, py: float) -> float | None:
        ix, iy = int(px * sx), int(py * sy)
        if not (0 <= ix < dw and 0 <= iy < dh):
            return None
        patch = depth[max(0, iy - 2):iy + 3, max(0, ix - 2):ix + 3]
        return float(np.median(patch))

    near = sample(x, y)
    far = sample(x, y - LOOK_UP)
    if near is None or far is None:
        return None
    return far - near


def audit(room: dict, depth: np.ndarray) -> dict:
    xs = [p[0] for p in room["walk"]]
    ys = [p[1] for p in room["walk"]]
    x0, x1 = max(0, min(xs)), min(room["width"], max(xs))
    y0, y1 = max(0, min(ys)), min(880, max(ys))

    total = bad = 0
    for y in np.arange(y0 + LOOK_UP + 4, y1 - 2, 10.0):
        for x in np.arange(x0 + 6, x1 - 6, 20.0):
            if not cal.point_in_poly(x, y, room["walk"]):
                continue
            s = slope_at(depth, room, x, y)
            if s is None:
                continue
            total += 1
            if s > -MIN_SLOPE:
                bad += 1

    # the points the game actually places characters on
    named = [("entry", room["entry"])] + [("arrive." + k, v) for k, v in (room.get("arrive") or {}).items()]
    named += [("stand." + h[0], h[1]) for h in room.get("stands", [])]
    problems = []
    for label, p in named:
        s = slope_at(depth, room, p[0], p[1])
        if s is None:
            continue
        if s > -MIN_SLOPE:
            problems.append({"at": label, "x": round(p[0]), "y": round(p[1]), "slope": round(s, 3)})

    return {
        "room": room["id"],
        "badFraction": round(bad / total, 2) if total else 0.0,
        "samples": total,
        "badPoints": problems,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("rooms", nargs="*")
    ap.add_argument("--assets", default=cal.DEFAULT_ASSETS)
    ap.add_argument("--json")
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(cal.SCRIPTS) if f.endswith(".adv"))
    if args.rooms:
        want = set(args.rooms)
        files = [f for f in files if f[:-4] in want]

    rows = []
    for f in files:
        room = cal.parse_room(os.path.join(cal.SCRIPTS, f))
        if not room:
            continue
        room["stands"] = parse_stands(os.path.join(cal.SCRIPTS, f))
        stem = room["bg"][3:] if room["bg"].startswith("bg_") else room["bg"]
        img = os.path.join(args.assets, stem + ".webp")
        if not os.path.exists(img):
            print(f"{room['id']:22} skip (no image)")
            continue
        depth = cal.depth_of(img)
        # The test only means anything where the depth map behaves like a ground plane. Rooms
        # where it does not are reported as unmeasurable rather than guessed at.
        _, r2, _ = cal.fit_horizon(depth, room)
        row = audit(room, depth)
        row["r2"] = round(r2, 2)
        rows.append(row)
        if r2 < 0.65:
            print(f"{room['id']:22} ????  depth unreliable here (r2 {r2:.2f}) — check by eye")
            continue
        flag = "FLOAT" if row["badFraction"] > 0.25 else "ok   "
        pts = ", ".join(p["at"] for p in row["badPoints"]) or "-"
        print(f"{room['id']:22} {flag}  {row['badFraction']*100:5.0f}% vertical  | {pts}")

    if args.json:
        json.dump(rows, open(args.json, "w"), indent=2)
        print(f"\nwrote {args.json}")


def parse_stands(path: str) -> list[tuple[str, tuple[float, float]]]:
    import re
    out = []
    lines = open(path).read().split("\n")
    current = "?"
    for line in lines:
        m = re.match(r"\s*hotspot\s+(\w+)", line)
        if m:
            current = m.group(1)
        m = re.match(r"\s*stand\s+(-?[\d.]+),(-?[\d.]+)", line)
        if m:
            out.append((current, (float(m.group(1)), float(m.group(2)))))
    return out


if __name__ == "__main__":
    main()
