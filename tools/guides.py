"""Pose-guide strips for the walk-sheet edit jobs (local, free, no network).

Stick figures on flat magenta: thick limbs, head disc, one colour per limb so the model can tell
near/far legs. Side guide: 6 poses facing right. Front/back guide: 3 rear + 3 front poses.
"""
import math
from PIL import Image, ImageDraw

MAG = (255, 0, 255)
RED, BLUE, GREEN, YEL, WHITE = (230, 40, 40), (40, 80, 240), (30, 200, 60), (250, 220, 0), (255, 255, 255)


def _pt(o, ang, ln):  # angle in degrees from straight down, + = forward (right)
    a = math.radians(ang)
    return (o[0] + math.sin(a) * ln, o[1] + math.cos(a) * ln)


def _leg(hip, thigh, knee, L=1.0):
    k = _pt(hip, thigh, 0.5 * L)
    a = _pt(k, thigh - knee, 0.5 * L)
    return k, a


# (near thigh, near knee flex, far thigh, far knee flex, near arm swing, far arm swing, bob)
SIDE = [
    (38, 3, -30, 16, -38, 38, 0.00),    # 1 contact: near foot heel-strike forward, far toe pushing off
    (18, 30, -34, 46, -22, 22, -0.03), # 2 down: weight onto near leg, knee soft, body lowest
    (0, 0, 30, 88, 4, -4, 0.025),       # 3 passing: far leg swings through, foot lifted by the knee, body highest
    (-30, 16, 38, 3, 38, -38, 0.00),    # 4 contact: far foot forward, near foot trailing
    (-34, 46, 18, 30, 22, -22, -0.03), # 5 down on the far leg
    (30, 88, 0, 0, -4, 4, 0.025),       # 6 passing: near leg swings through
]


def side_guide(size=(3136, 1344), cells=6, fig_h=0.70):
    W, H = size
    im = Image.new("RGB", size, MAG)
    d = ImageDraw.Draw(im)
    cw = W / cells
    ground = H * 0.90
    L = fig_h * H * 0.50       # leg length
    T = fig_h * H * 0.34       # torso length
    for i, (nt, nk, ft, fk, na, fa, bob) in enumerate(SIDE[:cells]):
        cx = cw * (i + 0.5)
        # hip height from the lowest ankle so a foot always touches the ground
        def drop(t, k):
            kn, an = _leg((0, 0), t, k, L)
            return an[1]
        hy = ground - max(drop(nt, nk), drop(ft, fk)) + bob * H
        hip = (cx, hy)
        sh = (cx - 0.01 * H, hy - T)
        w = int(0.035 * H)
        # far limbs first (blue), then torso, then near limbs (red)
        for (t, k, c) in ((ft, fk, BLUE),):
            kn, an = _leg(hip, t, k, L)
            d.line([hip, kn, an], fill=c, width=w, joint="curve")
            d.line([an, (an[0] + 0.07 * H, an[1])], fill=c, width=w)
        fe = _pt(sh, fa, 0.35 * T * 2)
        d.line([sh, fe], fill=BLUE, width=int(w * 0.7))
        d.line([hip, sh], fill=GREEN, width=int(w * 1.6))
        hd = (sh[0] + 0.01 * H, sh[1] - 0.07 * H)
        r = 0.045 * H
        d.ellipse([hd[0] - r, hd[1] - r, hd[0] + r, hd[1] + r], fill=YEL)
        d.line([hd, (hd[0] + r * 1.4, hd[1])], fill=WHITE, width=6)  # nose = facing right
        kn, an = _leg(hip, nt, nk, L)
        d.line([hip, kn, an], fill=RED, width=w, joint="curve")
        d.line([an, (an[0] + 0.07 * H, an[1])], fill=RED, width=w)
        ne = _pt(sh, na, 0.35 * T * 2)
        d.line([sh, ne], fill=RED, width=int(w * 0.7))
    return im


# Front/back: (left foot raise, right foot raise, left foot x-shift, right foot x-shift, bob)
# raise = fraction of the leg length the foot is lifted off the floor (a heel-up trailing foot
# or a swinging foot); a planted foot is 0. Shifts are in figure heights.
FRONT = [
    (0.00, 0.14, -0.015, 0.015, 0.00),   # A: left foot planted (the stepping foot), right heel up and trailing
    (0.00, 0.40, 0.000, 0.005, 0.015),   # B: passing: left planted, right knee up, foot clear of the floor
    (0.14, 0.00, -0.015, 0.015, 0.00),   # C: right foot planted (stepping), left heel up and trailing
]


def vertical_guide(size=(3136, 1344), fig_h=0.70):
    W, H = size
    im = Image.new("RGB", size, MAG)
    d = ImageDraw.Draw(im)
    cw = W / 6
    ground = H * 0.90
    FH = fig_h * H
    L = 0.45 * FH
    T = 0.30 * FH
    w = int(0.035 * H)
    for i in range(6):
        rear = i < 3
        lr, rr, lx, rx, bob = FRONT[i % 3]
        cx = cw * (i + 0.5)
        hy = ground - L * 0.97 + bob * H
        hip_w = 0.04 * H
        for side, rise, shift, col in ((-1, lr, lx, RED), (1, rr, rx, BLUE)):
            foot = (cx + side * (hip_w + 0.015 * H) + shift * FH, ground - rise * L)
            knee = (cx + side * (hip_w + 0.03 * H) + shift * FH * 0.5, (hy + foot[1]) / 2 + (rise * L * 0.15))
            d.line([(cx + side * hip_w, hy), knee, foot], fill=col, width=w, joint="curve")
            d.ellipse([foot[0] - w * 0.9, foot[1] - w * 0.3, foot[0] + w * 0.9, foot[1] + w * 0.5], fill=col)
        sh = (cx, hy - T)
        d.line([(cx, hy), sh], fill=GREEN, width=int(w * 2.4))
        d.line([(cx - 0.09 * H, sh[1] + 10), (cx + 0.09 * H, sh[1] + 10)], fill=GREEN, width=int(w * 0.8))
        r = 0.045 * H
        hd = (cx, sh[1] - 0.07 * H)
        d.ellipse([hd[0] - r, hd[1] - r, hd[0] + r, hd[1] + r], fill=YEL)
        if not rear:
            d.line([(hd[0] - r * .5, hd[1]), (hd[0] + r * .5, hd[1])], fill=WHITE, width=6)  # a face
        for side in (-1, 1):
            d.line([(cx + side * 0.09 * H, sh[1] + 10), (cx + side * 0.105 * H, hy + 0.02 * H)],
                   fill=RED if side < 0 else BLUE, width=int(w * 0.7))
    return im


if __name__ == "__main__":
    import sys
    out = sys.argv[1]
    side_guide().save(out + "/guide_side.png")
    vertical_guide().save(out + "/guide_vertical.png")


def side_guide3(size=(3136, 1344), cells=6):
    """Same legs as side_guide, arms swung hard at contact (+/-62 deg), halfway in the down cells,
    hanging near the body in the passing cells."""
    global SIDE
    old = SIDE
    swing = [(-62, 62), (-34, 34), (-6, 6), (62, -62), (34, -34), (6, -6)]
    SIDE = [(a, b, c, d, sw[0], sw[1], h) for (a, b, c, d, _e, _f, h), sw in zip(old, swing)]
    try:
        return side_guide(size, cells)
    finally:
        SIDE = old
