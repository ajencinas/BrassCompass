/**
 * The words baked into each video's pixels. Sighted players read them off the frame; everyone
 * else needs them as text, so they are exposed to the accessibility tree and can be shown on
 * screen at whatever size the reader needs.
 */
const TRANSCRIPTS: Record<string, string[]> = {
  "intro.mp4": ["The Brass Compass", "One night in Port Vela. One berth on the Marrow. One clerk with paperwork to finish."],
  "act-i-outro.mp4": ["End of Act I", "One stamped licence. One berth on the Marrow.", "Officially competent, in a font nobody can argue with.", "The next chapter: tomorrow, the Marrow sails. Tonight, the harbour keeps its secrets."],
  "act-ii-intro.mp4": ["Act II", "The Vela Straits"],
  "act-ii-outro.mp4": ["The Vela Straits", "Inside the reef, a ship that should not exist."],
  "act-iii-intro.mp4": ["Act III", "Tidy Weather"],
  "act-iii-outro.mp4": ["Tidy Weather", "Everybody rows for the Marrow. One sail runs for home."],
  "act-iv-intro.mp4": ["Act IV", "All Hands Returned"],
  "act-iv-outro.mp4": ["All Hands Returned", "Arcadia: returned. All hands.", "Port Vela harbour."],
};

export class CinematicPlayer {
  private overlay = document.createElement("div");
  private video = document.createElement("video");
  private onComplete: (() => void) | null = null;

  constructor(private audio: () => { muted: boolean; volume: number }) {
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

    skip.addEventListener("click", () => this.skip());
    text.addEventListener("click", (event) => {
      event.stopPropagation();
      const shown = this.transcript.classList.toggle("visible");
      this.transcript.classList.toggle("sr-only", !shown);
      text.textContent = shown ? "Hide text" : "Show text";
    });
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay || event.target === this.video) this.skip();
    });
    this.overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== "Escape" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      this.skip();
    });
    this.video.addEventListener("ended", () => this.skip());
    this.video.addEventListener("error", () => this.skip());
  }

  get active(): boolean {
    return this.onComplete !== null;
  }

  private transcript = document.createElement("div");

  play(src: string, onComplete: () => void): void {
    if (this.active) return;

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
    const audio = this.audio();
    this.video.muted = audio.muted;
    this.video.volume = audio.volume;
    this.video.src = src;
    this.overlay.hidden = false;
    this.overlay.querySelector("button")!.focus();
    void this.video.play().catch(() => {
      // The skip control remains available if autoplay is blocked.
    });
  }

  skip(): void {
    if (!this.onComplete) return;
    const complete = this.onComplete;
    this.onComplete = null;
    this.video.pause();
    this.overlay.hidden = true;
    this.video.removeAttribute("src");
    this.video.load();
    complete();
  }
}
