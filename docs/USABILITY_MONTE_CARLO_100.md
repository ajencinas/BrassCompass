# 100-Player Monte Carlo Usability Study

**Build:** `ccc6fde` · 25-room painted build
**Method:** 100 independent agent testers; 10 personas × 10 gameplay situations, with rotating
path variations. Each tester read 3–5 current screenshots and returned structured findings.
**Valid responses:** 99 (one failed to return).
**Scale:** 1 = unplayable for this persona, 5 = clear and enjoyable.

## Headline

| Metric | Result |
|---|---|
| Pass / friction / blocker | **0 / 98 / 1** |
| Average score | **2.9 / 5** |
| Would keep playing | **96 / 99** |
| Issue mentions | **1 blocker, 235 major, 64 minor** |
| Testers who found the experience friction-free | **0** |

This is not a rejection of the game. 96 of 99 wanted to continue: the world, art, characters and
story hook land. The friction is concentrated in **wayfinding, legibility and keyboard access** —
the layer between a player and the good content.

## Where the friction is

Frequency of issue mentions by area:

| Area | Mentions |
|---|---|
| Navigation / exits | 51 |
| Legibility | 43 |
| Onboarding / objective | 26 |
| HUD | 22 |
| Map / atlas | 17 |
| Dialogue | 11 |
| Puzzle affordance | 8 |
| Feedback | 6 |
| Ending | 6 |
| Recap | 3 |

Every one of the ten scenarios produced friction; none produced a clean pass. The dock-to-harbour-
mouth route produced the only blocker.

## The blocker

**Keyboard-only players cannot act or travel.** The footer documents only
“Click a thing to act · right-click to look · hold Q to reveal”; the atlas footer says
“Click a place to travel · A or Escape to close.” Tab/arrow targeting, Enter-to-act and
Enter-to-travel are neither implemented in the documented flow nor visible. A motor-impaired
tester scored this 2/5 and stopped.

**Fix:** Tab/arrow focus with a visible ring on scene hotspots and atlas rows; Enter to act/travel;
list the keys in the footer.

## Top findings, ranked

### 1. Exits are invisible or inconsistent
Tester after tester could not tell how to leave a room. The tavern has no visible door; the helm,
crow’s nest and stern gallery show no way back; the fog rooms show no path out; only the captain’s
cabin shows a small `»`. The HUD never explains that the edge of a scene or a painted door is an
exit, and Reveal is a held key most players never try.

**Fix:** one persistent, labelled exit affordance per exit (chevron + “Down to deck” / “Leave —
The Harbour”), at a consistent screen edge, with a ≥48 px target and a Q-reveal highlight. Paint
the matching door/hatch/ladder into the rooms that lack one (tavern, helm, crow’s nest, gallery,
salt camp, far pans).

### 2. Legibility and HUD density
Small top-bar labels, thin serif body text, low-contrast fog and a twelve-cell verb grid fail the
low-vision, 1280×720 and non-native testers. Several could not read the room name or the hint line
without zooming.

**Fix:** larger default type and a text-size control that affects the HUD as well as dialogue;
group the verbs (primary four + “More”); raise contrast on the top bar, room plate and footer;
test at 1280×720.

### 3. No current objective
The only persistent guidance is the cryptic “Pinned to the chart — J”. The dock never names the
harbourmaster’s house; the Shroud never says “cross to the castaway camp”; first-timers chase the
HARBOUR MOUTH sign instead of the lit door.

**Fix:** one plain-English objective line under the room name; a first-visit hint (“That lamp is
still lit — the harbourmaster keeps late hours”); change the toast to “New place added to your map
(J)” and auto-hide it.

### 4. Atlas is mouse-first and state-poor
There is no mouse close/back-to-room control, no keyboard movement between markers, and visited /
locked / future states rely on subtle colour and a key panel. Testers expected arrow keys and a
close button because every other panel advertises a key.

**Fix:** visible Close (Esc) button and click-outside-to-dismiss; Up/Down/Home/End selection with
Enter to travel; explicit “visited / not yet found / beyond the fog” legend; larger markers.

### 5. Dialogue and targeting
“Right-click to leave” means leave the conversation, but reads as leave the room. Marta behind the
bar and Vex at the dim edge of the deck are hard to identify; there are no nameplates until hover.

**Fix:** reword to “right-click to end the conversation”; persistent nameplates on hover/focus;
move Vex inboard at the helm; keep Marta’s head/torso clear of the bottle shelf.

### 6. Naming and consistency
Two different rooms are both titled “The Fog Flats” (lagoon shore and salt pans); the Marrow’s bow
is titled “The Shroud”; ship rooms drop the ship prefix. This breaks the map, history and mental
model.

**Fix:** unique sub-names (“The Wrack Line”, “The Salt Pans”, “The Far Flats”), keep “The Marrow —
Bow” in the plate, and echo the atlas key number in the header.

### 7. Puzzle affordance
The great lantern and nameplate are visually plausible props, not obvious interactables; several
testers did not connect the chart/inventory to the next step.

**Fix:** a stronger hover/reveal outline on puzzle-critical props; a chart entry that names the
lantern and plate; a one-line “I should compare this with Elias’s chart” nudge after the first
look.

## What testers liked

- The painted night harbour, fog and ship interiors; “I want to walk around this place.”
- The title/chart and the island → area → room hierarchy.
- Character portraits and the central father-mystery hook.
- The recap, deeds and ship’s log when they found them.
- 96/99 would continue despite the friction — the core is worth fixing, not replacing.

## Recommended next pass

Do **one wayfinding + accessibility pass** before another content pass:

1. Keyboard focus/act/travel + visible focus ring (the blocker).
2. A single exit-affordance system used by every room, plus the missing painted doors/hatches.
3. Objective line + first-visit hint + harbourmaster label.
4. Atlas close button, keyboard list, state legend.
5. Type/contrast pass at 1280×720 and 150% zoom; group the verbs.
6. Naming/copy consistency (“end conversation”, unique area names).

Then rerun the same 100-tester matrix against the fixed build and compare the average score and the
navigation/legibility counts. The testers’ raw structured output is in
`/tmp/dsh-spill-Tf50qS/session-14b48dafb4b9/ce6ede951167-workflow.txt`.

## Caveat

These are screenshot-based persona reviews, not live telemetry. They measure what a player can infer
from a single frame plus the control legend, and they over-sample first-impression friction. The
convergence across 99 independent testers is the signal; the exact counts are directional.

---

## Follow-up: the wayfinding + accessibility pass

Implemented in `60b9b7d` and the polish that followed:

- Persistent **named exit labels** for every way out, including off-screen exits pinned to the screen
  edge. The labels sit on the painted door/ladder or at the area's edge; clicking the words is the
  same as clicking the exit, and the hit box is ~51 px tall.
- A one-line **goal under the room name** for all 25 rooms (e.g. “Goal: Find the harbourmaster. The
  lit door is his.”).
- The footer and title now document **Tab/arrows + Enter**; Tab draws a cream ring on the scene
  hotspot, names the pending action, and Enter acts.
- The atlas gains a **Close** button, click-outside dismiss, **↑↓ + Enter** navigation, a visible
  selected marker/row, and the legend “Bright: visited · Dim: not yet found · Fog: beyond.”
- Renamed **The Wrack Line** and **The Marrow — Bow**; “right-click to leave” now reads “right-click
  to end”; the chart toast reads “New place on the chart — J.”
- Larger room plate/HUD type and the 1280×720 HUD checked for clipping.

### Fixed-build A/B

Twenty testers (five personas × four focused scenarios: onboarding, navigation, atlas, 1280 legibility).
Nineteen usable responses:

| Metric | Before | After |
|---|---|---|
| Average score | **2.9 / 5** | **3.6 / 5** |
| Pass / friction / blocker | 0 / 98 / 1 | **2 / 17 / 0** |
| Would continue | 96 / 99 | **19 / 19** |

The single blocker is gone. Every tester independently identified the new goal line and the named
exits as the fix; the motor-impairment and low-vision testers still ask for **larger label type and
hit targets at 1280×720** and an explicit UI/text-scale control. The atlas still needs a clearer
“you are here” versus “selected” distinction for keyboard users, and the 12-verb grid still has no
visible default verb. Those are the next polish items, not blockers.

### Second polish (after the A/B)

- Goal/label type raised again; exit labels are ~20 px at 1920 and sit on the painted door/ladder,
  stack instead of colliding, and hide while a hotspot is focused so the focus label and the
  persistent label cannot overlap. Their hit boxes are ~76 px tall.
- Exit labels accept the click themselves, but only where no painted hotspot is under the pointer.
- Atlas now says **“You are here.”** for the current area/room and gives the selected marker/row an
  explicit gold ring; the note reads “Selected: … Enter to travel.”
- The idle footer now says **“Click a thing — best verb picked”**, explaining the automatic verb
  instead of leaving the 12-cell grid with no visible default.
- Rechecked at 1280×720: goal, top bar, verbs, inventory and footer fit without clipping; the
  focus label and sentence remain legible.

Still open for a future accessibility pass: 44 px minimum targets at 720p (the whole HUD scales
below that), the 12-verb grid could collapse to primary verbs + More, and the label/help type at
150% browser zoom is still at the small end.
