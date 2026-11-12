/**
 * Player preferences: how text reads and how the screen moves. Remembered per browser, apart
 * from the save, so they survive a new voyage. (Volumes live with the audio engine.)
 */

export type TextSpeed = "slow" | "normal" | "fast" | "instant";
export type TextScale = 1 | 1.25 | 1.5 | 1.75 | 2;
/** How long a line stays up once read: the base time, a longer one, a much longer one. */
export type ReadingTime = "normal" | "long" | "xlong";
/** Whether Q shows the interactive outlines while held, or switches them on and off. */
export type RevealMode = "hold" | "toggle";
/** Graphics quality: the render size, smoothing and the costlier lighting (see engine/view.ts). */
export type GraphicsQuality = "high" | "medium" | "low";

export interface Prefs {
  /**
   * The typewriter speed the player chose; null is Normal. Reduced motion shows every line at
   * once whatever this says (see `effectiveTextSpeed`); the choice comes back when it's off.
   */
  textSpeed: TextSpeed | null;
  /**
   * Lines that something else is waiting on stay up until the player clicks, presses a key or
   * taps. On by default: reading pace is the player's, not a fixed number of seconds.
   */
  waitForClick: boolean;
  /** UI text scale the player chose; null fits the screen (see `autoTextScale`). */
  textScale: TextScale | null;
  /** Reduced motion; null follows the OS setting. */
  reducedMotion: boolean | null;
  /** High-contrast HUD; null follows the OS `prefers-contrast: more` setting. */
  highContrast: boolean | null;
  /** How long lines stay up before moving on by themselves (1x / 1.6x / 2.4x). */
  readingTime: ReadingTime;
  /** Q: hold to reveal, or press to switch on and off. */
  revealMode: RevealMode;
  /** Lines the player has already read advance after a minimal delay. */
  skipRead: boolean;
  /** Graphics quality; lower it on a machine that struggles. */
  quality: GraphicsQuality;
}

const KEY = "brasscompass.prefs.v1";
/**
 * Stored with the prefs. Version 1 always wrote a text scale, so its 100% may only have been the
 * default; from version 2 a stored 100% was chosen, and automatic is stored as null. Version 3
 * changed the reading default: lines wait for the player unless the player chose otherwise, so
 * a `false` written by an older version is the old default, not a choice.
 */
const PREFS_VERSION = 3;
/** Set once the voyage has been finished; unlocks Chapter select. Survives a new voyage. */
export const COMPLETED_KEY = "brasscompass.completed";

export const TEXT_SPEEDS: TextSpeed[] = ["slow", "normal", "fast", "instant"];
export const TEXT_SCALES: TextScale[] = [1, 1.25, 1.5, 1.75, 2];
export const READING_TIMES: ReadingTime[] = ["normal", "long", "xlong"];
export const REVEAL_MODES: RevealMode[] = ["hold", "toggle"];
export const GRAPHICS_QUALITIES: GraphicsQuality[] = ["high", "medium", "low"];
/** What each reading time multiplies the automatic hold and fade times by. */
export const READING_FACTOR: Record<ReadingTime, number> = { normal: 1, long: 1.6, xlong: 2.4 };

/** Narration characters per second; dialogue runs a little quicker, as it always has. */
export const NARRATION_CPS: Record<TextSpeed, number> = { slow: 34, normal: 62, fast: 120, instant: Infinity };
export const DIALOGUE_CPS: Record<TextSpeed, number> = { slow: 38, normal: 70, fast: 135, instant: Infinity };

const DEFAULTS: Prefs = {
  textSpeed: null, waitForClick: true, textScale: null, reducedMotion: null,
  highContrast: null, readingTime: "normal", revealMode: "hold", skipRead: false, quality: "high",
};

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs> & { v?: number };
    const scale = TEXT_SCALES.includes(raw.textScale as TextScale) ? raw.textScale as TextScale : null;
    const version = typeof raw.v === "number" ? raw.v : 1;
    return {
      textSpeed: TEXT_SPEEDS.includes(raw.textSpeed as TextSpeed) ? raw.textSpeed as TextSpeed : null,
      // Version 3: a new voyage waits for the player by default. A version-3 `false` is a real
      // choice; an older `false` was the shipped default, so it joins the new default.
      waitForClick: version >= 3 ? raw.waitForClick !== false : true,
      // A version-1 100% is the old default, not a choice: let it fit the screen. From version 2
      // on a stored 100% was chosen (automatic is stored as null), so v2 and later keep it.
      textScale: version >= 2 || scale !== 1 ? scale : null,
      reducedMotion: typeof raw.reducedMotion === "boolean" ? raw.reducedMotion : null,
      // Added after version 3 without a bump: an older save simply lacks them and gets the defaults.
      highContrast: typeof raw.highContrast === "boolean" ? raw.highContrast : null,
      readingTime: READING_TIMES.includes(raw.readingTime as ReadingTime) ? raw.readingTime as ReadingTime : "normal",
      revealMode: REVEAL_MODES.includes(raw.revealMode as RevealMode) ? raw.revealMode as RevealMode : "hold",
      skipRead: raw.skipRead === true,
      quality: GRAPHICS_QUALITIES.includes(raw.quality as GraphicsQuality) ? raw.quality as GraphicsQuality : "high",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify({ v: PREFS_VERSION, ...p })); } catch { /* preferences are optional */ }
}

/**
 * Text size when the player hasn't chosen one. The canvas shrinks with the window, so on a small
 * screen (1366×768 draws the 1920-wide game at 71%) the default type comes out at 13–14 px.
 */
export function autoTextScale(viewScale: number): TextScale {
  // 800x600 draws the game at 42%: 1.25 would still leave the verbs at about 11 px.
  return viewScale < 0.55 ? 1.5 : viewScale < 0.8 ? 1.25 : 1;
}

/** The text size in effect: the player's choice, else what fits this screen. */
export function effectiveTextScale(p: Prefs, viewScale: number): TextScale {
  return p.textScale ?? autoTextScale(viewScale);
}

/** One query, kept: `matchMedia` builds a new list on every call. */
const motionQuery: MediaQueryList | null =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

export function osReducedMotion(): boolean {
  return motionQuery?.matches ?? false;
}

/** Call `listener` when the OS reduced-motion setting changes. */
export function onOsReducedMotion(listener: () => void): void {
  motionQuery?.addEventListener?.("change", listener);
}

const contrastQuery: MediaQueryList | null =
  typeof matchMedia === "function" ? matchMedia("(prefers-contrast: more)") : null;

export function osHighContrast(): boolean {
  return contrastQuery?.matches ?? false;
}

/** Call `listener` when the OS contrast setting changes. */
export function onOsHighContrast(listener: () => void): void {
  contrastQuery?.addEventListener?.("change", listener);
}

/** High contrast in effect: the setting, else the OS. */
export function highContrast(p: Prefs): boolean {
  return p.highContrast ?? osHighContrast();
}

/**
 * The HUD painters (ui.ts) read this rather than take another argument: set once per frame
 * from the game, it widens the verb cells' borders and strengthens plate text.
 */
let hudContrast = false;
export function setHudContrast(on: boolean): void { hudContrast = on; }
export function hudHighContrast(): boolean { return hudContrast; }

/** Reduced motion in effect: the setting, else the OS. */
export function reducedMotion(p: Prefs): boolean {
  return p.reducedMotion ?? osReducedMotion();
}

/**
 * The typewriter speed in effect. Reduced motion is a statement about the player, not a style
 * preference: it beats a speed chosen before it was turned on, or the typewriter comes back.
 * The game and the settings panel both read this, so the panel never shows a speed that isn't.
 */
export function effectiveTextSpeed(p: Prefs, reduced = reducedMotion(p)): TextSpeed {
  return reduced ? "instant" : p.textSpeed ?? "normal";
}

export function hasCompleted(): boolean {
  try { return localStorage.getItem(COMPLETED_KEY) === "1"; } catch { return false; }
}
export function markCompleted(): void {
  try { localStorage.setItem(COMPLETED_KEY, "1"); } catch { /* ignore */ }
}
