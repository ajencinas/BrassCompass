#!/usr/bin/env python3
"""
Asset generator for The Brass Compass.

Reads MANIFEST, calls RunComfy, post-processes, writes to public/assets/.
Every job is cached by a hash of (model_id, payload) so re-running never
re-bills a successful generation.
"""
import hashlib
import json
import os
import sys
import time
from io import BytesIO

sys.path.insert(0, os.path.dirname(__file__))
import socket
import urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
CACHE = os.path.join(ROOT, ".gencache.json")
BASE = "https://model-api.runcomfy.net"

# Target logical resolution of the game.
SCENE_W, SCENE_H = 1920, 880


def api_key():
    """Read the RunComfy key lazily: environment first, then .env."""
    global _KEY
    if _KEY:
        return _KEY
    key = os.environ.get("RUNCOMFY_API", "").strip()
    if not key:
        env = os.path.join(ROOT, ".env")
        if os.path.exists(env):
            with open(env) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("export "):
                        line = line[len("export "):].lstrip()
                    if line.startswith("RUNCOMFY_API") and "=" in line:
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not key:
        raise SystemExit("RUNCOMFY_API missing (set it in the environment or in .env)")
    _KEY = key
    return _KEY


_KEY = None

RETRIES = 5
BACKOFF = 2.0  # seconds; doubles each attempt


class ApiError(RuntimeError):
    def __init__(self, msg, code=None):
        super().__init__(msg)
        self.code = code


class JobFailed(ApiError):
    """The job itself ended badly (failed/cancelled); resuming it is pointless."""


def _is_timeout(e):
    return isinstance(e, (socket.timeout, TimeoutError)) or isinstance(
        getattr(e, "reason", None), (socket.timeout, TimeoutError)
    )


def _retrying(fn, what, tries=RETRIES, retry_timeouts=True):
    """Call fn(); retry with exponential backoff on 5xx, 429, network errors
    and timeouts. Other HTTP 4xx fail immediately."""
    delay = BACKOFF
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode(errors="replace")[:400]
            except Exception:
                body = ""
            if e.code != 429 and e.code < 500:
                raise ApiError(f"{what}: HTTP {e.code} {body}", code=e.code) from None
            err = f"HTTP {e.code} {body}"
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as e:
            if _is_timeout(e) and not retry_timeouts:
                raise ApiError(f"{what}: timed out (not retried: the request may have been accepted)") from None
            err = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
        if attempt == tries:
            raise ApiError(f"{what}: giving up after {tries} tries ({err})")
        print(f"       retry {attempt}/{tries - 1} for {what} in {delay:.0f}s ({err})", flush=True)
        time.sleep(delay)
        delay *= 2


def _req(path, data=None):
    body = json.dumps(data).encode() if data is not None else None

    def call():
        r = urllib.request.Request(
            BASE + path, data=body, method="POST" if data is not None else "GET"
        )
        r.add_header("Authorization", "Bearer " + api_key())
        if body:
            r.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(r, timeout=180) as resp:
            return json.load(resp)

    # A POST that timed out may already have been accepted (and billed), so
    # only retry it on explicit server errors / connection failures.
    return _retrying(call, ("POST " if body else "GET ") + path, retry_timeouts=body is None)


DONE = ("completed", "succeeded")
FAILED = ("failed", "cancelled", "canceled", "error")


def submit(model_id, payload):
    sub = _req(f"/v1/models/{model_id}", payload)
    if not isinstance(sub, dict) or "request_id" not in sub:
        raise ApiError(f"submit failed: {sub}")
    return sub["request_id"]


def poll(rid, timeout=1200):
    """Wait for request `rid` to finish and return its result."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = _req(f"/v1/requests/{rid}/status")
        status = str(st.get("status", "")).lower()
        if status in FAILED:
            raise JobFailed(f"job {rid} {status}: {st.get('error') or st}")
        if status in DONE:
            res = _req(f"/v1/requests/{rid}/result?include_cost=true")
            rstatus = str(res.get("status", "")).lower()
            if rstatus in FAILED:
                raise JobFailed(f"job {rid} {rstatus}: {res.get('error') or res}")
            return res
        time.sleep(5)
    raise ApiError(f"timeout waiting for job {rid}")


def run(model_id, payload, timeout=1200, request_id=None, on_submit=None):
    rid = request_id or submit(model_id, payload)
    if on_submit and not request_id:
        on_submit(rid)
    return poll(rid, timeout)


def download(url, path):
    if not url:
        raise ApiError("no output URL in result")

    def fetch():
        r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(r, timeout=300) as resp:
            return resp.read()

    data = _retrying(fetch, f"download {url}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return data


# --------------------------------------------------------------------------
# Post-processing
# --------------------------------------------------------------------------

def post_background(raw_bytes, out_path, width=SCENE_W, height=SCENE_H):
    """Cover-fit a render to the game's scene resolution (or a full-screen plate)."""
    from PIL import Image, ImageEnhance, ImageFilter

    im = Image.open(BytesIO(raw_bytes)).convert("RGB")
    tw, th = width, height
    scale = max(tw / im.width, th / im.height)
    nw, nh = round(im.width * scale), round(im.height * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    im = im.crop((left, top, left + tw, top + th))

    # subtle sharpen after downscale so brushwork survives
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2))
    im = ImageEnhance.Contrast(im).enhance(1.03)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, quality=92, method=6)
    return im.size


def post_portrait(raw_bytes, out_path, size=(768, 1024)):
    from PIL import Image, ImageFilter

    im = Image.open(BytesIO(raw_bytes)).convert("RGB")
    scale = max(size[0] / im.width, size[1] / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - size[0]) // 2
    top = (im.height - size[1]) // 2
    im = im.crop((left, top, left + size[0], top + size[1]))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=45, threshold=2))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, quality=92, method=6)
    return im.size


def key_out(im, t0=52.0, t1=132.0):
    """
    Chroma-key a flat backdrop into a real alpha matte.

    A hard threshold leaves a coloured fringe, because edge pixels are a blend of
    the figure and the backdrop. So we estimate a soft alpha from colour distance
    and then unpremultiply: F = (C - (1-a)*BG) / a, which recovers the true figure
    colour and removes the halo.
    """
    import numpy as np
    from PIL import Image, ImageFilter

    im = im.convert("RGBA")
    arr = np.asarray(im).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    h, w = r.shape

    corners = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]
    bg = np.array(
        [np.mean([arr[y, x, i] for x, y in corners]) for i in range(3)],
        dtype=np.float32,
    )

    d = np.abs(r - bg[0]) + np.abs(g - bg[1]) + np.abs(b - bg[2])
    alpha = np.clip((d - t0) / (t1 - t0), 0.0, 1.0)

    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # Magenta spill: shadows and fringes cast on the backdrop keep its hue even when much
        # darker, so colour distance alone calls them solid. Fade anything balanced-magenta.
        mag = np.minimum(r, b) - g
        balanced = np.abs(r - b) < 0.35 * np.maximum(np.maximum(r, b), 1.0)
        spill = np.clip((mag - 30.0) / 50.0, 0.0, 1.0) * balanced
        alpha = alpha * (1.0 - spill)

    # Specks: drop small islands of opacity that aren't attached to the figure.
    from scipy import ndimage
    labels, count = ndimage.label(alpha > 0.1)
    if count > 1:
        sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
        small = np.isin(labels, 1 + np.nonzero(sizes < 400)[0])
        alpha[small] = 0.0

    safe = np.maximum(alpha, 0.25)[..., None]
    fg = (arr[:, :, :3] - (1.0 - alpha)[..., None] * bg) / safe
    fg = np.clip(fg, 0, 255)

    if bg[0] > 150 and bg[2] > 150 and bg[1] < 110:
        # Colour despill near the silhouette: magenta bounce light tints edges pink. Pull red
        # and blue down toward green wherever both exceed it, within ~30px of the backdrop.
        near = ndimage.distance_transform_edt(alpha > 0.5) < 30
        fr, fgc, fb = fg[:, :, 0], fg[:, :, 1], fg[:, :, 2]
        excess = np.clip(np.minimum(fr, fb) - fgc, 0, None) * near
        fg[:, :, 0] = fr - excess * 0.85
        fg[:, :, 2] = fb - excess * 0.85

    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = fg.astype(np.uint8)
    out[:, :, 3] = (alpha * 255).astype(np.uint8)

    result = Image.fromarray(out, "RGBA")
    # Trim the outermost faint ring so silhouettes stay clean against dark scenes.
    result.putalpha(result.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return result


def post_sprite(raw_bytes, out_path):
    """Key a flat backdrop out of a single figure/prop and trim to content."""
    from PIL import Image

    im = key_out(Image.open(BytesIO(raw_bytes)))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path)
    return im.size


IDLE_MAX_HEIGHT = 1100


def _clean_matte(im):
    """Pull the faint magenta haze out of the matte without hardening the silhouette.

    key_out keeps a soft ramp so the edges read into the dark plates. For the standing idle
    that ramp is exactly what makes the feet ambiguous: a few rows of near-transparent paint
    below the soles are counted as "figure" by the trim, so the feet anchor sits under a ghost
    of a shadow. Anything under 48/255 is lifted out; anything over 200/255 is made solid; the
    one- or two-pixel edge in between survives.
    """
    import numpy as np
    from PIL import Image

    a = np.asarray(im.convert("RGBA")).copy()
    alpha = a[:, :, 3].astype(np.float32)
    alpha = np.clip((alpha - 48.0) / (200.0 - 48.0), 0.0, 1.0) * 255.0
    a[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def post_painted_idle(raw_bytes, out_path, max_height=IDLE_MAX_HEIGHT):
    """Key and trim a standing painted figure so the boot soles are the last opaque row.

    The walk sheets never needed this: their soles are painted flush and each cell is re-packed
    on a shared baseline. A single idle study can come back with a brushy shadow or a sole that
    dissolves into the backdrop, which the game then reads as the foot of the figure. Trim on a
    crisp matte, then cap the height like `tools/optimize_assets.py` does, so the shipped sprite
    is the same scale as the walk cells.
    """
    from PIL import Image

    im = _clean_matte(key_out(Image.open(BytesIO(raw_bytes))))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if im.height > max_height:
        s = max_height / im.height
        size = (max(1, round(im.width * s)), max_height)
        im = im.resize(size, Image.LANCZOS, reducing_gap=3.0)
        im = _clean_matte(im)
        # The resize can leave a padded transparent row or two; trim again so the soles are
        # exactly the bottom of the file.
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, optimize=True)
    return im.size


ICON_MAX = 256


def post_icon(raw_bytes, out_path, max_side=ICON_MAX):
    """Key and trim an inventory icon like a prop, keep that full-size cut-out in
    .asset-originals/ (the convention of tools/optimize_assets.py), and ship a copy whose longer
    side is at most `max_side`: inventory chips draw it at ~64 px."""
    from PIL import Image

    im = key_out(Image.open(BytesIO(raw_bytes)))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # A fresh render is a new original, so this backup is replaced, never kept stale.
    original = os.path.join(ROOT, ".asset-originals", os.path.relpath(out_path, ROOT))
    os.makedirs(os.path.dirname(original), exist_ok=True)
    im.save(original)
    s = min(1.0, max_side / max(im.size))
    if s < 1.0:
        size = (max(1, round(im.width * s)), max(1, round(im.height * s)))
        im = im.resize(size, Image.LANCZOS, reducing_gap=3.0)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, optimize=True)
    return im.size


def post_walk_sheet(raw_bytes, out_path, frames=6):
    """Key a sprite strip, then re-pack it into even, baseline-aligned cells."""
    from PIL import Image
    from normalize_sheet import main as normalize

    im = key_out(Image.open(BytesIO(raw_bytes)))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path)
    normalize(out_path, out_path)
    return Image.open(out_path).size


def _satchel_side(cell):
    """How far the warm-brown leather satchel sits from the body's centre (+ right, - left)."""
    import numpy as np

    a = np.asarray(cell.convert("RGBA"))
    solid = a[:, :, 3] > 128
    ys, xs = np.where(solid)
    if len(ys) < 100:
        return 0.0
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = bottom - top, right - left
    if h < 20 or w < 20:
        return 0.0
    r, g, b = (a[:, :, i].astype(np.int16) for i in range(3))
    # The only warm mid-brown mass at hip height is the satchel: the boots sit lower and the
    # warm rim light is a thin edge, so this isolates the bag.
    brown = (r > 70) & (r - g > 18) & (r - b > 25) & (g < 110) & (b < 100) & (g > 15)
    band = np.zeros_like(brown)
    band[top + int(h * 0.30) : top + int(h * 0.72), left : right + 1] = True
    ys, xs = np.where(brown & band)
    if len(xs) < 200:
        return 0.0
    return (xs.mean() - (left + right) / 2) / max(1, w)


def _straighten_rear_frames(sheet, frames, rear):
    """A 3-behind strip sometimes comes back with one rear frame mirrored, which makes the
    satchel and the warm rim jump sides as the cycle turns. Flip the odd one out."""
    from PIL import Image

    cw = sheet.width // frames
    votes = []
    for f in range(rear):
        side = _satchel_side(sheet.crop((f * cw, 0, (f + 1) * cw, sheet.height)))
        votes.append(1 if side > 0.02 else -1 if side < -0.02 else 0)
    majority = 1 if votes.count(1) > votes.count(-1) else -1
    if votes.count(majority) < 2 or votes.count(-majority) != 1:
        return
    f = votes.index(-majority)
    cell = sheet.crop((f * cw, 0, (f + 1) * cw, sheet.height)).transpose(Image.FLIP_LEFT_RIGHT)
    sheet.paste(cell, (f * cw, 0))
    print(f"       rear frame {f + 1} was mirrored; flipped to keep the satchel on one side")


def post_painted_walk_sheet(raw_bytes, out_path, frames=6, rear_frames=0):
    """Key a painted sprite strip and re-pack it into `frames` even, baseline-aligned cells.

    Same contract as post_walk_sheet, with one difference: painted figures leave a faint
    painterly shadow or reflected light on the backdrop between two strides, a pixel or two of
    alpha in the gap. The shared normaliser counts any opaque pixel as figure, so such a gap
    bridges two figures into one. Here only columns carrying a few real figure pixels count, so
    the narrow gap still splits, and the per-frame boxes are re-aligned on one baseline.
    `rear_frames` (the 3-behind/3-front vertical sheet) also straightens a mirrored rear frame.
    """
    import numpy as np
    from PIL import Image

    im = key_out(Image.open(BytesIO(raw_bytes)))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    alpha = np.asarray(im)[:, :, 3] > 16
    counts = alpha.sum(axis=0)

    runs, start = [], None
    for x, n in enumerate(counts):
        solid = n >= 4
        if solid and start is None:
            start = x
        elif not solid and start is not None:
            if x - start >= 40:
                runs.append((start, x - 1))
            start = None
    if start is not None and len(counts) - start >= 40:
        runs.append((start, len(counts) - 1))

    if len(runs) != frames:
        print(f"       {len(runs)} figure(s) found, expected {frames}; using the shared normaliser")
        im.save(out_path)
        from normalize_sheet import main as normalize

        normalize(out_path, out_path)
        return Image.open(out_path).size

    boxes = []
    for x0, x1 in runs:
        sub = alpha[:, x0 : x1 + 1]
        ys = np.where(sub.any(axis=1))[0]
        xs = np.where(sub.any(axis=0))[0]
        if not len(ys) or not len(xs):
            continue
        boxes.append((x0 + xs.min(), ys.min(), x0 + xs.max(), ys.max()))
    if len(boxes) != frames:
        raise RuntimeError(f"only {len(boxes)} of {frames} painted figures could be cropped")

    max_w = max(b[2] - b[0] for b in boxes)
    baseline = max(b[3] for b in boxes)
    cell_w = max_w + 36
    cell_h = baseline + 1 + 8

    sheet = Image.new("RGBA", (cell_w * len(boxes), cell_h), (0, 0, 0, 0))
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        fig = im.crop((x0, y0, x1 + 1, y1 + 1))
        # centre horizontally, sit the feet on the shared baseline
        px = i * cell_w + (cell_w - fig.width) // 2
        py = baseline - fig.height + 1
        sheet.alpha_composite(fig, (px, py))
    if rear_frames:
        _straighten_rear_frames(sheet, len(boxes), rear_frames)
    sheet.save(out_path)
    print(f"       {out_path}: {len(boxes)} frames, cell {cell_w}x{cell_h}, total {sheet.width}x{sheet.height}")
    return sheet.size


def post_audio(raw_bytes, out_path, max_seconds=None):
    """Normalise to OGG mono-friendly mp3 and trim to a loop length."""
    import subprocess, tempfile

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
        tf.write(raw_bytes)
        src = tf.name
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", src]
    if max_seconds:
        cmd += ["-t", str(max_seconds)]
    cmd += ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", out_path]
    subprocess.run(cmd, check=True)
    os.unlink(src)
    return os.path.getsize(out_path)


# --------------------------------------------------------------------------
# Manifest
# --------------------------------------------------------------------------

STYLE = ("hand-painted digital illustration, cinematic point-and-click adventure game art, "
         "rich atmospheric volumetric lighting, painterly brushwork, detailed, "
         "strong colour grading, wide 16:9 composition, no text, no UI, no watermark, no logos")

# The visual restart's language, shared by the repainted rooms and the rest of the restart plates:
# the story is carried by light, weather and composition, never by painted information. One warm
# lantern key against deep indigo, a cold fog rim, emerald kept for the Grey Lantern's ghost-light,
# and no chart or signage furniture of any kind.
RESTART_STYLE = (
    "Fully painted cinematic concept art, not a map, a diagram or a poster: hand-painted digital "
    "oil illustration with loaded, visible brushwork, deep indigo and slate-blue night shadows "
    "that stay coloured rather than black, cold silver-blue fog light rimming every silhouette, "
    "a few small warm amber lantern cores, wet stone and wet timber catching broken reflections, "
    "soft volumetric shafts through mist, rich filmic colour grade, full-bleed to all four edges, "
    "no border, no frame, no vignette furniture. No text, no lettering, no signage, no signboards, "
    "no painted words or numbers, no labels, no compass rose, no rhumb lines, no sea serpent, no "
    "parchment or paper texture, no UI, no watermark, no logos."
)

BG_MODEL = "bytedance/seedream-5/lite/text-to-image"
BG_RES = "2848x1600 (16:9)"

# ---------------- the visual restart: paintings first ----------------
# The restart's language, shared by the title painting and the five atlas plates
# (docs/VISUAL_RESTART.md): the story is carried by light, weather and composition, never by
# painted information. One warm lantern key against deep indigo, a cold fog rim, emerald kept for
# the Grey Lantern's own ghost-light, and no chart furniture of any kind.
RESTART_STYLE = (
    "Fully painted cinematic concept art, not a map, a diagram or a poster: hand-painted digital "
    "oil illustration with loaded, visible brushwork, deep indigo and slate-blue night shadows "
    "that stay coloured rather than black, cold silver-blue fog light rimming every silhouette, "
    "a few small warm amber lantern cores, wet stone and wet timber catching broken reflections, "
    "soft volumetric shafts through mist, rich filmic colour grade, full-bleed to all four edges, "
    "no border, no frame, no vignette furniture. No text, no lettering, no signage, no signboards, "
    "no painted words or numbers, no labels, no compass rose, no rhumb lines, no sea serpent, no "
    "parchment or paper texture, no UI, no watermark, no logos."
)

# Characters must sit inside painterly backgrounds without looking pasted on.
CHAR_STYLE = ("rendered in the same painterly style as a cinematic adventure game background: "
              "oil-painted digital illustration, visible brushwork, soft warm rim lighting, "
              "muted natural colour palette, semi-realistic proportions, detailed fabric folds, "
              "no cartoon outlines, no cel shading, integrated filmic colour grade")
# The standing figures are drawn small and composited straight onto a painted plate, so they get a
# far firmer direction than CHAR_STYLE: the same lighting, brushwork and materials as the scene
# behind them, with none of the flat fills and clean edges that read as a sticker on a painting.
PAINTED_BODY = ("Full body figure standing, head to feet, hand-painted in the manner of a traditional "
                "oil painting: visible broad brushstrokes on face, hair and fabric, simplified "
                "painterly planes of light and shadow, semi-realistic proportions, soft warm amber "
                "key light from one side and cold blue-grey rim light from the other, muted natural "
                "palette, carrying the light and palette of a cinematic night scene. Not anime, not "
                "cel shaded, no clean line art, no cartoon outlines, not a 3D render, not a "
                "photograph, no text.")
CHAR_KEYS = {
    "char_elias", "char_walk", "npc_bramwick_body", "npc_marta_body",
    "char_walk_v2", "char_walk_vertical", "npc_bramwick_body_v2", "npc_marta_body_v2",
    "npc_quill_body", "npc_vane_body", "npc_silas_body", "npc_rook_body",
    "npc_nell_body", "npc_tam_body", "npc_onn_body",
    "npc_dorrit_body", "npc_hobb_body",
    "npc_ansel_body", "npc_pike_body", "npc_tamhobb_body",
    "npc_nib_body", "npc_bramwick_seated", "npc_weather_body",
    "npc_vane_rum", "npc_ansel_seated", "npc_vex_body", "npc_mordant_body",
    # The painted cast (this wave): full-length oil studies that sit inside the plates.
    "npc_bramwick_body_painted", "npc_pike_body_painted", "npc_nell_body_painted",
    "npc_onn_body_painted", "npc_tam_body_painted", "npc_tamhobb_body_painted",
    "npc_ansel_body_painted", "npc_mordant_body_painted", "npc_bramwick_seated_painted",
}

# Repaints of standing figures that carry PAINTED_BODY instead of CHAR_STYLE. They are cut out of
# the plate (post_sprite), not kept as full-bleed portraits, so they must not fall through to the
# portrait branch of postprocess().
PAINTED_BODY_KEYS = {
    f"npc_{cid}_body_painted" for cid in ("vex", "quill", "hobb", "dorrit", "marta")
}

# Fenn's repaint: he is the one figure always on screen in front of the painterly plates, so his
# sprite is painted to the plates' finish rather than drawn as flat anime. The same person, the
# same costume, lit by the plate's warm amber key and cold blue rim; no outline and no cel shading.
PAINTED_FIGURE = ("painted in the same hand as the game's background plates: oil-painted digital "
                  "illustration, visible confident brushwork across face, hair and cloth, "
                  "semi-realistic proportions and anatomy, simplified painterly planes of light "
                  "and shadow, warm amber key light from the left and a cold blue rim light along "
                  "the right-hand edges, rich muted colours, soft lost-and-found edges, integrated "
                  "filmic colour grade, no outlines, no cel shading, not anime, not a 3D render, "
                  "not a photograph, no text")

PAINTED_CHAR_KEYS = {
    "char_elias_painted", "char_walk_v2_painted", "char_walk_vertical_painted",
}
PAINTED_WALK_KEYS = {"char_walk_v2_painted", "char_walk_vertical_painted"}

FENN = ("Fenn, a young cartographer's apprentice in his early twenties: short dark curly hair, a "
        "navy blue long coat with brass buttons, a white shirt, brown leather boots, a worn leather "
        "satchel slung across his body")

# One description per character, shared by their portrait and body sprite so the two always
# show the same person. Keep these in step with docs/STORY.md.
CAST = {
    "quill": ("a young woman ship's lookout in her early twenties, clearly a woman, slim and "
              "wiry, sun-browned skin, cropped black hair under a knotted red neckerchief, a "
              "navy-and-white striped sailor's shirt, rolled grey canvas trousers, bare feet, "
              "sharp amused dark eyes"),
    "silas": ("a sleek shipping factor in his forties, pale clever face, a neat dark moustache, "
              "a tall black hat, an immaculate dark blue frock coat with a high white collar and "
              "a silver cravat pin, grey kid gloves, a thin smile that does not reach his eyes"),
    "rook":  ("an old ship's navigator in his seventies, white hair and a short full white "
              "beard, a deep-lined weathered face, a ragged dark tarred coat over a stained "
              "neckerchief, fingerless wool gloves, tired knowing eyes"),
    "dorrit": ("a ship's cook in his sixties, round and fussy, bald head with a neat grey "
               "fringe, small round spectacles, a spotless white apron over a faded blue customs "
               "officer's waistcoat with brass buttons, sleeves rolled, holding a ladle like a pen"),
    "hobb":   ("a big weathered ship's bosun in his forties, shaved head, thick black beard, broad "
               "shoulders, a sleeveless leather jerkin over a grey shirt, both forearms covered in "
               "tattooed names, a silver bosun's whistle on a cord round his neck"),
    "ansel": ("a cheerful sunburnt sea captain in his fifties, wild grey-blond hair and a "
              "bushy salt-streaked grey-blond beard, crinkled laughing blue eyes, a faded and "
              "much-patched navy captain's coat with tarnished brass buttons and mismatched "
              "patches, a salt-stained open-necked linen shirt, a large letter L embroidered in "
              "red thread on one cuff, a sewing needle and thread stuck through his lapel, "
              "rolled canvas trousers, bare sandy feet"),
    "pike":  ("an earnest young sentry about nineteen, thin and gangly, freckled anxious face, "
              "neatly combed sandy hair under a too-large peaked cap, an ill-fitting grey "
              "uniform coat with sleeves too long, an oversized bright yellow quarantine "
              "armband, clutching a wooden clipboard thick with forms, a pencil behind one ear"),
    "tamhobb": ("a big weathered salt-raker in his thirties, the younger brother of a ship's "
                "bosun, shaved head, short black beard, broad shoulders, deeply sunburnt, a "
                "ragged sleeveless shirt crusted white with salt, rolled canvas trousers, bare "
                "feet, one plain tattoo of an anchor on his forearm"),
    "nib":   ("a bored young office clerk about seventeen, thin and pale, lank mousy hair "
              "under a green celluloid eyeshade, a grey waistcoat a size too big over a white "
              "shirt with ink-stained cuffs and black sleeve garters, a pen behind one ear, "
              "heavy-lidded and utterly uninterested eyes"),
    "bramwick": ("an old weathered harbourmaster in his sixties, thick grey beard, battered "
                 "black tricorn hat, a long dark green coat with brass buttons, a brass "
                 "compass on a chain round his neck"),
    "weatherman": ("a burly, neatly groomed henchman in his thirties, clean-shaven, short "
                   "combed hair under a black bowler hat, a buttoned grey wool coat, a bright "
                   "yellow armband on one sleeve, polite blank expression"),
    "marta": ("a strong-featured woman in her fifties who runs a dockside tavern, broad "
              "shoulders, ginger hair going grey tied back in a ponytail, a red headband, a black "
              "shirt with the sleeves rolled to the elbow, an olive-green canvas apron, a knowing "
              "and slightly dangerous smile"),
    # The Father and the Fog.
    "vex": ("a pirate captain in his mid-forties, sharp and vain and dangerously charming, dark "
            "hair greying at the temples, a neatly trimmed dark beard, a long navy captain's coat "
            "with tarnished gold braid on the high collar, a thin old cutlass scar across one "
            "cheekbone, an amused half-smile that does not quite reach his eyes"),
    "mordant": ("an ancient ghost pirate captain, courteous and waterlogged, pale grey-green skin, "
                "a long braided grey beard, hollow but calm and sad eyes, an antique navy coat "
                "with tarnished brass buttons and salt-stained cuffs"),
}


def portrait(cid):
    return {"prompt": f"Painted character portrait, head and shoulders, of {CAST[cid]}. Warm "
                      f"rim light from one side, deep shadow on the other, painterly adventure "
                      f"game dialogue portrait, oil-painted digital illustration with visible "
                      f"brushwork, not anime, not cel shaded, dark neutral background, no text",
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


def body(cid, pose):
    return {"prompt": f"Full body figure of {CAST[cid]}, {pose}, painted adventure game "
                      f"character, flat solid magenta background (#FF00FF), no shadow, no "
                      f"ground, no text",
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


def painted_body(cid, pose):
    """A standing figure for the painted plates. The figure is isolated on magenta so the keyer
    can cut it out, and framed head-to-toe so the compositor's feet anchor lands on the floor."""
    return {"prompt": f"Full body figure of {CAST[cid]}, {pose}. {PAINTED_BODY} "
                      f"The complete figure from the top of the head to the soles of the feet is "
                      f"inside the frame, both feet fully visible with room below them, no weapons "
                      f"and nothing held in the hands. The entire background is flat solid magenta "
                      f"(#FF00FF) behind and all around the figure; no shadow, no ground, no "
                      f"furniture, no props, no text, no border",
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


# Portraits that came out photographic or CG beside the painted majority (Bramwick, Hobb, Pike,
# Dorrit) are redone with this firmer direction: the same people, unmistakably painted.
PAINTED_PORTRAIT = (
    "Hand-painted adventure game dialogue portrait in the manner of a traditional oil painting: "
    "visible, confident brushstrokes on the face and hair as well as the clothes, simplified "
    "painterly planes of light and shadow, slightly stylised semi-realistic features, warm amber "
    "rim light from one side and deep shadow on the other, rich muted colours, a dark neutral "
    "background of loose painted strokes. Not a photograph, not photorealistic, not a 3D render, "
    "no fine skin pores, not anime, not cel shaded, no text")


def painted_portrait(desc):
    return {"prompt": f"Painted character portrait, head and shoulders, of {desc}. "
                      f"{PAINTED_PORTRAIT}",
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


# Standing bodies that must read as figures *inside* the painted plates, not cut-out stickers
# laid over them. The old bodies were clean-edged, evenly lit and anime-proportioned; these are
# painted as oil studies in the plates' own hand, lit by their warm amber key and cold blue rim.
PAINTED_BODY = (
    "Painted as a full-length oil study for a cinematic adventure game, in the same hand as its "
    "background plates: visible, loaded brushstrokes across the face, hair, hands and cloth; broad "
    "simplified planes of light and shadow instead of smooth airbrushed gradients; slightly "
    "stylised but semi-realistic proportions with a real body's weight, stance and drapery; a warm "
    "amber key light from one side and a cold blue rim light along the opposite edges; rich but "
    "muted earthy colours, weathered by salt, sun and work; soft lost-and-found silhouette edges "
    "that settle into a painted world. Not a photograph, not photorealistic, not a 3D render, no "
    "plastic or airbrushed skin, not anime, not manga, no cel shading, no black line art or comic "
    "outlines, no glossy highlights, no text")


def painted_body(desc, pose, extra=""):
    return {"prompt": f"Full body figure of {desc}, {pose}. The whole figure is inside the frame, "
                      f"from the top of the head to the soles of both feet, with a little empty "
                      f"background above the head and below the feet; the figure fills most of the "
                      f"height of the picture. {PAINTED_BODY}. The background is flat solid magenta "
                      f"(#FF00FF) everywhere around the figure, including between the legs and "
                      f"under the feet; no shadow, no ground, no floor, no plinth, no extra props, "
                      f"no border, no frame, no text"
                      + (f". {extra}" if extra else ""),
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


# The painted bodies: one description per cast member, keyed `npc_<id>_body_painted`, generated
# full length on magenta and then chroma-keyed and trimmed like every other sprite. The old bodies
# stay on disk and on their manifest entries; only the live asset keys are repointed at these.
PAINTED_BODIES = {
    # Bramwick: the harbourmaster from the portrait — old, heavy, grey-bearded, dark green.
    "bramwick": (
        "Bramwick, an old weathered harbourmaster in his sixties: heavy-set and stooped, a thick "
        "grey beard, a battered black tricorn hat pulled low, a long dark green wool coat with "
        "brass buttons and salt-stained skirts, a brass compass on a chain at his breast, worn "
        "knee boots",
        "standing with his hands clasped behind his back, turned in side three-quarter view to "
        "the left, a stern appraising look"),
    # Pike: nineteen, gangly, uniform too big, clipboard, quarantine-yellow armband.
    "pike": (
        "Pike, an earnest young man of nineteen, clearly a young adult and not a boy: tall, thin "
        "and gangly, long arms and legs, narrow shoulders, a long bony adult face with a sharp "
        "chin and a thin neck, freckles, anxious pale eyes, sandy hair under a peaked cap a size "
        "too large, an ill-fitting grey uniform coat with the sleeves too long, an oversized "
        "bright yellow quarantine armband on one sleeve, a wooden clipboard thick with forms "
        "clutched to his chest, a pencil behind one ear, black trousers and scuffed boots; adult "
        "male proportions and real anatomy, not a child, not a big-eyed cartoon",
        "standing stiffly to attention, side three-quarter view to the left"),
    # Nell: fifties, headscarf, hoop earrings, apron, hands on hips.
    "nell": (
        "Nell, a village market seller in her fifties: a broad, strong, weather-beaten woman, a "
        "tan headscarf knotted tight over greying brown hair, large gold hoop earrings, a faded "
        "scarf at her neck, a coarse brown work apron over a blue linen shirt with the sleeves "
        "rolled to the elbow, a heavy dark skirt, stout boots",
        "standing with her hands planted on her hips, side three-quarter view to the left, a "
        "shrewd half-smile"),
    # Onn: seventies, shawl, cross, broom.
    "onn": (
        "Old Onn, a village woman in her seventies: small, bent and wiry, a deep-lined weathered "
        "face, wisps of grey hair under a dark shawl drawn over her head, a small iron cross on a "
        "thin chain at her throat, a brown shawl over a long dark skirt and a coarse apron, "
        "buckled shoes",
        "standing leaning on a besom broom of tied twigs, side three-quarter view to the left, a "
        "wary narrowed look"),
    # Tam: a real ten-year-old, not a small adult.
    "tam": (
        "Tam, a village boy about ten years old: short and sturdy with a real child's proportions, "
        "a child's large head and small hands, a freckled round face, a wide gap-toothed grin with "
        "one front tooth missing, tousled light brown hair under an oversized brown flat cap "
        "pushed back, an oversized brown coat with the collar turned up over patched knee "
        "breeches, bare dirty feet; clearly a child, not a small adult",
        "standing with his hands pushed into his pockets, side three-quarter view to the left, "
        "looking up"),
    # Tamhobb: adult brother of the bosun, salt raker, rake in hand.
    "tamhobb": (
        "Tam Hobb, a salt-raker in his thirties: a big, broad-shouldered, thick-armed man, shaved "
        "head, a short black beard, deeply sunburnt skin, a ragged sleeveless shirt crusted white "
        "with salt, a plain anchor tattoo on one forearm, rolled canvas trousers, bare feet; "
        "clearly an adult man, the younger brother of a ship's bosun",
        "standing leaning on a long wooden salt rake, side three-quarter view to the left, tired "
        "and watchful"),
    # Ansel/Elias: the captain from the portrait, patched coat, L on the cuff, bare feet.
    "ansel": (
        "Ansel Fenn, a cheerful sunburnt sea captain in his fifties: wild grey-blond hair and a "
        "bushy salt-streaked grey-blond beard, crinkled laughing blue eyes, a faded much-patched "
        "navy captain's coat with tarnished brass buttons and mismatched patches, a large red "
        "embroidered letter L on one cuff, a sewing needle and thread stuck through the lapel, a "
        "salt-stained open-necked linen shirt, rolled canvas trousers, bare sandy feet",
        "standing with his arms flung wide in delighted welcome, a folded patchwork flag under "
        "one arm, facing the viewer in three-quarter view"),
    # Mordant: ancient, courteous, waterlogged, green ghost-light.
    "mordant": (
        "Captain Mordant, an ancient ghost pirate captain: tall, gaunt and waterlogged, pale "
        "grey-green skin, a long braided grey beard, hollow but calm and sad eyes, an antique "
        "navy coat with tarnished brass buttons and salt-stained cuffs, a cutlass at his hip, "
        "worn seaboots; calm and courteous rather than monstrous, not a rotting corpse, no gore",
        "standing full-length in three-quarter view with one hand open in a courteous gesture, a "
        "faint green ghost-light falling along one side of his coat and face; his skin has a "
        "sea-green cast; he is fully opaque and solid, with no translucent aura, no mist and no "
        "glow floating in the air around him"),
}


# The three figures a blind review still read as outliers in the painted cast: Pike as anime
# line-art, Tam as smooth Pixar/3D, Mordant as CG-real. Same people, same costumes and framing as
# their portraits; this is the PAINTED_BODY hand with the failure each one has to lose spelled
# out. Each was studied at least twice and the better study kept; the alternates stay in `.genraw`
# and on disk but not in the manifest.
PAINTED_BODY_V2 = (
    "Painted as a full-length oil study on primed canvas for a cinematic adventure game, in "
    "exactly the same hand as its background plates: loaded, visibly brushed strokes across face, "
    "hair, hands and cloth; scumbled half-tones and broken colour; occasional palette-knife "
    "smears; paint dragged thin enough to feel the canvas; planes of light and shadow simplified "
    "into a few broad strokes; lost-and-found silhouette edges. Warm amber key light from one "
    "side, cold blue-grey rim light along the opposite edge, rich muted earthy colour weathered "
    "by salt and sun. Real human anatomy with weight, stance and drapery. Not a photograph, not "
    "photorealistic, not a 3D render, not CGI, no plastic or airbrushed skin, no subsurface "
    "scattering, no smooth airbrushed gradients, not anime, not manga, no cel shading, no black "
    "ink outlines or comic line art, no glossy highlights, no text."
)

PAINTED_BODIES_V2 = {
    # Pike: nineteen, bony and anxious; a real gangly adult face, not a bishounen.
    "pike": (
        "Pike, an anxious young sailor and quarantine sentry of nineteen: tall and bony, narrow "
        "shoulders, long arms and legs, a thin neck, sharp cheekbones and hollow cheeks, a long "
        "bony nose, a thin anxious mouth, wary deep-set eyes of ordinary adult size, freckles, "
        "sandy hair cropped under a peaked cap a size too large, an ill-fitting grey uniform "
        "greatcoat with shoulders too wide and sleeves too long, an oversized bright yellow "
        "quarantine armband on one sleeve, a wooden clipboard thick with forms held against his "
        "chest, a pencil behind one ear, black trousers and scuffed boots",
        "standing stiffly to attention in side three-quarter view to the left, shoulders hunched "
        "a little, looking warily off to the side",
        "His face is a real young man's face with adult proportions and ordinary eyes — not an "
        "anime or manga face, not a wide-eyed bishounen, no oversized irises, no eyelashes drawn "
        "as lines, no smooth cel-shaded skin; the brush must be seen on the cheekbones and the "
        "fabric."),
    # Tam: a real nine-year-old, painted like a loose study from life, not a 3D child.
    "tam": (
        "Tam, a small island boy of about nine: short and sturdy with a real child's proportions, "
        "his head about one sixth of his height, short legs, small hands and narrow shoulders, a "
        "round freckled face, a gap-toothed grin with one front tooth missing, small plain dark "
        "child's eyes, tousled light brown hair under an oversized brown flat cap pushed back, an "
        "oversized brown coat with the collar turned up over patched knee breeches, bare dirty "
        "feet, clearly a child and not a small adult",
        "standing with his hands pushed into his pockets, side three-quarter view to the left, "
        "looking up",
        "Painted like a loose oil study from life: broad wet brushstrokes and scumbled colour, "
        "the paint handling of a portrait sketch, edges broken and soft. Not a 3D animated film, "
        "not Pixar, not Disney, not smooth CGI, no plastic or clay skin, no perfect rounded head, "
        "no giant glossy eyes; his eyes are small and ordinary and his face is painted with "
        "visible strokes."),
    # Mordant: an opaque, solid old captain in broad paint; no ghost aura, no CG skin.
    "mordant": (
        "Captain Mordant, an ancient spectral sea-captain: tall, gaunt and waterlogged, hollow "
        "cheeks, pale grey-green weathered skin, long loose grey hair falling to his shoulders, "
        "a long braided grey beard, deep-set sad eyes, an antique navy captain's coat with "
        "tarnished brass buttons and salt-stained cuffs, a brown leather belt, dark trousers, "
        "heavy solid opaque black seaboots",
        "standing full-length in three-quarter view with one hand open in a courteous gesture",
        "He is painted with broad, blocky brushwork: dry brush and scumbled impasto on the coat, "
        "the beard and the boots, matte painted skin with visible strokes, no CG subsurface "
        "scattering, no photoreal pores or specular sheen, no airbrushed gradients. He is solid "
        "and opaque — no translucent aura, no green glow bleeding around his edges, no mist, no "
        "vapour. He is bare-headed: long grey hair, no hat, no cap, no tricorne, no headgear of "
        "any kind. His boots are solid opaque leather with dark soles, not fading into the "
        "background, and no magenta halo or band gathers at his feet or along the silhouette."),
}

PAINTED_BODY_KEYS |= {f"npc_{cid}_body_painted_v2" for cid in PAINTED_BODIES_V2}


def painted_body_v2(desc, pose, extra):
    """A second-wave oil study: the painted_body framing, with the failures of the old painted
    bodies named and forbidden."""
    return {"prompt": f"Full body figure of {desc}, {pose}. The whole figure is inside the frame, "
                      f"from the top of the head to the soles of both feet, with a little empty "
                      f"background above the head and below the feet; the figure fills most of the "
                      f"height of the picture. {PAINTED_BODY_V2} {extra} The background is flat "
                      f"solid magenta (#FF00FF) everywhere around the figure, including between "
                      f"the legs and under the feet; no shadow, no ground, no floor, no plinth, "
                      f"no props, no border, no frame, no text.",
            "resolution": "1728x2304 (3:4)", "output_format": "png"}


# Inventory icons: one object each, painted like the props and keyed the same way, then shrunk by
# post_icon. Every icon shares this framing, light and finish so a full inventory reads as a set.
ICON_STYLE = ("a hand-painted adventure game inventory icon: one single object, centred, with a "
              "wide margin of empty background all round it, seen in three-quarter view from "
              "slightly above, matte oil-painted digital illustration with visible brushwork, "
              "slightly stylised, not a 3D render, not a photograph, no gloss, soft warm key "
              "light from the upper left and a gentle warm rim light along its edges, rich muted "
              "colours, a bold clear silhouette that reads at a small size, flat solid magenta "
              "background (#FF00FF), no shadow, no ground, no table, no frame")


def icon(subject, text="no text, no lettering"):
    return {"prompt": f"{subject}. {ICON_STYLE}, {text}",
            "resolution": "2048x2048 (1:1)", "output_format": "png"}


MANIFEST = [
    # ---------------- the atlas: the island chart and the macro views above the rooms ----------------
    ("bg_island_map", "image", BG_MODEL,
     {"prompt": f"A hand-painted antique chart of a fog-bound northern island at night, seen from "
                f"above: Dreadwater Isle, a dark green-grey island in a cold pewter sea. A small "
                f"harbour town with a stone quay and a lighthouse on the south coast; a steep "
                f"upper town climbing to the lighthouse headland; a great bank of pale fog covering "
                f"the eastern half of the island and the sea beyond it; a reef gate and a broken "
                f"wreck in the fog; a lone ship at anchor in the western bay; a faint spectral "
                f"green lantern-glow deep in the eastern fog. Painted on dark blue chart paper with "
                f"faded gold ink: a compass rose, depth soundings, rhumb lines, a sea serpent in "
                f"the empty water, torn edges and a little salt staining. Hand-painted adventure "
                f"game map art, rich brushwork, moody and mysterious, no text, no labels, no "
                f"lettering anywhere. {STYLE}",
      "resolution": "2848x1600 (16:9)", "output_format": "png"}, "scenes/island_map.webp"),

    ("bg_area_harbour", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: a wide establishing view of "
                f"a night harbour waterfront on a fog-bound northern island. The moored Marrow at "
                f"the left, a warm-lit tavern with a hanging sign, a tall timber harbourmaster's "
                f"house, a narrow lane between two warehouses, a boat shed with its door ajar, a "
                f"counting house with green lamps, and a shipwright's chandlery, all along a wet "
                f"stone-and-timber quay. Indigo water, warm lantern reflections, cold blue fog "
                f"behind. One continuous empty quay band across the lower third; no people, no "
                f"crates or barrels in that band. Clear side view, essential scenery in the central "
                f"vertical band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/area_harbour.webp"),

    ("bg_area_town", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: a steep cobbled lane "
                f"climbing through a fog-bound northern harbour town at night. Dark timber-and-stone "
                f"cottages, a stone well, warm lit windows, laundry lines, a shrine niche, and at "
                f"the top of the lane the lighthouse on its headland with its great lamp burning "
                f"gold through the fog. Cold blue-grey fog, wet cobbles, warm lamps. One continuous "
                f"empty lane band across the lower third; no people, no stalls in that band. Clear "
                f"side view, essential scenery in the central vertical band. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/area_town.webp"),

    ("bg_area_marrow", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: a wide side view of a "
                f"two-masted sailing ship, the Marrow, at sea in cold fog at dusk. Her deck and "
                f"rail run across the lower third, the helm and binnacle at the right, the cabin "
                f"stern windows at the far right, a hatch and companionway amidships, the bow and "
                f"figurehead at the left, and the crow's nest high on the foremast. Tattered grey "
                f"sails, wet decks, warm stern lantern, cold fog sea and grey horizon. No people, "
                f"one empty deck band across the lower third. Clear side view, essential scenery "
                f"in the central vertical band. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/area_marrow.webp"),

    ("bg_area_shroud", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: a vast grey tidal flat "
                f"under thick cold fog, the Shroud. A beached longboat on the left, a broken "
                f"ghost-ship wreck with tattered sails and a faint green glow in the rigging in "
                f"the centre, a castaway camp of grey tents and a palisade on the right, the pale "
                f"track to a reef gate in the far right fog, and a distant spectral ship at "
                f"anchor. Ribbed wet sand, pewter channels, low fog, no sun, no tropical colour. "
                f"One empty wet-sand band across the lower third; no people. Clear side view, "
                f"essential scenery in the central vertical band. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/area_shroud.webp"),

    ("bg_area_lantern", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: the Grey Lantern, an "
                f"ancient ghost ship, at anchor in thick cold fog at night. A wide side view: her "
                f"dark rotted hull and tattered sails, a great green lantern burning at the stern, "
                f"the deck rail and a cabin door across the lower third, spectral green light in "
                f"the rigging, pale fog and black water. No people, one empty deck band across the "
                f"lower third. Clear side view, essential scenery in the central vertical band. "
                f"{STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/area_lantern.webp"),

    # ---------------- the visual restart: a painted title and five painted area plates --------
    # A new lighting language, not new geography. The old chart and the five area plates above are
    # the anchors: the same island, the same quays and ships, repainted as full-bleed cinematic
    # establishing views. The chart furniture goes (compass rose, rhumb lines, sea serpent, torn
    # paper, all painted lettering); light, weather and composition carry the place instead. No
    # painted signs — the harbour reads by its lanterns, the town by its lit lane, the Grey
    # Lantern by its green flame. Prompts keep the anchors' subject placement so the atlas markers
    # over the plates still land on the right places.
    ("bg_title", "image", BG_MODEL,
     {"prompt": f"An oil painting of Dreadwater Isle at night, a cinematic aerial seen in "
                f"perspective from high above the cold pewter sea, looking down and across at a "
                f"fog-bound northern island. The island holds the left half of the frame: a "
                f"huddled harbour town of dark timber and stone along a stone quay at the "
                f"south-west, a scatter of warm amber lanterns and lit windows along the "
                f"waterfront, the town climbing steeply to a lighthouse on its headland at the "
                f"upper left, its great lamp burning gold and throwing a long gold beam into the "
                f"fog. In the western water at the far left the Marrow, a dark two-masted sailing "
                f"ship, lies at anchor, her stern lantern one warm point on the black water. The "
                f"whole eastern half of the frame is drowned in a great soft bank of pale "
                f"blue-grey sea fog; deep inside it stand the broken ribs of a wreck on a reef, "
                f"and far off a faint sickly emerald green lantern glow, barely visible, the only "
                f"green in the picture. Above, torn cloud and a thin cold moon; the top quarter "
                f"is quiet dark sky and high fog, calm enough to carry a title. Moonlight silver "
                f"on the water, warm town lights reflected in long broken streaks, deep indigo "
                f"shadows, sea running to every edge of the frame. The island reads at a glance "
                f"with no label anywhere: a painting first, a place before an atlas. "
                f"{RESTART_STYLE}",
      "resolution": "2848x1600 (16:9)", "output_format": "png"}, "scenes/title_night.webp"),

    ("bg_area_harbour_v2", "image", BG_MODEL,
     {"prompt": f"A cinematic establishing painting of the harbour at Dreadwater Isle at night, "
                f"seen from the quay, full-bleed. The dark two-masted Marrow is moored at the "
                f"left, her furled sails and rigging black against cold indigo water, a single "
                f"lamp warm at her stern. Left of centre the tall timber tavern, its windows warm "
                f"behind small panes, a blank weathered board above its door and nothing written "
                f"on it; beyond it the harbourmaster's tall house and a narrow lane between two "
                f"warehouses. Right of centre a boat shed with its door ajar, a counting house "
                f"whose windows glow a thin green, and a shipwright's chandlery with stacked "
                f"spars under its eave. Wet cobbles and stone edging run across the foreground, "
                f"tallow and green lantern light pooling on the wet stone, thin fog drifting "
                f"between the buildings, the hills behind lost in it. Warm lantern light against "
                f"cold blue fog, wet reflections, deep indigo shadows. Empty: no people, no "
                f"signs, no lettering. One continuous harbour scene; all essential buildings in "
                f"the middle band of the frame, sky and foreground may crop. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"},
     "scenes/area_harbour_v2.webp"),

    ("bg_area_town_v2", "image", BG_MODEL,
     {"prompt": f"A cinematic establishing painting of Upper Town, Dreadwater Isle, at night: a "
                f"steep cobbled lane climbing between dark timber-framed and stone cottages, "
                f"full-bleed. Warm lit windows and a few iron lamps along the lane, laundry lines "
                f"strung between gables, a stone well at the right, an empty shrine niche in a "
                f"cottage wall. The lane rises to a headland at the upper right where the "
                f"lighthouse stands, its great lamp burning gold, one long gold beam sweeping "
                f"through cold blue fog. Wet cobbles mirroring the lamps and windows, cold fog "
                f"pooling in the lane, roofs fading up into the murk, no horizon but fog. Warm "
                f"amber windows against cold blue-grey night, deep indigo shadows, wet stone. "
                f"Empty: no people, no signs, no lettering. All essential buildings in the middle "
                f"band of the frame, sky and foreground may crop. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"},
     "scenes/area_town_v2.webp"),

    ("bg_area_marrow_v2", "image", BG_MODEL,
     {"prompt": f"A cinematic establishing painting of the Marrow, a two-masted sailing ship, at "
                f"sea in cold fog at dusk, painted from her own deck, full-bleed. Her bow and "
                f"carved figurehead at the left, tattered grey canvas hanging in strips from the "
                f"yards, tarred ratlines and tangled rigging; the helm and brass binnacle at the "
                f"right above a short flight of steps, the stern cabin dark timber with warm "
                f"amber windows and a single glowing warm lantern at its corner; the crow's nest "
                f"high on the foremast, half lost in fog. Beyond the rail a pewter fog sea under "
                f"a pale gold dusk sky, the low sun breaking through grey cloud at the left "
                f"horizon, cold fog rolling over the water. Wet deck planks catching cold light "
                f"and one warm lamp, deep indigo-teal shadows, desaturated slate and pewter. "
                f"Empty: no people, no signs, no lettering. All essential scenery in the middle "
                f"band of the frame, sky and foreground may crop. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"},
     "scenes/area_marrow_v2.webp"),

    ("bg_area_shroud_v2", "image", BG_MODEL,
     {"prompt": f"A cinematic establishing painting of the Shroud, a vast grey tidal flat under "
                f"thick cold fog, full-bleed. A beached longboat at the left, her clinker hull "
                f"dark against ribbed wet sand; in the centre a broken ghost-ship wreck heeled "
                f"into the flats, tattered grey sails hanging in rags, a faint spectral green "
                f"glow threading through her rigging; at the right a low castaway camp of grey "
                f"tents behind a driftwood palisade, no banners and nothing written; a pale track "
                f"curving away into the far-right fog toward a reef gate, and a distant spectral "
                f"ship at anchor on the grey horizon. Ribbed wet sand and pewter channels "
                f"mirroring the fog, low fog lying in the hollows, no sun, no tropical colour, one "
                f"faint ember of warm light at the camp the only warmth. Empty: no people, no "
                f"signs, no lettering. All essential scenery in the middle band of the frame, sky "
                f"and foreground may crop. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"},
     "scenes/area_shroud_v2.webp"),

    ("bg_area_lantern_v2", "image", BG_MODEL,
     {"prompt": f"A cinematic establishing painting of the Grey Lantern, an ancient ghost ship, "
                f"at anchor in thick cold fog at night, seen from a low deck rail, full-bleed. Her "
                f"dark rotted hull and torn grey sails fill the frame; the great iron lantern on "
                f"its stern post at the right, a swollen green flame inside cloudy glass throwing "
                f"a sickly emerald halo through the fog; spectral green light threading the "
                f"rigging and washing the wet planks. A weathered deck rail and a low dark cabin "
                f"door run across the lower edge, black water below, pale teal fog beyond, one "
                f"faint warm ember far aft the only warmth left in the world. Cold moonlit "
                f"silver-blue-green palette, deep black-green shadows, eerie and lonely but not "
                f"gory. Empty: no people, no signs, no lettering. All essential scenery in the "
                f"middle band of the frame, sky and foreground may crop. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"},
     "scenes/area_lantern_v2.webp"),

    # ---------------- the ships' rooms as close-ups of the area views ----------------
    # The area plates above are the anchor; these paint the rooms the player walks in as
    # side-on close-ups of the same ships, keeping hull, rigging, lanterns, palette and brushwork
    # identical, so the cut from the establishing card into the room reads as one camera move.
    # Each leaves the lower third as a clear walkable band. 21:9 renders, cropped to 2560x880.
    ("bg_marrow_deck_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-on close-up of the main deck of the Marrow, the two-masted "
                f"sailing ship from her establishing view, painted from the deck itself at cold "
                f"fog dusk. A low camera at deck level looks broadside across the ship toward the "
                f"sea. The same dark tarred hull and turned-baluster rail run across the middle "
                f"distance; beyond them a cold pewter fog sea under a pale gold dusk sky, the low "
                f"sun breaking through grey cloud at the left horizon. Left: the foremast with "
                f"tarred ratlines, a storm-torn cream-grey sail hanging in strips, the bow rail "
                f"and a glimpse of the carved figurehead. Centre: the mainmast with more tattered "
                f"sails and tangled rigging, the hatch cover and companionway with its glass "
                f"skylight; lashed crates and coiled ropes along the rail above the walk band. "
                f"Right: a short flight of wooden steps with a rope handrail climbing from the "
                f"main deck to the raised quarterdeck, then the ship's wheel and brass binnacle "
                f"on that platform, the dark timber stern cabin with "
                f"warm amber lit windows and a single glowing warm lantern hanging at its corner, "
                f"and the stern rail. One continuous, completely empty and unobstructed walkable "
                f"deck band of wet dark planks spans the entire lower third from the left edge to "
                f"the right edge; no figures, crates, barrels, coiled ropes, fallen spars, posts "
                f"or debris anywhere in that lane. Deep indigo-teal shadows, desaturated slate and "
                f"pewter, one warm amber stern lamp, wet planks catching cold light, thin drifting "
                f"fog. Hand-painted digital illustration, cinematic point-and-click adventure game "
                f"art, visible oil-painted brushwork, rich atmospheric volumetric lighting, strong "
                f"colour grading, ultra-wide panoramic composition, no text, no UI, no watermark, "
                f"no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/marrow_deck_wide.webp"),

    ("bg_grey_lantern_deck_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-on close-up of the deck of the Grey Lantern, the ancient ghost "
                f"ship from her establishing view, painted from her own deck in thick cold fog at "
                f"night. A low camera at deck level looks broadside along the rotted deck toward "
                f"the stern at the right. The same dark, nearly black hull, splintered rail and "
                f"carved woodwork run across the middle distance; beyond them pale teal fog and "
                f"flat black water. Left: the bow and foremast, torn grey canvas sails hanging in "
                f"long ragged strips from leaning yards, frayed shrouds and tangled rigging. "
                f"Centre: the broken mainmast with spectral green light threading through the "
                f"rigging. Right: the high carved stern gallery, a low dark cabin door beneath it, "
                f"and the great iron lantern on its stern post, a swollen green flame inside "
                f"cloudy glass with a sickly emerald halo, spectral green light washing the wet "
                f"deck. One continuous, completely empty and unobstructed walkable deck band of "
                f"wet silver-grey planks spans the entire lower third from the left edge to the "
                f"right edge; no figures, crates, barrels, coiled ropes, fallen spars, posts or "
                f"debris anywhere in that lane. Cold moonlit silver-blue-green palette, deep "
                f"black-green shadows, sickly emerald glow, pale grey fog, a single faint warm "
                f"ember far aft. Eerie and lonely but not gory. Hand-painted digital illustration, "
                f"cinematic point-and-click adventure game art, visible oil-painted brushwork, rich "
                f"atmospheric volumetric lighting, strong colour grading, ultra-wide panoramic "
                f"composition, no text, no UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/grey_lantern_deck_wide.webp"),

    ("bg_arcadia_cabin_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-on close-up of the stern cabin of the Grey Lantern, the ancient "
                f"ghost ship: Captain Mordant's cabin, still dry after eighty years, lit by cold "
                f"blue-green fog light. A low camera inside the cabin looks along it toward the "
                f"stern, the timber bulkheads painted a faded blue-green and gone silver with "
                f"salt, a low deck beam overhead. Left: a built-in bunk with a pale pillow and a "
                f"dark folded blanket, a small sea chest beneath, a shelf of salt-stained books. "
                f"Centre-left: beneath a square opening in the deck beams, a steep wooden "
                f"companionway ladder climbs from the floor, its foot resting on the planks, the "
                f"way up to the deck. Centre: the captain's desk, its top crowded with unrolled sea "
                f"charts, a brass divider, a dry inkpot and quill and a leather log book, a small "
                f"blank brass nameplate lying on the desk, a wooden chair pushed aside. Right: "
                f"three stern windows with torn "
                f"grey curtains, the carved stern gallery, and a green ship's lantern hanging from "
                f"the beam, its green glass glowing faintly. Clear, empty plank floor across the "
                f"lower third from the left edge to the right edge, unobstructed except for the "
                f"foot of the ladder; no figures, no furniture, no debris in that lane. Cold "
                f"blue-green palette, desaturated teal "
                f"shadows, pale fog light through the windows, a faint green lantern glow, worn "
                f"dark timber. Hand-painted digital illustration, cinematic point-and-click "
                f"adventure game art, visible oil-painted brushwork, rich atmospheric volumetric "
                f"lighting, strong colour grading, ultra-wide panoramic composition, no text, no "
                f"UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/arcadia_cabin_wide.webp"),

    # ---------------- backgrounds (scene art, no characters) ----------------
    ("bg_dock", "image", BG_MODEL,
     {"prompt": f"Night harbour of a Caribbean trading island seen from a wooden pier. A tall "
                f"galleon with rigging and warm lanterns is moored at left. Low stone warehouses "
                f"with glowing amber windows line the waterfront, mist drifting over deep indigo "
                f"water, wet planks shining in the foreground. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/dock.webp"),

    ("bg_office", "image", BG_MODEL,
     {"prompt": f"Interior of a harbour customs office at night. A heavy wooden desk covered with "
                f"ledgers, rolled charts and a brass oil lamp, shelves stacked with crates and "
                f"nautical instruments, a tall arched window showing the moonlit harbour beyond, "
                f"warm amber lamplight against deep blue shadow. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/office.webp"),

    ("bg_tavern", "image", BG_MODEL,
     {"prompt": f"Interior of a crowded dockside tavern at night, seen from the doorway. A long "
                f"polished wooden bar on the right, rows of bottles, hanging lanterns casting warm "
                f"amber pools of light, fishing nets and ship wheels on the walls, heavy beams, "
                f"barrels and empty tables with pewter mugs, smoke in the air. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/tavern.webp"),

    # ---------------- characters ----------------
    ("char_elias", "image", BG_MODEL,
     {"prompt": "Full body figure of a young harbour clerk in his early twenties, short dark curly "
                "hair, navy blue long coat with brass buttons over a white shirt with rolled "
                "sleeves, brown leather boots, a satchel at his hip, standing, side three-quarter "
                "view, painted adventure game character, flat solid magenta background (#FF00FF), "
                "no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/elias.png"),

    ("char_walk", "image", BG_MODEL,
     {"prompt": "Sprite sheet of a walking animation, exactly six frames in one horizontal row, "
                "evenly spaced and identical in size, side view facing right. The character is a "
                "young man in a navy blue long coat, white shirt and brown boots, mid-stride walk "
                "cycle from contact pose through passing pose and back. Flat solid magenta "
                "background (#FF00FF), no shadows, no ground, no labels, no text, pixel-clean "
                "edges, game sprite reference",
      "resolution": "2848x1600 (16:9)", "output_format": "png"}, "characters/elias_walk.png"),

    ("npc_harbourmaster", "image", BG_MODEL,
     {"prompt": "Painted character portrait, head and shoulders, of an old weathered harbourmaster, "
                "sixties, thick grey beard, battered tricorn hat, heavy dark green coat with a brass "
                "compass on a chain, sharp sceptical eyes, warm rim light on one side, deep shadow on "
                "the other, painterly adventure game dialogue portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/harbourmaster.png"),

    ("npc_tavernkeep", "image", BG_MODEL,
     painted_portrait("Marta, a handsome and warm woman in her fifties who keeps the Salty Keel "
                      "tavern: strong broad shoulders and strong forearms, silver-streaked auburn "
                      "hair tied back in a ponytail under a red kerchief, a practical dark "
                      "collarless shirt with the sleeves rolled to the elbow, a worn olive canvas "
                      "apron over it, one forearm bare and showing a thin old scar, arms crossed in "
                      "an easy relaxed stance, a knowing and kind half-smile, warm amber lamplight "
                      "from the left, fully dressed and modest, no sexualisation, no cleavage"),
     "characters/tavernkeep.png"),

    # ---------------- props & on-screen figures ----------------
    ("prop_crate", "image", BG_MODEL,
     {"prompt": "A single sturdy wooden shipping crate of rum bottles, nailed shut, weathered "
                "grey planks with iron corner straps, a few straw-packed dark glass bottle necks "
                "just visible between the top slats, the words HELD FOR CUSTOMS INSPECTION "
                "stencilled across the front in faded black block capitals, a red wax customs "
                "seal on the lid, matte, oil-painted digital illustration with visible "
                "brushwork, not a 3D render, no gloss, three-quarter view, soft side lighting, "
                "flat solid magenta background (#FF00FF), no shadow, no ground, no other text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/crate.png"),

    ("prop_invoices", "image", BG_MODEL,
     {"prompt": "A single iron invoice spike with a thick stack of old paper invoices impaled on "
                "it, the top sheet curled and faintly stained, a faded red harbour stamp and brown "
                "ink strokes on the pages, no legible words, painted adventure game prop, warm "
                "lamplight from the left, three-quarter view, the object isolated and floating, "
                "the ENTIRE background flat solid magenta (#FF00FF) including underneath it, "
                "no table, no counter, no surface, no shadow, no ground, no other text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/invoices.png"),

    ("prop_crowbar", "image", BG_MODEL,
     {"prompt": "A single old iron crowbar leaning at a slight angle, worn red paint, painted "
                "adventure game prop, dramatic side lighting, flat solid magenta background "
                "(#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/crowbar.png"),

    ("npc_bramwick_body", "image", BG_MODEL,
     {"prompt": "Full body figure of an old weathered harbourmaster, sixties, thick grey beard, "
                "battered tricorn hat, long dark green coat with brass buttons, a brass compass on "
                "a chain, standing with hands clasped behind his back, side three-quarter view, "
                "painted adventure game character, flat solid magenta background (#FF00FF), "
                "no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/bramwick_body.png"),

    ("npc_marta_body", "image", BG_MODEL,
     {"prompt": "Full body figure of a broad cheerful tavern keeper, fifties, red kerchief, rolled "
                "sleeves, apron, arms crossed, confident stance, side three-quarter view, painted "
                "adventure game character, flat solid magenta background (#FF00FF), no shadow, "
                "no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/marta_body.png"),

    # ---------------- movement-first wide scenes and matching figures ----------------
    ("bg_dock_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of a night harbour in Port Vela. "
                f"A tall moored galleon at the far left, a welcoming tavern door in the middle distance, "
                f"and a customs house door at the far right. One continuous, completely unobstructed "
                f"wooden pier walking lane spans the entire lower third from left to right. No people, "
                f"no furniture, crates, ropes, or posts in that walking lane. Clear side-view perspective, "
                f"wet planks, indigo water, warm lanterns, essential scenery kept in the central vertical "
                f"band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/dock_wide.webp"),

    ("bg_office_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background inside a harbour customs office "
                f"at night. An open entrance door at the far left, a broad desk with a locked drawer and "
                f"paper forms at the right, shelves and an arched moonlit window along the back wall. "
                f"One continuous empty wooden floor walking corridor spans the entire lower third; no "
                f"people, chairs, rugs, boxes, or furniture in that corridor. Clear side-view perspective, "
                f"warm lamplight and deep blue shadow, essential scenery in the central vertical band. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/office_wide.webp"),

    ("bg_tavern_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background inside a dockside tavern at night. "
                f"Entrance door at the far left, a long polished bar along the right back wall, an empty "
                f"staff standing area behind the bar, patrons only seated at distant rear tables. One "
                f"continuous completely empty floor walking aisle spans the lower third from entrance to "
                f"bar; no people, stools, tables, barrels, or mugs in that aisle. Hanging lanterns, warm "
                f"amber light, fishing nets, clear side-view perspective, essential scenery kept in the "
                f"central vertical band. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/tavern_wide.webp"),

    # ---------------- the harbour's rooms, as close-ups of the harbour area view ----------------
    # The area view (bg_area_harbour) is the visual anchor now: these three plates must read as
    # side-on close-ups of the same fog-bound timber quay, not neighbouring buildings. Same
    # architecture (jettied timber, steep slate gables, small warm mullioned windows, iron wall
    # lanterns, green counting-house lamp), same palette (indigo water, cold blue fog, warm amber
    # windows) and same painterly brushwork. Each keeps an empty lower-third walking band.
    ("bg_dock_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: a side-on close-up of the "
                f"harbour quay in front of the harbourmaster's house, the same fog-bound northern "
                f"harbour as the wide night harbour establishing view. At the left the dark wooden "
                f"bow, bulwark and rigging of the moored two-masted ship the Marrow, her hull "
                f"doubled in black indigo water; at the centre the tall timber harbourmaster's "
                f"house, steep slate gables, a jettied upper storey, rows of small warm-lit "
                f"mullioned windows, a plank door under a painted board, an iron wall lantern "
                f"burning amber beside it; at the right a dark timber counting house with a green "
                f"lamp, a hanging tavern sign and a tall dock lamp post. Wet stone-and-timber quay, "
                f"wet planks, mooring posts, a few crates and barrels stacked against the walls, "
                f"cold blue fog rolling between the rooflines, warm amber reflections in the "
                f"puddles and boards. No people. One continuous, completely empty walkable quay "
                f"band across the lower third, with no crates, barrels, posts or ropes in it. Deep "
                f"indigo and cold blue with warm amber windows and lanterns, matching the harbour "
                f"establishing view. Essential architecture kept in the central horizontal band "
                f"for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/dock_close_wide.webp"),

    # The dock's readable close-up: dock_close_wide's three-quarter camera put the way out
    # off-frame and its shadows buried the path, so that plate is replaced rather than
    # re-graded. This one is strict side-on, lit like a starting room, and carries the whole
    # walk from the Marrow's bow at the left to the signpost and steps at the far right.
    ("bg_dock_v2_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide strict side-on side-scrolling view of the harbour quay; the Marrow's "
                f"dark bow and rigging at the left; the tall jettied timber harbourmaster's house "
                f"with warm mullioned windows and a lit plank door at the centre; the counting "
                f"house with a green lamp at the right; a clear continuous wet-board-and-stone "
                f"path across the lower third from the left edge to the right edge, continuing "
                f"past the counting house to a painted signpost and a short flight of stone steps "
                f"at the far right leading up toward the harbour mouth; a warm lamp post beside "
                f"the signpost; crates/barrels against the walls, not in the path; cold blue fog, "
                f"warm amber reflections; bright enough to read as a starting room; no people, no "
                f"text, no lettering, no UI. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/dock_quay_wide.webp"),

    ("bg_tavern_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: an interior close-up of the "
                f"Salty Keel, the dockside tavern on the same fog-bound harbour quay. Dark oak "
                f"posts and beams, plank walls, a low smoke-blackened ceiling; a long polished bar "
                f"counter along the right with rows of bottles on shelves, pewter tankards and a "
                f"brass hand-bell; wrought-iron lanterns hanging from the beams casting warm amber "
                f"pools; fishing nets, glass floats and coiled rope; a heavy plank door with iron "
                f"hinges at the far left standing ajar onto cold blue night and fog, a small-paned "
                f"window beside it showing indigo harbour water; barrels and a long bench table "
                f"against the rear wall; deep blue shadow in the corners against the amber light. "
                f"No people. One continuous clear plank floor walking lane across the lower third "
                f"from the door to the bar, with no stools, tables, barrels or mugs in it. Warm "
                f"amber, dark timber and deep cold blue, matching the harbour establishing view. "
                f"Essential scenery kept in the central horizontal band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/tavern_close_wide.webp"),

    ("bg_office_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background: an interior close-up of the "
                f"harbourmaster's house on the fog-bound harbour quay, the same dark timber "
                f"architecture as the harbour outside. A heavy oak desk at the right with a brass "
                f"oil lamp burning warm amber, a locked drawer with a brass keyhole, ledgers and "
                f"rolled charts; tall shelves along the back wall crowded with ledgers, wooden "
                f"boxes and brass nautical instruments; a tall small-paned window left of centre "
                f"with the full moon over the harbour, ship masts and a faint green lamp beyond it; "
                f"a plank door at the far left standing open to cold blue fog and the wet quay; "
                f"beamed ceiling, panelled walls, broad worn plank floor. Deep indigo moonlight and "
                f"cold blue shadow against the warm pool of the desk lamp. No people. One "
                f"continuous clear floor walking lane across the lower third, with no chairs, rugs, "
                f"boxes or furniture in it. Deep blue night, dark timber and warm amber lamplight, "
                f"matching the harbour establishing view. Essential architecture kept in the "
                f"central horizontal band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/office_close_wide.webp"),

    # The harbour's back lanes and outbuildings, brought up to the same close-up standard as
    # dock_close_wide / tavern_close_wide / office_close_wide. Same fog-bound timber quay, same
    # palette (indigo, cold blue fog, warm amber windows, green counting-house lamp), same
    # painterly hand and the same empty lower-third walking band as the three hero plates.
    ("bg_alley_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide strict side-on side-scrolling adventure game background: Wreckers' "
                f"Lane, the narrow shadowed cobbled slot between the harbourmaster's timber house "
                f"and the counting house on the fog-bound northern harbour quay, painted as a "
                f"close-up of the harbour establishing view. At the far left the lane opens back "
                f"onto the quay: the corner of a dark jettied timber house, a glimpse of indigo "
                f"harbour water and cold blue fog, and a warm iron wall lantern. Along the "
                f"left-centre the boat shed's tall black plank doors, one leaf standing ajar on a "
                f"thin blade of cold fog light, a stack of crates and barrels against the wall. At "
                f"the centre the counting house frontage of dark tarred boards, a solid plank door "
                f"under a small glowing green glass lamp in an iron bracket, green light spilling "
                f"onto the wet cobbles. At the right the shipwright's chandlery frontage, a broad "
                f"small-paned shop window burning warm amber, coils of rope, oars and lanterns "
                f"silhouetted inside, a painted plank door with a brass handle. Iron lanterns strung "
                f"above the lane cast warm pools. Wet cobbles with amber and green reflections, "
                f"cold blue fog gathering at both ends, deep indigo shadow overhead. No people, no "
                f"text, no lettering. One continuous, completely empty wet-cobble walk band across "
                f"the lower third from the left edge to the right edge, with no crates, barrels, "
                f"posts or puddles standing in it. Essential architecture kept in the central "
                f"horizontal band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/alley_close_wide.webp"),

    ("bg_chandlery_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide strict side-on side-scrolling adventure game background: the interior "
                f"of the shipwright's chandlery on the fog-bound harbour quay at night, painted as "
                f"a close-up of the harbour establishing view, in the same dark timber architecture "
                f"and the same warm-lamp and cold-blue key as the harbour's other interiors. At the "
                f"far left a plank lane door stands open onto cold blue fog and the wet quay, a "
                f"small window beside it. Along the back wall tall shelves crowded with coils of "
                f"tarred rope, blocks and tackle, oars, bolts of canvas, iron lanterns, barrels of "
                f"pitch, jars and ship's fittings. Across the centre a long worn wooden counter "
                f"holds a brass scale, a lit ship's lantern, small brass weights and a hundred "
                f"small things ships need. At the right the Marrow's bare "
                f"mast leans against the back wall with an iron band, beside wrapped bolts of "
                f"sailcloth. A warm oil lamp burns over the counter; cold blue night shows through "
                f"the door and the small window. Broad worn plank floor with sawdust and rope ends. "
                f"Deep indigo shadow and dark timber against warm amber lamplight. No people, no "
                f"text, no lettering. One continuous, completely empty plank floor walking lane "
                f"across the lower third, with no barrels, crates, rope coils or furniture in it. "
                f"Essential scenery kept in the central horizontal band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/chandlery_close_wide.webp"),

    ("bg_countinghouse_close_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide strict side-on side-scrolling adventure game background: the interior "
                f"of Vex's counting house on the fog-bound harbour quay at night, painted as a "
                f"close-up of the harbour establishing view, in the same dark wood and cold-blue "
                f"and warm-amber key. A panelled wall of dark polished mahogany. At the far left a "
                f"tall plank door stands open on a thin seam of cold blue night; directly above the "
                f"door, mounted high on the panelled wall where it is clearly visible, a large "
                f"ornate polished brass cloud emblem in raised relief catches the lamplight. In the "
                f"centre the back wall is a great grid "
                f"of plain wooden pigeonholes packed with rolled charts and ledgers, and below it a "
                f"row of tall clerks' standing desks with brass scales, inkwells and neat stacks of "
                f"ledgers. At the right a squat black iron safe with a brass dial. On the back wall "
                f"a large gilt-framed oil portrait of a smug gentleman in a tall black hat and a "
                f"thin moustache. Three green-glass shaded brass desk lamps burn with warm pools "
                f"over the desks, their green shades and green glow matching the green "
                f"counting-house lamp outside; cold blue moonlight falls through tall shuttered "
                f"windows. Dark wood, green pools, deep indigo shadow. No people, no text, no "
                f"lettering anywhere. One continuous, completely empty polished parquet floor walk "
                f"band across the lower third, with no desks, stools or rugs in it. Essential "
                f"scenery kept in the central horizontal band for an ultra-wide crop. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/countinghouse_close_wide.webp"),

    ("char_walk_v2", "image", BG_MODEL,
     {"prompt": "Sprite sheet of a walking animation, exactly six frames in one horizontal row, evenly "
                "spaced and identical in size, strict side view facing right. A young harbour clerk with "
                "short dark curly hair, navy long coat with brass buttons, white shirt, brown boots and "
                "leather satchel. Full body visible in every frame, consistent proportions and costume, "
                "mid-stride cycle. Flat solid magenta background (#FF00FF), no shadows, no ground, no "
                "labels, no text, game sprite reference",
      "resolution": BG_RES, "output_format": "png"}, "characters/elias_walk_v2.png"),

    ("char_walk_vertical", "image", BG_MODEL,
     {"prompt": "Sprite sheet of walking animation, exactly six frames in one horizontal row, evenly "
                "spaced and identical in size. First three frames show the same young harbour clerk from "
                "directly behind walking away; last three frames show him from directly in front walking "
                "toward the viewer. Short dark curly hair, navy long coat with brass buttons, white shirt, "
                "brown boots and leather satchel. Full body visible, consistent proportions and costume. "
                "Flat solid magenta background (#FF00FF), no shadows, no ground, no labels, no text",
      "resolution": BG_RES, "output_format": "png"}, "characters/elias_walk_vertical.png"),

    # ---------------- Fenn's painted repaint (the player figure, always in front of the plates) --
    ("char_elias_painted", "image", BG_MODEL,
     {"prompt": f"Full body standing figure of {FENN}. Relaxed idle stance, arms hanging "
                f"naturally, weight on one leg, side three-quarter view facing right, the whole "
                f"figure from hair to boots inside the frame with a little room above the hair "
                f"and below the boots, painted adventure game character sprite. Flat solid "
                f"magenta background (#FF00FF) filling the entire canvas including under and "
                f"around him, no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/elias_painted.png"),

    # The idle is the pose the player sees standing still, and the one place where the feet
    # must be beyond argument: the walk cells paint both soles flush and crisp, but the first
    # idle study let the boot leather dissolve into the magenta, so the keyer trimmed to a
    # ghost of a sole and the figure read as hovering. This prompt says the quiet part out
    # loud, and post_painted_idle trims it on a matte with no faint shadow below the feet.
    ("char_elias_painted_v2", "image", BG_MODEL,
     {"prompt": f"Full body oil study of {FENN}, standing still in a relaxed idle, side "
                f"three-quarter view facing right, arms hanging naturally. Loose loaded "
                f"brushstrokes, scumbled painterly edges, warm amber lamplight from the left "
                f"and a cold blue rim light along his right edges, deep warm shadow, muted "
                f"earthy navy and brown, semi-realistic anatomy with a real body's weight. "
                f"Both brown leather boots are painted solid and completely opaque, with their "
                f"dark leather soles and heels clearly shown; his feet are planted side by side "
                f"on one level line, neither boot lower than the other, and the boots do not "
                f"fade or turn transparent at the feet. The whole figure from hair to soles is "
                f"inside the frame with a clear margin of flat magenta below the boots. Flat "
                f"solid magenta background (#FF00FF), no shadow, no ground, no floor, no other "
                f"props, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/elias_painted_v2.png"),

    ("char_walk_v2_painted", "image", BG_MODEL,
     {"prompt": f"Sprite sheet of one walking animation, exactly six frames in a single "
                f"horizontal row, evenly spaced with a clear gap of magenta between the frames, "
                f"all six frames identical in size and standing on one shared floor line. Strict "
                f"side view, the character facing right. Every frame is the same person: {FENN}. "
                f"A complete six-pose walk cycle from left-foot contact through the passing pose "
                f"to right-foot contact and back, arms swinging naturally with the stride. Full "
                f"body visible in every frame from hair to boots, both feet inside the frame. "
                f"Flat solid magenta background (#FF00FF) filling the entire canvas, no shadows, "
                f"no ground, no labels, no text, no borders, no frames",
      "resolution": BG_RES, "output_format": "png"}, "characters/elias_walk_v2_painted.png"),

    ("char_walk_vertical_painted", "image", BG_MODEL,
     {"prompt": f"Sprite sheet of one walking animation, exactly six frames in a single "
                f"horizontal row, evenly spaced with a clear gap of magenta between the frames, "
                f"all six frames identical in size and standing on one shared floor line. The "
                f"first three frames show the same character from directly behind walking away "
                f"from the viewer; the last three frames show him from directly in front walking "
                f"toward the viewer. Every frame is the same person: {FENN}, with the satchel "
                f"strap crossing his back in the rear views and his chest in the front views. "
                f"Full body visible in every frame from hair to boots, both feet inside the "
                f"frame. Flat solid magenta background (#FF00FF) filling the entire canvas, no "
                f"shadows, no ground, no labels, no text, no borders, no frames",
      "resolution": BG_RES, "output_format": "png"}, "characters/elias_walk_vertical_painted.png"),

    ("npc_bramwick_body_v2", "image", BG_MODEL,
     {"prompt": "Full body figure of an old weathered harbourmaster, sixties, thick grey beard, battered "
                "tricorn hat, long dark green coat with brass buttons and a brass compass on a chain, "
                "standing with hands clasped behind his back, side three-quarter view. Warm lamplight from "
                "the left, flat solid magenta background (#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/bramwick_body_v2.png"),

    ("npc_marta_body_v2", "image", BG_MODEL,
     body("marta", "standing with her arms crossed, confident stance, side three-quarter view, warm lantern light from the left"), "characters/marta_body_v2.png"),

    # ---------------- act II: the voyage ----------------
    ("bg_deck_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of a pirate brig's main deck "
                f"at dawn, seen from the waist. Two masts with rigging and furled sails, coiled "
                f"ropes and lashed crates along the rail, the sea and a pale gold horizon beyond "
                f"the bulwarks, wet planks catching the first light, a hatch and a companionway. "
                f"Leave the lower third as clear walkable deck. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/deck_wide.webp"),

    ("bg_crowsnest_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background, seen from high in the "
                "rigging of a pirate brig: the view from the crow's nest. In the foreground a "
                "small square wooden platform of weathered planks with a stout timber rail along "
                "its outer edge and a lashed stack of crates at one end; the thick mainmast rises "
                "at the right with tarred shrouds and ratlines running up into the pale sky, "
                "halyards and blocks hanging still. Beyond the rail the ship's deck lies far "
                "below, small and steeply angled, its pale planks, rails and capstan dwarfed by "
                "the drop; then a vast cold fog sea and a grey horizon under an overcast sky. "
                "No people. The camera looks steeply down from high above the deck: the platform "
                "is close in the foreground and the sea is far below. One continuous, completely "
                "empty and unobstructed walkable platform band spans the lower quarter of the "
                "picture; no figures, crates, barrels, ropes or debris in that lane. Cold "
                "blue-grey palette, damp weathered wood, thin drifting mist, one faint pale light "
                "on the horizon. Hand-painted digital illustration, cinematic point-and-click "
                "adventure game art, visible oil-painted brushwork, rich atmospheric volumetric "
                "light, detailed rigging, strong colour grading, ultra-wide panoramic "
                "composition, no text, no UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/crowsnest_wide.webp"),

    # The crow's nest as the room plate proper: a genuinely high view straight down onto the
    # Marrow, with the platform and its rail close enough to stand on and a lashed stack of
    # Vex's crates at the left end for the crates hotspot to sit on.
    ("bg_crowsnest_high_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background painted from the crow's nest "
                "of a two-masted pirate brig in cold fog at dawn: a steep bird's-eye view almost "
                "straight down onto the ship's own deck, the drop dizzying. In the foreground the "
                "crow's nest itself: a square platform of weathered salt-bleached planks fills the "
                "bottom quarter of the frame, one continuous, completely empty, unobstructed "
                "walkable band from the left edge to the right edge, no figures, crates, barrels, "
                "ropes or debris standing in it. A stout tarred timber rail with heavy posts runs "
                "along the platform's outer edge, and beyond the rail the platform drops away into "
                "empty air and thin fog. At the far left end of the platform, behind the walking "
                "band and against the rail, a lashed stack of wooden crates bound with new rope "
                "and a coil of line. The thick foremast rises at the centre with tarred shrouds "
                "and ratlines, halyards and blocks hanging still. Directly below the platform, "
                "seen from high above and steeply foreshortened, the ship's own deck: small, "
                "distant, its pale planks, capstan, two masts and tattered grey sails dwarfed by "
                "the height, the deck pointing down and away from the viewer. Around it a vast "
                "cold fog sea, grey water and a grey horizon under an overcast sky. The camera "
                "looks steeply down from high above: the platform is close in the foreground, the "
                "ship and the sea are far below. The empty platform band is the clearest, most "
                "readable part of the painting. Cold blue-grey palette, damp weathered wood, thin "
                "drifting mist, one faint pale light on the horizon. No people, no figures, no "
                "second ship alongside. Hand-painted digital illustration, cinematic "
                "point-and-click adventure game art, visible oil-painted brushwork, rich "
                "atmospheric volumetric light, detailed rigging, strong colour grading, "
                "ultra-wide panoramic composition, no text, no UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/crowsnest_high_wide.webp"),

    ("bg_quarterdeck_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of a pirate brig's "
                f"quarterdeck at dawn. A large spoked ship's wheel on a raised platform, a brass "
                f"binnacle and compass housing, the mizzen mast, stern lanterns still lit, the "
                f"wake and open sea behind the rail, gold dawn light against deep blue shadow. "
                f"Leave the lower third as clear walkable deck. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/quarterdeck_wide.webp"),

    ("bg_cabin_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of a pirate captain's cabin "
                f"at dawn. A chart table strewn with sea charts and dividers, a hanging oil lamp, "
                f"a bunk with a curtain, brass instruments on shelves, stern windows showing the "
                f"wake and a pale sky, dark carved wood. Leave the lower third as clear plank "
                f"floor. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/cabin_wide.webp"),

    ("npc_quill_body", "image", BG_MODEL,
     body("quill", "standing at ease with a long brass spyglass tucked under one arm, side three-quarter view"), "characters/quill_body.png"),

    ("npc_vane_body", "image", BG_MODEL,
     {"prompt": "Full body figure of a weathered pirate captain, a woman in her fifties, long "
                "dark coat with tarnished braid, tricorn hat, grey-streaked hair tied back, a "
                "cutlass at her hip, standing with authority, side three-quarter view, painted "
                "adventure game character, flat solid magenta background (#FF00FF), no shadow, "
                "no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/vane_body.png"),

    ("npc_quill", "image", BG_MODEL,
     painted_portrait("Quill, the Marrow's navigator, a striking and confident young sailor woman "
                      "of twenty-two: short dark windblown hair, a knotted red bandana, a "
                      "navy-and-white striped sailor's shirt, collar open at the throat and buttoned "
                      "high beneath, sleeves rolled to the elbow, a plain rope belt, a small brass "
                      "compass on a cord round her neck, a sharp half-smile, sun-browned skin, "
                      "bright intelligent eyes, warm sunset light from one side and cool blue sea "
                      "light from the other, attractive and charismatic, fully dressed, modest with "
                      "no cleavage, no pin-up pose, no nudity"),
     "characters/quill.png"),

    ("npc_vane", "image", BG_MODEL,
     painted_portrait("a weathered pirate captain, a woman in her fifties with a lean, hard face, "
                      "a battered black tricorn hat, long grey-streaked hair tied back, a single "
                      "thin pale old scar running straight down through her left eyebrow, a black "
                      "captain's coat with tarnished gold braid on its high collar, a level, "
                      "unimpressed gaze"), "characters/vane.png"),

    ("prop_spyglass", "image", BG_MODEL,
     {"prompt": "A single brass spyglass, worn and dented, lying at a slight angle on nothing, "
                "painted adventure game prop, dramatic side lighting, flat solid magenta "
                "background (#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/spyglass.png"),

    # Act III: the boat that carried the crew off the Marrow and out to the reef gate.
    ("prop_longboat", "image", BG_MODEL,
     {"prompt": "A single small wooden ship's boat, a ship's longboat, seen from the side and "
                "slightly above, the whole boat in frame from stern to bow, empty. Clinker-built "
                "hull of weathered grey-brown planks, faded slate-blue paint and a thin rust-red "
                "stripe along the gunwale, a squared transom, a small iron ring in the bow, three "
                "pairs of oars shipped neatly along the thwarts, a coil of tarred rope in the "
                "stern sheets, no mast, no sail, no people. Painted adventure game prop, matte "
                "oil-painted digital illustration with visible brushwork, cold damp overcast "
                "light, detailed but a clear silhouette. The ENTIRE background is flat solid "
                "magenta (#FF00FF), including underneath and all around the boat; no shadow, no "
                "ground, no water, no sand, no text",
      "resolution": "2848x1600 (16:9)", "output_format": "png"}, "props/longboat.png"),

    # ---------------- act I: the wider harbour ----------------
    ("bg_alley_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed flat side-on at eye "
                f"level: a narrow cobbled lane running left to right across the whole frame. A "
                f"continuous wall of tall narrow house fronts with shuttered windows along the "
                f"back, a chandler's shopfront with a hanging anchor sign at the right, stacked "
                f"crates and a bolted wooden loft shutter with external stairs at the left, "
                f"hanging lanterns strung above the lane, wet cobbles along the bottom third. "
                f"No vanishing point, no archway, no tunnel, no centred perspective. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/alley_wide.webp"),

    ("bg_chandlery_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of the interior of a ship's "
                f"chandler at night. Shelves of coiled rope, blocks and tackle, iron lanterns, "
                f"barrels of pitch, bolts of canvas, a long wooden counter with a brass scale, one "
                f"warm lamp. Leave the lower third as clear plank floor. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/chandlery_wide.webp"),

    ("bg_warehouse_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of a harbour warehouse loft "
                f"at night. Stacked shipping crates and barrels, a dusty desk with heavy ledgers "
                f"and a guttering candle, moonbeams through slatted roof boards, ropes and a hoist, "
                f"cobwebs. Leave the lower third as clear floorboards. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/warehouse_wide.webp"),


    ("npc_silas_body", "image", BG_MODEL,
     {"prompt": "Full body figure of a sleek shipping factor in his forties, cutaway coat of good "
                "cloth, tall hat, gloves, a ledger under one arm, standing with the easy confidence "
                "of a man who owns the room, side three-quarter view, painted adventure game "
                "character, flat solid magenta background (#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/silas_body.png"),

    ("npc_rook_body", "image", BG_MODEL,
     body("rook", "sitting hunched on a low wooden stool at a small round wooden tavern table, one hand around a pewter mug on the table, the whole table, stool and his boots visible on the floor, side three-quarter view"), "characters/rook_body.png"),

    ("npc_silas", "image", BG_MODEL,
     portrait("silas"), "characters/silas.png"),

    ("npc_rook", "image", BG_MODEL,
     painted_portrait(f"{CAST['rook']}, a wry, weary half-smile, warm lamp light from one side"),
     "characters/rook.png"),

    # ---------------- act II, expanded ----------------
    ("bg_below_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of the below-decks of a "
                f"pirate brig at dawn, seen side-on. Low heavy beams; hammocks slung in the "
                f"forecastle at the left; a battered wooden sea-chest with iron bands standing on "
                f"the floor at the left; a long mess table with benches in the middle; a cramped "
                f"galley at the right with an iron stove, a huge steaming stew pot on it and a "
                f"large brass gong hanging from a beam; a ladder up to a hatch; warm lantern light "
                f"and pale dawn light through a deck grating. No people. Leave the lower third as "
                f"clear plank floor. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/below_wide.webp"),

    ("bg_bow_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of the bow of a pirate brig "
                f"in thick white fog at dawn, seen side-on. The deck runs toward the bowsprit at "
                f"the right edge, with a carved wooden figurehead; a bow lantern glowing in the "
                f"fog; the foremast shrouds and coils of rope; dark jagged reef rocks barely "
                f"visible through the fog beyond the rail. No people. Leave the lower third as "
                f"clear walkable deck. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/bow_wide.webp"),

    ("npc_dorrit", "image", BG_MODEL, portrait("dorrit"), "characters/dorrit.png"),
    ("npc_dorrit_body", "image", BG_MODEL,
     body("dorrit", "standing, holding a ladle, side three-quarter view"), "characters/dorrit_body.png"),
    ("npc_hobb", "image", BG_MODEL, portrait("hobb"), "characters/hobb.png"),
    ("npc_hobb_body", "image", BG_MODEL,
     body("hobb", "standing with his arms folded, side three-quarter view"), "characters/hobb_body.png"),

    # The stern gallery at sunset: an optional vista off the captain's cabin, no puzzle.
    ("bg_gallery_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: the captain's stern gallery of a pirate brig at sunset, an open-air "
                f"wooden balcony built across the carved stern of the ship, looking out astern "
                f"over the sea. At the far left, the tall glazed double doors of the captain's "
                f"cabin stand open, warm lamplight spilling out across the boards. A low carved "
                f"wooden balustrade with turned balusters runs the whole width of the frame at "
                f"waist height, and beyond it: the ship's long white wake trailing away to the "
                f"horizon, a huge low golden sun sinking into banks of rose and amber cloud and "
                f"laying a molten path across the water, distant blue islands in silhouette, a "
                f"few gulls wheeling, flying fish skimming the swell. At the far right the "
                f"gallery ends at a carved, gilded quarter-gallery corner with a brass lantern on "
                f"a bracket, and a small round wooden table holding a dark rum bottle and two "
                f"small glasses. Golden-hour light, warm highlights along the rail and the "
                f"planks, deep violet-blue shadow in the sea. No people. Leave the lower third "
                f"as a clear, empty walkway of warm wooden deck planks running the full width "
                f"of the frame. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/gallery_wide.webp"),

    ("npc_vane_rum", "image", BG_MODEL,
     {"prompt": "Full body figure of a weathered pirate captain, a woman in her fifties, long "
                "dark coat with tarnished braid, tricorn hat, grey-streaked hair tied back, a "
                "cutlass at her hip, standing at ease with a small glass of dark rum held loosely "
                "in one hand at her waist, looking off into the distance, side three-quarter "
                "view, painted adventure game character, flat solid magenta background "
                "(#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/vane_rum.png"),

    # ---------------- act I: upper town (exploration only) ----------------
    ("bg_village_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed flat side-on at eye "
                f"level: a small harbour village square at night running left to right across the "
                f"whole frame. Whitewashed and stone cottages with shutters and warm lit windows, a "
                f"low stone well with a bucket, wooden market stalls under striped awnings, a small "
                f"shrine niche with candles, washing lines strung between houses, potted plants, "
                f"barrels and crates, worn cobbles along the bottom third, lanterns against deep "
                f"blue night. No vanishing point, no centred perspective, no archway. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/village_wide.webp"),

    ("npc_nell_body", "image", BG_MODEL,
     {"prompt": "Full body figure of a village market seller, a woman in her fifties with a headscarf "
                "and a heavy apron, sleeves rolled, hands on her hips, standing behind nothing, side "
                "three-quarter view, painted adventure game character, flat solid magenta background "
                "(#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/nell_body.png"),

    ("npc_tam_body", "image", BG_MODEL,
     {"prompt": "Full body figure of a village child about ten years old, barefoot, patched breeches, "
                "an oversized coat and a flat cap, hands in pockets, side three-quarter view, painted "
                "adventure game character, flat solid magenta background (#FF00FF), no shadow, no "
                "ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/tam_body.png"),

    ("npc_onn_body", "image", BG_MODEL,
     {"prompt": "Full body figure of an old village woman in her seventies, grey hair under a shawl, "
                "long dark skirt, holding a besom broom, standing, side three-quarter view, painted "
                "adventure game character, flat solid magenta background (#FF00FF), no shadow, no "
                "ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/onn_body.png"),

    ("npc_nell", "image", BG_MODEL,
     painted_portrait("a village market seller, a weather-beaten woman in her fifties, a tan "
                      "headscarf knotted tight over greying brown hair, large gold hoop earrings, "
                      "a faded scarf round her neck, a knowing half-smile, shrewd amused eyes, "
                      "warm lantern light from one side"), "characters/nell.png"),

    ("npc_tam", "image", BG_MODEL,
     painted_portrait("a village boy about ten years old, freckled, a wide gap-toothed grin with "
                      "one front tooth missing, tousled light brown hair under an oversized brown "
                      "flat cap pushed back, the turned-up collar of an oversized coat, bright "
                      "curious eyes, a lit lantern glowing behind one shoulder"),
     "characters/tam.png"),

    ("npc_onn", "image", BG_MODEL,
     painted_portrait("an old village woman in her seventies, a deep-lined weathered face, wisps "
                      "of grey hair under a dark shawl drawn over her head, a small iron cross on "
                      "a thin chain at her throat, wary narrowed eyes, a lit lantern glowing "
                      "behind one shoulder"), "characters/onn.png"),

    # ---------------- act III: tidy weather ----------------
    ("bg_reef_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: a wrecked two-masted brig lying heeled over on a coral reef in a glassy "
                f"turquoise lagoon at dawn. The wreck fills the right half, her deck tilted toward "
                f"us, a square wooden deck hatch boarded shut, a broken rail, both masts still up "
                f"with a bare masthead and a loose halyard rope hanging. On the left a small "
                f"wooden rowing boat pulled up on a pale coral sand flat, oars across it. A low "
                f"bank of white fog sits along the outer reef on the horizon; pink and gold dawn "
                f"sky. No people. Leave the lower third as clear walkable sand and coral flat. "
                f"{STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/reef_wide.webp"),

    ("bg_wreckcabin_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of the interior of a "
                f"shipwrecked captain's cabin, seen flat side-on, the room slightly tilted. Shafts "
                f"of morning sunlight through cracked stern windows and gaps in the planks. Along "
                f"the back wall, from left to right: a hammock; a wooden bucket standing by the "
                f"wall; a heavy writing desk pushed against the back wall with a fat leather "
                f"logbook and an inkwell on it, pigeonholes stuffed with papers above it, and a "
                f"small framed oil portrait of a smiling woman hanging crooked over it; a ladder "
                f"up to a hatch at the far right. Barnacles and seaweed on the lower walls. The "
                f"whole bottom third is bare empty floor planks with a few puddles and nothing "
                f"standing on them. No people. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/wreckcabin_wide.webp"),

    ("bg_ghostwreck_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed flat side-on at "
                f"eye level: the broken hull of an old two-masted sailing ship, a ghost-ship "
                f"wreck, lying heeled over and half-sunk in a vast grey tidal flat under thick "
                f"cold fog. Her hull fills the right two-thirds of the frame, her bow toward "
                f"the left, her deck tilted toward us, the bow rail broken away. Both masts "
                f"still stand, the foremast snapped short, with tattered grey canvas sails "
                f"hanging in strips from the yards. A faint spectral green glow clings to the "
                f"rigging and the mastheads, cold and unnatural. Several of her hull timbers "
                f"are rotted through or half-translucent where the ghost light shows through, "
                f"and her silhouette is subtly wrong and unnatural. She rests on wet grey "
                f"ribbed sand; shallow channels of pewter-coloured water wind around her hull "
                f"and out into the fog. Heavy cold grey fog fills the sky and hides the "
                f"horizon; there is no sun, no blue sky, no tropical turquoise water, no palm "
                f"trees, no greenery. A small wooden longboat is drawn up on the wet sand in "
                f"the left foreground, her oars shipped. Cold grey and pewter palette, the "
                f"only colour the sickly green glow in the rigging. No people, no figures "
                f"anywhere. Leave the lower third as a clear walkable band of wet grey sand "
                f"and shallow water running from the left edge to the right edge, nothing "
                f"standing on it. No text. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/ghostwreck_wide.webp"),

    ("bg_shore_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: the white sand beach of a low tropical island in bright morning light. "
                f"Calm turquoise lagoon water along the left with a small wooden rowing boat "
                f"pulled up on the sand; leaning palm trees and sea grape; far across the lagoon a "
                f"sleek grey single-masted cutter at anchor; at the right a sandy path rising "
                f"between dunes toward a distant wooden palisade with a yellow flag. No people. "
                f"Leave the lower third as clear walkable sand. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/shore_wide.webp"),

    ("bg_gate_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed flat side-on at "
                f"eye level: a tall sharpened-log palisade running across the whole frame on a "
                f"tropical island, a heavy double wooden gate in the middle barred shut, a bright "
                f"yellow quarantine flag on a pole above the gate. At the left a small wooden "
                f"sentry hut with an open window, a desk and a paper calendar nailed up inside. "
                f"Beside the gate a small iron brazier on legs giving off a thin curl of grey "
                f"smoke. Palms, sand, morning light, a haze of smoke in the air. No people. Leave "
                f"the lower third as clear walkable sand. No vanishing point. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/gate_wide.webp"),

    # Act III repaints: the old shore and gate plates are bright tropical daylight, and the
    # Shroud needs its own cold, fog-bound flats and reef gate. Painted at the same 16:9 render
    # as the other wide backgrounds, then cover-cropped to 2560x880 (post_background).
    ("bg_fogflats_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: the Shroud's fog flats at low tide, a vast cold grey-blue wilderness of "
                f"ribbed sandbars and shallow tidal channels. Channels of pewter water wind "
                f"between long banks of wet grey sand that shine with the sky; low ground fog "
                f"drifts across the middle distance and hides the horizon. In the right-hand "
                f"third, small and half-lost in the haze, a weathered wooden palisade gate stands "
                f"on a low dune, a faint sandy track leading up to it. Far out on the left the "
                f"broken masts of an old wreck lean out of the fog, barely visible and very "
                f"distant. In the left foreground a ship's longboat is drawn up and canted on a "
                f"wet sandbar, her oars still shipped. No people, no figures anywhere, no ships "
                f"afloat, no moored sloop, no palms and no tropical greenery. Painted "
                f"adventure-game background with visible brushwork, cold grey-blue and pewter "
                f"palette, overcast diffuse light, no sun, quiet and desolate. Leave the lower "
                f"third as a clear walkable band of wet sand and shallow water running from the "
                f"left edge to the right edge. No text. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/fogflats_wide.webp"),

    ("bg_gate_fog_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed flat side-on at "
                f"eye level: the fog-bound reef gate of the Shroud. A weathered wooden palisade "
                f"of salt-grey sharpened posts runs across the frame; in the centre a heavy gate "
                f"of ship's timber stands with one leaf standing open, the passage beyond lost in "
                f"cold fog. In the shallow grey water before the gate a ship's longboat waits, "
                f"oars across her thwarts, her dark hull reflected in the still water. Behind the "
                f"palisade, in the upper right, the black hull of the Grey Lantern, an ancient "
                f"wooden sailing ship, lies at anchor half-lost in the fog: a long low dark "
                f"silhouette of tarred planks and a broken rail rising above the posts. No "
                f"buildings and no cliffs behind the palisade, only grey mist and the ship. One "
                f"small green lantern burns on her deck, a sickly green glow with a faint green "
                f"reflection in the water below. A low iron signal brazier stands on the sand to "
                f"the right of the gate, a thin curl of smoke rising from it. On the left a wet "
                f"sandy path leads in from the fog flats. No people, no figures anywhere. Painted "
                f"adventure-game background with visible brushwork, cold grey-blue and pewter "
                f"palette, diffuse overcast light, the green lantern the only colour. Leave the "
                f"lower third as a clear walkable band of wet sand and shallow water running from "
                f"the left edge to the right edge. No text. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/gate_fog_wide.webp"),

    ("bg_works_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on: a "
                f"smoky industrial yard of iron and fire on a tropical island. A row of big iron "
                f"braziers on legs burning dried kelp and pouring thick white-grey smoke into the "
                f"sky; one great brazier in the centre, twice the size of the others, roaring "
                f"orange; huge leather forge bellows; stacked bales of dried brown kelp; a tall "
                f"timber gantry over the braziers with a long rope halyard hanging from a pulley; "
                f"soot-blackened sand; harsh orange firelight through grey smoke. No people. Leave "
                f"the lower third as clear walkable ground. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/works_wide.webp"),

    ("bg_lighthouse_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                "level: a lonely stone lighthouse on a fog-bound headland at dusk in the Shroud. "
                "The tall cylindrical stone tower stands right of centre, its great lamp burning "
                "warm amber behind the glass, throwing a soft gold glow into the cold blue-grey "
                "fog. At the left a low stone keeper's store shed with a plank door and a slate "
                "roof, a small iron brazier burning at its door, and a narrow wet flagstone path "
                "winding from the shed across the headland and down towards the foreground. Wet "
                "black rocks and shallow tidal pools at the cliff edge, a grey fog sea below, a "
                "pale fog horizon and a faint cold moon behind the mist. No people. One "
                "continuous, completely empty and unobstructed walkable path and rocky yard band "
                "spans the lower quarter of the picture; no figures, crates, barrels, ropes or "
                "debris in that lane. Essential scenery kept in the central vertical band for "
                "the ultra-wide crop. Cold blue-grey palette with a single warm amber lamp. "
                "Hand-painted digital illustration, cinematic point-and-click adventure game art, "
                "visible oil-painted brushwork, rich atmospheric volumetric fog, painterly "
                "detailed stone and wet rock, strong colour grading, ultra-wide panoramic "
                "composition, no text, no UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/lighthouse_wide.webp"),

    # ---------------- the area views anchor the rooms: Upper Town and the Shroud ----------------
    # The three rooms below are close-ups of the macro views above (area_town, area_shroud), not
    # independent establishing shots: same dark timber-and-stone town, same fog and palette, same
    # lighthouse tower, same longboat/wreck/palisade. Painted 21:9 and cover-cropped to 2560x880,
    # so the central vertical band carries the essential scenery.
    ("bg_town_lane_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background plate, a close-up room view "
                "of Upper Town at night, seen flat side-on at eye level from a few paces out in "
                "the steep cobbled lane, the nearest stonework large in frame. From left to "
                "right: a low wet stone retaining wall with a black iron lantern and a short "
                "flight of worn steps running down out of frame towards the harbour; a tall "
                "jettied timber-framed cottage, its plaster dark with age, leaded windows lit "
                "warm amber, a plank back door with a lamp over it and an unlit shuttered window "
                "above; a squat grey stone cottage with a carved stone shrine niche set in its "
                "wall, a little painted saint inside, a shelf of candle stubs and a warm votive "
                "glow; a low round stone well with a timber windlass, rope and a hanging bucket "
                "standing on the wet cobbles; then the lane climbs steeply between two leaning "
                "dark cottages as a broad flight of worn stone steps with an iron handrail, and "
                "above the steps, right of centre and high over the rooftops in the blue fog, "
                "the lighthouse stands on its black rock, the whole tower from base to lantern "
                "room and its domed glass roof entirely inside the top of the frame and not "
                "cropped, a stout round pale stone tower with a gallery rail, its great lamp "
                "burning warm gold with a soft beam raking right through the mist; at the right "
                "a tall dark stone-and-timber house with one warm lit "
                "window, a line of white laundry strung across the lane, and a small shuttered "
                "market stall with a dark canvas awning, a trestle table, rope coils, lamp oil "
                "crates and dried fish. Wet cobblestones reflect the lanterns, and a continuous "
                "clear empty lane runs along the lower third from the left edge to the right "
                "edge with nothing standing on it. Deep blue-teal night, warm amber windows, cold "
                "low fog drifting between the houses, wet stone. No people, no figures, no text, "
                "no signage, no UI, no watermark. Hand-painted digital illustration, cinematic "
                "point-and-click adventure game art, visible oil-painted brushwork, "
                "near-photoreal detail, rich atmospheric volumetric lighting, strong colour "
                "grading, ultra-wide panoramic composition, essential scenery kept in the "
                "central vertical band for the 2560x880 crop.",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/town_lane_wide.webp"),

    ("bg_town_head_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background plate, a close-up room view "
                "of the lighthouse headland above Upper Town at night, seen flat side-on at eye "
                "level, the same dark stone-and-timber world as the town lane below. From left "
                "to right: a low stone keeper's store with a slate roof, a plank door, a small "
                "shuttered window and a warm iron brazier burning at its door on the wet "
                "flagstones, orange firelight and a thin curl of smoke; wet black rocks, shallow "
                "tidal pools and a low stone kerb along the headland; a broad wet flagstone path "
                "crossing the whole lower third from the left edge to the right edge, completely "
                "empty and unobstructed, shining with cold sky and warm firelight; at the right "
                "the lighthouse tower stands tall and close on its rock plinth, the same stout "
                "round whitewashed stone tower with a domed glass lantern room, a gallery rail "
                "and a great warm amber lamp, a long soft beam raking out to the right through "
                "the fog; beyond the tower the cliff edge falls away to a pale fog sea with a "
                "faint cold moon behind the mist. Cold blue-grey fog at night, wet stone, warm "
                "amber lamp and brazier the only warm notes. No people, no figures, no text, no "
                "signage, no UI, no watermark. Hand-painted digital illustration, cinematic "
                "point-and-click adventure game art, visible oil-painted brushwork, "
                "near-photoreal detail, rich atmospheric volumetric lighting, strong colour "
                "grading, ultra-wide panoramic composition, essential scenery kept in the "
                "central vertical band for the 2560x880 crop.",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/town_head_wide.webp"),

    ("bg_shroud_flats_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background plate, a close-up room view "
                "of the Shroud's Fog Flats at low tide, seen flat side-on at eye level. In the "
                "left foreground the ship's longboat is drawn up and canted on a ribbed wet "
                "sandbar, dark tarred planks, her oars shipped across the thwarts, a coil of rope "
                "at the bow, close enough to fill the lower left; beyond her the flats open into "
                "ribbed grey-blue wet sand and shallow pewter channels winding away into the "
                "middle distance; half-lost in cold fog, the broken hull and leaning masts of a "
                "large wrecked sailing ship, distant and muted with her ribs showing; at the "
                "right a low dune with a weathered palisade of salt-grey sharpened posts, two "
                "patched canvas tents behind it and a pale gap where a sandy track leads down "
                "towards the shore; beyond, dense white-grey ground fog hides the horizon, with "
                "faint dark cliffs far off in the mist. The lower third is a clear, continuous "
                "band of wet sand and shallow water from the left edge to the right edge, with "
                "nothing standing on it. Cold grey-blue and pewter palette, diffuse overcast "
                "light, no sun, no green, no tropical water, no ships afloat. No people, no "
                "figures, no text, no signage, no UI, no watermark. Hand-painted digital "
                "illustration, cinematic point-and-click adventure game art, visible oil-painted "
                "brushwork, near-photoreal detail, rich atmospheric fog, strong colour grading, "
                "ultra-wide panoramic composition, essential scenery kept in the central "
                "vertical band for the 2560x880 crop.",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/shroud_flats_wide.webp"),

    ("bg_saltcamp_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: a prison salt camp on a tropical island under a white glaring morning "
                f"sun. Shallow rectangular salt pans shining white, conical heaps of raked salt, "
                f"wooden salt rakes, rows of patched canvas tents, washing lines of sailors' "
                f"shirts, a small stout wooden store hut with a barred window and a padlocked "
                f"door at the right, a sharpened-log palisade behind, and at the far left the "
                f"pale reef flats running out to the lagoon. Bleached salt-white glare, hard "
                f"shadows. No people. Leave the lower third as clear walkable packed salt ground. "
                f"{STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/saltcamp_wide.webp"),

    ("npc_ansel", "image", BG_MODEL,
     painted_portrait(f"{CAST['ansel']}, laughing with a broad delighted grin"),
     "characters/ansel.png"),
    ("npc_ansel_body", "image", BG_MODEL,
     body("ansel", "standing with his arms flung wide in delighted welcome, a folded patchwork flag under one arm, side three-quarter view"), "characters/ansel_body.png"),
    ("npc_pike", "image", BG_MODEL, portrait("pike"), "characters/pike.png"),
    ("npc_pike_body", "image", BG_MODEL,
     body("pike", "standing stiffly to attention holding his clipboard to his chest, side three-quarter view"), "characters/pike_body.png"),
    ("npc_tamhobb", "image", BG_MODEL, portrait("tamhobb"), "characters/tamhobb.png"),
    ("npc_tamhobb_body", "image", BG_MODEL,
     body("tamhobb", "standing leaning on a long wooden salt rake, side three-quarter view"), "characters/tamhobb_body.png"),

    # The far pans: an optional vista off the salt camp, father and son, no puzzle.
    ("bg_farpans_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye level: "
                f"the far salt pans at the edge of a tropical island lagoon, late morning, as the "
                f"last veils of fog lift off the water. In the foreground, a broad, flat, empty bank "
                f"of packed white salt crust runs the full width of the picture along the bottom, "
                f"where people will walk; nothing stands on it. Behind it, across the middle of the "
                f"frame, a wide patchwork of shallow flooded salt pans divided by low raked walls of "
                f"white salt, their still water a perfect mirror of a pearl, peach and rose-gold sky; "
                f"small conical heaps of raked salt and a few long wooden salt rakes leaning against "
                f"them; a grey heron wading in a pan; gulls. Far out across the glassy turquoise "
                f"lagoon, small and distant on a coral reef near the centre, an old wrecked brig with "
                f"exactly two masts lies heeled steeply over on her side, both masts still standing "
                f"at a slant; beyond her a white line of surf on the outer reef and the open sea. At "
                f"the far left, a low weathered boardwalk of grey planks on stilts runs out across "
                f"the pans toward the lagoon and stops short. At the far right, small and distant, "
                f"the patched canvas tents and sharpened-log palisade of the salt camp, with a beaten "
                f"path of packed salt leading off toward them. Soft sunbeams through the lifting "
                f"mist, glittering salt crystals, airy and luminous. No people. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/farpans_wide.webp"),
    ("npc_ansel_seated", "image", BG_MODEL,
     body("ansel", "sitting on an upturned wooden barrel, leaning forward with his forearms on his knees and his hands loosely clasped, a soft fond smile, facing right, side view, the whole barrel and his bare feet visible on the ground"), "characters/ansel_seated.png"),

    ("prop_flag16", "image", BG_MODEL,
     {"prompt": "A single home-made patchwork flag sewn from old shirts, faded blue, white, "
                "red and striped patches with uneven hand stitching, a large letter L "
                "embroidered in the top corner, flying out to the right from a short length of "
                "rope as if in a stiff breeze, painted adventure game prop, oil-painted digital "
                "illustration, morning side lighting, flat solid magenta background (#FF00FF), "
                "no pole, no shadow, no ground, no text other than the letter L",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/flag16.png"),

    # ---------------- act IV: all hands returned ----------------
    ("bg_countinghouse_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background, viewed side-on at eye "
                f"level: the interior of an immaculate merchant's counting-house at night. A "
                f"row of tall clerks' standing desks with high stools, every pen in line; a "
                f"whole back wall of numbered wooden pigeonholes stuffed with rolled papers and "
                f"ledgers; a squat black iron safe with a brass dial at the right; on the back "
                f"wall a large gilt-framed oil painting of a smug gentleman in a tall black hat "
                f"with a thin moustache; a polished brass emblem shaped like a cloud mounted "
                f"above the door at the left; green-shaded desk lamps throwing warm pools of "
                f"light against deep blue shadow; tall shuttered windows. Everything ruler "
                f"straight and spotless. No people. Leave the lower third as clear empty "
                f"polished parquet floor. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/countinghouse_wide.webp"),

    ("bg_pierend_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide side-scrolling adventure game background of the far end of a stone "
                f"harbour pier in Port Vela at night, viewed side-on at eye level. The pier's "
                f"broad flat top of wet stone flags runs left to right across the whole lower "
                f"third, iron mooring bollards and coiled ropes along its seaward edge. At the "
                f"far right a tall white stone lighthouse stands on the pier end, its lamp "
                f"burning gold. At the left a small grey single-masted cutter is moored "
                f"alongside, sail furled, a gangplank down. Stacked wooden crates, sacks and a "
                f"hand cart on the pier beside her, a lantern on an iron post. Indigo water, a "
                f"deep blue moonlit night sky with drifting clouds, the warm lights of the "
                f"harbour town far off. Wet stone shining in lantern light, warm amber against "
                f"deep blue shadow, the same look as a hand-painted night harbour scene. No "
                f"people. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/pierend_wide.webp"),

    # The short walk between the harbour and its mouth: the boards of the dock run on at the
    # right edge, the stone flags of the pier end at the left, so the room reads as one
    # continuous quay rather than a cut between two places.
    ("bg_quay_wide", "image", BG_MODEL,
     {"prompt": f"Ultra-wide strict side-on side-scrolling adventure game background at eye "
                f"level: the short quay between the inner harbour and the harbour mouth on a "
                f"fog-bound northern island at night, a close-up of the same fog-bound timber "
                f"waterfront as the wide night harbour establishing view. One broad flat quay "
                f"path runs clear across the whole width of the frame in the lower third, wet "
                f"grey stone flags at the left changing to wet dark wooden boards at the right, "
                f"a continuous completely unobstructed walking band from the left edge to the "
                f"right edge, shining with long warm lantern reflections. At the left the harbour "
                f"mouth opens onto indigo open water and cold blue fog, a low stone breakwater "
                f"running out with a small white stone lighthouse on a distant point, its lamp "
                f"burning gold; a black iron bollard and coiled rope on the quay edge. At the "
                f"right the inner harbour behind the boards: the dark bow, furled rigging and "
                f"tall masts of the moored two-masted ship the Marrow tied along the quay, and "
                f"behind her the corner, chimney and steep slate gable of a tall jettied timber "
                f"harbourmaster's house with one small warm-lit mullioned window and an iron wall "
                f"lantern. Two tall black cast-iron lamp posts with warm amber lanterns light the "
                f"path; a few crates and barrels stacked against the far wall, none of them in "
                f"the path. Indigo water, cold blue night sky with drifting fog and cloud, warm "
                f"amber against deep blue shadow, painterly night-harbour brushwork. The empty "
                f"walkable band across the lower third is the clearest, brightest part of the "
                f"painting. Keep the essential scenery in the central horizontal band for an "
                f"ultra-wide crop. No people, no figures, no text, no lettering, no signage, no "
                f"UI. {STYLE}",
      "resolution": BG_RES, "output_format": "png"}, "scenes/quay_wide.webp"),


    ("prop_quay_steps", "image", BG_MODEL,
     {"prompt": "A short flight of weathered stone harbour steps descending from the quay toward the water at night, seen from the side and slightly above: four broad wet stone treads, a black iron handrail on the near side, a little green weed and salt in the joints, a warm amber lamp glow falling across the top steps and a cold blue reflection in the wet stone below, the treads leading down and away to the right. Painted adventure game prop, oil-painted digital illustration, three-quarter view, the whole stair in frame, the object isolated and floating, the ENTIRE background flat solid magenta (#FF00FF) including underneath it, no shadow, no ground, no water, no other objects, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/quay_steps.png"),

    ("prop_quay_lamp", "image", BG_MODEL,
     {"prompt": "A single tall harbour lamp post: a black cast-iron post with a fluted base and "
                "a ladder-rest crossbar, topped by a hexagonal glass lantern with a warm amber "
                "flame burning inside, a little soot on the glass, a decorative iron finial above. "
                "Painted adventure game prop, oil-painted digital illustration, warm light on the "
                "glass and cold blue-grey on the iron, three-quarter view, the whole post in "
                "frame from base to finial, the object isolated and floating, the ENTIRE "
                "background flat solid magenta (#FF00FF) including underneath it, no shadow, no "
                "ground, no other objects, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/quay_lamp.png"),

    ("npc_nib", "image", BG_MODEL, portrait("nib"), "characters/nib.png"),
    ("npc_nib_body", "image", BG_MODEL,
     body("nib", "standing slouched with his hands hanging, holding a pen loosely, side three-quarter view"), "characters/nib_body.png"),
    ("npc_bramwick_seated", "image", BG_MODEL,
     body("bramwick", "sitting slumped on a low wooden tavern stool, holding a pewter mug on his knee with both hands, facing right, side view, the stool and his boots visible on the floor, no table"), "characters/bramwick_seated.png"),
    ("npc_weather_body", "image", BG_MODEL,
     body("weatherman", "standing holding a wooden crate in both arms, side three-quarter view"), "characters/weather_body.png"),
    ("prop_qflag", "image", BG_MODEL,
     {"prompt": "A single plain square bright yellow quarantine flag flying out to the right from "
                "the top of a short upright wooden post, no markings on the flag, painted "
                "adventure game prop, oil-painted digital illustration, soft side lighting, flat "
                "solid magenta background (#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/qflag.png"),

    # ---------------- the cold open: before the title card ----------------
    # A full-screen plate, not a room background (see FULL_PLATES): the customs desk at night,
    # the day-book and the date stamp. No people: Bramwick speaks from the doorway, off-frame.
    ("bg_coldopen", "image", BG_MODEL,
     {"prompt": "Hand-painted adventure game close-up of a harbour customs desk at night, seen at "
                "a low three-quarter angle across the blotter. An open leather day-book with thick "
                "cream ruled pages, a column of entries in brown ink, the last line fresh and "
                "unblotted; a heavy brass date stamp with a turned wooden handle lying in the "
                "gutter of the book, its round base toward the viewer; a squat glass inkwell with a "
                "dark pen; a bundle of customs forms; a low brass oil lamp with a warm glass chimney "
                "at the left, its pool of amber light falling across the page and the stamp. Deep "
                "blue shadow, dark office shelves behind, the lamp the only light. The day-book and "
                "the date stamp are the brightest, clearest things in the frame, resting well inside "
                "the middle of the picture. No people, no hands, no legible writing, no signs, no "
                "UI. " + STYLE,
      "resolution": BG_RES, "output_format": "png"}, "scenes/coldopen.webp"),

    # ---------------- inventory icons: props/items/<id>.png, asset key item_<id> ----------------
    # Papers and books are told apart by colour and one big cue each (a red stamp, a yellow
    # ribbon, a chain, kelp), since any lettering is unreadable at chip size.
    ("item_crowbar", "image", BG_MODEL,
     icon("An old iron crowbar lying diagonally from lower left to upper right, a curved split "
          "claw at the upper end and a flat chisel tip at the lower end, worn red paint chipped "
          "back to dark iron, a little rust on the claw"), "props/items/crowbar.png"),
    ("item_rum", "image", BG_MODEL,
     icon("A single squat bottle of dark rum standing upright, thick dark green glass with a long "
          "neck, a cork sealed with dripping red wax, a plain cream paper label with only a small "
          "painted anchor on it, warm amber light glowing through the rum inside the glass"),
     "props/items/rum.png"),
    ("item_licence_form", "image", BG_MODEL,
     icon("A single blank official form printed on thick cream paper, standing upright and "
          "tilted slightly, an engraved pale blue decorative border, a small printed anchor crest "
          "under the heading, neat rows of empty ruled lines and boxes, and an empty dotted circle "
          "at the lower right where a stamp should go, the corners curling a little",
          'the only lettering anywhere is the printed heading "LICENCE" in bold capitals across '
          'the top'), "props/items/licence_form.png"),
    ("item_licence", "image", BG_MODEL,
     icon("A single official form printed on thick cream paper, standing upright and tilted "
          "slightly, an engraved pale blue decorative border, a small printed anchor crest under "
          "the heading, neat rows of ruled lines and boxes, and a large round bright red ink stamp "
          "with an anchor in its centre pressed boldly over the lower right corner, the red ink "
          "still wet and glossy",
          'the only lettering anywhere is the printed heading "LICENCE" in bold capitals across '
          'the top'), "props/items/licence.png"),
    ("item_drawer_key", "image", BG_MODEL,
     icon("A single small old brass desk-drawer key lying diagonally, an ornate looped bow, a "
          "slender shaft and a simple toothed bit, a short loop of faded red string tied through "
          "the bow, warm brass highlights"), "props/items/drawer_key.png"),
    ("item_stamp", "image", BG_MODEL,
     icon("A heavy old official hand stamp: a solid round brass base with a turned dark wooden "
          "handle and knob on top, tipped toward the viewer so its flat brass face shows an "
          "engraved anchor in a ring, with a trace of red ink on it"), "props/items/stamp.png"),
    ("item_compass", "image", BG_MODEL,
     icon("An antique brass pocket compass with its hinged lid standing open, a finely engraved "
          "lid, a cream compass card with a compass rose under domed glass and a slender blued "
          "steel needle, a small brass ring at the top, gleaming warm old brass"),
     "props/items/compass.png"),
    ("item_spyglass", "image", BG_MODEL,
     icon("A single brass spyglass with its three draw tubes extended, lying diagonally from "
          "lower left to upper right, worn and dented old brass polished bright, a dark leather "
          "grip band, a glinting glass lens at the wide end"), "props/items/spyglass.png"),
    ("item_sextant", "image", BG_MODEL,
     icon("A polished brass navigator's sextant: a fan-shaped open brass frame with an engraved "
          "arc scale along its curved bottom edge, a pivoting index arm, a small telescope, two "
          "little mirrors and a dark wooden handle, polished to a mirror shine"),
     "props/items/sextant.png"),
    ("item_pell_log", "image", BG_MODEL,
     icon("A slim, battered navigator's logbook with a faded dark green cloth cover, scuffed "
          "corners and a cracked spine, closed and tied with a thin leather cord wrapped twice "
          "round it, yellowed page edges"), "props/items/pell_log.png"),
    ("item_bill", "image", BG_MODEL,
     icon("A large official certificate on thick yellowed paper, standing upright and curling "
          "slightly at the corners, a printed decorative border, a few blank ruled lines, and a "
          "bright yellow silk ribbon threaded through the bottom edge, fixed with a round red wax "
          "seal",
          'the only lettering anywhere is the printed heading "BILL OF HEALTH" in bold capitals '
          'across the top'), "props/items/bill.png"),
    ("item_calendar_leaf", "image", BG_MODEL,
     icon("A single small page torn off a wall calendar pad, a ragged torn top edge, a red "
          "printed band across the top, and a very large bold black printed number 12 filling the "
          "middle of the page, the paper curling slightly",
          'the only lettering anywhere is the large number "12"'),
     "props/items/calendar_leaf.png"),
    ("item_bucket", "image", BG_MODEL,
     icon("An empty old wooden bailing bucket made of dark weathered oak staves bound with two "
          "rusty iron hoops, a frayed rope handle, a few small barnacles on the lower staves, seen "
          "from slightly above so the dry empty inside is visible"), "props/items/bucket.png"),
    ("item_bucket_water", "image", BG_MODEL,
     icon("An old wooden bailing bucket made of dark weathered oak staves bound with two rusty "
          "iron hoops, a frayed rope handle, a few small barnacles on the lower staves, seen from "
          "slightly above, filled to the brim with clear bright turquoise lagoon water with a "
          "small silver fish in it, a little water spilling over the rim"),
     "props/items/bucket_water.png"),
    ("item_flag16", "image", BG_MODEL,
     icon("A single small home-made patchwork flag sewn from old shirts, faded blue, white, red "
          "and striped cotton patches with uneven hand stitching, a large red letter L "
          "embroidered in the top corner, rippling out to the right from a short loop of rope as "
          "if in a breeze, no pole",
          'the only lettering anywhere is the embroidered letter "L"'),
     "props/items/flag16.png"),
    ("item_ansel_log", "image", BG_MODEL,
     icon("A thick, fat ship's logbook bound in salt-stained brown leather, closed, swollen and "
          "warped by sea water, brass corner caps, crusted white salt along its edges, a frayed "
          "red ribbon bookmark hanging out of the pages"), "props/items/ansel_log.png"),
    ("item_purse", "image", BG_MODEL,
     icon("A small soft brown leather drawstring purse, plump with coins, its gathered neck "
          "tied shut with a cord and sealed with a round blob of red sealing wax pressed with the "
          "shape of a little cloud"), "props/items/purse.png"),
    ("item_requisition", "image", BG_MODEL,
     icon("A single narrow printed requisition slip on pale green paper, standing upright and "
          "tilted slightly, a small grey printed cloud emblem at the top under the heading, rows "
          "of ruled lines with a few short strokes of dark ink handwriting, and a perforated "
          "tear-off stub down the left edge",
          'the only legible lettering is the printed heading "REQUISITION" in small capitals '
          'across the top'), "props/items/requisition.png"),
    ("item_claims_book", "image", BG_MODEL,
     icon("A slim, immaculate black leather account book, closed, with gilt page edges, fine "
          "gold-tooled border lines on the cover, a small embossed gold cloud emblem in the "
          "centre of the cover and a black silk ribbon bookmark"), "props/items/claims_book.png"),
    ("item_ledger", "image", BG_MODEL,
     icon("A huge heavy old harbour ledger, closed, bound in worn oxblood-red leather with brass "
          "corner caps and a thick block of yellowed pages, a short length of rusty iron chain "
          "hanging from an iron ring on its spine, the last link snapped open"),
     "props/items/ledger.png"),
    ("item_kelp_manifest", "image", BG_MODEL,
     icon("A folded paper cargo manifest tied with coarse twine round a small bundle of dried "
          "dark brown kelp fronds, the paper smudged grey with smoke at one corner, a small "
          "stamped grey cloud mark on it"), "props/items/kelp_manifest.png"),
    ("item_manifest", "image", BG_MODEL,
     icon("A long sheet of aged parchment-coloured paper standing upright, partly rolled up into "
          "a scroll at the bottom, a long column of short handwritten entries in faded brown ink "
          "on ruled lines down the page, each with a small tick beside it",
          'the only legible lettering is the heading "ARCADIA" written large across the top'),
     "props/items/manifest.png"),

    # ---------------- the Father and the Fog: new cast ----------------
    ("npc_vex", "image", BG_MODEL,
     {"prompt": f"Painted character portrait, head and shoulders, of {CAST['vex']}, no hat. Warm "
                f"amber lamplight from one side and cool blue sea light from the other, deep "
                f"shadow between. Hand-painted adventure game dialogue portrait in the manner of "
                f"a traditional oil painting: visible confident brushstrokes on the face and hair "
                f"as well as the clothes, simplified painterly planes of light and shadow, "
                f"slightly stylised semi-realistic features, rich muted colours, a dark neutral "
                f"background of loose painted strokes. Not a photograph, not photorealistic, not "
                f"a 3D render, no fine skin pores, not anime, not cel shaded, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/vex.png"),

    ("npc_vex_body", "image", BG_MODEL,
     body("vex", "standing in three-quarter view with one hand resting on the hilt of a cutlass "
                 "at his hip and the other hand open in a theatrical gesture, tall black leather "
                 "boots, no hat"), "characters/vex_body.png"),

    ("npc_mordant", "image", BG_MODEL,
     {"prompt": f"Painted character portrait, head and shoulders, of {CAST['mordant']}. A faint "
                f"green ghost-light glows on one side, cool blue shadow on the other, calm and "
                f"sad rather than monstrous, not a rotting corpse, no gore. Hand-painted "
                f"adventure game dialogue portrait in the manner of a traditional oil painting: "
                f"visible confident brushstrokes on the face and hair as well as the clothes, "
                f"simplified painterly planes of light and shadow, slightly stylised "
                f"semi-realistic features, rich muted colours, a dark neutral background of loose "
                f"painted strokes. Not a photograph, not photorealistic, not a 3D render, no fine "
                f"skin pores, not anime, not cel shaded, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/mordant.png"),

    ("npc_mordant_body", "image", BG_MODEL,
     body("mordant", "standing full-length in three-quarter view with one hand open in a "
                     "courteous gesture and a cutlass at his hip, calm and sad and courteous "
                     "rather than monstrous, not gory, not a rotting corpse, a faint green "
                     "ghost-light glowing on one side"), "characters/mordant_body.png"),

    # ---------------- painted cast: standing figures repainted to sit in the plates ----------------
    # The anime-leaning bodies (Vex, Quill, Hobb, Dorrit, Marta) read as stickers pasted over the
    # painted backgrounds: flat fills, clean edges, key light from nowhere. These are the same five
    # people, in the same clothes, painted with the brushwork and the warm-key/cold-rim light of the
    # night scenes behind them. Magenta-keyed to sprites and pointed at by the old asset keys, so
    # every room picks them up; the old files stay on disk for the record.
    ("npc_vex_body_painted", "image", BG_MODEL,
     painted_body("vex", "standing naturally at rest in three-quarter view, weight on one hip, "
                         "both arms hanging relaxed at his sides, long navy coat falling open over "
                         "tall black leather boots, no hat, no sword, no cutlass"),
     "characters/vex_body_painted.png"),

    ("npc_quill_body_painted", "image", BG_MODEL,
     painted_body("quill", "standing naturally at rest in three-quarter view, arms relaxed at her "
                           "sides, rolled trousers and bare feet planted on the ground, no "
                           "spyglass in her hands. Her face is a real young woman's face painted "
                           "from life: small natural eyes, no heavy eyeliner, no glossy cartoon "
                           "eyes, a defined jaw and ordinary cheekbones, sun-browned skin built "
                           "from loose brushstrokes; an oil study from a life class, not a "
                           "character illustration or a character design"),
     "characters/quill_body_painted.png"),

    ("npc_hobb_body_painted", "image", BG_MODEL,
     painted_body("hobb", "standing naturally at rest, arms relaxed at his sides, booted feet "
                          "planted apart, jerkin and shirt hanging loose"),
     "characters/hobb_body_painted.png"),

    ("npc_dorrit_body_painted", "image", BG_MODEL,
     painted_body("dorrit", "standing naturally at rest in three-quarter view, arms relaxed at his "
                            "sides, stout legs in dark trousers and worn black shoes, no ladle"),
     "characters/dorrit_body_painted.png"),

    ("npc_marta_body_painted", "image", BG_MODEL,
     painted_body("marta", "standing naturally at rest in three-quarter view, arms relaxed at her "
                           "sides, olive apron falling to her boots"),
     "characters/marta_body_painted.png"),

    # ---------------- reboot: the Grey Lantern (Act IV) ----------------
    # The ghost ship's deck plate and the two new Act IV item icons. The deck asks for the widest
    # 21:9 render the model takes so the 2560x880 crop keeps nearly the whole vertical composition.
    ("bg_lantern_deck_wide", "image", BG_MODEL,
     {"prompt": "Ultra-wide side-scrolling adventure game background: the deck of the Grey Lantern, "
                "an ancient pirate ghost ship at night. Torn grey canvas sails hang in long ragged "
                "strips from a broken, leaning mainmast; tangled rigging and frayed shrouds criss-cross "
                "the cold sky; a great iron lantern with a sickly green flame hangs forward from a spar "
                "on the left, casting a green glow across splintered rails and old carved woodwork. The "
                "deck boards are warped and split and gleam silver with salt; ghostly fog curls over "
                "the rail and drifts between the masts, and the sea beyond is a wall of pale grey mist. "
                "One continuous, completely empty and unobstructed walkable deck band spans the entire "
                "lower third of the picture from the left edge to the right edge; no figures, crates, "
                "barrels, coiled ropes, fallen spars, posts or debris anywhere in that lane. Clear "
                "side-view perspective from a low camera at deck level, essential scenery kept in the "
                "central vertical band for the ultra-wide crop. Eerie and lonely but not gory, cold "
                "moonlit silver-blue with the sickly green lantern glow and a faint warm ember far aft, "
                "strong silhouettes, deep shadow, atmospheric haze. Hand-painted digital illustration, "
                "cinematic point-and-click adventure game art, visible oil-painted brushwork, rich "
                "volumetric lighting, strong colour grading, ultra-wide panoramic composition, no "
                "text, no UI, no watermark, no logos",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/lantern_deck_wide.webp"),

    ("item_bell_clapper", "image", BG_MODEL,
     icon("A single ship's-bell clapper of heavy worn brass: a slender turned brass shaft with a fat "
          "rounded striking bulb at the bottom, the bulb rubbed smooth and shiny by years of "
          "striking, a small brass loop at the top with a short plaited brown leather thong knotted "
          "through it, dark age patina in the crevices and a few small dents"),
     "props/items/bell_clapper.png"),

    ("item_lantern", "image", BG_MODEL,
     icon("A single ship's lantern of brass and black iron: a heavy four-paned storm lantern with a "
          "curved carrying handle, a hinged black iron storm shutter half-open over one side, one "
          "glass pane cracked with a fine fissure, a small trimmed wick burning low inside, a "
          "soot-blackened iron cap and a salt-worn brass frame"),
     "props/items/lantern.png"),

    # The two props the ghost ship needs painted: the plate that names Mordant, and the wrapped
    # lantern Quill drapes. Both are cut out onto the plate, so each asks for a clean silhouette.
    ("prop_nameplate", "image", BG_MODEL,
     {"prompt": "A single small brass ship's nameplate: a flat rectangular engraved brass plaque "
                "with a raised bevelled border and four countersunk screw holes, seen from the "
                "front and slightly above, tilted up a little so its whole engraved face is "
                "visible as if lying flat on a desk. Two lines of neat serif capitals are cut "
                "into the brass, GREY LANTERN above and M. MORDANT, MASTER below, the letters "
                "dark with age, green verdigris and a little salt crust in the engraving, the "
                "brass worn, scratched and softly polished, cold green lamplight along the top "
                "edge and a warm highlight below. Painted adventure game prop, matte oil-painted "
                "digital illustration with visible brushwork, slightly stylised, not a 3D render, "
                "not a photograph, no gloss, clear rectangular silhouette. The ENTIRE background "
                "is flat solid magenta (#FF00FF), including all around the plate and underneath "
                "it; no desk, no table, no shadow, no ground, no other objects, no other text",
      "resolution": "2848x1600 (16:9)", "output_format": "png"}, "props/nameplate.png"),

    ("prop_lantern_wrapped", "image", BG_MODEL,
     {"prompt": "A single great ship's lantern, tall and rectangular, completely wrapped and "
                "lashed in wet dark oiled canvas so that no glass and no flame shows, the black "
                "iron domed cap and its heavy ring still visible above the folds, the shape of "
                "the lantern clear under the sagging cloth. The canvas is soaked, glossy and "
                "dripping, bound round twice with tarred rope, the knot and a short frayed end "
                "hanging down one side; the whole object is dark brown and black, with no light "
                "escaping it, cold moonlit blue along the top and a faint sickly green rim light "
                "down one edge. Painted adventure game prop, matte oil-painted digital "
                "illustration with visible brushwork, detailed but a clear tall silhouette, not a "
                "3D render, not a photograph. The ENTIRE background is flat solid magenta "
                "(#FF00FF), including underneath and all around it; no shadow, no ground, no "
                "ship, no other objects, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/lantern_wrapped.png"),

    # ================= the harbour's five screens, repainted =================
    # The restart's room paintings. Each is a full-bleed 2560x880 painting rendered at 21:9 and
    # cover-cropped by post_background(); each carries the same indigo night, cold fog rim and
    # warm amber lantern key as bg_area_harbour, and each is deserted: no people, no signs, no
    # painted lettering anywhere. The way out of every room is lit into the painting — a warm
    # pool at a door, a door ajar on light, a reflection trail running off-frame — so an exit is
    # read by light and composition alone, never by a sign. The lower third is a continuous,
    # uncluttered walkable band in all five.
    ("bg_dock_cinema_wide", "image", BG_MODEL,
     {"prompt": f"Full-bleed ultra-wide panoramic side-on painting of a fog-bound northern harbour "
                f"quay at night, the same world, palette and brushwork as the harbour establishing "
                f"painting: indigo night, cold silver-blue fog, wet timber and stone, small warm "
                f"amber lanterns, long broken reflections. Left third: the dark tarred bow, "
                f"bulwark and tangled rigging of a moored two-masted ship, her hull doubled in "
                f"black indigo water, mooring ropes and a stone edge in front of her. Left of "
                f"centre: a low dockside tavern frontage of dark tarred boards under a jettied "
                f"upper storey, its heavy plank door standing wide open on a warm amber interior, "
                f"a small iron lantern burning beside the door and a bright warm pool of light "
                f"spilling across the wet cobbles in front of it; the dark timber wall above the "
                f"door is plain and bare. Centre: the tall harbourmaster's timber house, steep "
                f"slate gables, jettied upper storey, rows of small warm-lit mullioned windows, "
                f"and a plank door standing open with warm amber light pouring out and a broad "
                f"glowing pool on the wet quay, an iron wall lantern burning beside it, the plain "
                f"timber wall above that door bare as well. Right of the house: a shadowed slot "
                f"between buildings, cold fog light deep inside it, crates and barrels stacked "
                f"against the walls; then a dark timber counting house whose doorway is marked by "
                f"a small green glass lamp burning emerald over it. Far right: the wet "
                f"board-and-cobble path runs on out of the right edge under a tall black lamp post "
                f"with a warm amber lantern, its long reflection running along the boards toward "
                f"the viewer; at the extreme right edge a second tall lamp post with a warm amber "
                f"lantern throws its pool across the wet stones, the path continuing out of frame "
                f"beneath it; between the two lamps a short flight of worn stone steps climbs "
                f"between the houses to a small open gate with a faint warm lamp beyond, the steps "
                f"catching the lamp light. The lower third is one continuous, completely empty and "
                f"unobstructed wet walking band from the left edge to the right edge, nobody and "
                f"nothing standing in it, shining with the reflections of the lamps. The whole "
                f"painting is deserted: not a single person, no figures, no silhouettes of people. "
                f"No signboard of any kind, no shop sign, no signpost, no hanging sign, no blank "
                f"board, no plaque, no flat painted panel, no painted letters, numbers or words, "
                f"no labels, no UI. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/dock_cinema_wide.webp"),

    ("bg_tavern_cinema_wide", "image", BG_MODEL,
     {"prompt": f"Full-bleed ultra-wide panoramic side-on painting of the interior of a dockside "
                f"tavern at night, the same world and brushwork as the harbour's night paintings: "
                f"deep indigo shadow, dark oak, warm amber lantern light. At the far left a heavy "
                f"plank door with black iron hinges stands wide open onto cold indigo night, the "
                f"harbour water and fog and a distant warm lamp just visible outside, and a long "
                f"cold blue wedge of night light falls across the worn plank floor from the "
                f"threshold. Left of centre a small-paned window shows indigo water and a faint "
                f"green harbour lamp. The centre is dark oak posts and smoke-blackened beams with "
                f"fishing nets, glass floats and coiled rope hanging high above head height; "
                f"against the back wall, clear of the walking aisle, stands a long dark plank table "
                f"with a single pewter mug on it and benches tucked beneath, a few barrels and "
                f"crates stacked beside it. The right half is a long polished bar counter of dark "
                f"wood, rows of bottles on shelves behind it, pewter tankards, a brass hand-bell "
                f"catching a small bright glint, and two iron lanterns hanging over the bar with "
                f"warm amber pools; the bar is the warmest, brightest part of the room, and the "
                f"counter's near edge and the bell are rimmed with warm light. The lower third is "
                f"one continuous, completely empty walkable aisle of worn dark plank floor from the "
                f"open door at the left edge to the bar at the right, no stools, tables, barrels or "
                f"mugs standing in it, wet-looking boards carrying both the cold blue door light "
                f"and the warm amber bar light. The room is deserted: not a single person, no "
                f"figures, no bartender, no drinkers. No menu board, no chalkboard, no painted sign, "
                f"no poster, no notice, no paper on the walls, no framed panel, no lettering or "
                f"numbers anywhere, no labels, no UI. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/tavern_cinema_wide.webp"),

    ("bg_office_cinema_wide", "image", BG_MODEL,
     {"prompt": f"Full-bleed ultra-wide panoramic side-on painting of the interior of a "
                f"harbourmaster's house at night on a fog-bound quay, the same dark timber "
                f"architecture as the harbour outside: deep indigo shadow, panelled walls, beamed "
                f"ceiling, broad worn plank floor. At the far left a plank door stands wide open "
                f"onto cold blue fog and the wet stone quay, a faint iron lamp glowing outside, a "
                f"cold silver-blue wedge of fog light falling in across the threshold boards. "
                f"Left of centre a tall small-paned window looks out on the harbour: a full moon "
                f"above black water and the dark masts of one moored ship, a faint green lamp far "
                f"off, cold moonlight falling in a broad pale beam that lays a bright cold patch "
                f"on the floor boards. Centre and right: tall shelves crowded with ledgers, "
                f"wooden boxes and brass nautical instruments; at the right a heavy oak desk with "
                f"a brass oil lamp burning warm amber, its glow pooling on the desk top, a locked "
                f"drawer with a brass keyhole catching a glint, an open log book and rolled charts "
                f"with brass weights. The cold moon beam and the warm desk-lamp pool meet on the "
                f"floor, and the two sources fight across the room. The lower third is one "
                f"continuous, completely empty walkable floor of worn planks from the open door at "
                f"the left edge to the desk at the right; no chairs, rugs, boxes or furniture "
                f"standing in it. The room is deserted: no people, no seated figure, no "
                f"silhouette. No plaque, no framed certificate, no map with labels, no painted "
                f"lettering or numbers anywhere, no sign, no labels, no UI. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/office_cinema_wide.webp"),

    ("bg_quay_cinema_wide", "image", BG_MODEL,
     {"prompt": f"Full-bleed ultra-wide panoramic strict side-on painting of the short quay "
                f"between an inner harbour and its mouth, on a fog-bound northern island at "
                f"night, the same fog-bound timber waterfront and brushwork as the harbour "
                f"establishing painting. One broad flat wet quay path of grey stone flags runs "
                f"clear across the whole width of the frame in the lower half, shining with long "
                f"warm lantern reflections that lead off both the left and right edges. At the "
                f"left the harbour mouth opens onto indigo open water and cold blue fog: a low "
                f"stone breakwater runs out to a small white stone lighthouse on a distant point, "
                f"its lamp burning gold, a soft gold halo in the fog and a thin gold reflection "
                f"on the water; a black iron bollard and coiled rope sit on the quay edge above "
                f"the path. At the right the inner harbour: the dark bow, furled rigging and tall "
                f"masts of a moored two-masted ship doubled in black water, and behind her the "
                f"corner, chimney and steep slate gable of a tall jettied timber house with a few "
                f"small warm-lit mullioned windows and one iron wall lantern burning amber, wet "
                f"wooden boards under it. Two tall black cast-iron lamp posts with warm amber "
                f"lanterns light the path, one left of centre and one at the right; a few crates "
                f"and barrels stacked against the far wall, none of them in the path. The lower "
                f"third is the clearest, brightest, completely empty and unobstructed walking "
                f"band of the painting, from the left edge to the right edge. Deserted: not a "
                f"single person, no figures, no ship's crew, no signpost, no signboard, no "
                f"lettering or numbers, no labels, no UI. {RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/quay_cinema_wide.webp"),

    ("bg_pierend_cinema_wide", "image", BG_MODEL,
     {"prompt": f"Full-bleed ultra-wide panoramic side-on painting of the far end of a stone "
                f"harbour pier at night, the same fog-bound world and brushwork as the harbour "
                f"establishing painting: indigo night, cold blue fog, wet stone, warm amber "
                f"lights. At the right a tall white stone lighthouse rises at the pier end, its "
                f"great lamp burning gold inside the lantern room, a warm halo in the cold fog and "
                f"a long gold reflection running down across the wet stone; beyond it to the right "
                f"the flat black water and the towering fog bank at the harbour mouth. The centre "
                f"is the pier's broad flat top of wet stone flags running left to right across the "
                f"lower half, iron mooring bollards and coiled ropes along its seaward edge above "
                f"the walking band, and a tall iron lamp post with a warm amber lantern whose pool "
                f"of light falls on the stones in the middle of the pier. At the left the Marrow's "
                f"small lapstrake boat is made fast under the lamp, her sail furled and oars "
                f"shipped, the wet gunwale catching a thin glint, a gangplank down; behind her at "
                f"the far left the warm lights of the harbour town along the quay path run on and "
                f"off the left edge, their long reflections leading back toward the harbour, with "
                f"stacked crates and sacks against the wall above the path. The lower third is one "
                f"continuous, completely empty and unobstructed wet walking band from the left "
                f"edge to the lighthouse at the right. Deserted: not a single person, no figures, "
                f"no captain at the lamp, no signboard, no lettering or numbers, no labels, no UI. "
                f"{RESTART_STYLE}",
      "resolution": "4704x2016 (21:9)", "output_format": "png"}, "scenes/pierend_cinema_wide.webp"),

    # ---------------- music ----------------
    ("music_dock", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "caribbean folk, nautical, gentle accordion and strings, mysterious night harbour, "
              "slow 6/8, atmospheric, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 48, "seed": 7}, "audio/dock.mp3"),

    ("music_sea", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "open sea at dawn, wide and hopeful, gentle strings and accordion over a slow swell, "
              "no percussion, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 44, "seed": 23}, "audio/sea.mp3"),

    ("music_fog", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "fog bank and a silent wreck, uneasy and sparse, low sustained strings, distant metal, "
              "no melody to hold on to, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 44, "seed": 31}, "audio/fog.mp3"),

    ("music_tavern", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "rowdy dockside tavern, fiddle and concertina, stomping jig, warm and humorous, "
              "mid tempo, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 40, "seed": 11}, "audio/tavern.mp3"),

    ("music_office", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "quiet bureaucratic comedy, plucked strings, ticking clock, curious and slightly "
              "sneaky, light chamber ensemble, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 36, "seed": 19}, "audio/office.mp3"),

    # The two optional vistas: the stern gallery at sunset, and the far pans as the fog lifts.
    ("music_sunset", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "sunset on a sailing ship's stern gallery, warm and wistful, slow waltz, solo cello "
              "and soft accordion over gentle strings, a long sea swell, tender and unhurried, "
              "no percussion, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 52, "seed": 41}, "audio/sunset.mp3"),

    ("music_pans", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "mist lifting off shining salt flats beside a quiet lagoon, tender and hopeful, "
              "fingerpicked nylon-string guitar and soft celesta over warm sustained strings, "
              "spacious and gentle, no percussion, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 50, "seed": 53}, "audio/pans.mp3"),
]

# ---------------- the painted cast: standing bodies that sit inside the plates ----------------
# One full-length oil study per cast member, keyed `npc_<id>_body_painted`. These are add-ons: the
# original body entries above stay in the manifest (and on disk), and src/content/assets.ts points
# the live keys at these files. The seated harbourmaster gets the same treatment because that is
# the sprite the office actually shows him in.
MANIFEST += [
    (f"npc_{cid}_body_painted", "image", BG_MODEL, painted_body(desc, pose),
     f"characters/{cid}_body_painted.png")
    for cid, (desc, pose) in PAINTED_BODIES.items()
]
MANIFEST.append(
    ("npc_bramwick_seated_painted", "image", BG_MODEL,
     painted_body(
         PAINTED_BODIES["bramwick"][0],
         "sitting slumped on a low wooden tavern stool with his knees apart, holding a pewter mug "
         "rested on one knee with both hands, facing right in side view, the stool and both boots "
         "visible, weary and closed off",
         "The background is a perfect flat chroma-key magenta from edge to edge, with no painted "
         "backdrop, no dark red wall, no vignette, no texture, no gradient and no floor beneath "
         "the stool"),
     "characters/bramwick_seated_painted.png"))

# The second-wave studies. Each figure is generated once here; the kept studies are the ones
# repointed at in src/content/assets.ts.
for _cid, (_desc, _pose, _extra) in PAINTED_BODIES_V2.items():
    MANIFEST.append((f"npc_{_cid}_body_painted_v2", "image", BG_MODEL,
                     painted_body_v2(_desc, _pose, _extra),
                     f"characters/{_cid}_body_painted_v2.png"))


def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            return json.load(f)
    return {}


def save_cache(c):
    # Resolve a symlink first (a git worktree sharing the main checkout's cache), so the write
    # lands in that file instead of replacing the link with a private copy.
    path = os.path.realpath(CACHE)
    # Other worktrees may be generating against the same cache at the same time. A shared temp
    # name makes the writers race for one file: one wins the replace, the other raises ENOENT.
    # Give each process its own temp file.
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(c, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# Superseded assets: kept in the manifest for the record, never rebuilt.
RETIRED = {"bg_dock", "bg_office", "bg_tavern", "char_walk", "npc_bramwick_body", "npc_marta_body"}

# Scenes that are not room backgrounds but the whole 1920x1080 screen: the cold open's plate.
FULL_PLATES = {"bg_coldopen", "bg_island_map"}

# The visual restart: the painted title/island view is a whole 1920x1080 screen, and the five
# atlas plates are 2560x880 full-bleed paintings cropped from a 21:9 render (the same crop the
# `_wide` room plates use). They are full-bleed paintings, not room backgrounds.
TITLE_PLATES = {"bg_title"}
AREA_PLATES_V2 = {f"bg_area_{area}_v2" for area in ("harbour", "town", "marrow", "shroud", "lantern")}


def output_url(kind, res):
    out = res.get("output") or {}
    if kind == "image":
        lst = out.get("images") or [out.get("image")]
    else:
        lst = out.get("audios") or [out.get("audio")]
    url = lst[0] if lst else None
    if isinstance(url, dict):
        url = url.get("url")
    return url


def postprocess(name, kind, rel, payload, raw, out_path):
    if kind == "image":
        if name in FULL_PLATES or name in TITLE_PLATES:
            post_background(raw, out_path, width=1920, height=1080)
        elif name in AREA_PLATES_V2:
            post_background(raw, out_path, width=2560, height=880)
        elif rel.startswith("scenes/"):
            post_background(raw, out_path, width=2560 if name.endswith("_wide") else SCENE_W)
        elif rel.startswith("props/items/"):
            post_icon(raw, out_path)
        elif rel.startswith("props/"):
            post_sprite(raw, out_path)
        elif name in PAINTED_WALK_KEYS:
            post_painted_walk_sheet(raw, out_path, rear_frames=3 if name == "char_walk_vertical_painted" else 0)
        elif name == "char_elias_painted_v2":
            post_painted_idle(raw, out_path)
        elif "walk" in rel:
            post_walk_sheet(raw, out_path)
        elif (rel.startswith("characters/") and name.startswith("npc_")
              and name not in CHAR_KEYS and name not in PAINTED_BODY_KEYS):
            # Dialogue portraits are full paintings on a dark backdrop. Chroma-keying them
            # divides the backdrop colour back out and leaves banding and red halos.
            post_portrait(raw, out_path)
        elif rel.startswith("characters/"):
            post_sprite(raw, out_path)
        else:
            post_background(raw, out_path)
    else:
        post_audio(raw, out_path, max_seconds=int(payload.get("duration", 60)))


def main(only=None):
    """Generate assets. Returns a list of (name, error) for assets that failed.

    Cache entries are {"sig", "cost", "path"} for finished assets. While a job
    is in flight the entry also carries "pending": {"sig", "request_id", and
    once known "result"}, saved before polling, so a re-run resumes the same
    paid job (poll and/or download) instead of submitting a new one.
    """
    cache = load_cache()
    total = 0.0
    failures = []
    reprocess = bool(os.environ.get("REPROCESS"))
    for name, kind, model, payload, rel in MANIFEST:
        if only and name not in only:
            continue
        if name in RETIRED and not only:
            continue
        out_path = os.path.join(ASSETS, rel)
        if name in CHAR_KEYS:
            payload = dict(payload)
            payload["prompt"] = payload["prompt"] + ", " + CHAR_STYLE
        elif name in PAINTED_CHAR_KEYS:
            payload = dict(payload)
            payload["prompt"] = payload["prompt"] + ", " + PAINTED_FIGURE
        sig = hashlib.sha256(
            json.dumps([model, payload], sort_keys=True).encode()
        ).hexdigest()[:16]

        entry = cache.get(name, {})
        pending = entry.get("pending")
        if pending and pending.get("sig") != sig:
            pending = None  # payload changed since that job; it is no longer wanted
        if not reprocess and not pending and entry.get("sig") == sig and os.path.exists(out_path):
            print(f"[skip] {name} (cached)")
            continue

        print(f"[gen ] {name}  ->  {rel}", flush=True)
        t0 = time.time()
        raw_path = os.path.join(ROOT, ".genraw", f"{name}.raw")

        try:
            if reprocess and os.path.exists(raw_path):
                # Re-run post-processing on a cached render — no API call, no charge.
                print(f"       reprocessing {raw_path}")
                with open(raw_path, "rb") as f:
                    raw = f.read()
                cost = entry.get("cost", 0) if entry.get("sig") == sig else 0
                spent = 0
            else:
                if pending and pending.get("result"):
                    print(f"       resuming download for job {pending['request_id']}")
                    res = pending["result"]
                else:
                    def remember(rid):
                        entry["pending"] = {"sig": sig, "request_id": rid}
                        cache[name] = entry
                        save_cache(cache)

                    rid = pending.get("request_id") if pending else None
                    if rid:
                        print(f"       resuming job {rid}")
                    try:
                        res = run(model, payload, request_id=rid, on_submit=remember)
                    except ApiError as e:
                        # A failed/cancelled/unknown job cannot be resumed: forget
                        # it so the next run submits afresh. Transient errors and
                        # timeouts keep it, so the next run resumes the same job.
                        if isinstance(e, JobFailed) or e.code in (404, 410):
                            if entry.pop("pending", None) is not None:
                                save_cache(cache)
                        raise
                    entry["pending"]["result"] = {
                        "output": res.get("output") or {},
                        "cost": res.get("cost", 0) or 0,
                    }
                    save_cache(cache)
                url = output_url(kind, res)
                raw = download(url, raw_path)
                cost = spent = res.get("cost", 0) or 0
            postprocess(name, kind, rel, payload, raw, out_path)
        except Exception as e:
            print(f"[FAIL] {name}: {e}", flush=True)
            failures.append((name, str(e)))
            continue

        total += spent
        cache[name] = {"sig": sig, "cost": cost, "path": rel}
        save_cache(cache)
        print(f"       done in {time.time() - t0:.0f}s  ${spent:.4f}", flush=True)

    print(f"\nTotal spend this run: ${total:.4f}")
    print(f"Assets in {ASSETS}")
    if failures:
        print(f"\n{len(failures)} asset(s) FAILED:")
        for name, err in failures:
            print(f"  - {name}: {err}")
    return failures


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
