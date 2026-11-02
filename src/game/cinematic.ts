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
    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Skip cinematic";
    skip.className = "cinematic-skip";
    const hint = document.createElement("p");
    hint.textContent = "Click, Enter, or Escape to skip";
    this.overlay.append(this.video, skip, hint);
    document.body.append(this.overlay);

    skip.addEventListener("click", () => this.skip());
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

  play(src: string, onComplete: () => void): void {
    if (this.active) return;
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
