/**
 * Input — pointer + keyboard, translated to logical coordinates.
 *
 * A mouse is read from mouse events, as it always has been: `detail` counts double-clicks, and
 * the dev editor's Alt+click intercepts `mousedown` before the game sees it. Touch and pen use
 * pointer events: a tap acts when the finger lifts, a long press (~500 ms) is a right-click, and
 * two quick taps in one place count as a double-click.
 */

import type { View } from "./view";

export type PointerKind = "mouse" | "touch" | "pen";
export interface PointerInfo {
  /** 2 for the second click of a double-click (or a double tap). */
  clicks: number;
  kind: PointerKind;
}
export type PointerHandler = (x: number, y: number, button: number, info: PointerInfo) => void;

const LONG_PRESS_MS = 500;
/** CSS pixels a finger may drift before a press stops counting as a tap. */
const TAP_SLOP = 14;
const DOUBLE_TAP_MS = 350;

export class Input {
  x = 0;
  y = 0;
  /** What last pointed at the screen; touch has no hover, so the game asks. */
  lastKind: PointerKind = "mouse";
  private handlers: { down: PointerHandler[]; move: PointerHandler[] } = {
    down: [],
    move: [],
  };
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
    let press: { id: number; x: number; y: number; kind: PointerKind; timer: number; long: boolean } | null = null;
    let lastTap = { t: -1e9, x: 0, y: 0 };
    const cancelPress = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
    };
    view.canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      view.canvas.focus({ preventScroll: true });
      cancelPress();
      this.touching = true;
      const kind: PointerKind = e.pointerType === "pen" ? "pen" : "touch";
      this.lastKind = kind;
      const p = { id: e.pointerId, x: e.clientX, y: e.clientY, kind, long: false, timer: 0 };
      p.timer = window.setTimeout(() => {
        // Long press: the right-click of a touch screen.
        p.long = true;
        if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* optional */ }
        emit(this.handlers.move, p.x, p.y, 0, { clicks: 0, kind });
        emit(this.handlers.down, p.x, p.y, 2, { clicks: 1, kind });
      }, LONG_PRESS_MS);
      press = p;
    });
    view.canvas.addEventListener("pointermove", (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) cancelPress();
    });
    view.canvas.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      const p = press;
      cancelPress();
      // Compatibility mouse events may trail a touch; ignore them for a moment.
      window.setTimeout(() => { this.touching = false; }, 400);
      if (!p || p.id !== e.pointerId || p.long) return;
      const now = performance.now();
      const double = now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < TAP_SLOP * 2;
      lastTap = double ? { t: -1e9, x: 0, y: 0 } : { t: now, x: p.x, y: p.y };
      // A tap is a hover and a click in one: touch has nothing to hover with.
      emit(this.handlers.move, p.x, p.y, 0, { clicks: 0, kind: p.kind });
      emit(this.handlers.down, p.x, p.y, 0, { clicks: double ? 2 : 1, kind: p.kind });
    });
    view.canvas.addEventListener("pointercancel", () => {
      cancelPress();
      this.touching = false;
    });

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
  onKey(h: (k: string, event: KeyboardEvent) => void): void {
    this.keys.push(h);
  }
  /** Key released, or "" with no event when the window loses focus (release everything). */
  onKeyUp(h: (k: string, event: KeyboardEvent | null) => void): void {
    this.keysUp.push(h);
  }
}
