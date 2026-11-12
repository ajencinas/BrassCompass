/**
 * The controls sheet and the shortcut names the chrome uses, in one place.
 *
 * The top bar is icon-only, so these strings are also the only words its accessible names and
 * hover titles get. Keeping them together is what stops a shortcut from being taught in one
 * place and forgotten in another (the Map key was missing here while the bar already had it).
 */

import { PAD_CONTROLS } from "./gamepad";

/** Keys the game advertises. The names are short so they fit under an icon. */
export const SHORTCUTS = {
  reveal: "Q",
  history: "L",
  tip: "H",
  chart: "J",
  map: "A",
  pause: "Escape",
  mute: "M",
  pagePrev: "PageUp",
  pageNext: "PageDown",
} as const;

/**
 * Every shortcut the game listens for, and what it does. Keyboard play, the title's own keys
 * and Chapter select's scene list are here too: a control the player can press is a control the
 * sheet should name.
 */
export const CONTROLS: [string, string][] = [
  ["Left-click a thing", "Do the obvious: talk, take, open, look (the lit-up verb)"],
  ["Right-click a thing", "Look at it"],
  ["Right-click elsewhere", "Cancel the sentence, or leave a conversation"],
  ["Click a verb, then a thing", "Do exactly that (Use and Give take two)"],
  ["Click the floor", "Walk; double-click to run"],
  ["Double-click a doorway", "Leave at once"],
  ["Hold Q, or the Reveal button", "Show everything you can interact with (Settings: Reveal key can make Q a switch)"],
  ["Tab / Shift+Tab", "Keyboard play: move between the scene, the verbs and the inventory"],
  ["Arrows, then Enter", "Move within the scene, verbs or inventory, and act"],
  [`${SHORTCUTS.pagePrev} / ${SHORTCUTS.pageNext}`, "Turn the satchel's pages"],
  ["1–9, or arrows and Enter", "Choose in a conversation"],
  ["Click, Enter or Space", "Skip a line that is typing"],
  ["Hold Ctrl (or ])", "Fast-forward lines you have already read"],
  [SHORTCUTS.tip, "A tip for what to do next"],
  [SHORTCUTS.chart, "Chart — everything you have learned"],
  [SHORTCUTS.map, "Map — the island chart, its areas, and travel"],
  [SHORTCUTS.history, "Line history — the last 30 lines"],
  [SHORTCUTS.mute, "Mute or unmute the sound"],
  ["Escape", "Cancel what you are doing; again for pause and settings"],
  ["C / E (at the title)", "Continue the saved voyage, or open Chapter select"],
  ["R (in Chapter select)", "Reopen the scene list"],
  ...PAD_CONTROLS,
  ["Touch: tap a thing", "Shows its name and what a tap would do; tap again to act"],
  ["Touch: long-press", "Look at (like right-click)"],
  ["Touch: tap a top-bar icon", "Names the plate; tap it again to do its job"],
];
