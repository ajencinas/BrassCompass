/**
 * Where focus goes back to when an overlay closes.
 *
 * A canvas game keeps its keyboard focus on the canvas, so an overlay's `previousFocus` is
 * usually the canvas. It can also be a real button (the screen-reader toolbar, the touch HUD,
 * or a button inside another overlay such as the recap). A programmatic `.focus()` on
 * `<body>` is a no-op, which used to leave a screen reader with no focused control after an
 * overlay closed over the title screen. This chooses the first target that can actually take
 * focus, falling back to the canvas.
 */

/** Whether `el` is a connected, visible, enabled HTMLElement that focus can land on. */
export function isFocusTarget(el: Element | null | undefined): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.isConnected || el === document.body || el === document.documentElement) return false;
  if (el.closest("[hidden]") || el.getAttribute("aria-hidden") === "true") return false;
  if (el.hasAttribute("disabled")) return false;
  // `getClientRects` is empty for display:none, and for a clipped element with no box.
  return el.getClientRects().length > 0;
}

/**
 * Return focus to the control that opened an overlay, or to the game canvas when that control
 * is gone, hidden, disabled, or never had focus (a shortcut pressed with focus on `<body>`).
 */
export function restoreFocus(previous: HTMLElement | null | undefined): void {
  if (typeof document === "undefined") return;
  const canvas = document.getElementById("game");
  const target = [previous, canvas].find(isFocusTarget);
  target?.focus({ preventScroll: true });
}
