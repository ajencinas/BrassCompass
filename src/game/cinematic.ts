import { assetUrl } from "../content/assets";
import { restoreFocus } from "./focus";

/**
 * The words baked into each video's pixels. Sighted players read them off the frame; everyone
 * else needs them as text, so they are exposed to the accessibility tree and can be shown on
 * screen at whatever size the reader needs.
 *
 * The reboot's four acts have no opening or closing films: the old cinematics belong to the
 * previous story and are not shipped with this one. Register a transcript here if a new film is
 * added; until then there is nothing to describe.
 */
const TRANSCRIPTS: Record<string, string[]> = {};

/** What a cinematic needs from the game's audio. */
export interface CinematicAudio {
  muted: boolean;
  volume: number;
  musicVolume: number;
  /**
   * Take the room's music and sound down under a video, and back after. `level` is how far:
   * 0 (the default) for a video with its own soundtrack, part-way under a composed cue.
   */
  duck(on: boolean, level?: number): void;
  /** A video with no soundtrack of its own: play a composed cue of this many seconds, in this act. */
  beginCue(act: number, seconds: number): void;
  /** Let the cue go, over `fadeMs`, into the next act's music. */
  endCue(fadeMs?: number): void;
}

/**
 * Which cinematics carry their own audio stream. The reboot ships no films, so the set is
 * empty; add a file here if a future film has a soundtrack. A video with a soundtrack ducks the
 * game to nothing under it; one without gets a composed cue and a part-way duck instead, so an
 * act break is never seven seconds of silence. The mechanism stays for the engine.
 */
const SOUNDTRACK = new Set<string>();
/** How far the music and the room drop under a composed cue: about -9 dB, still there beneath it. */
const CUE_DUCK = 0.35;

/** The file name of a cinematic, from its URL. */
function nameOf(src: string): string {
  return (src.split("/").pop() ?? "").split("?")[0];
}

/** The act a cinematic belongs to, from its filename: `act-ii-intro.mp4` is act 2. */
function actOf(src: string): number {
  const m = /act-(iv|iii|ii|i)-/i.exec(src);
  return m ? ["i", "ii", "iii", "iv"].indexOf(m[1].toLowerCase()) + 1 : 1;
}

/**
 * A key or click this soon after a cinematic starts belongs to whatever started it: the second
 * click of a double-click on New Voyage, the click a tap trails behind it, a choice confirmed
 * twice. It must not skip a video the player has not seen.
 */
const SKIP_GRACE_MS = 400;
const SKIP_KEYS = new Set(["Enter", "Escape", " "]);

export class CinematicPlayer {
  private overlay = document.createElement("div");
  private video = document.createElement("video");
  private onComplete: (() => void) | null = null;
  /** The room's sound coming back after a video; cancelled when another follows straight on. */
  private unduck: number | null = null;
  /** The end of the fade-out, when the overlay is hidden and the video let go. */
  private hideTimer: number | null = null;
  /** The silent cinematic whose cue we are waiting to start, and whether it has started. */
  private cueFor: string | null = null;
  private cueStarted = false;
  private cueMeta: (() => void) | null = null;
  private startedAt = -Infinity;
  /** Keys down right now, and those that were already down when this cinematic began. */
  private held = new Set<string>();
  private heldAtStart = new Set<string>();
  /** What had focus before the overlay took it, so the game gets its keyboard back after. */
  private previousFocus: HTMLElement | null = null;

  constructor(private audio: () => CinematicAudio) {
    this.overlay.className = "cinematic";
    this.overlay.hidden = true;
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.setAttribute("aria-label", "Story cinematic");
    this.video.playsInline = true;
    this.video.preload = "auto";
    const text = document.createElement("button");
    text.type = "button";
    text.textContent = "Show text";
    text.className = "cinematic-text";
    this.transcript.className = "cinematic-transcript sr-only";

    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Skip cinematic";
    skip.className = "cinematic-skip";
    const hint = document.createElement("p");
    hint.className = "cinematic-hint";
    hint.textContent = "Click, Enter, or Escape to skip";
    this.overlay.append(this.video, this.transcript, text, skip, hint);
    document.body.append(this.overlay);

    skip.addEventListener("click", () => { if (this.settled()) this.skip(); });
    text.addEventListener("click", (event) => {
      event.stopPropagation();
      const shown = this.transcript.classList.toggle("visible");
      this.transcript.classList.toggle("sr-only", !shown);
      text.textContent = shown ? "Hide text" : "Show text";
    });
    this.overlay.addEventListener("click", (event) => {
      if ((event.target === this.overlay || event.target === this.video) && this.settled()) this.skip();
    });
    this.overlay.addEventListener("keydown", (event) => {
      if (!SKIP_KEYS.has(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      // Only a fresh press skips: not a held key's auto-repeat, and not the press that started
      // the video (a choice, New Voyage), which is still down when it begins.
      if (event.repeat || this.heldAtStart.has(event.key) || !this.settled()) return;
      this.skip();
    });
    // Capture, so these see every key before anything else can act on it or stop it.
    window.addEventListener("keydown", (event) => { this.held.add(event.key); }, true);
    window.addEventListener("keyup", (event) => {
      this.held.delete(event.key);
      this.heldAtStart.delete(event.key);
    }, true);
    // A key held while the window loses focus never sends its keyup.
    window.addEventListener("blur", () => { this.held.clear(); this.heldAtStart.clear(); });
    this.video.addEventListener("ended", () => this.skip());
    this.video.addEventListener("error", () => this.skip());
  }

  get active(): boolean {
    return this.onComplete !== null;
  }

  private transcript = document.createElement("div");

  /** Long enough since the video started that a key or click means "skip". */
  private settled(): boolean {
    return performance.now() - this.startedAt >= SKIP_GRACE_MS;
  }

  play(src: string, onComplete: () => void): void {
    if (this.active) return;
    // Straight on from another cinematic (an outro into the next act's title card): the room's
    // sound stays down and the overlay stays up between the two.
    if (this.unduck !== null) { window.clearTimeout(this.unduck); this.unduck = null; }
    if (this.hideTimer !== null) { window.clearTimeout(this.hideTimer); this.hideTimer = null; }

    const lines = TRANSCRIPTS[src.split("/").pop() ?? ""] ?? [];
    this.transcript.replaceChildren(
      ...lines.map((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        return p;
      })
    );
    this.transcript.classList.add("sr-only");
    this.transcript.classList.remove("visible");
    const toggle = this.overlay.querySelector(".cinematic-text");
    if (toggle) toggle.textContent = "Show text";
    this.overlay.setAttribute("aria-label", lines.length ? lines.join(". ") : "Story cinematic");
    this.onComplete = onComplete;
    this.startedAt = performance.now();
    this.heldAtStart = new Set(this.held);
    const audio = this.audio();
    // A cue still fading from the previous video belongs to that one; this one starts its own.
    audio.endCue(200);
    const soundtrack = SOUNDTRACK.has(nameOf(src));
    audio.duck(true, soundtrack ? 0 : CUE_DUCK);
    this.video.muted = audio.muted;
    // The soundtrack is music: it follows the Music slider as well as the master volume.
    this.video.volume = Math.max(0, Math.min(1, audio.volume * audio.musicVolume));
    // next-level: ship — scripts write `/assets/video/…`; resolve it against the build's base so
    // the cinematics play when the game is hosted in a subdirectory.
    this.video.src = assetUrl(src);
    // A video with no audio stream gets a composed cue under a part-way duck. It starts with
    // the picture (duration is not known until metadata), and ends when the cinematic does.
    this.cueFor = soundtrack ? null : src;
    this.cueStarted = false;
    if (this.cueMeta) { this.video.removeEventListener("loadedmetadata", this.cueMeta); this.cueMeta = null; }
    if (this.cueFor) {
      const startCue = (): void => {
        if (this.cueStarted || this.cueFor !== src || !this.active) return;
        const seconds = Number.isFinite(this.video.duration) ? this.video.duration : 0;
        if (seconds <= 0) return;
        this.cueStarted = true;
        audio.beginCue(actOf(src), seconds);
      };
      this.cueMeta = startCue;
      this.video.addEventListener("loadedmetadata", startCue, { once: true });
      if (this.video.readyState >= 1) startCue();
    }
    const fresh = this.overlay.hidden;
    if (fresh) this.previousFocus = document.activeElement as HTMLElement | null;
    this.overlay.inert = false;
    this.overlay.hidden = false;
    // From nothing, fade in from transparent. Straight on from another cinematic the overlay is
    // still up (or part-way out) and simply comes back to full.
    if (fresh) void this.overlay.offsetWidth;
    this.overlay.classList.add("showing");
    this.overlay.querySelector("button")!.focus();
    void this.video.play().catch(() => {
      // The skip control remains available if autoplay is blocked.
    });
  }

  skip(): void {
    if (!this.onComplete) return;
    const complete = this.onComplete;
    this.onComplete = null;
    this.cueFor = null;
    if (this.cueMeta) { this.video.removeEventListener("loadedmetadata", this.cueMeta); this.cueMeta = null; }
    this.audio().endCue();
    this.video.pause();
    // Fade over the game rather than cutting to it; the last frame stays up while it does.
    // Meanwhile the overlay takes no clicks, keys or focus, so the game is playable at once.
    if (this.overlay.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.overlay.inert = true;
    this.overlay.classList.remove("showing");
    this.hideTimer = window.setTimeout(() => this.finishHide(), this.fadeMs() + 50);
    // The room's sound comes back on the next tick, unless `complete` starts another video.
    this.unduck = window.setTimeout(() => {
      this.unduck = null;
      this.audio().duck(false);
    }, 0);
    complete();
  }

  private finishHide(): void {
    this.hideTimer = null;
    if (this.active) return;
    this.overlay.hidden = true;
    this.video.removeAttribute("src");
    this.video.load();
    // The skip button is gone with the overlay; hand focus back to the game (or to whatever
    // took it while the film was ending) instead of leaving a screen reader on <body>.
    if (document.activeElement === document.body) restoreFocus(this.previousFocus);
  }

  /** The overlay's fade, as the stylesheet has it (shorter under reduced motion). */
  private fadeMs(): number {
    const seconds = parseFloat(getComputedStyle(this.overlay).transitionDuration);
    return Number.isFinite(seconds) ? seconds * 1000 : 350;
  }
}
