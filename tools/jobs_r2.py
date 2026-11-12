"""Job table for tools/art_r2.py. build() returns the list of job dicts (one per paid call)."""
import os

SALT_COMMON = (
    "Repaint this exact panoramic game plate, keeping the composition, every building, mast, fence, "
    "boat, lantern, fire and horizon line in precisely the same position, size and shape: it is a "
    "re-grade and a foreground repaint, not a new picture. Lower the whole exposure to a moonless "
    "indigo night: deep slate-blue sky, pewter water, cold silver-blue fog rim on silhouettes, the "
    "brightest things in the picture are the existing amber lanterns and firelight, which keep "
    "their exact places and glow, with a warm amber key pooling on the ground and props around each lamp and fire; "
    "the picture stays readable, mid-dark overall, like the other night plates of the game. The empty pale foreground becomes dark wet ground with real "
    "painted detail and loaded visible brushwork. The bottom fifth stays an open, continuous walkable "
    "strip with only low flat texture on it (no object taller than a few percent of the picture "
    "height anywhere in the central seventy percent of the width); larger props sit only in the "
    "extreme left and right corners and along the very bottom edge. No people, no figures, no text, "
    "no lettering, no signs, no labels, no UI, no border, no frame. ")

ROOMS = {
    "far_pans": ("scenes/far_pans_v2b_wide.webp",
        "FOREGROUND: the huge white salt-crust band across the bottom third becomes dark blue-grey wet salt "
        "crust: cracked polygonal plates, shallow puddles holding broken amber and silver reflections, "
        "raked furrows, scattered salt-grey crumbs, a few reed tufts and a coil of wet rope in the lower "
        "corners, a half-buried broken rake at the bottom-left, a dark upturned crate at the bottom-right. "
        "The white salt mounds on the pans and the boardwalk stay but turn blue-grey and dim."),
    "lagoon_shore": ("scenes/lagoon_shore_v2b_wide.webp",
        "FOREGROUND: the empty pale sand band becomes dark wet rippled sand with tide-lines, small pools "
        "reflecting the lantern, strands of black kelp, scattered shells and pebbles, a bleached "
        "driftwood log and a coiled mooring rope at the extreme bottom-left, a half-sunk barrel and "
        "reed tufts at the extreme bottom-right. The longboat, the wreck in the fog, the lamp post and "
        "the palisade with its small lit windows keep their exact places."),
    "salt_camp": ("scenes/salt_camp_v2b_wide.webp",
        "FOREGROUND: the bright blue-white salt apron along the bottom becomes dark, salt-stained trodden "
        "ground: boot prints, scattered salt crystals dulled to blue-grey, wet patches, a few sacks "
        "slumped against the bottom-left edge, a salt-caked barrel and a coil of rope at the "
        "bottom-right corner, a trail of dropped rake-teeth marks. The tents, washing line, store hut "
        "with its lit lamp, brazier and pallet keep their exact places; the salt pans' white surfaces "
        "turn pewter and indigo."),
    "key_gate": ("scenes/key_gate_v2b_wide.webp",
        "EXPOSURE: much darker than the reference, a deep indigo night with only the fires, the green ghost lantern and "
        "their reflections bright; the sky is deep slate-blue, not light blue. FOREGROUND: the empty wet sand in front becomes "
        "darker, rippled and puddled with the gate's firelight and the brazier reflected in it, kelp and shells along the "
        "tide-line, a snapped oar and a coil of rope lying flat near the bottom-right corner only. NOTHING at all stands on the "
        "left half of the bottom edge or in front of the gate: keep it open wet sand, no crates, no stacks, no planks. The palisade, "
        "the gate and its fire, the longboat, the brazier on its tripod and the ghost ship with its green lantern keep their exact places."),
}


def build(J, plate_ref, g, STYLE_EDIT, BODY_BG):
    jobs = []
    here = os.path.join(g.ASSETS, "candidates_r2", "guides")

    def guide(name):
        def f():
            import base64
            return "data:image/png;base64," + base64.b64encode(open(os.path.join(here, name), "rb").read()).decode()
        return f

    def takes(n, name, **kw):
        for i in range(n):
            tail = f" Painter's take {'abc'[i]}."  # distinct payload => distinct cache key, not a seed
            kw2 = dict(kw); kw2["prompt"] = kw["prompt"] + tail
            jobs.append(J(f"{name}_{'abc'[i]}", **{**kw2, "out": kw["out"]}))

    # ---- P1 walk sheets (tier 1)
    WALK_HEAD = (
        "Image 1 is a pose guide: coloured stick figures on magenta, one per cell, showing the exact limb "
        "positions of each frame of a walk cycle. Image 2 is the character. Redraw every stick figure "
        "as the character of image 2 -- {FENN} -- the same man in all six frames: same face, same short "
        "dark curly hair, same navy coat with brass buttons, same white shirt, same brown boots, the "
        "same worn leather satchel on its strap hanging at the same hip every frame. Follow the guide's "
        "pose in each cell exactly (legs, knees, feet and arms; stride length as in the guide). "
        "Same figure height, same lighting and same colour values in every frame: warm amber key from the "
        "left, cold blue-grey rim light on the right-hand edge, deep indigo shadow. Both soles flat and opaque, "
        "feet on one shared floor line, clear magenta gaps between the figures; none of the guide's "
        "stick-figure colours or shapes remain. Image 2 only supplies the identity, costume and lighting: do NOT copy its standing pose. Every "
        "frame is a different mid-walk pose with a long stride and visibly swinging arms; two frames must never look alike. ").format(FENN=g.FENN)
    takes(3, "walk_side_r2_strip", kind="edit", resolution="3136x1344 (21:9)",
          out="characters/elias_walk_v2_painted_r2.png", post="strip_side", tier=1,
          refs=[guide("guide_side.png"), "characters/elias_painted_v2.png"],
          prompt=WALK_HEAD + "Strict side view facing right in all six cells: 1 contact with the near foot's heel "
          "forward, 2 down, 3 passing with the far leg swinging through and its foot lifted clear, 4 contact with the far "
          "foot forward, 5 down, 6 passing with the near leg swinging through; arms swing opposite to the legs. " +
          BODY_BG + " " + STYLE_EDIT)
    takes(3, "walk_vertical_r2_strip", kind="edit", resolution="3136x1344 (21:9)",
          out="characters/elias_walk_vertical_painted_r2.png", post="strip_vertical", tier=1,
          refs=[guide("guide_vertical.png"), "characters/elias_painted_v2.png"],
          prompt=WALK_HEAD + "Cells 1-3 show him from directly behind walking away (satchel strap across his back); "
          "cells 4-6 show him from directly in front walking toward the viewer (strap across his chest). In each "
          "triple: cell 1 left foot stepping with the right heel lifted, cell 2 passing with the right foot lifted clear of the "
          "floor and the knee bent, cell 3 right foot stepping with the left heel lifted. The legs must clearly differ "
          "from cell to cell. " + BODY_BG + " " + STYLE_EDIT)

    # ---- P2 salt-pan rooms (tier 2): edit, 21:9 padded reference, centre-cropped back to 2560x880
    for room, (rel, fg) in ROOMS.items():
        takes(2, f"{room}_r2", kind="edit", resolution="3136x1344 (21:9)",
              out=rel.replace("_v2b_wide.webp", "_r2_wide.webp"), post="plate", tier=2,
              refs=[(lambda r=rel: plate_ref(r))],
              prompt=SALT_COMMON + fg + " " + g.RESTART_STYLE)

    # ---- P3 Nib + cast relight (tier 3)
    takes(3, "nib_portrait_r2", kind="edit", resolution="1728x2304 (3:4)", out="characters/nib_painted_r2.png",
          post="portrait", tier=3, refs=["characters/nib_painted.png"],
          prompt=("Repaint this exact portrait of Nib, a bored seventeen-year-old office clerk, keeping the pose, the green "
                  "eyeshade, the grey waistcoat, the sleeve garters and the pen behind his ear. Rebuild the FACE from life: a "
                  "real tired adolescent boy, heavy-lidded ordinary small eyes with visible lid folds and shadowed sockets, a "
                  "stronger brow, a longer nose, thin dry lips, slight sallow skin with uneven colour, a bony jaw; not "
                  "androgynous, not pretty, not soft, no large irises, no drawn eyelashes, no smooth skin. Give him the unflattering details of a "
                  "real overworked teenager: a few blemishes and a spotty chin, faint dark circles under the eyes, chapped lips, thicker straight "
                  "eyebrows, a slightly crooked nose with a visible bridge, a prominent Adam's apple, sticking-out ears, greasy hair. Loaded visible brushstrokes "
                  "on the face. " + STYLE_EDIT))
    takes(2, "nib_body_r2", kind="edit", resolution="1728x2304 (3:4)", out="characters/nib_body_painted_r2.png",
          post="sprite", tier=3, refs=["characters/nib_body_painted.png"],
          prompt=("Repaint this exact full-body figure of Nib, keeping pose and costume (grey waistcoat, garters, eyeshade, "
                  "pen). Same teenage boy's real face as a tired adolescent with ordinary small eyes, not manga. The whole "
                  "figure from hair to both soles stays in frame. " + BODY_BG + " " + STYLE_EDIT))
    RELIGHT = ("Repaint this exact full-body figure keeping the same person, pose, costume and proportions, only "
               "re-lighting and re-grading it to match the cast: warm amber key light on the figure's LEFT side, cold "
               "blue-grey rim light along the RIGHT edge, deep indigo shadow side, clothing values {how}. The whole "
               "figure from hair to soles stays in frame. ")
    for cid, rel, how in [
        ("dorrit", "characters/dorrit_body_painted.png", "darkened about 30 percent so the white apron is a warm grey-cream, not a bright flat white"),
        ("quill", "characters/quill_body_painted.png", "darkened about 20 percent with a visible cold rim"),
        ("pike", "characters/pike_body_painted_v2.png", "darkened about 20 percent, the grey coat modelled with colour, warm left / cool right"),
        ("tam", "characters/tam_body_painted_v2.png", "slightly cooler in the shadows, with a cold rim on the right"),
        ("vex", "characters/vex_body_painted.png", "lifted slightly out of the near-black with a clear cold rim on the right and warm gold braid highlights"),
        ("ansel", "characters/ansel_body_painted.png", "the rim sides swapped to warm left / cool right, overall darker by about 15 percent"),
    ]:
        takes(2, f"cast_{cid}_r2", kind="edit", resolution="1728x2304 (3:4)",
              out=rel.replace(".png", "_r2.png"), post="sprite", tier=3, refs=[rel],
              prompt=RELIGHT.format(how=how) + BODY_BG + " " + STYLE_EDIT)

    # ---- prop swap: the story gave Tam Hobb the Arcadia's boathook instead of a salt rake (tier 3)
    takes(2, "tamhobb_boathook_r2", kind="edit", resolution="1728x2304 (3:4)",
          out="characters/tamhobb_body_boathook_r2.png", post="sprite", tier=3,
          refs=["characters/tamhobb_body_painted.png"],
          prompt=("Edit this exact full-body figure of Tam Hobb: change ONLY the object he holds. Replace the wooden salt rake "
                  "with a ship's boathook: a long straight weathered wooden pole of the same length, thickness and angle as the "
                  "rake handle, held in the same hands in the same grip, its blunt iron-shod butt resting on the ground where the "
                  "rake's head rested, and at the top end above his hands one curved black-iron hook with a short straight spike "
                  "beside it, clearly visible and fully inside the frame. No rake teeth, no rake head, no comb. Keep his face, pose, bald "
                  "head and beard, torn sleeveless shirt with salt crust, tattoo, trousers, bare feet, lighting, proportions, colours and "
                  "framing exactly identical. " + BODY_BG + " " + STYLE_EDIT))

    # ---- P4 style unification pilots (tier 4): light restyle toward the restart/painted finish
    UNI = ("Repaint this exact panoramic game plate keeping the composition, geometry, every object and every lamp in "
           "exactly the same place; change only the finish: remove any dark ink outline and hard cartoon edge, "
           "replace crisp vector-like contours with soft lost-and-found painted edges, add loaded visible brush "
           "strokes and scumbled half-tones, keep deep coloured indigo shadows, a few warm amber lantern cores and a cold "
           "silver-blue rim; keep the same overall brightness and colour balance. No text, no signs, no people. ")
    for room, rel, extra in [
        ("tavern", "scenes/tavern_cinema_wide.webp", "Keep the bar, shelves, bottles and tankards, the open door and the green window exactly where they are."),
        ("pier_end", "scenes/pierend_cinema_wide.webp", "Tone the over-saturated cobalt sky to slate-indigo with softer cloud and keep the lighthouse, lamp and bollards as they are."),
        ("marrow_gallery", "scenes/gallery_v2_wide.webp", "Keep the sunset but paint it as the same oil hand: less graphic, more broken colour, a cooler shadowed deck; keep the balustrade, wake and doors."),
    ]:
        takes(2, f"{room}_r2", kind="edit", resolution="3136x1344 (21:9)",
              out=rel.replace(".webp", "").replace("_wide", "_r2_wide") + ".webp", post="plate", tier=4,
              refs=[(lambda r=rel: plate_ref(r))], prompt=UNI + extra + " " + g.RESTART_STYLE)

    # ---- fallbacks / stretch (tier 5): only if tier 1 or 2 fail acceptance
    for c in range(1, 7):
        phases = ["contact, near heel forward, far toe pushing off", "down, weight on the near knee",
                  "passing, far leg swinging through with the foot lifted", "contact, far heel forward, near toe pushing off",
                  "down, weight on the far knee", "passing, near leg swinging through with the foot lifted"]
        takes(2, f"walk_side_r2_cell{c}", kind="edit", resolution="1728x2304 (3:4)",
              out=f"characters/walk_cells_r2/side_{c}.png", post="cell", tier=5,
              refs=["characters/elias_painted_v2.png"],
              prompt=("Redraw this exact character -- same face, hair, navy coat, satchel, boots, lighting -- in a strict "
                      f"side view facing right, mid-walk, pose: {phases[c-1]}. Full body, both soles flat and opaque, the whole "
                      "figure inside the frame at the same scale as the reference. " + BODY_BG + " " + STYLE_EDIT))
    for room, (rel, fg) in ROOMS.items():
        takes(2, f"{room}_t2i", kind="t2i", resolution="3136x1344 (21:9)",
              out=rel.replace("_v2b_wide.webp", "_t2i_wide.webp"), post="plate", tier=5,
              prompt=g.RESTART_PLATE + " Salt-pan room at night, same layout as the old plate. " + fg + " " + g.RESTART_STYLE)

    # ================= ROUND 2 (tier 6) =================
    # 1. the bell the Act IV puzzle needs, painted into the strongest plate (grafted locally afterwards)
    takes(3, "lantern_bell_r2", kind="edit", resolution="3136x1344 (21:9)",
          out="scenes/lantern_deck_bell_r2_wide.webp", post="plate", tier=6,
          refs=[(lambda: plate_ref("scenes/lantern_deck_restart_b_wide.webp"))],
          prompt=("Edit this exact panoramic painting of the Grey Lantern's ghost ship: add exactly ONE object and change nothing "
                  "else. Hanging from a black-iron bracket on the main mast, just below the lowest large furled yard, slightly "
                  "left of the mast and left of the picture's centre (about 47 percent across and 38 percent down), paint a weathered "
                  "ship's bell: dull verdigris-streaked brass, flared lip, a crown with a rope loop, a dark iron clapper plainly "
                  "visible hanging inside the mouth, and a short frayed rope trailing down from it. It is about 12 percent of the "
                  "picture height tall so it reads at a glance, painted with the same loose brushwork as the rigging. Lit by the same "
                  "spectral emerald glow from behind and the mist, with one small warm amber glint on its shoulder and rim, fog "
                  "softening its edges. Every other thing (mast, rigging, sails, great lantern, deck, rail, fog, colours, composition) "
                  "stays exactly as in the reference. No text, no lettering, no people."))

    # 2. salt-room foregrounds: wet crust / mud / brine and scattered salt-works clutter, upper plate untouched
    FG = ("Edit this exact night plate: keep everything above the foreground band exactly as it is (composition, buildings, boats, "
          "lamps, fires, sky, colours). Repaint ONLY the lowest quarter of the picture, the empty foreground band, as the apron of a "
          "working salt flat: irregular crusted wet grey-blue salt and dark mud, shallow pools of standing brine reflecting the "
          "lamps and fires in warm amber, dried-salt ridges and cracks, rake furrows and spilled salt crystals. Spread across the "
          "whole width of that band, in its upper half, a few salt workers' things with clear gaps between them: two or three wooden "
          "salt rakes lying or leaning, a wicker basket or two heaped with salt, a coil of rope, a wooden barrel tipped on its side "
          "spilling salt, a broken crate. Every object is low (under 6 percent of the picture height), none sits in the bottom 8 "
          "percent of the picture or in front of a doorway, gate or path, and the bottom strip stays open flat ground. It must NOT "
          "look like cobblestones, pavers, tiles or regular polygons: irregular crust and mud only. Same cold night key, mid-dark overall. "
          "No text, no lettering, no people, no signs. ")
    for room, extra in [
        ("far_pans", "The pans' water, the boardwalk, the heron, the camp and the lamp stay unchanged. "),
        ("key_gate", "The gate, the fire at the gate, the longboat, the brazier and the palisade stay unchanged; the way to the gate stays clear. "),
        ("lagoon_shore", "The sand becomes wet rippled sand and mud with shallow brine pools; instead of salt rakes use a fishing net, oars, lobster pots and a basket. "),
    ]:
        takes(3 if room == "far_pans" else 2, f"{room}_fg2", kind="edit", resolution="3136x1344 (21:9)",
              out=f"scenes/{room}_fg2_wide.webp", post="plate", tier=6,
              refs=[(lambda r=room: plate_ref(f"scenes/{r}_r2_wide.webp"))], prompt=FG + extra)
    takes(2, "salt_camp_sack", kind="edit", resolution="3136x1344 (21:9)",
          out="scenes/salt_camp_sack_wide.webp", post="plate", tier=6,
          refs=[(lambda: plate_ref("scenes/salt_camp_r2_wide.webp"))],
          prompt=("Edit this exact night plate and change only one thing: remove the pile of sacks at the bottom-left corner and replace it "
                  "with open wet salt-crusted ground and a few spilled salt crystals, so nothing stands at the left end of the bottom "
                  "edge. Keep the barrel and coil of rope at the bottom-right and everything else exactly as it is. No text, no people."))

    # 3. Nib: fresh text-to-image (older teen / young adult) plus one edit that takes the current painting as the style reference
    NIB2 = ("Hand-painted adventure game dialogue portrait, head and shoulders, of Nib, a tired young clerk of nineteen who looks older "
            "than his years: a lean face with a defined jaw, clear cheekbones, a straight strong nose and a slight shadow of stubble, "
            "tired observant dark-ringed eyes that watch rather than stare, thick brows, short messy mousy-brown hair, a green celluloid "
            "eyeshade pushed up on his forehead with a pen tucked into it, a grey waistcoat over a white shirt, black armbands on both "
            "upper arms and ink-stained cuffs. Painted from life in the manner of a traditional oil portrait: loaded visible brushstrokes "
            "across the face, hair and cloth, planes of warm amber lantern key on one side and cold blue-grey rim light on the other, deep "
            "indigo shadow, a dark neutral background of loose painted strokes. A real adult-looking young man's face, not boyish, not "
            "soft, not pretty, not androgynous, no large irises, no drawn eyelashes, no smooth skin, not anime, not manga, not a 3D "
            "render, no text, no lettering, no watermark.")
    for i in range(3):
        jobs.append(J(f"nib_portrait_t2i_{'abc'[i]}", kind="t2i", prompt=NIB2 + f" Painter's take {'abc'[i]}.", resolution="1728x2304 (3:4)",
                      out="characters/nib_painted_r3.png", post="portrait", tier=6))
    jobs.append(J("nib_portrait_edit2_a", kind="edit", resolution="1728x2304 (3:4)", out="characters/nib_painted_r3.png", post="portrait", tier=6,
                  refs=["characters/nib_painted_r2.png"],
                  prompt=("Repaint this exact portrait of Nib keeping his pose, the green eyeshade with the pen, the grey waistcoat and the black "
                          "armbands with ink stains, but age the face to a tired nineteen-year-old man: a leaner face, a defined jaw and cheekbones, "
                          "a stronger straight nose, a faint stubble shadow, tired observant eyes with dark rings, thick brows, no soft youthful "
                          "cheeks, not boyish, not pretty. Keep the loaded brushwork and lighting. " + STYLE_EDIT)))

    # 4. Dorrit relight, explicit about the apron
    jobs.extend([J(f"cast_dorrit_r2b_{'ab'[i]}", kind="edit", resolution="1728x2304 (3:4)", out="characters/dorrit_body_painted_r3.png",
                   post="sprite", tier=6, refs=["characters/dorrit_body_painted.png"],
                   prompt=("Repaint this exact full-body figure of Dorrit keeping the same man, face, pose, blue waistcoat, rolled sleeves and "
                           "trousers, but the apron is NOT bright white: it is a warm grey-cream, dull and worn, with grease, soup and "
                           "flour stains and a faint brown tint in the folds, no pure white anywhere. Lower the overall value of the whole figure, "
                           "so the brightest tone is a soft cream; warm amber key on the left, cold blue-grey rim on the right, deep indigo shadows. "
                           "The whole figure from head to soles stays in frame. " + BODY_BG + " " + STYLE_EDIT + f" Take {'ab'[i]}."))
                 for i in range(2)])

    # 5. side walk with exaggerated arm swing
    jobs.extend([J(f"walk_side_r3_strip_{'ab'[i]}", kind="edit", resolution="3136x1344 (21:9)", out="characters/elias_walk_v2_painted_r3.png",
                   post="strip_side", tier=6, refs=[guide("guide_side3.png"), "characters/elias_painted_v2.png"],
                   prompt=WALK_HEAD + "Strict side view facing right in all six cells. Arm swing is large and obvious and opposite to the legs: in the "
                   "contact cells (1 and 4) the arm on the side of the leading leg swings far back and the other arm swings far forward with a "
                   "slightly bent elbow, the hands well away from the coat; in the passing cells (3 and 6) the arms hang close to the body; in the "
                   "down cells (2 and 5) they are halfway. Legs: 1 and 4 long stride, heel forward, toe pushing off behind; 3 and 6 the legs pass "
                   "with the lifted foot's knee bent and the foot clear of the floor. The coat skirts flare with the stride. " +
                   BODY_BG + " " + STYLE_EDIT + f" Take {'ab'[i]}.")
                 for i in range(2)])

    # round 2b: key_gate foreground retry, dark ground kept, props only
    takes(2, "key_gate_fg3", kind="edit", resolution="3136x1344 (21:9)", out="scenes/key_gate_fg3_wide.webp", post="plate", tier=7,
          refs=[(lambda: plate_ref("scenes/key_gate_r2_wide.webp"))],
          prompt=("Edit this exact night plate: keep EVERYTHING exactly as it is, including the dark wet blue-grey sand and its firelit "
                  "reflections, the sky, the palisade, the gate and its fire, the boat, the brazier and the ghost ship. Do NOT whiten, "
                  "brighten or snow over the ground: the sand stays dark, wet and rippled. Only ADD a few low, weathered salt-works things "
                  "lying on the dark sand in the foreground: two wooden salt rakes lying on the ground, a wicker basket heaped with a little salt, "
                  "a coil of wet rope, a wooden barrel tipped on its side with a small spill of salt, a couple of broken crate boards. Place "
                  "them on the middle and right part of the foreground, between the gate and the brazier, each under 6 percent of the picture "
                  "height, with clear gaps; leave the lower-left corner, the path in front of the gate and the very bottom edge of the picture "
                  "completely empty. Same cold night light with warm amber reflections. No text, no people, no signs."))

    # ================= ROUND 3 (tier 8) =================
    DAWN_STYLE = ("Hand-painted digital oil painting with loaded visible brushwork and broad confident strokes, rich filmic grade: "
                  "deep indigo and slate-blue shadows that stay coloured, a pale gold and rose dawn key, thinning silver mist, "
                  "wet timber and still water catching broken gold reflections. No text, no lettering, no signage, no flags with writing, "
                  "no people, no palm trees, nothing tropical, no UI, no border, no frame, no watermark.")
    DAWN_SCENE = ("Panoramic painting for a point-and-click game, seen flat side-on at eye level: the harbour of Dreadwater at first light "
                  "after the fog has lifted, seen from the end of a weathered wooden pier. In the foreground the dark wet planks and "
                  "mooring posts of the pier with a coil of rope. Calm flat water stretches away, glittering with pale gold and rose light. "
                  "Moored at their buoys across the harbour are several returned ships and small boats: a tall three-masted ship with furled "
                  "sails, a brigantine, two fishing boats and a rowing skiff, all in silhouette against the glow. Along the far shore the "
                  "dark crooked half-timbered harbour houses with a few last warm window lights going out, and a pale headland. The sky is "
                  "a high dawn sky, indigo at the top fading to pale gold and rose at the horizon behind the centre of the picture, with the last "
                  "thin banks of mist dissolving over the water and a low sun just above the horizon in the centre. The sea beyond the harbour "
                  "mouth is open and clear: the grey fog is gone. ")
    for i in range(2):
        jobs.append(J(f"fog_lifts_t2i_{'ab'[i]}", kind="t2i", resolution="3136x1344 (21:9)", out="scenes/shore_wide_r3.webp", post="plate", tier=8,
                      prompt=DAWN_SCENE + DAWN_STYLE + f" Painter's take {'ab'[i]}."))
    jobs.append(J("fog_lifts_edit_a", kind="edit", resolution="3136x1344 (21:9)", out="scenes/shore_wide_r3.webp", post="plate", tier=8,
                  refs=[(lambda: plate_ref("scenes/dock_cinema_wide.webp"))],
                  prompt=("Repaint this exact painting of the Dreadwater harbour as the same place at DAWN after the fog has lifted, same oil "
                          "hand and same crooked half-timbered houses, quay, steps, lamp posts and moored ship in the same positions, but: the "
                          "deep blue night becomes a clear dawn sky, indigo at the top fading to pale gold and rose behind the central house "
                          "roofs, the heavy blue fog is gone leaving only a few thin silvery wisps near the water, the cobbles and the water "
                          "reflect pale gold-rose light, the window lamps and the lanterns are small and soft against the daylight (their glow "
                          "faint), the green lamp becomes an ordinary dark lantern. Add two or three small moored fishing boats and a rowing skiff "
                          "on the still water at the left beside the tall ship, whose sails stay furled. Shadows stay coloured indigo, "
                          "key light warm gold from the centre. No text, no lettering, no people, no flags, no UI.")))

    # r3 job 2: far_pans left third relit (grafted locally afterwards)
    for i in range(2):
        jobs.append(J(f"far_pans_relight_{'ab'[i]}", kind="edit", resolution="3136x1344 (21:9)", out="scenes/far_pans_r3b_wide.webp", post="plate", tier=8,
                      refs=[(lambda: plate_ref("scenes/far_pans_r3_wide.webp"))],
                      prompt=("Edit this exact night plate: keep the composition, every object and every position exactly the same, and change ONLY "
                              "the lighting of the left third of the picture (the wooden pier on the left with its posts and rails, the grey heron "
                              "standing in the shallows, the white salt mounds, the rakes leaning against them and the pans beside them). Relight "
                              "that area with a soft cold silver-blue moonlight from above and behind: a clear pale blue rim light along the top "
                              "edges of the pier beams and posts, the heron's back, neck and head, and the crests of the salt mounds and rake handles, "
                              "so they separate from the dark water and read at a glance; lift the deep shadows there to a readable slate-blue with "
                              "visible wood grain and salt crystals, and give the water beside them a faint pale reflection. The sky, the right "
                              "two-thirds, the lantern, the tents, the wreck, the foreground props and the colour of the rest of the picture stay "
                              "exactly as they are. Mid-dark overall, still a night scene. No text, no people, no lettering. " + f"Take {'ab'[i]}.")))

    # r3 job 6: lagoon_shore foreground, props only at the edges, sand stays dark
    for i in range(2):
        jobs.append(J(f"lagoon_shore_fg3_{'ab'[i]}", kind="edit", resolution="3136x1344 (21:9)", out="scenes/lagoon_shore_fg3_wide.webp", post="plate", tier=8,
                      refs=[(lambda: plate_ref("scenes/lagoon_shore_r2_wide.webp"))],
                      prompt=("Edit this exact night plate: keep EVERYTHING exactly as it is, including the dark wet blue-grey rippled sand, the tide "
                              "pools, the longboat, the driftwood log, the barrel, the reeds, the wreck, the lamp post, the palisade and the sky. Do NOT "
                              "whiten or brighten the sand, and do NOT put any net, line, rope or fence across the middle of the picture: the whole centre "
                              "of the foreground stays open dark sand. Only ADD a few small weathered things lying on the dark sand close to the left "
                              "and right edges, in the lower quarter: a pair of wooden oars lying flat and a wicker lobster pot near the left edge beside "
                              "the driftwood, a small wicker basket and a coil of wet rope near the right edge beside the barrel, plus a few extra "
                              "scattered shells and a strand of black kelp. Each object is low and small (under 6 percent of the picture height). "
                              "Same cold night light. No text, no people, no signs. " + f"Take {'ab'[i]}.")))
    return jobs
