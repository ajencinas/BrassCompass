/**
 * The frame loop: its 60 fps clock, its rAF scheduling and its recoverable failure overlay.
 *
 * `Game` used to own all of this inline. None of it needs the game: the clock only reads
 * timestamps, and the loop only needs one callback per due frame. Keeping it here makes the
 * timing rules (the 60 Hz gate, the one-frame backlog cap, the clamped `dt`, three-strikes
 * recovery) small enough to test without a browser. The DOM overlay is still built here because
 * nothing else may own the page while the game cannot paint it.
 */

import { escapeHtml } from "./atlas";
import { restoreFocus } from "./focus";

/** The render loop's target: 60 frames a second, however fast the display refreshes. */
export const FRAME_MS = 1000 / 60;
/** The largest step the game will take, so a long background tab cannot teleport play. */
const MAX_STEP = 0.05;
/** Consecutive failed frames before the recoverable overlay offers a way out. */
const FAILURE_LIMIT = 3;

/**
 * The frame clock, as plain timing state: 60 fps target, elapsed-time accumulation and no
 * knowledge of the game. `tick` is called once for every animation callback; it returns the
 * seconds of game time to advance when a frame is due, and null when the callback came too soon.
 */
export class FrameClock {
  private lastT = 0;
  private accum = 0;
  private pendingDt = 0;

  /**
   * Target 60 fps even on a 120/144 Hz panel. The elapsed time since the last rendered frame is
   * accumulated, so skipped callbacks do not slow the game clock down. A 1 ms tolerance keeps a
   * 60 Hz panel's jitter from skipping alternate frames; at most one frame of backlog is kept,
   * so a throttled tab cannot spiral to catch up.
   */
  tick(t: number): number | null {
    const elapsed = this.lastT ? t - this.lastT : 0;
    this.lastT = t;
    this.accum += elapsed;
    this.pendingDt += elapsed;
    if (this.accum < FRAME_MS - 1) return null;
    this.accum = Math.min(this.accum - FRAME_MS, FRAME_MS);
    const dt = Math.min(MAX_STEP, this.pendingDt / 1000);
    this.pendingDt = 0;
    return dt;
  }

  /** Forget the last frame time: the next callback starts the clock over (Try again). */
  reset(): void {
    this.lastT = 0;
  }
}

/** What the game lends the loop: a due frame, and a way to speak over the failure overlay. */
export interface FrameLoopHooks {
  /** One due frame: `dt` seconds of game time at `t` milliseconds. */
  step(dt: number, t: number): void;
  /** Read a message to a screen reader before the overlay takes focus. */
  announce(text: string): void;
}

/**
 * The animation loop. It keeps scheduling the next frame in `finally`: one bad update or render
 * must never stop the clock forever. A failure that repeats is surfaced as a recoverable overlay
 * instead of a silent freeze, and the loop keeps scheduling even then so Try again can rebuild.
 */
export class FrameLoop {
  private clock = new FrameClock();
  /** Consecutive frame exceptions since the last clean callback. */
  private failures = 0;
  /** The failure overlay is up; the loop still runs but skips update/render. */
  private fatal = false;

  constructor(private hooks: FrameLoopHooks) {}

  start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    try {
      if (this.fatal) return;
      // A callback that is not due still counts as a clean frame, exactly as the old inline
      // loop did: on a 120 Hz panel most callbacks just accumulate time.
      const dt = this.clock.tick(t);
      if (dt !== null) this.hooks.step(dt, t);
      this.failures = 0;
    } catch (error) {
      this.failures++;
      console.error("The Brass Compass: frame failed", error);
      if (this.failures >= FAILURE_LIMIT) this.showFailure(error);
    } finally {
      requestAnimationFrame((tt) => this.frame(tt));
    }
  }

  /**
   * A failure path after the loop has thrown three times in a row. The loop keeps scheduling
   * frames (so a one-off fault recovers on its own if the player closes this), and the overlay
   * offers the two honest recoveries: try again, or reload and rebuild from the save. Nothing
   * in the voyage is written or erased here.
   */
  private showFailure(error: unknown): void {
    if (this.fatal) return;
    this.fatal = true;
    this.failures = 0;
    showFrameFailure(error, {
      announce: (text) => this.hooks.announce(text),
      retry: () => {
        this.fatal = false;
        this.failures = 0;
        // Start the clock over: time spent in the dialog is not replayed as one giant step.
        this.clock.reset();
      },
    });
  }
}

/** What the failure overlay may do to the loop that owns it. */
export interface FrameFailureHooks {
  /** Read the failure out; a screen reader cannot see the dialog until it takes focus. */
  announce(text: string): void;
  /** Try again was pressed: let the loop run, with its clock started over. */
  retry(): void;
}

/**
 * Build the recoverable failure dialog. Kept out of `Game` so the frozen game needs no DOM code
 * of its own, and so the copy, focus and keyboard isolation are in one place.
 */
export function showFrameFailure(error: unknown, hooks: FrameFailureHooks): void {
  try { hooks.announce("The game hit a problem. Choose Try again, or reload the page."); } catch { /* DOM gone */ }
  if (typeof document === "undefined") return;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const inert: { el: HTMLElement; was: boolean }[] = [];
  const el = document.createElement("div");
  el.id = "fatal";
  el.setAttribute("role", "alertdialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "fatal-title");
  el.setAttribute("aria-describedby", "fatal-detail");
  const detail = error instanceof Error && error.message ? escapeHtml(error.message) : "";
  el.innerHTML = `
    <div class="fatal-inner">
      <h1 id="fatal-title">The game hit a problem</h1>
      <p id="fatal-detail">Something failed three frames running${detail ? `: ${detail}` : ""}.
        The voyage is still in the log. Try again, or reload the page to rebuild it from your save.</p>
      <div class="fatal-actions">
        <button type="button" id="fatal-retry">Try again</button>
        <button type="button" id="fatal-reload">Reload page</button>
      </div>
    </div>`;
  // The frozen game behind the dialog must not answer keys or take focus. The live region is
  // left out: it is where the dialog's announcement and the recovery notice go.
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child === el || child.id === "sr") continue;
    inert.push({ el: child, was: child.inert });
    child.inert = true;
  }
  const close = (): void => {
    el.remove();
    for (const { el: child, was } of inert) child.inert = was;
    restoreFocus(previous);
  };
  el.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      hooks.retry();
      try { hooks.announce("The game is running again."); } catch { /* DOM gone */ }
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>("button")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons.length ? (at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length : -1;
    event.preventDefault();
    if (next >= 0) buttons[next].focus();
  });
  document.body.append(el);
  el.querySelector<HTMLButtonElement>("#fatal-retry")?.addEventListener("click", () => {
    close();
    hooks.retry();
    try { hooks.announce("The game is running again."); } catch { /* DOM gone */ }
  });
  el.querySelector<HTMLButtonElement>("#fatal-reload")?.addEventListener("click", () => location.reload());
  el.querySelector<HTMLButtonElement>("#fatal-retry")?.focus();
}
