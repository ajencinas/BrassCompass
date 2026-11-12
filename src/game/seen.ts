/**
 * Which narration lines the player has already read, remembered per browser (apart from the
 * save, like the preferences) so a second voyage can skip what it has said before.
 *
 * Lines are stored as short hashes, not text, and capped: this is a convenience, never a record.
 * Kept free of the game and of storage itself so the rules can be tested on their own.
 */

export const SEEN_KEY = "brasscompass.seen.v1";
/** The most lines remembered; the oldest are forgotten first. */
export const SEEN_MAX = 3000;

/** A 32-bit FNV-1a hash of the line, in hex: small, stable, and no text kept. */
export function lineKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export class SeenLines {
  private keys: Set<string>;

  constructor(
    initial: Iterable<string> = [],
    private save: (keys: string[]) => void = () => {},
    private max = SEEN_MAX
  ) {
    this.keys = new Set(initial);
    this.trim();
  }

  get size(): number {
    return this.keys.size;
  }

  has(text: string): boolean {
    return this.keys.has(lineKey(text));
  }

  /** Remember a line. Returns true if it was new (and so was saved). */
  add(text: string): boolean {
    const key = lineKey(text);
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.trim();
    this.save([...this.keys]);
    return true;
  }

  private trim(): void {
    while (this.keys.size > this.max) {
      const oldest = this.keys.values().next().value as string;
      this.keys.delete(oldest);
    }
  }
}

/** Lines already read, or none if storage is absent, empty or unreadable. */
export function readSeen(read: (key: string) => string | null): string[] {
  try {
    const raw = JSON.parse(read(SEEN_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string").slice(-SEEN_MAX) : [];
  } catch {
    return [];
  }
}

export function writeSeen(write: (value: string) => void, keys: Iterable<string>): void {
  try { write(JSON.stringify([...keys])); } catch { /* skipping is optional */ }
}

/** How long a read line stays before skipping moves past it, in seconds. */
export const SKIP_DELAY = 0.3;

/**
 * Whether a line should be skipped now: only a line already read, and only when the player
 * asked for it, by the setting or by holding the fast-forward key.
 */
export function shouldSkip(repeat: boolean, skipSetting: boolean, fastForwardHeld: boolean): boolean {
  return repeat && (skipSetting || fastForwardHeld);
}
