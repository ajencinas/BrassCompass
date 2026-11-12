/**
 * Room tone — the quiet air of an interior, and the policy for the game's interaction cues.
 *
 * The outdoor beds (sea, wind, gulls) are weather; a room tone is the sound of being inside:
 * a low, filtered breath of air with a faint upper layer for paper, rope, glass or wind in the
 * seams. It is synthesised from the same crossfaded brown-noise loop the ambience uses, so it
 * costs no download and cannot drift at its seam. Each kind is only a filter and a level: the
 * number here is the whole design, which is what makes it testable without Web Audio.
 *
 * The levels are deliberately far under the ambience beds (0.055–0.10) and the interface tick
 * (0.085). A room tone should be missed when it stops, never heard when it starts.
 */

export type RoomToneKind = "hearth" | "study" | "workshop" | "counting" | "cabin" | "hold" | "gallery";

export interface RoomToneSpec {
  /** The body of the room's air: a low-pass, or a broad band-pass for a working room. */
  filter: { type: BiquadFilterType; frequency: number; q?: number };
  /** Peak gain of the bed before the effects bus and the player's Effects slider. */
  level: number;
  /** The slow swell that stops it sitting flat: frequency in Hz, depth as a fraction of level. */
  lfo: { hz: number; depth: number };
  /** A faint band above the body: paper, rope, glass, or wind in the window seams. */
  air?: { frequency: number; q: number; level: number };
}

export const ROOM_TONES: Record<RoomToneKind, RoomToneSpec> = {
  /* The Salty Keel: a fire's low breath, with the room's glass and voices far above it. */
  hearth: {
    filter: { type: "lowpass", frequency: 340 },
    level: 0.042,
    lfo: { hz: 0.07, depth: 0.4 },
    air: { frequency: 1500, q: 0.7, level: 0.1 },
  },
  /* The harbourmaster's house: a small room holding its breath around a desk lamp. */
  study: {
    filter: { type: "lowpass", frequency: 260 },
    level: 0.028,
    lfo: { hz: 0.05, depth: 0.35 },
  },
  /* The shipwright's and the boat shed: timber, rope and a broad, dull working quiet. */
  workshop: {
    filter: { type: "bandpass", frequency: 300, q: 0.6 },
    level: 0.032,
    lfo: { hz: 0.045, depth: 0.45 },
    air: { frequency: 2200, q: 0.8, level: 0.08 },
  },
  /* Vex's counting house: paper and green glass, drier and stiller than the workshop. */
  counting: {
    filter: { type: "lowpass", frequency: 240 },
    level: 0.026,
    lfo: { hz: 0.04, depth: 0.3 },
    air: { frequency: 3200, q: 0.9, level: 0.06 },
  },
  /* A captain's cabin: the hull's low voice through the planks, close and enclosed. */
  cabin: {
    filter: { type: "lowpass", frequency: 210 },
    level: 0.04,
    lfo: { hz: 0.08, depth: 0.5 },
    air: { frequency: 900, q: 0.7, level: 0.1 },
  },
  /* The crew deck: heavier again, the hold's air and the water on the other side of the hull. */
  hold: {
    filter: { type: "lowpass", frequency: 170 },
    level: 0.045,
    lfo: { hz: 0.06, depth: 0.55 },
    air: { frequency: 600, q: 0.6, level: 0.12 },
  },
  /* The stern gallery: open to the sea on one side, a deck's wood under it on the other. */
  gallery: {
    filter: { type: "lowpass", frequency: 250 },
    level: 0.03,
    lfo: { hz: 0.09, depth: 0.5 },
    air: { frequency: 1800, q: 0.7, level: 0.08 },
  },
};

/** Seconds for a new room tone to reach full level under the incoming painting. */
export const ROOM_TONE_FADE_IN = 1.4;
/**
 * Time constant of a room tone letting go. Six of these (~2.7 s) is the stop: longer than the
 * fade-in, so the two rooms' air overlaps for a moment rather than cutting between them.
 */
export const ROOM_TONE_FADE_OUT = 0.45;

/** Interaction cues whose job is feedback for a pointer or a movement, not a game event. */
export type CueName = "hover" | "arm" | "advance" | "choice" | "chart" | "threshold" | "save" | "error"
  | "pickup" | "chime" | "deny" | "inventory" | "combine" | "travel" | "locked";
const MOTION_CUES: ReadonlySet<CueName> = new Set(["hover", "threshold", "travel"]);

/**
 * Whether a cue should sound, given the reduced-motion setting. Reduced motion is a statement
 * about the player: the hover sparkle and the threshold swell describe movement across the
 * screen (and the atlas's travel sweep, a journey in sound), so they are left out. Dialogue,
 * choices, the chart, saves, errors and the event cues (pickup, combine, locked...) are
 * information and still sound.
 */
export function cuePlays(cue: CueName, reduced: boolean): boolean {
  return !(reduced && MOTION_CUES.has(cue));
}
