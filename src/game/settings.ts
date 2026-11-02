/** Native controls keep settings usable with mouse, touch, and keyboard. */
export class Settings {
  private panel = document.createElement("div");
  private previousFocus: HTMLElement | null = null;
  private confirmRestart = false;
  constructor(private actions: {
    resume: () => void; restart: () => void; title: () => void;
    mute: () => void; volume: (value: number) => void;
    audio: () => { muted: boolean; volume: number };
    tips: () => boolean; toggleTips: () => void;
  }) {
    this.panel.className = "settings";
    this.panel.hidden = true;
    this.panel.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="pause-heading">
      <p class="eyebrow">THE BRASS COMPASS</p><h1 id="pause-heading">Voyage paused</h1>
      <p>Progress saves automatically as you explore.</p>
      <button data-action="resume">Resume voyage</button>
      <button data-action="mute"></button>
      <button data-action="tips"></button>
      <label>Master volume <input type="range" min="0" max="1" step="0.05" aria-label="Master volume"></label>
      <button data-action="restart">Restart voyage</button>
      <button data-action="title">Return to title</button>
      <small>Escape to resume · H for a tip · Right-click does the lit-up verb, or cancels</small>
    </section>`;
    document.body.append(this.panel);
    this.panel.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest("button")?.dataset.action;
      if (action === "restart" && !this.confirmRestart) {
        this.confirmRestart = true;
        this.button("restart").textContent = "Confirm restart — erase this voyage";
        return;
      }
      if (action === "resume") this.actions.resume();
      if (action === "restart") this.actions.restart();
      if (action === "title") this.actions.title();
      if (action === "mute") { this.actions.mute(); this.sync(); }
      if (action === "tips") { this.actions.toggleTips(); this.sync(); }
    });
    this.panel.querySelector("input")!.addEventListener("input", (event) => {
      this.actions.volume(Number((event.target as HTMLInputElement).value));
    });
    this.panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); this.actions.resume(); }
      if (event.key === "Tab") {
        const controls = [...this.panel.querySelectorAll<HTMLElement>("button, input")];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault(); controls[next].focus();
      }
    });
  }
  private button(action: string): HTMLButtonElement {
    return this.panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  }
  private sync(): void {
    const audio = this.actions.audio();
    this.button("mute").textContent = audio.muted ? "Sound: off — enable" : "Sound: on — mute";
    this.panel.querySelector("input")!.value = String(audio.volume);
    this.button("tips").textContent = this.actions.tips()
      ? "Tip mode: on — next step always shown" : "Tip mode: off — show the next step";
  }
  show(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.confirmRestart = false;
    this.button("restart").textContent = "Restart voyage";
    this.sync(); this.panel.hidden = false; this.button("resume").focus();
  }
  hide(): void {
    this.panel.hidden = true; this.previousFocus?.focus();
  }
}
