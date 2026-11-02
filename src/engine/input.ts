/** Input — pointer + keyboard, translated to logical coordinates. */

import type { View } from "./view";

export type PointerHandler = (x: number, y: number, button: number) => void;

export class Input {
  x = 0;
  y = 0;
  private handlers: { down: PointerHandler[]; move: PointerHandler[] } = {
    down: [],
    move: [],
  };
  private keys: ((k: string, event: KeyboardEvent) => void)[] = [];

  constructor(view: View) {
    window.addEventListener("mousemove", (e) => {
      const p = view.toLogical(e.clientX, e.clientY);
      this.x = p.x;
      this.y = p.y;
      this.handlers.move.forEach((h) => h(p.x, p.y, e.button));
    });

    view.canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.canvas.focus({ preventScroll: true });
      const p = view.toLogical(e.clientX, e.clientY);
      this.x = p.x;
      this.y = p.y;
      this.handlers.down.forEach((h) => h(p.x, p.y, e.button));
    });

    view.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      this.keys.forEach((h) => h(e.key, e));
    });
  }

  onDown(h: PointerHandler): void {
    this.handlers.down.push(h);
  }
  onMove(h: PointerHandler): void {
    this.handlers.move.push(h);
  }
  onKey(h: (k: string, event: KeyboardEvent) => void): void {
    this.keys.push(h);
  }
}
