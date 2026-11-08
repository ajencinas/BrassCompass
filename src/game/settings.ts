/** Native controls keep settings usable with mouse, touch, and keyboard. */

import { effectiveTextSpeed, type Prefs, type TextScale, type TextSpeed } from "./prefs";

export interface SettingsActions {
  resume: () => void; restart: () => void; title: () => void;
  /** Resume, then show a tip / open the line history: the keys the footer promises. */
  tip: () => void; history: () => void;
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
  /** The text size "Automatic" picks on this screen. */
  autoTextScale: () => TextScale;
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
  ["Tab / Shift+Tab", "Keyboard play: move between the scene, the verbs and the inventory"],
  ["Arrows, then Enter", "Move within the scene, verbs or inventory, and act"],
  ["1–9, or arrows and Enter", "Choose in a conversation"],
  ["Click, Enter or Space", "Skip a line that is typing"],
  ["H", "A tip for what to do next"],
  ["J", "Chart — what you have learned"],
  ["L", "Line history — the last 30 lines"],
  ["M", "Mute"],
  ["Escape", "Pause and settings"],
  ["Touch: tap a thing", "Shows its name; tap again to act"],
  ["Touch: long-press", "Look at (like right-click)"],
];

/** A confirmation armed this recently is a double-click or a bounce, not a decision. */
const CONFIRM_GRACE_MS = 400;

export class Settings {
  private panel = document.createElement("div");
  private previousFocus: HTMLElement | null = null;
  /** When the restart question appeared (performance.now()), or null while it isn't asked. */
  private armedAt: number | null = null;
  constructor(private actions: SettingsActions) {
    this.panel.className = "settings";
    this.panel.hidden = true;
    const controls = CONTROLS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    this.panel.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="pause-heading">
      <header class="settings-head">
        <div>
          <p class="eyebrow">THE BRASS COMPASS</p><h1 id="pause-heading">Voyage paused</h1>
          <p>Progress saves automatically as you explore.</p>
        </div>
        <button data-action="resume" class="primary">Resume voyage</button>
      </header>
      <div class="settings-grid">
        <div class="group">
          <h2>Sound</h2>
          <button data-action="mute"></button>
          <label class="row"><span>Master volume</span><input data-volume="master" type="range" min="0" max="1" step="0.05"></label>
          <label class="row"><span>Music</span><input data-volume="music" type="range" min="0" max="1" step="0.05"></label>
          <label class="row"><span>Effects</span><input data-volume="sfx" type="range" min="0" max="1" step="0.05"></label>
        </div>
        <div class="group">
          <h2>Text</h2>
          <label class="row"><span>Text speed</span><select data-pref="textSpeed" aria-describedby="speed-note">
            <option value="slow">Slow</option><option value="normal">Normal</option>
            <option value="fast">Fast</option><option value="instant">Instant</option>
          </select></label>
          <p class="note" id="speed-note" hidden>Reduced motion is on, so lines appear at once.</p>
          <label class="row"><span>Text size</span><select data-pref="textScale">
            <option value="auto">Automatic</option>
            <option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option>
          </select></label>
          <button data-action="wait" aria-pressed="false"></button>
          <button data-action="tips" aria-pressed="false"></button>
        </div>
        <div class="group">
          <h2>Display</h2>
          <label class="row"><span>Reduced motion</span><select data-pref="reducedMotion">
            <option value="auto">Follow system</option><option value="on">On</option><option value="off">Off</option>
          </select></label>
          <button data-action="fullscreen" aria-pressed="false"></button>
        </div>
        <div class="group">
          <h2>Voyage</h2>
          <button data-action="restart">Restart voyage</button>
          <div class="confirm" role="group" aria-labelledby="restart-question" hidden>
            <p id="restart-question">Restart? This erases the voyage you're on.</p>
            <button data-action="keep">Keep my voyage</button>
            <button data-action="erase" class="danger">Erase it and restart</button>
          </div>
          <button data-action="title">Return to title</button>
        </div>
      </div>
      <details><summary>Controls</summary><dl class="controls">${controls}</dl></details>
      <small>Escape to resume · H for a tip · L for line history</small>
    </section>`;
    document.body.append(this.panel);
    this.panel.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest("button")?.dataset.action;
      if (action === "restart") { this.askRestart(); return; }
      if (action === "keep") { this.keepVoyage(); return; }
      if (action === "erase") {
        // The second click of a double-click, or anything this soon after the question appeared,
        // is the hand that asked it: only a separate, later choice erases a voyage.
        if (event.detail > 1 || this.armedAt === null || performance.now() - this.armedAt < CONFIRM_GRACE_MS) return;
        this.actions.restart();
        return;
      }
      if (action === "resume") this.actions.resume();
      if (action === "title") this.actions.title();
      if (action === "mute") { this.actions.mute(); this.sync(); }
      if (action === "tips") { this.actions.toggleTips(); this.sync(); }
      if (action === "wait") { this.actions.setPrefs({ waitForClick: !this.actions.prefs().waitForClick }); this.sync(); }
      if (action === "fullscreen") this.toggleFullscreen();
    });
    // A click on the dim backdrop would drop focus onto the page, where the dialog's own keys
    // (Escape, Tab) no longer reach it. Keep focus inside.
    this.panel.addEventListener("mousedown", (event) => {
      if (event.target === this.panel) event.preventDefault();
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
        if (select.dataset.pref === "textScale") {
          this.actions.setPrefs({ textScale: v === "auto" ? null : Number(v) as TextScale });
        }
        if (select.dataset.pref === "reducedMotion") {
          this.actions.setPrefs({ reducedMotion: v === "auto" ? null : v === "on" });
        }
        this.sync();
      });
    }
    document.addEventListener("fullscreenchange", () => this.sync());
    this.panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      // A held key acts once. Enter on a focused button clicks it again on every auto-repeat,
      // which walked straight through "Restart voyage" into its confirmation.
      if (event.repeat && (event.key === "Enter" || event.key === " " || event.key === "Escape")) {
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (this.armedAt !== null) this.keepVoyage(); else this.actions.resume();
        return;
      }
      // The footer's promises. Not in a select, where letters pick an option.
      const typing = (event.target as HTMLElement).tagName === "SELECT";
      if (!typing && (event.key === "h" || event.key === "H")) { event.preventDefault(); this.actions.tip(); return; }
      if (!typing && (event.key === "l" || event.key === "L")) { event.preventDefault(); this.actions.history(); return; }
      if (event.key === "Tab") {
        const controls = [...this.panel.querySelectorAll<HTMLElement>("button, input, select, summary")]
          .filter((el) => !el.closest("[hidden]") && !(el as HTMLButtonElement).disabled);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault(); controls[next].focus();
      }
    });
  }
  private button(action: string): HTMLButtonElement {
    return this.panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  }
  /** Ask before a restart erases the voyage. The safe answer takes the button's place. */
  private askRestart(): void {
    if (this.armedAt !== null) return;
    this.armedAt = performance.now();
    this.button("restart").hidden = true;
    this.panel.querySelector<HTMLElement>(".confirm")!.hidden = false;
    this.button("keep").focus();
  }
  private keepVoyage(): void {
    this.armedAt = null;
    this.panel.querySelector<HTMLElement>(".confirm")!.hidden = true;
    const restart = this.button("restart");
    restart.hidden = false;
    restart.focus();
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
    const reduced = this.actions.reduced();
    this.button("mute").textContent = audio.muted ? "Sound: off — enable" : "Sound: on — mute";
    const vol = (k: string) => this.panel.querySelector<HTMLInputElement>(`input[data-volume="${k}"]`)!;
    vol("master").value = String(audio.volume);
    vol("music").value = String(audio.musicVolume);
    vol("sfx").value = String(audio.sfxVolume);
    const sel = (k: string) => this.panel.querySelector<HTMLSelectElement>(`select[data-pref="${k}"]`)!;
    // The speed in effect, not the one stored: reduced motion shows every line at once.
    const speed = sel("textSpeed");
    speed.value = effectiveTextSpeed(prefs, reduced);
    speed.disabled = reduced;
    this.panel.querySelector<HTMLElement>("#speed-note")!.hidden = !reduced;
    const size = sel("textScale");
    size.value = prefs.textScale === null ? "auto" : String(prefs.textScale);
    size.options[0].textContent = `Automatic (${Math.round(this.actions.autoTextScale() * 100)}% here)`;
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
  /** Put focus back in the dialog (it wandered off to the page). */
  focus(): void {
    if (!this.panel.hidden) this.button("resume").focus();
  }
  /** Whether the dialog is showing. */
  get open(): boolean {
    return !this.panel.hidden;
  }
  show(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.armedAt = null;
    this.panel.querySelector<HTMLElement>(".confirm")!.hidden = true;
    this.button("restart").hidden = false;
    this.sync(); this.panel.hidden = false; this.button("resume").focus();
  }
  hide(): void {
    this.panel.hidden = true; this.previousFocus?.focus();
  }
}
