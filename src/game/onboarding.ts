/**
 * The first watch: five short, one-time lessons that teach the interface by naming it at the
 * moment it matters, then get out of the way.
 *
 * Nothing here is permanent chrome. Each lesson is offered once — the first hover over a thing,
 * the first item picked up, the first item selected, the first room with a satchel, the first
 * chart — is shown for a few seconds in the game's own glass-and-brass voice, and is remembered
 * per browser so a second voyage is never taught the same thing twice. The verbs stay the verbs,
 * and there is still no footer and no legend.
 *
 * Kept free of canvas and game state so the rules can be tested on their own.
 */

export type LessonId = "look" | "take" | "use" | "inventory" | "chart";

/** The order they are introduced in; also the set that must be taught for `fresh` to end. */
export const LESSON_ORDER: LessonId[] = ["look", "take", "use", "inventory", "chart"];

/** Where a lesson sits on screen: by the scene, the satchel, the top bar or the sentence line. */
export type LessonAnchor = "scene" | "satchel" | "bar" | "sentence";

export interface Lesson {
  id: LessonId;
  anchor: LessonAnchor;
  /** One line, in the game's voice. `touch` players have no hover, so the words change. */
  text: (touch: boolean) => string;
}

export const LESSONS: Record<LessonId, Lesson> = {
  look: {
    id: "look",
    anchor: "scene",
    text: (touch) => touch ? "Tap a thing to name it. Hold to look closer." : "Right-click a thing to look at it.",
  },
  take: {
    id: "take",
    anchor: "scene",
    text: () => "Pick up what you can carry.",
  },
  use: {
    id: "use",
    anchor: "sentence",
    text: (touch) => touch ? "Use or give it: then tap the other thing." : "Use or give it: then pick the other thing.",
  },
  inventory: {
    id: "inventory",
    anchor: "satchel",
    text: (touch) => touch ? "The satchel holds what you take. Tap a pocket." : "The satchel holds what you take. Tab reaches it.",
  },
  chart: {
    id: "chart",
    anchor: "bar",
    text: (touch) => touch ? "The chart keeps what you learn. Tap it." : "The chart keeps what you learn. J.",
  },
};

/** How long a lesson stays up, in seconds of play. */
export const LESSON_TIME = 7;

export const LESSON_KEY = "brasscompass.firstwatch.v1";

/** Lessons already taught, or none if storage is absent, empty or unreadable. */
export function readLessons(read: (key: string) => string | null): LessonId[] {
  try {
    const raw = JSON.parse(read(LESSON_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is LessonId => LESSON_ORDER.includes(id as LessonId));
  } catch {
    return [];
  }
}

export function writeLessons(write: (value: string) => void, taught: Iterable<LessonId>): void {
  try { write(JSON.stringify([...taught])); } catch { /* a lesson is optional */ }
}

export interface ActiveLesson {
  id: LessonId;
  /** Seconds left on screen. */
  left: number;
  /** Seconds it was given, for the fade in and out. */
  total: number;
}

/**
 * The lessons this browser has not seen, one at a time. A lesson is marked taught the moment it
 * is offered, not when it finishes: a player who closes the tab mid-line has still been told.
 */
export class FirstWatch {
  private taught: Set<LessonId>;
  private waiting: LessonId[] = [];
  /** The lesson showing now, or null. */
  current: ActiveLesson | null = null;

  constructor(
    initial: readonly LessonId[],
    private save: (taught: LessonId[]) => void = () => {}
  ) {
    this.taught = new Set(initial.filter((id) => LESSON_ORDER.includes(id)));
    // Nothing left to teach: don't keep the class on the game's plate.
  }

  /** Still something to teach. */
  get fresh(): boolean {
    return this.taught.size < LESSON_ORDER.length;
  }

  /** Whether this lesson has already been offered on this browser. */
  learnt(id: LessonId): boolean {
    return this.taught.has(id);
  }

  /**
   * Offer a lesson at its moment. Returns false if it was already taught or is already waiting;
   * otherwise it takes the screen now, or queues behind the lesson showing.
   */
  offer(id: LessonId): boolean {
    if (this.taught.has(id)) return false;
    this.taught.add(id);
    this.save([...this.taught]);
    if (this.current) this.waiting.push(id);
    else this.current = { id, left: LESSON_TIME, total: LESSON_TIME };
    return true;
  }

  /** Advance the showing lesson; `frozen` holds it while the screen is handing over. */
  tick(dt: number, frozen = false): void {
    if (!this.current || frozen) return;
    this.current.left -= dt;
    if (this.current.left > 0) return;
    const next = this.waiting.shift();
    this.current = next ? { id: next, left: LESSON_TIME, total: LESSON_TIME } : null;
  }

  /** Drop anything waiting (a new voyage, a cutscene, leaving play). */
  clearQueue(): void {
    this.waiting = [];
    this.current = null;
  }

  /** Opacity of the lesson plate: a soft rise, a long hold, a soft fall. */
  get alpha(): number {
    const c = this.current;
    if (!c) return 0;
    const age = c.total - c.left;
    return Math.max(0, Math.min(1, age / 0.28, c.left / 0.6));
  }
}
