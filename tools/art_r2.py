#!/usr/bin/env python3
"""
Art repaint pass r2 for The Brass Compass: separate manifest, separate cache, hard spend cap.

  python3 tools/art_r2.py list                 # plan, tiers, estimates, status. No network.
  python3 tools/art_r2.py guides               # render the two pose-guide strips (local, free)
  python3 tools/art_r2.py run NAME [--dry]     # ONE job. --dry prints payload + guard verdict only
  python3 tools/art_r2.py run --tier 1 [--max-jobs N]
  python3 tools/art_r2.py spend                # ledger total, open reservations, headroom
  python3 tools/art_r2.py settle               # list open reservations / timed-out jobs (no changes)
  python3 tools/art_r2.py settle --clear ID --confirm-unbilled   # owner: that job was never billed
  python3 tools/art_r2.py promote NAME         # copy a chosen candidate to its final *_r2 name
  python3 tools/art_r2.py pack-side|pack-vertical NAME...   # assemble per-cell takes / strips

Rules enforced here (not by convention):
  * never writes to an existing path (candidates go to public/assets/candidates_r2/, finals are
    new *_r2 names; promote refuses to overwrite);
  * every submit is preceded by a ledger reservation at the job's CEILING price and the run stops
    (exit 3) if ledger_total + job ceiling > CAP; jobs not marked `reserve` also stop at SOFT_CAP;
  * the actual cost from the API result is written to the ledger before download/post-processing;
  * its own cache (.art_r2_cache.json) and ledger (.art_r2_ledger.jsonl): generate.py's MANIFEST
    and .gencache.json are never touched. ART_R2_CACHE / ART_R2_LEDGER relocate them (a fresh
    ledger would hide the spend), so they are refused unless --allow-ledger-override is passed;
  * a job whose result reports no cost is booked at its expected price, and a timed-out job
    (which may have been billed) counts as spent until the owner settles it.
"""
import argparse, base64, hashlib, json, os, shutil, sys, time
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if os.environ.get("ART_R2_TOOLS"): sys.path.insert(1, os.environ["ART_R2_TOOLS"])  # draft testing only
import generate as g  # helpers only: run/download/key_out/post_*; importing makes no request

ROOT = g.ROOT
ASSETS = g.ASSETS
CAND = os.path.join(ASSETS, "candidates_r2")
CACHE = os.environ.get("ART_R2_CACHE") or os.path.join(ROOT, ".art_r2_cache.json")
LEDGER = os.environ.get("ART_R2_LEDGER") or os.path.join(ROOT, ".art_r2_ledger.jsonl")
CAP = 15.00      # owner's hard cap for this pass (new spend only; see plan, decision 1)
SOFT_CAP = 12.00 # non-reserve jobs stop here, leaving ~$3 for re-rolls
CEIL = {g.BG_MODEL: 0.035, g.EDIT_MODEL: 0.06}  # per-image ceilings; the edit model's real price is unrecorded
EXPECT = {g.BG_MODEL: 0.028, g.EDIT_MODEL: 0.035}

STYLE_EDIT = g.REPAINT_STYLE
BODY_BG = g.REPAINT_BODY_FRAME


# ------------------------------------------------------------------ jobs
def _ref_png(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def plate_ref(rel):
    """A 2560x880 plate as a 21:9 reference: mirror-pad 108/109 rows top and bottom (the inverse of
    post_background's centre crop), so the model sees a native 21:9 canvas and the crop returns
    exactly the original framing."""
    from PIL import Image, ImageOps
    im = Image.open(os.path.join(ASSETS, rel)).convert("RGB")
    pad = (round(im.width * 9 / 21) - im.height) // 2  # 2560*9/21=1097 -> 108
    top = ImageOps.flip(im.crop((0, 0, im.width, pad)))
    bot = ImageOps.flip(im.crop((0, im.height - pad, im.width, im.height)))
    out = Image.new("RGB", (im.width, im.height + 2 * pad))
    out.paste(top, (0, 0)); out.paste(im, (0, pad)); out.paste(bot, (0, pad + im.height))
    buf = BytesIO(); out.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def J(name, kind, prompt, resolution, out, refs=(), post="plate", tier=1, takes=1, reserve=False, note=""):
    return dict(name=name, model=g.EDIT_MODEL if kind == "edit" else g.BG_MODEL, prompt=prompt,
                resolution=resolution, out=out, refs=list(refs), post=post, tier=tier,
                takes=takes, reserve=reserve, note=note)


JOBS = []  # filled by plan_jobs() in jobs_r2.py (prompts live in the plan file); kept separate to
# keep this runner short: `from jobs_r2 import JOBS`.
try:
    from jobs_r2 import build as _build
    JOBS = _build(J, plate_ref, g, STYLE_EDIT, BODY_BG)
except ImportError:
    pass


# ------------------------------------------------------------------ ledger
def ledger_rows():
    if not os.path.exists(LEDGER):
        return []
    with open(LEDGER) as f:
        return [json.loads(l) for l in f if l.strip()]


def ledger_state():
    """(spent, open_reserved). A reservation with no done/failed row is counted at its ceiling:
    a crashed job may have been billed. A timed-out job is booked as spent at its ceiling."""
    done, reserved, timed_out = 0.0, {}, {}
    for r in ledger_rows():
        if r["event"] == "reserve":
            reserved[r["id"]] = r["amount"]
        elif r["event"] in ("done", "failed"):
            reserved.pop(r["id"], None)
            done += r["amount"]
        elif r["event"] == "timeout":       # may have been billed: counted as spent, not as open
            reserved.pop(r["id"], None)
            timed_out[r["id"]] = r["amount"]
        elif r["event"] == "settle_open":   # manual: owner confirmed the job was never billed
            reserved.pop(r["id"], None)
        elif r["event"] == "settle_timeout":
            timed_out.pop(r["id"], None)
    return done + sum(timed_out.values()), sum(reserved.values())


def ledger_write(row):
    row["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(json.dumps(row) + "\n"); f.flush(); os.fsync(f.fileno())


def observed_ceiling(model):
    """Ceiling for the next job of `model`: the table value until a real price has been logged,
    then 1.25x the dearest logged price (so one surprise price tightens the guard at once)."""
    seen = [r["amount"] for r in ledger_rows() if r["event"] == "done" and r.get("model") == model and r["amount"] > 0 and not r.get("estimated")]
    return 1.25 * max(seen) if seen else CEIL[model]


def booked_cost(res, model):
    """(amount to record, whether it is an estimate). An API result with no cost, or a cost of 0,
    is not a free image: it is booked at the model's expected price so the cap can still trip."""
    try:
        cost = float((res or {}).get("cost") or 0)
    except (TypeError, ValueError):
        cost = 0.0
    if cost > 0:
        return cost, False
    return EXPECT[model], True


def guard(job):
    spent, open_res = ledger_state()
    ceil = observed_ceiling(job["model"])
    total_if = spent + open_res + ceil
    limit = CAP if job["reserve"] else SOFT_CAP
    return total_if <= limit, spent, open_res, ceil, limit


# ------------------------------------------------------------------ cache
def load_cache():
    return json.load(open(CACHE)) if os.path.exists(CACHE) else {}


def save_cache(c):
    tmp = f"{CACHE}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(c, f, indent=2); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, CACHE)


# ------------------------------------------------------------------ one job
def build_payload(job):
    p = {"prompt": job["prompt"], "resolution": job["resolution"], "output_format": "png"}
    if job["refs"]:
        p["image"] = [r() if callable(r) else g.reference_uri(r) for r in job["refs"]]
    return p


def cand_path(job):
    """Every take lands under its own job name in candidates_r2/, never beside or over a live file."""
    ext = ".webp" if job["post"] == "plate" else ".png"
    return os.path.join(CAND, job["name"] + ext)


def run_job(job, dry=False):
    payload = build_payload(job)
    sig = hashlib.sha256(json.dumps([job["model"], {k: (v if k != "image" else [hashlib.sha256(i.encode()).hexdigest()[:12] for i in v]) for k, v in payload.items()}], sort_keys=True).encode()).hexdigest()[:16]
    out = cand_path(job)
    cache = load_cache()
    ent = cache.get(job["name"], {})
    if ent.get("sig") == sig and os.path.exists(out):
        print(f"[skip] {job['name']} cached -> {out}")
        return 0.0
    if os.path.exists(out):
        raise SystemExit(f"refusing to overwrite {out}")
    ok, spent, open_res, ceil, limit = guard(job)
    print(f"[plan] {job['name']}: spent ${spent:.3f} + open ${open_res:.3f} + ceiling ${ceil:.3f} vs limit ${limit:.2f} -> {'OK' if ok else 'STOP'}")
    if dry:
        print(json.dumps({k: (v if k != "image" else [f"<{len(i)//1024} KB data uri>" for i in v]) for k, v in payload.items()}, indent=1)[:3000])
        return 0.0
    if not ok:
        raise SystemExit(3)
    jid = f"{job['name']}:{int(time.time())}"
    ledger_write({"event": "reserve", "id": jid, "job": job["name"], "model": job["model"], "amount": ceil})
    try:
        res = g.run(job["model"], payload)
    except Exception as e:
        # A failed or cancelled job is not billed; a timeout (or any other error) may be, so it
        # is booked as spent at the ceiling until the owner settles it (`settle`).
        if isinstance(e, g.JobFailed):
            ledger_write({"event": "failed", "id": jid, "job": job["name"], "model": job["model"], "amount": 0.0})
        else:
            ledger_write({"event": "timeout", "id": jid, "job": job["name"], "model": job["model"], "amount": ceil})
        raise
    cost, estimated = booked_cost(res, job["model"])
    ledger_write({"event": "done", "id": jid, "job": job["name"], "model": job["model"], "amount": cost,
                  **({"estimated": True} if estimated else {})})
    raw = g.download(g.output_url("image", res), os.path.join(ROOT, ".genraw", job["name"] + ".raw"))
    os.makedirs(CAND, exist_ok=True)
    postprocess(job, raw, out)
    cache[job["name"]] = {"sig": sig, "cost": cost, "estimated": estimated, "path": os.path.relpath(out, ASSETS)}
    save_cache(cache)
    spent2, _ = ledger_state()
    print(f"       done ${cost:.4f}   running total ${spent2:.4f} / ${CAP:.2f}   -> {out}")
    return cost


def postprocess(job, raw, out):
    post = job["post"]
    if post == "plate":     # centre-crop of the 21:9 render back to 2560x880, as every _wide plate
        g.post_background(raw, out, width=2560)
    elif post == "portrait":
        g.post_portrait(raw, out)
    elif post == "sprite":  # key magenta + trim, like the painted bodies
        g.post_sprite(raw, out)
    elif post in ("strip_side", "strip_vertical"):
        g.post_painted_walk_sheet(raw, out, rear_frames=3 if post == "strip_vertical" else 0)
    elif post == "cell":    # one keyed, trimmed figure; packed later by pack-side/pack-vertical
        g.post_sprite(raw, out)
    else:
        raise SystemExit("unknown post " + post)


# ------------------------------------------------------------------ plate acceptance check
def check_plate(old_rel, new_path, lights, dark_target=(55, 100)):
    """Fast geometry/readability gate for a repainted plate (no network). Prints PASS/FAIL lines.
    lights: [(x, y)] taken from the room's `light` lines."""
    import numpy as np
    from PIL import Image, ImageFilter
    old = Image.open(os.path.join(ASSETS, old_rel)).convert("RGB")
    new = Image.open(new_path).convert("RGB")
    assert old.size == new.size, f"size {old.size} != {new.size}"
    lo, ln = np.asarray(old.convert("L"), float), np.asarray(new.convert("L"), float)
    print(f"mean luminance old {lo.mean():.0f} -> new {ln.mean():.0f} (target {dark_target[0]}-{dark_target[1]})")
    # structure above the foreground band: correlation of log-luminance gradient maps, so a pure
    # re-grade (darker, same shapes) still scores ~1 while moved or reinvented shapes score low
    def edges(im):
        a = np.log1p(np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(3)), float))
        gx, gy = np.gradient(a); return np.hypot(gx, gy)
    eo, en = edges(old)[:640], edges(new)[:640]
    corr = np.corrcoef(eo.ravel(), en.ravel())[0, 1]
    print(f"structure correlation above y=640: {corr:.2f} (>=0.60 PASS on log-gradient)")
    for (x, y) in lights:
        r, R = 45, 160
        def contrast(l):
            core = l[max(0, y - r):y + r, max(0, x - r):x + r].max()
            ring = l[max(0, y - R):y + R, max(0, x - R):x + R].mean()
            return core - ring
        co, cn = contrast(lo), contrast(ln)
        print(f"light ({x},{y}): local contrast old {co:.0f} new {cn:.0f} -> {'PASS' if cn >= 0.6 * co else 'CHECK (lamp weaker or moved)'}")
    band = ln[760:880]
    print(f"foreground band y760-880: std {band.std():.1f} (old {lo[760:880].std():.1f}); want clearly higher than old")


# ------------------------------------------------------------------ walk-sheet assembly (per-cell takes)
def pack_cells(paths, out, frames_height=937, pad_x=18, pad_bottom=7, canvas_h=1100, strength=0.8):
    """Pack N keyed single-figure PNGs into one sheet on the shipped convention (cell = widest figure
    + 2*18 px, 1100 px tall, soles on y=1092, median figure height 937 as tools/normalize_walk_sheet.py)
    after matching every figure's colour statistics to the median figure (fixes the dark frame)."""
    import numpy as np
    from PIL import Image
    figs = []
    for p in paths:
        im = Image.open(p).convert("RGBA")
        a = np.asarray(im)[:, :, 3] > 16
        ys, xs = np.where(a)
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        s = frames_height / im.height
        figs.append(im.resize((max(1, round(im.width * s)), frames_height), Image.LANCZOS))
    def stats(im):
        a = np.asarray(im).astype(float); m = a[:, :, 3] > 128
        px = a[m][:, :3]; return px.mean(0), px.std(0) + 1e-6
    st = [stats(f) for f in figs]
    tm = np.median([s[0] for s in st], 0); ts = np.median([s[1] for s in st], 0)
    matched = []
    for f, (mu, sd) in zip(figs, st):
        a = np.asarray(f).astype(float)
        rgb = (a[:, :, :3] - mu) / sd * ts + tm
        a[:, :, :3] = np.clip(a[:, :, :3] * (1 - strength) + rgb * strength, 0, 255)
        matched.append(Image.fromarray(a.astype("uint8"), "RGBA"))
    cw = max(f.width for f in matched) + 2 * pad_x
    sheet = Image.new("RGBA", (cw * len(matched), canvas_h), (0, 0, 0, 0))
    for i, f in enumerate(matched):
        sheet.alpha_composite(f, (i * cw + (cw - f.width) // 2, canvas_h - pad_bottom - f.height + 1))
    sheet.save(out)
    print(f"{out}: {len(matched)} cells {cw}x{canvas_h}")


# ------------------------------------------------------------------ CLI
def cmd_list():
    spent, open_res = ledger_state()
    cache = load_cache()
    print(f"ledger: spent ${spent:.3f}, open reservations ${open_res:.3f}, cap ${CAP:.2f}, soft ${SOFT_CAP:.2f}")
    run_total = 0.0
    for j in sorted(JOBS, key=lambda j: (j["tier"], j["name"])):
        e = EXPECT[j["model"]] * j["takes"]; run_total += e
        print(f"T{j['tier']} {j['name']:38s} {('edit' if j['model']==g.EDIT_MODEL else 't2i'):4s} takes {j['takes']} ~${e:.3f} cum ~${run_total:.2f} {'[done]' if j['name'] in cache else ''}")


def open_reservations():
    """(id, kind, row) for every reservation still open, and every timed-out job not yet settled."""
    rows = ledger_rows()
    open_, timed = {}, {}
    for r in rows:
        ev, i = r["event"], r.get("id")
        if ev == "reserve": open_[i] = r
        elif ev in ("done", "failed", "settle_open"): open_.pop(i, None)
        elif ev == "timeout": open_.pop(i, None); timed[i] = r
        elif ev == "settle_timeout": timed.pop(i, None)
    return [(i, "open", r) for i, r in open_.items()] + [(i, "timed out", r) for i, r in timed.items()]


def cmd_settle(clear, confirmed):
    """List what is still counted against the cap without a final price; the owner may clear one
    that was never billed (check the provider's dashboard first)."""
    pending = open_reservations()
    if not clear:
        if not pending: print("nothing open: every reservation has a final price")
        for i, kind, r in pending:
            print(f"{kind:9s} {i}  {r['model']}  ${r['amount']:.3f} counted against the cap")
        if pending: print("to release one the provider never billed: settle --clear ID --confirm-unbilled")
        return
    hit = next(((i, k, r) for i, k, r in pending if i == clear), None)
    if not hit: raise SystemExit(f"no open or timed-out reservation {clear!r} (run `settle` to list them)")
    if not confirmed: raise SystemExit("refusing to release spend without --confirm-unbilled (the owner's statement that it was not billed)")
    ledger_write({"event": "settle_open" if hit[1] == "open" else "settle_timeout", "id": clear, "note": "owner confirmed unbilled"})
    s, o = ledger_state(); print(f"released {clear}; spent ${s:.4f} open ${o:.4f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd"); ap.add_argument("names", nargs="*")
    ap.add_argument("--dry", action="store_true"); ap.add_argument("--tier", type=int)
    ap.add_argument("--max-jobs", type=int, default=999)
    ap.add_argument("--clear"); ap.add_argument("--confirm-unbilled", action="store_true")
    ap.add_argument("--allow-ledger-override", action="store_true",
                    help="honour ART_R2_LEDGER / ART_R2_CACHE (a different ledger hides the real spend)")
    a = ap.parse_args()
    if (os.environ.get("ART_R2_LEDGER") or os.environ.get("ART_R2_CACHE")) and not a.allow_ledger_override:
        raise SystemExit("ART_R2_LEDGER / ART_R2_CACHE move the spend ledger and would bypass the cap; "
                         "unset them, or pass --allow-ledger-override if this is a test")
    if a.cmd == "settle": return cmd_settle(a.clear, a.confirm_unbilled)
    if a.cmd == "list": return cmd_list()
    if a.cmd == "spend":
        s, o = ledger_state(); print(f"spent ${s:.4f} open ${o:.4f} headroom to cap ${CAP - s - o:.4f}, to soft ${SOFT_CAP - s - o:.4f}"); return
    if a.cmd == "guides":
        from guides import side_guide, vertical_guide
        d = os.path.join(CAND, "guides"); os.makedirs(d, exist_ok=True)
        side_guide().save(os.path.join(d, "guide_side.png")); vertical_guide().save(os.path.join(d, "guide_vertical.png")); print("guides ->", d); return
    if a.cmd == "run":
        sel = [j for j in JOBS if (j["name"] in a.names) or (a.tier and j["tier"] == a.tier and not a.names)]
        if not sel: raise SystemExit("no jobs selected")
        for j in sel[: a.max_jobs]:
            run_job(j, dry=a.dry)
        return
    if a.cmd == "promote":
        j = next(j for j in JOBS if j["name"] == a.names[0]); src = cand_path(j); dst = os.path.join(ASSETS, j["out"])
        if os.path.exists(dst): raise SystemExit(f"{dst} exists; promote never overwrites")
        shutil.copy2(src, dst); print("promoted ->", dst); return
    raise SystemExit("unknown command")


if __name__ == "__main__":
    main()
