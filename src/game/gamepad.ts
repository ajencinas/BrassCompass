/**
 * Gamepad support: the standard Gamepad API, mapped onto the keys the game already answers.
 *
 * Nothing here knows the game. `stepPad` turns one reading of a controller into key events
 * (pure, tested on its own); `GamepadInput` is the thin browser half that listens for a
 * controller being plugged in, reads it once per frame *only while one is connected*, and
 * hands the key events on. With no controller there is no polling and no cost.
 *
 * The map (standard layout; Xbox names, PlayStation in brackets):
 *   D-pad, left stick   Arrow keys (move in the scene, verbs, satchel, answers), repeating
 *   A (Cross)           Enter: do the thing, choose an answer
 *   B (Circle)          Escape: cancel, leave a conversation; again for pause
 *   X (Square)          Q: reveal what you can interact with (hold, or toggle per setting)
 *   Y (Triangle)        H: a tip
 *   LB / RB             PageUp / PageDown: the satchel's pages
 *   LT / RT             J / L: the chart / the line history
 *   Select (Share)      A: the map
 *   Start (Options)     Pause, and resume from pause
 *   Left / right stick click   Shift+Tab / Tab: move between scene, verbs and satchel
 */

export interface PadEvent {
  type: "down" | "up";
  /** A `KeyboardEvent.key` value, or "Pause" for the pause toggle (no key stands for it). */
  key: string;
  shift: boolean;
  /** An auto-repeat of a held direction. */
  repeat: boolean;
}

/** One reading of a controller: which buttons are down, and the axes. */
export interface PadSample {
  buttons: boolean[];
  axes: number[];
}

interface Binding { key: string; shift?: boolean; repeats?: boolean }

/** Standard-mapping button index -> the key it presses. */
export const BUTTON_KEYS: Record<number, Binding> = {
  0: { key: "Enter" },
  1: { key: "Escape" },
  2: { key: "q" },
  3: { key: "h" },
  4: { key: "PageUp", repeats: true },
  5: { key: "PageDown", repeats: true },
  6: { key: "j" },
  7: { key: "l" },
  8: { key: "a" },
  9: { key: "Pause" },
  10: { key: "Tab", shift: true, repeats: true },
  11: { key: "Tab", repeats: true },
  12: { key: "ArrowUp", repeats: true },
  13: { key: "ArrowDown", repeats: true },
  14: { key: "ArrowLeft", repeats: true },
  15: { key: "ArrowRight", repeats: true },
};

/** How far a stick must lean before it counts as a press. */
export const STICK_DEADZONE = 0.55;
/** A held direction repeats after this long, then at this rate (milliseconds). */
export const REPEAT_DELAY_MS = 420;
export const REPEAT_RATE_MS = 130;

/** The controls this reads, as they are named in the controls sheet. */
export const PAD_CONTROLS: [string, string][] = [
  ["Controller: D-pad or left stick", "Move between things, verbs, the satchel and answers"],
  ["Controller: A / B", "Enter (do it, choose) / Escape (cancel, leave a conversation)"],
  ["Controller: X / Y", "Reveal what you can interact with / a tip"],
  ["Controller: LB / RB", "Turn the satchel's pages"],
  ["Controller: LT / RT / Select", "Chart / line history / map"],
  ["Controller: Start", "Pause, and resume"],
  ["Controller: stick click", "Move between the scene, the verbs and the satchel"],
];

export interface PadState {
  /** Controls held now, by id, with when the next repeat is due (Infinity: none). */
  held: Map<string, { binding: Binding; next: number }>;
}

export function createPadState(): PadState {
  return { held: new Map() };
}

/** The controls a sample is pressing, by id. The stick leans into one direction at a time. */
export function pressedControls(sample: PadSample): Map<string, Binding> {
  const pressed = new Map<string, Binding>();
  sample.buttons.forEach((down, index) => {
    const binding = BUTTON_KEYS[index];
    if (down && binding) pressed.set(`b${index}`, binding);
  });
  const x = sample.axes[0] ?? 0, y = sample.axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) >= STICK_DEADZONE) {
    const dir = Math.abs(x) > Math.abs(y) ? (x < 0 ? 14 : 15) : (y < 0 ? 12 : 13);
    pressed.set(`s${dir}`, BUTTON_KEYS[dir]);
  }
  return pressed;
}

/**
 * Advance the pad by one reading at time `now` (ms): key-downs for what was just pressed (and
 * for held directions as they repeat), key-ups for what was released. The same direction from
 * the stick and the D-pad is one press, and a stick pushed past its dead zone and back is one
 * press and one release, never a repeat storm.
 */
export function stepPad(state: PadState, sample: PadSample, now: number): PadEvent[] {
  const events: PadEvent[] = [];
  const pressed = pressedControls(sample);
  // A direction held on both the D-pad and the stick must not press twice: fold by key.
  const seenKeys = new Set<string>();
  for (const [id, binding] of pressed) {
    const sig = `${binding.shift ? "+" : ""}${binding.key}`;
    if (seenKeys.has(sig)) { pressed.delete(id); continue; }
    seenKeys.add(sig);
  }
  for (const [id, binding] of pressed) {
    const held = state.held.get(id);
    if (!held) {
      events.push({ type: "down", key: binding.key, shift: Boolean(binding.shift), repeat: false });
      state.held.set(id, { binding, next: binding.repeats ? now + REPEAT_DELAY_MS : Infinity });
    } else if (now >= held.next) {
      events.push({ type: "down", key: binding.key, shift: Boolean(binding.shift), repeat: true });
      held.next = now + REPEAT_RATE_MS;
    }
  }
  for (const [id, held] of [...state.held]) {
    if (pressed.has(id)) continue;
    state.held.delete(id);
    events.push({ type: "up", key: held.binding.key, shift: Boolean(held.binding.shift), repeat: false });
  }
  return events;
}

/**
 * Key-ups for everything still held, and a clean state: what a controller going away owes the
 * game (a hold-to-reveal Q, say, would otherwise never be released).
 */
export function releaseAll(state: PadState): PadEvent[] {
  const events: PadEvent[] = [];
  for (const held of state.held.values()) {
    events.push({ type: "up", key: held.binding.key, shift: Boolean(held.binding.shift), repeat: false });
  }
  state.held.clear();
  return events;
}

/** Only the standard layout is mapped; anything else would press the wrong keys. */
export function isSupportedPad(pad: { mapping?: string }): boolean {
  return pad.mapping === "standard";
}

/**
 * The pause dialog is plain DOM, steered by Tab and Enter: there the D-pad becomes Tab and
 * Shift+Tab. (Everything else keeps its meaning: B is Escape, Start resumes.)
 */
export function settingsEvent(e: PadEvent): PadEvent {
  const next = e.key === "ArrowDown" || e.key === "ArrowRight";
  const previous = e.key === "ArrowUp" || e.key === "ArrowLeft";
  return next || previous ? { ...e, key: "Tab", shift: previous } : e;
}

/** What the browser half needs from the game. */
export interface PadHooks {
  announce(text: string): void;
  /** Called with each key event the controller makes, already adapted for the screen it is on. */
  press(event: PadEvent): void;
}

/**
 * The browser half. `connected` is false until a controller sends its first input (browsers
 * hide a pad until then); only then does the game poll it, once per frame.
 */
export class GamepadInput {
  private state = createPadState();
  private active = new Set<number>();
  private unsupported = new Set<number>();

  constructor(private hooks: PadHooks) {
    if (typeof window === "undefined") return;
    window.addEventListener("gamepadconnected", (event) => {
      const pad = (event as GamepadEvent).gamepad;
      if (this.active.has(pad.index)) return;
      if (!isSupportedPad(pad)) {
        // An unmapped pad's button numbers mean nothing here: say so once, and never poll it.
        if (!this.unsupported.has(pad.index)) {
          this.unsupported.add(pad.index);
          this.hooks.announce("Controller connected, but its layout is not supported. Use the keyboard or mouse.");
        }
        return;
      }
      this.active.add(pad.index);
      this.hooks.announce("Controller connected. Use the D-pad to move, A to choose, B to go back, Start to pause.");
    });
    window.addEventListener("gamepaddisconnected", (event) => {
      const index = (event as GamepadEvent).gamepad.index;
      this.unsupported.delete(index);
      const wasActive = this.active.delete(index);
      if (!wasActive) return;
      // Release what was held before forgetting it, so no key stays down.
      for (const up of releaseAll(this.state)) this.hooks.press(up);
      this.state = createPadState();
      if (!this.active.size) this.hooks.announce("Controller disconnected.");
    });
  }

  /** Whether a controller is plugged in: the game polls only while this is true. */
  get connected(): boolean {
    return this.active.size > 0;
  }

  /** Read the first live controller once and pass its key events on. */
  poll(now: number): void {
    if (!this.active.size) return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((p): p is Gamepad => Boolean(p && p.connected && isSupportedPad(p) && this.active.has(p.index)));
    if (!pad) return;
    const sample: PadSample = { buttons: pad.buttons.map((b) => b.pressed), axes: [...pad.axes] };
    for (const event of stepPad(this.state, sample, now)) this.hooks.press(event);
  }
}

/**
 * Deliver a controller key to the page the way a keyboard would: as a key event on whatever has
 * focus (the canvas, whose window listener is the game's input, or a dialog's own control). A
 * focused button is clicked for Enter, and a focused list or slider is stepped by left/right,
 * because a synthetic key event does neither natively.
 */
export function deliverPadKey(event: PadEvent, settingsOpen = false): void {
  if (typeof document === "undefined") return;
  const el = document.activeElement as HTMLElement | null;
  const steppable = el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type === "range");
  // In the pause dialog the D-pad walks the controls, except along a list or slider it steps.
  if (settingsOpen && !(steppable && (event.key === "ArrowLeft" || event.key === "ArrowRight"))) {
    event = settingsEvent(event);
  }
  const target: EventTarget = el && el !== document.body ? el : window;
  if (event.type === "down" && el && el !== document.body) {
    if (event.key === "Enter" && el.matches("button, summary, a[href]")) { el.click(); return; }
    if (el instanceof HTMLSelectElement && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const at = el.selectedIndex + (event.key === "ArrowLeft" ? -1 : 1);
      if (at >= 0 && at < el.options.length) {
        el.selectedIndex = at;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    if (el instanceof HTMLInputElement && el.type === "range" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      if (event.key === "ArrowLeft") el.stepDown(); else el.stepUp();
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
  }
  const key = new KeyboardEvent(event.type === "down" ? "keydown" : "keyup", {
    key: event.key, shiftKey: event.shift, repeat: event.repeat, bubbles: true, cancelable: true,
  });
  // A controller's key is not the browser's: the game has to tell them apart, because a
  // synthetic Tab cannot move browser focus at all.
  Object.defineProperty(key, "__pad", { value: true });
  target.dispatchEvent(key);
}
