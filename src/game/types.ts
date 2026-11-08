/** Shared data types for rooms, hotspots, effects and dialogue. */

import type { Poly, Pt } from "../engine/walkbox";

export type VerbId =
  | "open" | "close" | "push" | "pull" | "walk" | "pickup"
  | "talk" | "give" | "use" | "look" | "turnon" | "turnoff";

/** The synthesised sound effects a script can play; AudioEngine has a method for each. */
export const SOUNDS = ["click", "pickup", "chime", "deny", "door", "gulls"] as const;
export type SoundId = (typeof SOUNDS)[number];

export interface Rect { x: number; y: number; w: number; h: number }
export type Area = Poly | { rect: Rect };

/** How a painted light breathes: candles flicker quickly, lanterns slowly, lamps barely; fire is big and restless. */
export type LightKind = "lantern" | "candle" | "lamp" | "fire" | "moon";
/** Drifting particles: dust in a sunbeam, embers off a fire, steam off a pot, glints on sunlit water. */
export type MoteKind = "dust" | "embers" | "steam" | "glints";
/** What the floor of a room sounds like underfoot. */
export type Footsteps = "wood" | "deck" | "stone" | "sand" | "earth";
/** A sound that belongs to a place in a room: a fire, water against a hull, a drip, a creaking ship. */
export type EmitterKind = "crackle" | "lapping" | "drip" | "creak";
/** The sound of going through an exit. `none` for open-air walks between places. */
export type DoorSound = "door" | "hatch" | "stairs" | "none";

/** A painted light given life: glow drawn over the scene at `at`, reaching `radius` pixels. */
export interface RoomLight { at: Pt; radius: number; kind: LightKind; colour?: string; showIf?: Cond[] }
/** Painted water that ripples: the background inside `area` is redrawn in displaced strips. */
export interface RoomWater { area: Poly; ripple: number }
/** A drifting band of fog or smoke between `top` and `bottom`, in front of anything whose feet are behind `floor`. */
export interface RoomHaze { top: number; bottom: number; floor: number; alpha: number; speed: number; tint?: string }
/** Particles drifting inside `area`. */
export interface RoomMotes { kind: MoteKind; area: Poly; count: number }

export type Cond =
  | { flag: string; is?: unknown }
  /** True when a numeric flag (a counter raised by `add`) has reached `atLeast`. */
  | { flag: string; atLeast: number }
  | { has: string }
  | { notHas: string }
  | { room: string }
  /** True while the current act is `act` (or any of the listed acts). */
  | { act: number | number[] }
  /** True when at least one of the listed conditions holds. */
  | { any: Cond[] }
  /** True when the condition does not hold. */
  | { not: Cond };

export type Effect =
  | { k: "flag"; id: string; v: unknown }
  /** Raise a numeric flag (a counter, e.g. affection) by `n`; an unset flag counts as 0. */
  | { k: "add"; id: string; n: number }
  | { k: "give"; item: string }
  | { k: "take"; item: string }
  /** Go to another room; `sound` is how the way there sounds (a door unless said otherwise). */
  | { k: "go"; room: string; sound?: DoorSound }
  /** Open a conversation, at `node` instead of the tree's start when given. */
  | { k: "talk"; tree: string; node?: string }
  | { k: "act"; n: number }
  | { k: "win" }
  /** Narrate a line. Waits for the previous line to be read first. */
  | { k: "say"; text: string }
  | { k: "sound"; id: SoundId }
  | { k: "music"; track: string }
  /** Record an entry in Fenn's casebook. Ignored if the same id is already filed. */
  | { k: "note"; id: string; text: string };

export interface Hotspot {
  id: string;
  name: string;
  area: Area;
  /** Explicit spot to stand on before acting. Falls back to the area's base. */
  stand?: Pt;
  showIf?: Cond[];
  /** First matching state overrides the name, lines and effects. */
  states?: {
    if: Cond[];
    name?: string;
    say?: Partial<Record<VerbId, string>>;
    do?: Partial<Record<VerbId, Effect[]>>;
  }[];
  /**
   * A person: fallback lines name them bare and never offer to carry them. Defaults to true
   * for anything you can talk to or that has a speaking figure.
   */
  person?: boolean;
  /** The natural verb, lit up on hover and done by a plain click. Guessed when not given. */
  verb?: VerbId;
  /** Article for fallback lines. Defaults to "the" unless the name is proper or has one. */
  article?: "the" | "a" | "none";
  /** Item granted when "pick up" is used. */
  item?: string;
  /** Default text per verb. */
  say: Partial<Record<VerbId, string>>;
  /** Extra effects per verb, run after the text. */
  do?: Partial<Record<VerbId, Effect[]>>;
  /** Skip walking to the stand point (e.g. examining the sky). */
  noWalk?: boolean;
}

export interface Combo {
  item: string;
  with: string; // hotspot id or item id
  say: string;
  do?: Effect[];
  consume?: boolean;
  /** Only available while these conditions hold; the first matching combo wins. */
  if?: Cond[];
}

/** A static prop or standing figure composited into a scene. */
export interface SceneSprite {
  /** Asset key. */
  key: string;
  /** Ground position (feet), even when the feet are hidden behind an occluder. */
  x: number;
  y: number;
  /** Real-world height relative to a standing adult (the player is 1). Scaled by perspective. */
  size: number;
  /**
   * Fraction of the full figure the art shows, measured from the top. Waist-up art behind a
   * counter is ~0.7: the figure is sized as a whole person and the missing legs fall below.
   */
  visible?: number;
  flip?: boolean;
  idle?: boolean;
  speaker?: string;
  grade?: string;
  /** Hotspot this sprite belongs to, so it can glow on hover. */
  hotspot?: string;
  /** Only drawn while these hold (in addition to its hotspot's showIf). */
  showIf?: Cond[];
}

export interface Room {
  id: string;
  name: string;
  bg: string;
  music?: string;
  walk: Poly[];
  entry: Pt;
  /** Where to appear when arriving from another room, keyed by that room's id. */
  arrive?: Record<string, Pt>;
  /**
   * Ground-plane perspective. A standing adult whose feet are at `refY` is `refH` pixels tall,
   * and height shrinks linearly to zero at the `horizon` line, so every figure and prop at any
   * depth agrees on one scale.
   */
  perspective: { horizon: number; refY: number; refH: number };
  /**
   * Optional measured scale curve: pixel height of a standing adult at a given floor y.
   * When present it overrides `perspective`, which cannot fit art whose furniture and figures
   * were not drawn on a single vanishing point. Two or more knots; interpolated linearly and
   * extrapolated from the end segments.
   */
  scale?: { y: number; h: number }[];
  hotspots: Hotspot[];
  combos?: Combo[];
  /** Props and standing NPC figures composited over the background. */
  sprites?: SceneSprite[];
  /**
   * Background regions repainted over anything standing behind them, e.g. the front of a bar.
   * `y` is where the object meets the floor; it joins the depth sort like an actor's feet.
   */
  occluders?: { area: Poly; y: number }[];
  onEnter?: Effect[];
  /**
   * Arrival scenes: on entering, the first whose conditions hold runs (after `onEnter`).
   * A scene sets a flag that its own conditions exclude, so it plays once.
   */
  scenes?: { if: Cond[]; do: Effect[] }[];
  ambience?: "gulls" | "sea" | "wind" | "tavern";
  /**
   * CSS filter applied to the figures in this room, on top of each sprite's own. This is the one
   * to reach for: a night scene's characters should sit in the light, not glow.
   */
  grade?: string;
  /**
   * CSS filter applied to the background plate and its occluders. Only for rooms that repaint a
   * daylight painting as another time of day — a grade here also dims the lanterns and the sky
   * that make the scene work, so use it sparingly and tint the figures separately.
   */
  backdrop?: string;
  /** Stars over the top `y` pixels of the scene (a night sky painted on at runtime). */
  stars?: { y: number };
  /** World width in scene pixels; defaults to the 1920px viewport. */
  width?: number;
  /** Painted lights that flicker and warm the figures passing through them. */
  lights?: RoomLight[];
  /** Painted water that ripples. */
  water?: RoomWater[];
  /** Drifting fog or smoke bands. */
  haze?: RoomHaze[];
  /** Drifting particles. */
  motes?: RoomMotes[];
  /** A lighthouse lamp whose beam sweeps once every `period` seconds. */
  beacon?: { at: Pt; period: number };
  /** What the floor sounds like underfoot; defaults to wood. */
  footsteps?: Footsteps;
  /** Sounds that belong to the place, positioned at `at` (or everywhere when omitted). */
  emitters?: { kind: EmitterKind; at?: Pt }[];
}

export interface Item {
  id: string;
  name: string;
  /** Shown when examined in the inventory. */
  look: string;
  /** First matching state overrides the name or look text (e.g. the compass's hints). */
  states?: { if: Cond[]; name?: string; look?: string }[];
}

export interface DialogueChoice {
  text: string;
  to: string;
  if?: Cond[];
  do?: Effect[];
}

export interface DialogueNode {
  id: string;
  /** "narrator" for internal monologue, or a character id. */
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
  do?: Effect[];
}

export interface DialogueTree {
  id: string;
  start: string;
  nodes: Record<string, DialogueNode>;
}
