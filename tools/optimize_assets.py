#!/usr/bin/env python3
"""
Shrink the shipped art so it decodes fast and fits in a phone's memory.

    python3 tools/optimize_assets.py [--dry-run] [--max-height 1100] [--no-video]

Character and prop PNGs are drawn at ~300-500 logical px but arrived ~2000-2200 px tall, which
cost ~450 MB of decoded bitmaps and long first-draw decodes. Each is scaled down uniformly so its
height is at most --max-height
(props: longer side at most --prop-max-side). Uniform scaling keeps the game's drawing identical: figures are
measured by their opaque bounds (Assets.frameBounds) and scaled to a real-world height, and sheet
cells are fractions of the width, never absolute pixels. Sheets keep a width divisible by their
frame count so cells stay whole. File names and formats (PNG with alpha) don't change.

Cinematics in public/assets/video are re-encoded (H.264 CRF 23, preset slow, +faststart) and kept
only when smaller. Scene backgrounds are left alone: their pixel size is what the room
coordinates were calibrated against.

Before anything is changed, the original is copied to .asset-originals/<same path> (once: an
existing backup is never overwritten, so re-running always works from the true original).
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
BACKUP = ROOT / ".asset-originals"

# Sheets drawn as horizontal strips: their width must stay divisible by the frame count.
SHEET_FRAMES = {"elias_walk_v2.png": 6, "elias_walk_vertical.png": 6}


def backup(path: Path) -> Path:
    """Copy `path` into .asset-originals once; return the backup (the true original)."""
    dest = BACKUP / path.relative_to(ROOT)
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    return dest


def kb(n: int) -> str:
    return f"{n / 1024:,.0f} KB" if n < 1 << 20 else f"{n / (1 << 20):,.1f} MB"


def shrink_png(path: Path, max_h: int, max_side: int, dry: bool) -> tuple[int, int]:
    """Scale so height <= max_h and the longer side <= max_side (sheets: height only)."""
    from PIL import Image

    def factor(w: int, h: int) -> float:
        if path.name in SHEET_FRAMES:
            return min(1.0, max_h / h)
        return min(1.0, max_h / h, max_side / max(w, h))

    before = path.stat().st_size
    with Image.open(path) as im:
        w, h = im.size
    if factor(w, h) >= 0.999:
        return before, before
    if dry:
        print(f"  would resize {path.relative_to(ROOT)} {w}x{h}")
        return before, before

    original = backup(path)
    with Image.open(original) as im:
        im.load()
        w, h = im.size
        s = factor(w, h)
        if s >= 0.999:
            return before, before
        frames = SHEET_FRAMES.get(path.name, 1)
        nw = max(frames, round(w * s / frames) * frames)
        nh = round(h * s)
        mode = "RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB"
        out = im.convert(mode).resize((nw, nh), Image.LANCZOS, reducing_gap=3.0)
    tmp = path.with_suffix(".tmp.png")
    out.save(tmp, "PNG", optimize=True)
    tmp.replace(path)
    after = path.stat().st_size
    print(f"  {path.relative_to(ROOT)}: {w}x{h} -> {nw}x{nh}  {kb(before)} -> {kb(after)}")
    return before, after


def reencode_video(path: Path, dry: bool) -> tuple[int, int]:
    before = path.stat().st_size
    if dry:
        print(f"  would re-encode {path.relative_to(ROOT)}")
        return before, before
    original = backup(path)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir) / path.name
        cmd = [
            "ffmpeg", "-v", "error", "-y", "-i", str(original),
            "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-movflags", "+faststart", str(tmp),
        ]
        if subprocess.run(cmd).returncode != 0 or not tmp.exists():
            print(f"  {path.name}: ffmpeg failed, kept as is")
            return before, before
        new = tmp.stat().st_size
        if new >= before:
            print(f"  {path.name}: re-encode not smaller ({kb(new)} vs {kb(before)}), kept as is")
            return before, before
        shutil.move(str(tmp), path)
    print(f"  {path.relative_to(ROOT)}: {kb(before)} -> {kb(new)}")
    return before, new


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-height", type=int, default=1100)
    ap.add_argument("--prop-max-side", type=int, default=900,
                    help="props are drawn at ~100-300 px; cap their longer side too")
    ap.add_argument("--no-video", action="store_true")
    args = ap.parse_args()

    try:
        import PIL  # noqa: F401
    except ImportError:
        print("Pillow is required: pip install pillow", file=sys.stderr)
        return 1

    total_b = total_a = 0
    print("Characters and props:")
    for folder in ("characters", "props"):
        for path in sorted((ASSETS / folder).glob("*.png")):
            side = args.prop_max_side if folder == "props" else 1 << 30
            b, a = shrink_png(path, args.max_height, side, args.dry_run)
            total_b += b
            total_a += a

    if not args.no_video and shutil.which("ffmpeg"):
        print("Video:")
        for path in sorted((ASSETS / "video").glob("*.mp4")):
            b, a = reencode_video(path, args.dry_run)
            total_b += b
            total_a += a
    elif not args.no_video:
        print("ffmpeg not found: video skipped")

    print(f"Total: {kb(total_b)} -> {kb(total_a)}  (originals in {BACKUP.relative_to(ROOT)}/)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
