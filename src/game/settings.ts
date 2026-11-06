/** Native controls keep settings usable with mouse, touch, and keyboard. */

import type { Prefs, TextScale, TextSpeed } from "./prefs";

export interface SettingsActions {
  resume: () => void; restart: () => void; title: () => void;
  mute: () => void;
  volume: (value: number) => void;
  musicVolume: (value: number) => void;
  sfxVolume: (value: number) => void;
  audio: () => { muted: boolean; volume: number; musicVolume: number; sfxVolume: number };
  tips: () => boolean; toggleTips: () => void;
  prefs: () => Prefs;
  setPrefs: (change: Partial<Prefs>) => void;
  /** Whether reduced motion is in effect right now (the OS setting when following it). */
  reduced: () => boolean;
}

/** The controls, shared with README "How to play" in spirit; kept short enough to scan. */
export const CONTROLS: [string, string][] = [
  ["Left-click a thing", "Do the obvious: talk, take, open, look (the lit-up verb)"],
  ["Right-click a thing", "Look at it"],
  ["Right-click elsewhere", "Cancel the sentence, or leave a conversation"],
  ["Click a verb, then a thing", "Do exactly that (Use and Give take two)"],
  ["Click the floor", "Walk; double-click to run"],
  ["Double-click a doorway", "Leave at once"],
  ["Hold Q, or the Reveal button", "Show everything you can interact with"],
  ["Tab / Shift+Tab, arrows, Enter", "Keyboard play: verbs, inventory, the scene"],
  ["1–9, or arrows and Enter", "Choose in a conversation"],
  ["Click, Enter or Space", "Skip a line that is typing"],
  ["H", "A tip for what to do next"],
  ["J", "Casebook — what you have learned"],
  ["L", "Line history — the last 30 lines"],
  ["M", "Mute"],
  ["Escape", "Pause and settings"],
  ["Touch: tap a thing", "Shows its name; tap again to act"],
  ["Touch: long-press", "Look at (like right-click)"],
];

export class Settings {
  private panel = document.createElement("div");
  private previousFocus: HTMLElement | null = null;
  private confirmRestart = false;
  constructor(private actions: SettingsActions) {
    this.panel.className = "settings";
    this.panel.hidden = true;
    const controls = CONTROLS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    this.panel.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="pause-heading">
      <p class="eyebrow">THE BRASS COMPASS</p><h1 id="pause-heading">Voyage paused</h1>
      <p>Progress saves automatically as you explore.</p>
      <button data-action="resume">Resume voyage</button>
      <h2>Sound</h2>
      <button data-action="mute"></button>
      <label>Master volume <input data-volume="master" type="range" min="0" max="1" step="0.05"></label>
      <label>Music <input data-volume="music" type="range" min="0" max="1" step="0.05"></label>
      <label>Effects <input data-volume="sfx" type="range" min="0" max="1" step="0.05"></label>
      <h2>Text</h2>
      <label>Text speed <select data-pref="textSpeed">
        <option value="slow">Slow</option><option value="normal">Normal</option>
        <option value="fast">Fast</option><option value="instant">Instant</option>
      </select></label>
      <label>Text size <select data-pref="textScale">
        <option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option>
      </select></label>
      <button data-action="wait" aria-pressed="false"></button>
      <button data-action="tips" aria-pressed="false"></button>
      <h2>Display</h2>
      <label>Reduced motion <select data-pref="reducedMotion">
        <option value="auto">Follow system</option><option value="on">On</option><option value="off">Off</option>
      </select></label>
      <button data-action="fullscreen" aria-pressed="false"></button>
      <details><summary>Controls</summary><dl class="controls">${controls}</dl></details>
      <h2>Voyage</h2>
      <button data-action="restart">Restart voyage</button>
      <button data-action="title">Return to title</button>
      <small>Escape to resume · H for a tip · L for line history</small>
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
      if (action === "wait") { this.actions.setPrefs({ waitForClick: !this.actions.prefs().waitForClick }); this.sync(); }
      if (action === "fullscreen") this.toggleFullscreen();
    });
    for (const input of this.panel.querySelectorAll<HTMLInputElement>("input[data-volume]")) {
      input.addEventListener("input", () => {
        const v = Number(input.value);
        if (input.dataset.volume === "master") this.actions.volume(v);
        if (input.dataset.volume === "music") this.actions.musicVolume(v);
        if (input.dataset.volume === "sfx") this.actions.sfxVolume(v);
      });
    }
    for (const select of this.panel.querySelectorAll<HTMLSelectElement>("select[data-pref]")) {
      select.addEventListener("change", () => {
        const v = select.value;
        if (select.dataset.pref === "textSpeed") this.actions.setPrefs({ textSpeed: v as TextSpeed });
        if (select.dataset.pref === "textScale") this.actions.setPrefs({ textScale: Number(v) as TextScale });
        if (select.dataset.pref === "reducedMotion") {
          this.actions.setPrefs({ reducedMotion: v === "auto" ? null : v === "on" });
        }
        this.sync();
      });
    }
    document.addEventListener("fullscreenchange", () => this.sync());
    this.panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); this.actions.resume(); }
      if (event.key === "Tab") {
        const controls = [...this.panel.querySelectorAll<HTMLElement>("button, input, select, summary")];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault(); controls[next].focus();
      }
    });
  }
  private button(action: string): HTMLButtonElement {
    return this.panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  }
  private toggleFullscreen(): void {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
        else doc.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) {
        void root.requestFullscreen().catch(() => {});
      } else root.webkitRequestFullscreen?.();
    } catch { /* not available here (an iframe, an old iPhone) */ }
  }
  private sync(): void {
    const audio = this.actions.audio();
    const prefs = this.actions.prefs();
    this.button("mute").textContent = audio.muted ? "Sound: off — enable" : "Sound: on — mute";
    const vol = (k: string) => this.panel.querySelector<HTMLInputElement>(`input[data-volume="${k}"]`)!;
    vol("master").value = String(audio.volume);
    vol("music").value = String(audio.musicVolume);
    vol("sfx").value = String(audio.sfxVolume);
    const sel = (k: string) => this.panel.querySelector<HTMLSelectElement>(`select[data-pref="${k}"]`)!;
    sel("textSpeed").value = prefs.textSpeed ?? (this.actions.reduced() ? "instant" : "normal");
    sel("textScale").value = String(prefs.textScale);
    sel("reducedMotion").value = prefs.reducedMotion === null ? "auto" : prefs.reducedMotion ? "on" : "off";
    const toggle = (action: string, on: boolean, yes: string, no: string) => {
      const b = this.button(action);
      b.textContent = on ? yes : no;
      b.setAttribute("aria-pressed", String(on));
    };
    toggle("wait", prefs.waitForClick,
      "Wait for click: on — lines stay until you click", "Wait for click: off — lines move on by themselves");
    toggle("tips", this.actions.tips(),
      "Tip mode: on — next step always shown", "Tip mode: off — show the next step");
    const full = Boolean(document.fullscreenElement ?? (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement);
    const canFull = Boolean(document.documentElement.requestFullscreen ??
      (document.documentElement as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen);
    toggle("fullscreen", full, "Fullscreen: on — leave", "Fullscreen: off — enter");
    this.button("fullscreen").hidden = !canFull;
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
