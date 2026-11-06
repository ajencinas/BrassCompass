/**
 * Player preferences: how text reads and how the screen moves. Remembered per browser, apart
 * from the save, so they survive a new voyage. (Volumes live with the audio engine.)
 */

export type TextSpeed = "slow" | "normal" | "fast" | "instant";
export type TextScale = 1 | 1.25 | 1.5;

export interface Prefs {
  /** Typewriter speed; null follows reduced motion (instant) or else "normal". */
  textSpeed: TextSpeed | null;
  /** Lines that something else is waiting on stay up until a click or key. */
  waitForClick: boolean;
  /** UI text scale. */
  textScale: TextScale;
  /** Reduced motion; null follows the OS setting. */
  reducedMotion: boolean | null;
}

const KEY = "brasscompass.prefs.v1";
/** Set once the voyage has been finished; unlocks Chapter select. Survives a new voyage. */
export const COMPLETED_KEY = "brasscompass.completed";

export const TEXT_SPEEDS: TextSpeed[] = ["slow", "normal", "fast", "instant"];
export const TEXT_SCALES: TextScale[] = [1, 1.25, 1.5];

/** Narration characters per second; dialogue runs a little quicker, as it always has. */
export const NARRATION_CPS: Record<TextSpeed, number> = { slow: 34, normal: 62, fast: 120, instant: Infinity };
export const DIALOGUE_CPS: Record<TextSpeed, number> = { slow: 38, normal: 70, fast: 135, instant: Infinity };

const DEFAULTS: Prefs = { textSpeed: null, waitForClick: false, textScale: 1, reducedMotion: null };

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>;
    return {
      textSpeed: TEXT_SPEEDS.includes(raw.textSpeed as TextSpeed) ? raw.textSpeed as TextSpeed : null,
      waitForClick: raw.waitForClick === true,
      textScale: TEXT_SCALES.includes(raw.textScale as TextScale) ? raw.textScale as TextScale : 1,
      reducedMotion: typeof raw.reducedMotion === "boolean" ? raw.reducedMotion : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* preferences are optional */ }
}

export function osReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function hasCompleted(): boolean {
  try { return localStorage.getItem(COMPLETED_KEY) === "1"; } catch { return false; }
}
export function markCompleted(): void {
  try { localStorage.setItem(COMPLETED_KEY, "1"); } catch { /* ignore */ }
}
