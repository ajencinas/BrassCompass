/**
 * Input — pointer + keyboard, translated to logical coordinates.
 *
 * A mouse is read from mouse events, as it always has been: `detail` counts double-clicks, and
 * the dev editor's Alt+click intercepts `mousedown` before the game sees it. Touch and pen use
 * pointer events: a tap acts when the finger lifts, and a long press (~500 ms) is a look.
 *
 * Touch deliberately reports every tap as a single click. A double tap used to arrive as
 * `clicks: 2`, which let it skip the game's arm-then-confirm step and take a door at once; a
 * finger that bounces is not a second decision. A press is also owned by the window now, so a
 * release outside the canvas, a cancelled pointer or a backgrounded tab cannot leave its
 * long-press timer armed to fire later.
 */

import type { View } from "./view";

export type PointerKind = "mouse" | "touch" | "pen";
export interface PointerInfo {
  /** 2 for the second click of a double-click. Touch/pen always report 1. */
  clicks: number;
  kind: PointerKind;
}
export type PointerHandler = (x: number, y: number, button: number, info: PointerInfo) => void;

const LONG_PRESS_MS = 500;
/** CSS pixels a finger may drift before a press stops counting as a tap. */
const TAP_SLOP = 14;

interface Press {
  id: number;
  x: number;
  y: number;
  kind: PointerKind;
  timer: number;
  long: boolean;
}

export class Input {
  x = 0;
  y = 0;
  /** What last pointed at the screen; touch has no hover, so the game asks. */
  lastKind: PointerKind = "mouse";
  private handlers: { down: PointerHandler[]; move: PointerHandler[] } = {
    down: [],
    move: [],
  };
  /** A finger sliding across the scene (a look-around drag): CSS pixels moved since the last call. */
  private pans: ((dxCss: number) => void)[] = [];
  private keys: ((k: string, event: KeyboardEvent) => void)[] = [];
  private keysUp: ((k: string, event: KeyboardEvent | null) => void)[] = [];

  constructor(view: View) {
    const emit = (list: PointerHandler[], clientX: number, clientY: number, button: number, info: PointerInfo) => {
      const p = view.toLogical(clientX, clientY);
      this.x = p.x;
      this.y = p.y;
      list.forEach((h) => h(p.x, p.y, button, info));
    };

    window.addEventListener("mousemove", (e) => {
      if (this.touching) return;
      this.lastKind = "mouse";
      emit(this.handlers.move, e.clientX, e.clientY, e.button, { clicks: 0, kind: "mouse" });
    });

    view.canvas.addEventListener("mousedown", (e) => {
      if (this.touching) return;
      e.preventDefault();
      view.canvas.focus({ preventScroll: true });
      this.lastKind = "mouse";
      emit(this.handlers.down, e.clientX, e.clientY, e.button, { clicks: Math.max(1, e.detail || 1), kind: "mouse" });
    });

    // ---- touch and pen
    let press: Press | null = null;
    const cancelPress = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
    };
    /** Compatibility mouse events trail a touch; ignore them for a moment. */
    let settle = 0;
    const clearSettle = () => { if (settle) window.clearTimeout(settle); settle = 0; };
    const settleTouch = () => {
      // One timer at a time: a new touch must not be cut short by the last touch's timer.
      clearSettle();
      settle = window.setTimeout(() => { settle = 0; this.touching = false; }, 400);
    };
    const inside = (x: number, y: number): boolean => {
      const r = view.canvas.getBoundingClientRect();
      // A portrait crop makes the canvas wider than the stage that clips it: only the part
      // the stage shows can be touched.
      const s = view.canvas.parentElement?.getBoundingClientRect();
      const l = s ? Math.max(r.left, s.left) : r.left, rr = s ? Math.min(r.right, s.right) : r.right;
      return x >= l && x <= rr && y >= r.top && y <= r.bottom;
    };

    view.canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      view.canvas.focus({ preventScroll: true });
      cancelPress();
      clearSettle();
      this.touching = true;
      const kind: PointerKind = e.pointerType === "pen" ? "pen" : "touch";
      this.lastKind = kind;
      // Keep receiving the release even if the finger leaves the canvas. Window handlers below
      // are the safety net if a browser refuses the capture.
      try { view.canvas.setPointerCapture(e.pointerId); } catch { /* optional */ }
      const p: Press = { id: e.pointerId, x: e.clientX, y: e.clientY, kind, long: false, timer: 0 };
      p.timer = window.setTimeout(() => {
        if (press !== p || p.long) return;
        p.long = true;
        p.timer = 0;
        if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* optional */ }
        emit(this.handlers.move, p.x, p.y, 0, { clicks: 0, kind });
        emit(this.handlers.down, p.x, p.y, 2, { clicks: 1, kind });
      }, LONG_PRESS_MS);
      press = p;
    });

    // The window owns movement, release and cancellation: a finger that slides off the canvas
    // (or lets go over the HUD) must not turn into a tap or a late long press.
    // A press that slides past the tap slop is no longer a tap; on a touch screen it becomes a
    // look-around drag (the portrait crop follows the finger, see View.dragCrop).
    let drag: { id: number; x: number } | null = null;
    window.addEventListener("pointermove", (e) => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x;
        drag.x = e.clientX;
        if (dx !== 0) this.pans.forEach((h) => h(dx));
        return;
      }
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) {
        if (press.kind === "touch" && !press.long) drag = { id: press.id, x: e.clientX };
        cancelPress();
      }
    });
    const endDrag = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) { drag = null; settleTouch(); } };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      if (!press || e.pointerId !== press.id) return;
      const p = press;
      cancelPress();
      settleTouch();
      if (p.long || !inside(e.clientX, e.clientY)) return;
      // A tap is a hover and a click in one: touch has nothing to hover with. Never `clicks: 2`:
      // a bounced finger must still arm, not confirm.
      emit(this.handlers.move, p.x, p.y, 0, { clicks: 0, kind: p.kind });
      emit(this.handlers.down, p.x, p.y, 0, { clicks: 1, kind: p.kind });
    });
    window.addEventListener("pointercancel", (e) => {
      if (e.pointerType === "mouse") return;
      if (press && e.pointerId === press.id) { cancelPress(); clearSettle(); this.touching = false; }
    });
    // Releasing outside the browser, switching tabs, or opening a system menu: every one of
    // these ends the gesture, and none of them should leave a timer behind.
    const releaseAll = () => { cancelPress(); clearSettle(); this.touching = false; };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
    window.addEventListener("contextmenu", releaseAll);

    view.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      this.keys.forEach((h) => h(e.key, e));
    });
    window.addEventListener("keyup", (e) => {
      this.keysUp.forEach((h) => h(e.key, e));
    });
    // A key held while the window loses focus never sends its keyup.
    window.addEventListener("blur", () => this.keysUp.forEach((h) => h("", null)));
  }
  private touching = false;

  onDown(h: PointerHandler): void {
    this.handlers.down.push(h);
  }
  onMove(h: PointerHandler): void {
    this.handlers.move.push(h);
  }
  /** Touch only: the finger dragged `dxCss` CSS pixels sideways across the scene. */
  onPan(h: (dxCss: number) => void): void {
    this.pans.push(h);
  }
  onKey(h: (k: string, event: KeyboardEvent) => void): void {
    this.keys.push(h);
  }
  /** Key released, or "" with no event when the window loses focus (release everything). */
  onKeyUp(h: (k: string, event: KeyboardEvent | null) => void): void {
    this.keysUp.push(h);
  }
}
