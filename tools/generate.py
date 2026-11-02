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
import urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
CACHE = os.path.join(ROOT, ".gencache.json")
BASE = "https://model-api.runcomfy.net"

# Target logical resolution of the game.
SCENE_W, SCENE_H = 1920, 880


def api_key():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("RUNCOMFY_API"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("RUNCOMFY_API missing from .env")


KEY = api_key()


def _req(path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(
        BASE + path, data=body, method="POST" if data is not None else "GET"
    )
    r.add_header("Authorization", "Bearer " + KEY)
    if body:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_body": e.read().decode()[:400]}


def run(model_id, payload, timeout=1200):
    sub = _req(f"/v1/models/{model_id}", payload)
    if "request_id" not in sub:
        raise RuntimeError(f"submit failed: {sub}")
    rid = sub["request_id"]
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = _req(f"/v1/requests/{rid}/status")
        if st.get("status") in ("completed", "succeeded", "failed", "cancelled"):
            res = _req(f"/v1/requests/{rid}/result?include_cost=true")
            if res.get("status") == "failed":
                raise RuntimeError(f"job failed: {res.get('error')}")
            return res
        time.sleep(5)
    raise RuntimeError("timeout")


def download(url, path):
    r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(r, timeout=300) as resp:
        data = resp.read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return data


# --------------------------------------------------------------------------
# Post-processing
# --------------------------------------------------------------------------

def post_background(raw_bytes, out_path, width=SCENE_W):
    """Cover-fit a render to the game's scene resolution."""
    from PIL import Image, ImageEnhance, ImageFilter

    im = Image.open(BytesIO(raw_bytes)).convert("RGB")
    tw, th = width, SCENE_H
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


def post_walk_sheet(raw_bytes, out_path, frames=6):
    """Key a sprite strip, then re-pack it into even, baseline-aligned cells."""
    from PIL import Image
    from normalize_sheet import main as normalize

    im = key_out(Image.open(BytesIO(raw_bytes)))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path)
    normalize(out_path, out_path)
    return Image.open(out_path).size


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

BG_MODEL = "bytedance/seedream-5/lite/text-to-image"
BG_RES = "2848x1600 (16:9)"

# Characters must sit inside painterly backgrounds without looking pasted on.
CHAR_STYLE = ("rendered in the same painterly style as a cinematic adventure game background: "
              "oil-painted digital illustration, visible brushwork, soft warm rim lighting, "
              "muted natural colour palette, semi-realistic proportions, detailed fabric folds, "
              "no cartoon outlines, no cel shading, integrated filmic colour grade")
CHAR_KEYS = {
    "char_elias", "char_walk", "npc_bramwick_body", "npc_marta_body",
    "char_walk_v2", "char_walk_vertical", "npc_bramwick_body_v2", "npc_marta_body_v2",
    "npc_quill_body", "npc_vane_body", "npc_silas_body", "npc_rook_body",
    "npc_nell_body", "npc_tam_body", "npc_onn_body",
    "npc_dorrit_body", "npc_hobb_body",
    "npc_ansel_body", "npc_pike_body", "npc_tamhobb_body",
    "npc_nib_body", "npc_bramwick_seated", "npc_weather_body",
}

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


MANIFEST = [
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
     {"prompt": "Painted character portrait, head and shoulders, of a strong-featured woman in her "
                "fifties who runs a dockside tavern: broad shoulders, greying auburn hair tied back, "
                "red kerchief, rolled sleeves, canvas apron, arms crossed, a knowing and slightly "
                "dangerous smile, warm lantern light from the left, painterly adventure game dialogue "
                "portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/tavernkeep.png"),

    # ---------------- props & on-screen figures ----------------
    ("prop_crate", "image", BG_MODEL,
     {"prompt": "A single wooden galley crate, lid prised open, packed tight with lemons, matte "
                "aged weathered planks with iron corner straps, muted natural colours, "
                "oil-painted digital illustration with visible brushwork, not a 3D render, no "
                "gloss, three-quarter view, soft side lighting, flat solid magenta background "
                "(#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/crate.png"),

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
     portrait("quill"), "characters/quill.png"),

    ("npc_vane", "image", BG_MODEL,
     {"prompt": "Painted character portrait, head and shoulders, of a weathered pirate captain, a "
                "woman in her fifties, tricorn hat, grey-streaked hair tied back, a scar through "
                "one eyebrow, tarnished brass braid on her collar, level unimpressed gaze, warm "
                "rim light, deep shadow, painterly adventure game dialogue portrait, dark neutral "
                "background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/vane.png"),

    ("prop_spyglass", "image", BG_MODEL,
     {"prompt": "A single brass spyglass, worn and dented, lying at a slight angle on nothing, "
                "painted adventure game prop, dramatic side lighting, flat solid magenta "
                "background (#FF00FF), no shadow, no ground, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "props/spyglass.png"),

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
     {"prompt": "Painted character portrait, head and shoulders, of an old worn-out ship's "
                "navigator in his seventies, deep-lined face, white stubble, a tarred coat collar, "
                "tired knowing eyes, warm lamp light from one side, deep shadow, painterly "
                "adventure game dialogue portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/rook.png"),

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
     {"prompt": "Painted character portrait, head and shoulders, of a village market seller, a "
                "weather-beaten woman in her fifties, headscarf knotted tight, gold earring, shrewd "
                "amused eyes, warm lantern light from one side, deep shadow, painterly adventure game "
                "dialogue portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/nell.png"),

    ("npc_tam", "image", BG_MODEL,
     {"prompt": "Painted character portrait, head and shoulders, of a village child about ten, "
                "freckled, missing a tooth, an oversized flat cap pushed back, bright curious eyes, "
                "warm lantern light from one side, deep shadow, painterly adventure game dialogue "
                "portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/tam.png"),

    ("npc_onn", "image", BG_MODEL,
     {"prompt": "Painted character portrait, head and shoulders, of an old village woman in her "
                "seventies, deep-lined face, grey hair under a dark shawl, a small iron cross at her "
                "throat, wary eyes, warm lantern light from one side, deep shadow, painterly adventure "
                "game dialogue portrait, dark neutral background, no text",
      "resolution": "1728x2304 (3:4)", "output_format": "png"}, "characters/onn.png"),

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

    ("npc_ansel", "image", BG_MODEL, portrait("ansel"), "characters/ansel.png"),
    ("npc_ansel_body", "image", BG_MODEL,
     body("ansel", "standing with his arms flung wide in delighted welcome, a folded patchwork flag under one arm, side three-quarter view"), "characters/ansel_body.png"),
    ("npc_pike", "image", BG_MODEL, portrait("pike"), "characters/pike.png"),
    ("npc_pike_body", "image", BG_MODEL,
     body("pike", "standing stiffly to attention holding his clipboard to his chest, side three-quarter view"), "characters/pike_body.png"),
    ("npc_tamhobb", "image", BG_MODEL, portrait("tamhobb"), "characters/tamhobb.png"),
    ("npc_tamhobb_body", "image", BG_MODEL,
     body("tamhobb", "standing leaning on a long wooden salt rake, side three-quarter view"), "characters/tamhobb_body.png"),

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

    # ---------------- music ----------------
    ("music_dock", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "caribbean folk, nautical, gentle accordion and strings, mysterious night harbour, "
              "slow 6/8, atmospheric, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 48, "seed": 7}, "audio/dock.mp3"),

    ("music_tavern", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "rowdy dockside tavern, fiddle and concertina, stomping jig, warm and humorous, "
              "mid tempo, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 40, "seed": 11}, "audio/tavern.mp3"),

    ("music_office", "audio", "acestep-ai/ace-step-1.5/text-to-audio",
     {"tags": "quiet bureaucratic comedy, plucked strings, ticking clock, curious and slightly "
              "sneaky, light chamber ensemble, instrumental, loopable",
      "lyrics": "[instrumental]", "duration": 36, "seed": 19}, "audio/office.mp3"),
]


def load_cache():
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    return {}


def save_cache(c):
    json.dump(c, open(CACHE, "w"), indent=2)


# Superseded assets: kept in the manifest for the record, never rebuilt.
RETIRED = {"bg_dock", "bg_office", "bg_tavern", "char_walk", "npc_bramwick_body", "npc_marta_body"}


def main(only=None):
    cache = load_cache()
    total = 0.0
    for name, kind, model, payload, rel in MANIFEST:
        if only and name not in only:
            continue
        if name in RETIRED and not only:
            continue
        out_path = os.path.join(ASSETS, rel)
        if name in CHAR_KEYS:
            payload = dict(payload)
            payload["prompt"] = payload["prompt"] + ", " + CHAR_STYLE
        sig = hashlib.sha256(
            json.dumps([model, payload], sort_keys=True).encode()
        ).hexdigest()[:16]

        if not os.environ.get("REPROCESS") and cache.get(name, {}).get("sig") == sig and os.path.exists(out_path):
            print(f"[skip] {name} (cached)")
            continue

        print(f"[gen ] {name}  ->  {rel}", flush=True)
        t0 = time.time()

        raw_path = os.path.join(ROOT, ".genraw", f"{name}.raw")
        if os.environ.get("REPROCESS") and os.path.exists(raw_path):
            # Re-run post-processing on a cached render — no API call, no charge.
            print(f"       reprocessing {raw_path}")
            raw = open(raw_path, "rb").read()
            res = {"output": {}, "cost": 0}
            kind_override = kind
        else:
            kind_override = kind
            try:
                res = run(model, payload)
            except Exception as e:
                print(f"[FAIL] {name}: {e}")
                continue

        out = res.get("output", {})
        if kind_override == "image":
            url = (out.get("images") or [out.get("image")] or [None])[0]
            raw = raw if os.environ.get("REPROCESS") and os.path.exists(raw_path) else download(url, raw_path)
            if rel.startswith("scenes/"):
                post_background(raw, out_path, width=2560 if name.endswith("_wide") else SCENE_W)
            elif rel.startswith("props/"):
                post_sprite(raw, out_path)
            elif "walk" in rel:
                post_walk_sheet(raw, out_path)
            elif rel.startswith("characters/") and name.startswith("npc_") and name not in CHAR_KEYS:
                # Dialogue portraits are full paintings on a dark backdrop. Chroma-keying them
                # divides the backdrop colour back out and leaves banding and red halos.
                post_portrait(raw, out_path)
            elif rel.startswith("characters/"):
                post_sprite(raw, out_path)
            else:
                post_background(raw, out_path)
        else:
            if os.environ.get("REPROCESS") and os.path.exists(raw_path):
                raw = open(raw_path, "rb").read()
            else:
                url = (out.get("audios") or [out.get("audio")])[0]
                raw = download(url, raw_path)
            post_audio(raw, out_path, max_seconds=int(payload.get("duration", 60)))

        cost = res.get("cost", 0) or 0
        total += cost
        cache[name] = {"sig": sig, "cost": cost, "path": rel}
        save_cache(cache)
        print(f"       done in {time.time() - t0:.0f}s  ${cost:.4f}", flush=True)

    print(f"\nTotal spend this run: ${total:.4f}")
    print(f"Assets in {ASSETS}")


if __name__ == "__main__":
    main(sys.argv[1:] or None)
