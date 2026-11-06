/** Game — state machine, interaction model, dialogue runtime and rendering. */

import { LOGICAL_W, LOGICAL_H, SCENE_H, type View } from "../engine/view";
import type { Input } from "../engine/input";
import type { Assets } from "../engine/assets";
import type { AudioEngine } from "../engine/audio";
import { drawText, drawWrapped, typewriterSlice, wrap } from "../engine/text";
import { WalkMesh, pointInPoly, clampToFloor, type Poly, type Pt } from "../engine/walkbox";
import {
  drawPanel, hitTestPanel, drawCursor, drawDialogue, dialogueHit, dialogueLayout,
  INV_PER_PAGE, COLORS, type PanelModel, type DialogueModel, type Chip,
} from "./ui";
import { Settings } from "./settings";
import { CinematicPlayer } from "./cinematic";
import { VERBS } from "./verbs";
import { characterOf } from "../content/characters";
import type {
  Room, Hotspot, VerbId, Effect, Cond, DialogueTree, DialogueNode, Area, Combo, DialogueChoice,
} from "./types";
import { ROOMS, START_ROOM, START_POS } from "../content/rooms";
import { ACTS, ENDING, FIRST_ACT } from "../content/acts";
import { defaultLine, noComboLine, itemAloneLine, targetOf, phrase, type Target } from "./lines";
import { personHeightAt } from "./scale";
import { Casebook, type CaseNote } from "./casebook";
import {
  readSave, writeSave, clearSave, backupCorrupt, takeOldSave, hasAnySave, migrateOldSave,
  SAVE_VERSION, type SaveData, type SaveKnown,
} from "./save";
import { drawDebugOverlay } from "./debug";
import { drawTitle, titleButtons, hitTitleButton, type TitleId } from "./title";
import { drawFigure, drawSprite, drawShadow } from "./figures";
import { ITEMS } from "../content/items";
import { DIALOGUES } from "../content/dialogue";
import { GLOBAL_COMBOS } from "../content/combos";
import { TIPS } from "../content/hints";

/** Top-bar buttons: one definition, used for both drawing and hit-testing. */
const BAR = { y: 18, h: 44, tip: [1300, 160], casebook: [1470, 190], pause: [1690, 206] } as const;

const TIPS_KEY = "brasscompass.tips.v1";

/** What the game reports to `Game.trace` (dev tools only; nothing listens in production). */
export type TraceEvent =
  | { kind: "verb"; text: string; hotspot: Hotspot }
  | { kind: "combo"; text: string; combo?: Combo }
  | { kind: "say"; text: string }
  | { kind: "effect"; effect: Effect }
  | { kind: "room"; room: string }
  | { kind: "node"; tree: string; node: DialogueNode }
  | { kind: "choice"; tree: string; choice: DialogueChoice }
  | { kind: "act"; n: number };

/** What the dev editor can pick with Alt+click. */
export type DevPick =
  | { kind: "hotspot"; room: string; hotspot: Hotspot }
  | { kind: "node"; tree: string; node: DialogueNode }
  | { kind: "choice"; tree: string; node: DialogueNode; choice: DialogueChoice };

type Ref = { kind: "hotspot" | "item"; id: string; name: string };
type KeyboardFocus =
  | { kind: "verb"; id: VerbId }
  | { kind: "item"; id: string }
  | { kind: "hotspot"; id: string };

interface Sentence {
  verb: VerbId | null;
  a: Ref | null;
  b: Ref | null;
}

// Movement is measured in body heights so it reads the same at every depth: a figure half as
// tall (twice as far away) covers half the screen distance in the same time.
const WALK_SPEED = 1.15; // body heights per second
const STRIDE = 0.85; // body heights per full walk cycle (two steps)
// Floor seen from eye height is foreshortened: a stride toward the camera covers far fewer screen
// pixels than a stride across it. Physically ~0.25 here; 0.45 keeps depth walks from dragging.
const DEPTH_SPEED = 0.45;
const NARRATION_SPEED = 62;
/**
 * How long a line stays up, once fully shown, before an effect that would replace it runs.
 * A click skips the wait.
 */
const HOLD: Partial<Record<Effect["k"], number>> = { talk: 0.5, say: 0.6, act: 2.4, win: 2.5 };
/** Effects that hand the screen to something else; nothing after one in a list runs. */
const TERMINAL: ReadonlySet<Effect["k"]> = new Set(["go", "talk", "act", "win"]);
/**
 * Effects that only change the voyage's state. They never wait for a line: a save, a pause or a
 * quit while a line is still being read must not lose them (Act III's crowbar).
 */
const STATE: ReadonlySet<Effect["k"]> = new Set(["flag", "add", "give", "take", "note"]);

/** What a save may name, checked against the live content. */
const KNOWN: SaveKnown = {
  room: (id) => id in ROOMS,
  item: (id) => id in ITEMS,
  act: (n) => n in ACTS,
  firstAct: FIRST_ACT,
};

export class Game {
  private room!: Room;
  private mesh!: WalkMesh;

  private x = START_POS.x;
  private y = START_POS.y;
  private facing: 1 | -1 = 1;
  private moveDirection: "left" | "right" | "up" | "down" = "right";
  private path: Pt[] = [];
  /** Distance walked, in body heights; drives the walk cycle and footsteps. */
  private walkPhase = 0;
  private walkStarting = false;
  private directionPending = 0;

  private sentence: Sentence = { verb: null, a: null, b: null };
  private narration: { text: string; shown: number } | null = null;
  private narrationClock = 0;

  private inventory: string[] = [];
  private inventoryPage = 0;
  private flags: Record<string, unknown> = {};
  /** Current act. Drives the start room, the cinematics and what "continue" restores. */
  private act = FIRST_ACT;
  /** Casebook entries, in the order Fenn wrote them. */
  private notes: CaseNote[] = [];

  private dialogue: { tree: DialogueTree; nodeId: string; shown: number } | null = null;

  private fade = 0;
  private fadeTarget = 0;
  private title = true;
  private won = false;
  private hoverVerb: VerbId | null = null;
  private hoverItem: string | null = null;
  private hoverHotspot: string | null = null;
  private hoverChoice = -1;
  private keyboardFocus: KeyboardFocus | null = null;
  private cameraX = 0;
  private focusCameraX: number | null = null;
  private rejection = 0;
  private time = 0;
  private hasSave = false;
  private paused = false;
  private settings: Settings;
  private cinematic: CinematicPlayer;
  private casebook: Casebook;

  constructor(
    private view: View,
    private input: Input,
    private assets: Assets,
    private audio: AudioEngine
  ) {
    this.settings = new Settings({
      resume: () => this.setPaused(false),
      restart: () => { this.setPaused(false); this.title = false; this.newGame(); },
      title: () => {
        // The save keeps anything still queued, so Continue picks up exactly here.
        this.persist();
        this.setPaused(false);
        this.resetTransient();
        this.explore = false;
        this.roomMenu = false;
        this.title = true;
      },
      mute: () => { this.audio.toggleMute(); },
      volume: (value) => this.audio.setVolume(value),
      audio: () => this.audio,
      tips: () => this.tipMode,
      toggleTips: () => this.setTipMode(!this.tipMode),
    });
    try { this.tipMode = localStorage.getItem(TIPS_KEY) === "on"; } catch { this.tipMode = false; }
    this.cinematic = new CinematicPlayer(() => this.audio);
    const titles: Record<number, string> = {};
    for (const [n, a] of Object.entries(ACTS)) titles[Number(n)] = `${a.title}`;
    this.casebook = new Casebook(titles, () => this.persist());
  }
  /** Tip mode keeps the current tip on screen. Remembered per browser, separate from saves. */
  private tipMode = false;
  private saveBroken = false;
  /** Respect the OS setting: no typewriter, no breathing, no twinkle, no pulsing outline. */
  private reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private live: HTMLElement | null = null;
  /** Seconds spent waiting for a room's art to arrive. */
  private roomWait = 0;
  private saveWarning: string | null = null;
  private setTipMode(on: boolean): void {
    this.tipMode = on;
    try { localStorage.setItem(TIPS_KEY, on ? "on" : "off"); } catch { /* ignore */ }
  }

  /** The plain next-step hint for the current state. */
  private currentTip(): string {
    return TIPS.find((t) => t.if.every((c) => this.check(c)))?.text ??
      "Look around: hover over things to see what they are, and talk to everyone.";
  }
  private showTip(): void {
    this.audio.chime();
    this.speak(`Tip: ${this.currentTip()}`);
  }

  /** The verb a sensible person would use on this: lit up on hover, done by right-click. */
  private suggestedVerb(hs: Hotspot): VerbId {
    if (hs.verb) return hs.verb;
    if (hs.do?.talk) return "talk";
    if (hs.item) return "pickup";
    if (hs.do?.open || hs.do?.walk) return "open";
    return "look";
  }

  private setPaused(value: boolean): void {
    this.paused = value;
    if (value) { this.persist(); this.settings.show(); } else this.settings.hide();
  }

  // ------------------------------------------------------------ lifecycle

  start(): void {
    try {
      this.hasSave = hasAnySave();
    } catch { this.hasSave = false; }
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__game = this;
      // Headless browsers can throttle rAF; tests advance the game clock directly.
      (window as unknown as Record<string, unknown>).__ff = (n = 200) => {
        for (let i = 0; i < n; i++) this.update(0.05);
      };
      // Jump straight to the start of an act, for testing and calibration.
      (window as unknown as Record<string, unknown>).__act = (n: number) => {
        this.title = false;
        this.won = false;
        this.flags = {};
        this.startAct(n);
      };
    }
    this.input.onDown((x, y, button) => this.onClick(x, y, button));
    this.input.onMove((x, y) => this.onMove(x, y));
    this.input.onKey((k, event) => this.onKey(k, event));
    this.loadRoom(START_ROOM, START_POS);
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    if (!this.paused) this.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame((tt) => this.frame(tt));
  }
  private lastT = 0;

  // ------------------------------------------------------------ input

  /**
   * True while the screen is changing hands (a door's fade, a room still arriving, a cutscene):
   * clicks and keys then could act on a room that is about to go, or trigger a door twice.
   */
  private inputLocked(): boolean {
    if (this.title || this.won) return false;
    // Past half-way back from black the new room is plainly there to be clicked.
    return this.paused || this.cinematic.active || this.pendingRoom !== null || this.fade > 0.5;
  }

  private onKey(k: string, event: KeyboardEvent): void {
    if (this.paused || this.cinematic.active) return;
    if (this.explore && this.exploreKey(k, event)) return;
    if (this.casebook.open) {
      // The overlay has focus of its own; never let a stray key reach the game behind it.
      event.preventDefault();
      if (k === "Escape" || k.toLowerCase() === "j") this.casebook.hide();
      return;
    }
    this.audio.unlock();
    if (k === "Escape" && !this.won) {
      event.preventDefault();
      this.setPaused(true);
      return;
    }
    if (k.toLowerCase() === "m") { this.audio.toggleMute(); return; }
    if (this.inputLocked()) {
      if (k === "Enter" || k === " " || k === "Tab" || k.startsWith("Arrow")) event.preventDefault();
      return;
    }
    // A held key must not race through lines and choices the player hasn't read.
    if (event.repeat && (k === "Enter" || k === " " || /^[1-9]$/.test(k)) &&
      (this.dialogue || this.queue || this.narration)) {
      event.preventDefault();
      return;
    }
    if (k.toLowerCase() === "j" && !this.title && !this.won && !this.cinematic.active) {
      event.preventDefault();
      this.casebook.show(this.notes);
      return;
    }
    if ((k === "h" || k === "H") && !this.title && !this.won && !this.dialogue && !this.queue) {
      this.showTip();
      return;
    }
    if (this.won && (k === "Enter" || k === " ")) {
      event.preventDefault();
      this.won = false;
      this.title = true;
      return;
    }
    if (this.title) {
      const buttons = this.titleButtons();
      const focus = buttons.findIndex((b) => b.id === this.titleFocus);
      if ((k === "c" || k === "C") && this.hasSave) this.titleActivate("continue");
      else if (k === "e" || k === "E") this.titleActivate("explore");
      else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(k)) {
        event.preventDefault();
        const delta = k === "ArrowUp" || k === "ArrowLeft" ? -1 : 1;
        this.titleFocus = buttons[(focus + delta + buttons.length) % buttons.length].id;
      } else if (k === "Enter" || k === " ") {
        event.preventDefault();
        this.titleActivate(focus < 0 ? "start" : this.titleFocus!);
      }
      return;
    }
    if (this.narration && this.narration.shown < this.narration.text.length) {
      event.preventDefault();
      this.narration.shown = this.narration.text.length;
      this.narrationClock = this.narration.text.length / NARRATION_SPEED;
      return;
    }
    if (this.queue) {
      event.preventDefault();
      this.flushQueue();
      return;
    }
    if (this.dialogue) {
      const choices = this.visibleChoices();
      if (/^[1-9]$/.test(k)) {
        event.preventDefault();
        this.pickChoice(parseInt(k, 10) - 1);
      } else if (choices.length && ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(k)) {
        event.preventDefault();
        const delta = k === "ArrowUp" || k === "ArrowLeft" ? -1 : 1;
        this.hoverChoice = (this.hoverChoice + delta + choices.length) % choices.length;
      } else if (k === "Enter" || k === " ") {
        event.preventDefault();
        const node = this.currentNode();
        if (node && this.dialogue.shown < node.text.length) {
          this.dialogue.shown = node.text.length;
        } else if (choices.length) {
          this.pickChoice(this.hoverChoice < 0 ? 0 : this.hoverChoice);
        } else {
          this.advanceDialogue();
        }
      }
      return;
    }
    if (k === "Tab") {
      event.preventDefault();
      this.moveFocus(event.shiftKey ? -1 : 1);
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
      event.preventDefault();
      this.moveFocusGrid(k);
    } else if (k === "Enter" || k === " ") {
      event.preventDefault();
      this.activateFocus();
    }
  }

  private focusTargets(): KeyboardFocus[] {
    return [
      ...VERBS.map((verb): KeyboardFocus => ({ kind: "verb", id: verb.id })),
      ...this.pageInventory().map((id): KeyboardFocus => ({ kind: "item", id })),
      ...this.visibleHotspots().map((hotspot): KeyboardFocus => ({ kind: "hotspot", id: hotspot.id })),
    ];
  }

  /** Inventory pages, matching the panel's own paging so focus and drawing never disagree. */
  private pageCount(): number {
    return Math.max(1, Math.ceil(this.inventory.length / INV_PER_PAGE));
  }
  private pageInventory(): string[] {
    const page = Math.min(this.inventoryPage, this.pageCount() - 1);
    return this.inventory.slice(page * INV_PER_PAGE, page * INV_PER_PAGE + INV_PER_PAGE);
  }
  private turnPage(delta: number): void {
    const pages = this.pageCount();
    if (pages < 2) return;
    this.inventoryPage = (Math.min(this.inventoryPage, pages - 1) + delta + pages) % pages;
    this.hoverItem = null;
    this.keyboardFocus = null;
  }

  private visibleHotspots(): Hotspot[] {
    return this.room.hotspots.filter((hotspot) =>
      !hotspot.showIf || hotspot.showIf.every((cond) => this.check(cond))
    );
  }

  private moveFocus(delta: number): void {
    const targets = this.focusTargets();
    if (!targets.length) return;
    const current = targets.findIndex((target) =>
      target.kind === this.keyboardFocus?.kind && target.id === this.keyboardFocus.id
    );
    const next = current < 0
      ? (delta < 0 ? targets.length - 1 : 0)
      : (current + delta + targets.length) % targets.length;
    this.keyboardFocus = targets[next];
    this.syncKeyboardCamera();
  }

  private moveFocusGrid(key: string): void {
    if (!this.keyboardFocus || !this.focusTargets().some((target) =>
      target.kind === this.keyboardFocus?.kind && target.id === this.keyboardFocus.id
    )) {
      this.moveFocus(1);
      return;
    }
    const focus = this.keyboardFocus;
    if (focus.kind === "hotspot") {
      const targets = this.visibleHotspots();
      const current = targets.findIndex((hotspot) => hotspot.id === focus.id);
      const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      const next = targets[(current + delta + targets.length) % targets.length];
      this.keyboardFocus = { kind: "hotspot", id: next.id };
      this.syncKeyboardCamera();
      return;
    }
    const columns = focus.kind === "verb" ? 6 : 4;
    const ids = focus.kind === "verb"
      ? VERBS.map((verb) => verb.id)
      : this.pageInventory();
    const current = ids.indexOf(focus.id);
    const row = Math.floor(current / columns);
    const col = current % columns;
    const rows = Math.ceil(ids.length / columns);
    let nextRow = row;
    let nextCol = col;
    if (key === "ArrowUp") nextRow = Math.max(0, row - 1);
    if (key === "ArrowDown") nextRow = Math.min(rows - 1, row + 1);
    if (key === "ArrowLeft") nextCol = Math.max(0, col - 1);
    if (key === "ArrowRight") nextCol = Math.min(columns - 1, col + 1);
    const next = Math.min(ids.length - 1, nextRow * columns + nextCol);
    this.keyboardFocus = { kind: focus.kind, id: ids[next] } as KeyboardFocus;
    this.syncKeyboardCamera();
  }

  private syncKeyboardCamera(): void {
    this.focusCameraX = null;
    if (this.keyboardFocus?.kind !== "hotspot") return;
    const hotspot = this.visibleHotspots().find((candidate) => candidate.id === this.keyboardFocus?.id);
    if (hotspot) this.focusCameraX = (hotspot.stand ?? this.areaStand(hotspot.area)).x;
  }

  private activateFocus(): void {
    if (!this.keyboardFocus) {
      this.moveFocus(1);
      return;
    }
    const focus = this.keyboardFocus;
    if (focus.kind === "verb") {
      this.audio.click();
      this.setVerb(focus.id);
    } else if (focus.kind === "item" && this.inventory.includes(focus.id)) {
      this.audio.click();
      this.pickItem(focus.id);
    } else if (focus.kind === "hotspot") {
      this.focusCameraX = null;
      const hotspot = this.visibleHotspots().find((candidate) => candidate.id === focus.id);
      if (hotspot) this.onHotspotClick(hotspot);
    }
  }

  private onMove(x: number, y: number): void {
    this.keyboardFocus = null;
    this.focusCameraX = null;
    this.hoverVerb = null;
    this.hoverItem = null;
    this.hoverHotspot = null;
    this.hoverChoice = -1;

    if (this.title) {
      this.titleFocus = this.titleButtons().find((b) => this.hitTitle(b.y, x, y))?.id ?? null;
      return;
    }

    if (this.dialogue) {
      const m = this.dialogueModel();
      const i = dialogueHit(x, y, m);
      this.hoverChoice = i ?? -1;
      return;
    }

    const hit = hitTestPanel(x, y, this.panelModel());
    if (hit) {
      if (hit.kind === "verb") this.hoverVerb = hit.id;
      else if (hit.kind === "item") this.hoverItem = hit.id;
      return;
    }

    const hs = y < SCENE_H ? this.hotspotAt(x + this.cameraX, y) : null;
    this.hoverHotspot = hs?.id ?? null;
  }

  private onClick(x: number, y: number, button: number): void {
    if (this.paused || this.cinematic.active || this.casebook.open) return;
    if (this.roomMenu) { this.roomMenuClick(x, y); return; }
    this.audio.unlock();
    this.keyboardFocus = null;
    this.focusCameraX = null;

    if (!this.title && !this.won && y <= BAR.y + BAR.h) {
      const inBar = (b: readonly [number, number]) => x >= b[0] && x <= b[0] + b[1];
      if (inBar(BAR.pause)) { this.setPaused(true); return; }
      if (inBar(BAR.casebook)) { this.casebook.show(this.notes); return; }
      if (inBar(BAR.tip)) {
        // Like H: a tip would talk over a conversation or a line still waiting its turn.
        if (!this.dialogue && !this.queue && !this.inputLocked()) this.showTip();
        return;
      }
    }
    if (this.inputLocked()) return;

    if (this.won) {
      this.won = false;
      this.title = true;
      return;
    }

    if (this.title) {
      const hit = this.titleButtons().find((b) => this.hitTitle(b.y, x, y));
      if (hit) this.titleActivate(hit.id);
      return;
    }

    if (this.narration && this.narration.shown < this.narration.text.length) {
      this.narration.shown = this.narration.text.length;
      this.narrationClock = this.narration.text.length / NARRATION_SPEED;
      return;
    }
    if (this.queue) {
      this.flushQueue();
      return;
    }

    if (this.dialogue) {
      if (button === 2) {
        this.leaveDialogue();
        return;
      }
      const node = this.currentNode();
      // First click reveals the full line, second click advances.
      if (node && (this.dialogue.shown < node.text.length)) {
        this.dialogue.shown = node.text.length;
        return;
      }
      const i = dialogueHit(x, y, this.dialogueModel());
      if (i !== null) {
        this.pickChoice(i);
      } else if (this.visibleChoices().length === 0) {
        this.advanceDialogue();
      }
      return;
    }

    if (button === 2) {
      // Right-click on a thing does its natural verb; anywhere else, or mid-sentence, cancels.
      const quick = !this.sentence.verb && !this.sentence.a && y < SCENE_H
        ? this.hotspotAt(x + this.cameraX, y) : null;
      if (quick) {
        this.setVerb(this.suggestedVerb(quick));
        this.onHotspotClick(quick);
        return;
      }
      this.path = []; this.onArrive = null;
      this.clearSentence();
      return;
    }

    const hit = hitTestPanel(x, y, this.panelModel());
    if (hit) {
      this.onPanelHit(hit);
      return;
    }

    if (y >= SCENE_H) return;

    const hs = this.hotspotAt(x + this.cameraX, y);
    if (!hs) {
      this.walkTo(clampToFloor({ x: x + this.cameraX, y }, this.room.walk), true);
      return;
    }

    this.onHotspotClick(hs);
  }

  private onPanelHit(hit: NonNullable<ReturnType<typeof hitTestPanel>>): void {
    this.audio.click();
    if (hit.kind === "verb") {
      this.setVerb(hit.id);
      return;
    }
    if (hit.kind === "item") {
      this.pickItem(hit.id);
      return;
    }
    if (hit.kind === "page") {
      this.turnPage(hit.delta);
      return;
    }
    if (hit.kind === "sentence") {
      this.execute();
    }
  }

  // ------------------------------------------------------------ sentence

  private clearSentence(): void {
    this.sentence = { verb: null, a: null, b: null };
    this.narration = null;
  }

  private setVerb(verb: VerbId): void {
    const keepA = this.sentence.a;
    this.sentence = { verb, a: keepA, b: null };
    this.narration = null;
    if (verb === "walk" && this.sentence.a) {
      // "Walk to <thing>" acts immediately.
      const target = this.resolveStand(this.sentence.a);
      if (target) this.walkTo(target, true);
      this.sentence.a = null;
    }
  }

  private pickItem(itemId: string): void {
    this.narration = null;
    const name = ITEMS[itemId]?.name ?? itemId;
    const ref: Ref = { kind: "item", id: itemId, name };

    if (!this.sentence.verb) {
      this.sentence.verb = "use";
    }
    const def = VERBS.find((v) => v.id === this.sentence.verb);

    // Two-object verb: the second pick completes the pair.
    if (def?.twoObject && this.sentence.a) {
      this.sentence.b = ref;
      this.execute();
      return;
    }
    this.sentence.a = ref;
    this.sentence.b = null;
    if (!def?.twoObject) this.execute();
  }

  private onHotspotClick(hs: Hotspot): void {
    this.audio.click();
    const verb = this.sentence.verb ?? "walk";
    if (verb === "walk") {
      const target = hs.stand ?? this.areaStand(hs.area);
      const effects = hs.do?.walk;
      const line = hs.say.walk;
      const arrive = effects
        ? () => this.runEffects(effects)
        : line ? () => { this.faceToward(hs); this.speak(line); } : undefined;
      this.walkTo(target, true, arrive);
      return;
    }

    const name = hs.name;
    const ref: Ref = { kind: "hotspot", id: hs.id, name };
    const def = VERBS.find((v) => v.id === verb);

    if (def?.twoObject) {
      if (!this.sentence.a) {
        if (hs.do?.[verb]) {
          this.runHotspot(verb, hs);
          return;
        }
        this.sentence.a = ref;
        // "Use counter" on its own: say the hint line, and keep waiting for an item.
        if (verb === "use" && hs.say.use) this.speak(hs.say.use);
        return;
      }
      if (this.sentence.a.kind === "item" && !this.sentence.b) {
        this.sentence.b = ref;
        this.execute();
        return;
      }
      // hotspot first → treat as target, swap so the item is the actor
      this.sentence.b = this.sentence.a;
      this.sentence.a = ref;
      this.execute();
      return;
    }

    this.sentence.a = ref;
    this.sentence.b = null;
    this.execute();
  }

  /** Called by the sentence line or by two-object completion. */
  private execute(): void {
    const { verb, a, b } = this.sentence;
    if (!verb || !a) {
      this.clearSentence();
      return;
    }

    // Two-object: one side is an item, the other a target.
    if (b) {
      const item = a.kind === "item" ? a : b.kind === "item" ? b : null;
      const target = a.kind === "item" ? b : a;
      if (item && target) {
        this.runCombo(verb, item.id, target);
        return;
      }
    }

    if (a.kind === "item") {
      if (verb === "look") this.speak(this.itemLook(a.id));
      else this.reject(itemAloneLine(verb, this.itemTarget(a.id)));
      this.clearSentenceKeepingNarration();
      return;
    }

    const hs = this.room.hotspots.find((h) => h.id === a.id);
    if (!hs) {
      this.clearSentence();
      return;
    }
    this.runHotspot(verb, hs);
  }

  /**
   * The sentence as it stands, so an action that finishes after a walk can tell whether the
   * player has started building a new one on the way (and leave that one alone).
   */
  private sentenceKey(): string {
    const { verb, a, b } = this.sentence;
    return `${verb}|${a?.kind}:${a?.id}|${b?.kind}:${b?.id}`;
  }
  private clearSentenceIfUnchanged(key: string): void {
    if (this.sentenceKey() === key) this.clearSentenceKeepingNarration();
  }

  private runHotspot(verb: VerbId, hs: Hotspot): void {
    const raw = hs;
    hs = this.hotspotState(hs);
    const target = hs.stand ?? this.areaStand(hs.area);
    const key = this.sentenceKey();
    const act = (): void => {
      this.trace?.({ kind: "verb", text: `${VERBS.find((v) => v.id === verb)?.label ?? verb} ${hs.name}`, hotspot: raw });
      if (!hs.noWalk) this.faceToward(hs);
      const line = hs.say[verb];
      const effects = hs.do?.[verb];
      if (verb === "look") this.flags[`looked:${this.room.id}.${hs.id}`] = true;

      if (verb === "pickup" && hs.item) {
        this.giveItem(hs.item);
        this.speak(line ?? `I take ${this.itemPhrase(hs.item)}.`);
        this.audio.pickup();
        effects && this.runEffects(effects);
        this.clearSentenceIfUnchanged(key);
        return;
      }

      const fallback = defaultLine(verb, this.hotspotTarget(hs), verb + hs.id);
      if (line || effects) this.speak(line ?? fallback);
      else this.reject(fallback);

      if (effects) this.runEffects(effects);
      this.clearSentenceIfUnchanged(key);
    };

    if (hs.noWalk) {
      act();
      return;
    }
    this.walkTo(target, false, act);
  }

  private runCombo(verb: VerbId, itemId: string, target: Ref): void {
    const matches = (c: { item: string; with: string; if?: Cond[] }) =>
      (!c.if || c.if.every((cond) => this.check(cond))) &&
      ((c.item === itemId && c.with === target.id) ||
        (c.item === target.id && c.with === itemId));
    // Room-specific combos win; then anything portable the player can do anywhere.
    const combo = this.room.combos?.find(matches) ?? GLOBAL_COMBOS.find(matches);
    const key = this.sentenceKey();
    const act = (): void => {
      this.trace?.({ kind: "combo", text: `${VERBS.find((v) => v.id === verb)?.label ?? verb} ${ITEMS[itemId]?.name ?? itemId} ${verb === "give" ? "to" : "with"} ${target.name}`, combo });
      if (combo) {
        this.speak(combo.say);
        if (combo.consume) this.takeItem(itemId);
        if (combo.do) this.runEffects(combo.do);
      } else {
        const hs = target.kind === "hotspot" ? this.room.hotspots.find((h) => h.id === target.id) : undefined;
        const state = hs ? this.hotspotState(hs) : undefined;
        const targetT: Target = state ? this.hotspotTarget(state) : this.itemTarget(target.id);
        // A person's own "give" line is the most characterful refusal there is.
        const own = verb === "give" && state && targetT.person ? state.say.give : undefined;
        this.reject(own ?? noComboLine(verb, this.itemTarget(itemId), targetT, itemId + target.id));
      }
      this.clearSentenceIfUnchanged(key);
    };

    if (target.kind === "item") {
      act();
      return;
    }
    const hs = this.room.hotspots.find((h) => h.id === target.id);
    const stand = hs?.stand ?? (hs ? this.areaStand(hs.area) : null);
    if (hs && stand) this.walkTo(stand, false, () => { if (!hs.noWalk) this.faceToward(hs); act(); });
    else act();
  }

  /** People are hotspots with a speaking figure or a conversation. */
  private hotspotTarget(hs: Hotspot): Target {
    const person = hs.person ?? (Boolean(hs.do?.talk) ||
      (this.room.sprites ?? []).some((s) => s.hotspot === hs.id && s.speaker));
    return targetOf(hs, person);
  }
  private itemTarget(id: string): Target {
    const name = ITEMS[id]?.name ?? id;
    // "Pell's log" stands on its own; everything else is "the" thing.
    return { name, person: false, article: /^[A-Z]/.test(name) ? "none" : "the" };
  }
  private itemPhrase(id: string): string {
    return phrase(this.itemTarget(id));
  }
  private itemLook(id: string): string {
    const item = ITEMS[id];
    if (!item) return "";
    const state = item.states?.find((s) => s.if.every((c) => this.check(c)));
    return state?.look ?? item.look;
  }

  private areaStand(area: Area): Pt {
    if ("rect" in area) {
      const r = area.rect;
      return { x: r.x + r.w / 2, y: r.y + r.h };
    }
    const poly = area as Poly;
    let sx = 0, maxY = -Infinity;
    for (const p of poly) {
      sx += p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return clampToFloor({ x: sx / poly.length, y: maxY }, this.room.walk);
  }

  private resolveStand(ref: Ref): Pt | null {
    if (ref.kind === "item") return null;
    const hs = this.room.hotspots.find((h) => h.id === ref.id);
    if (!hs) return null;
    return hs.stand ?? this.areaStand(hs.area);
  }

  // ------------------------------------------------------------ effects

  /**
   * Run effects in order. An effect that replaces what's on screen (a conversation, a new line,
   * the end of an act) first waits for the current line to be read: the rest of the list is
   * parked in `queue` and resumed from `update`, or straight away on a click. State changes
   * (flags, items, notes) in the parked part apply at once — only what the player sees and
   * hears waits — and the queue itself is saved, so nothing is lost to a save, pause or quit.
   */
  private runEffects(list: Effect[]): void {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const hold = HOLD[e.k];
      if (hold !== undefined && this.narration && !this.dialogue) {
        const due = this.narration.text.length / NARRATION_SPEED + hold;
        if (this.narrationClock < due) {
          const parked: Effect[] = [];
          let ended = false;
          for (const rest of list.slice(i)) {
            if (!ended && STATE.has(rest.k)) this.applyEffect(rest);
            else parked.push(rest);
            if (TERMINAL.has(rest.k)) ended = true;
          }
          this.queue = parked;
          this.queueDue = due;
          this.persist();
          return;
        }
      }
      if (this.applyEffect(e)) return;
    }
    this.persist();
  }
  private queue: Effect[] | null = null;
  private queueDue = 0;

  /** One effect. Returns true when it ended the list (a door, a conversation, an act's end). */
  private applyEffect(e: Effect): boolean {
    this.trace?.({ kind: "effect", effect: e });
    switch (e.k) {
      case "flag":
        this.flags[e.id] = e.v;
        break;
      case "add": {
        const v = this.flags[e.id];
        this.flags[e.id] = (typeof v === "number" ? v : 0) + e.n;
        break;
      }
      case "give":
        this.giveItem(e.item);
        break;
      case "take":
        this.takeItem(e.item);
        break;
      case "go":
        this.goRoom(e.room);
        return true;
      case "talk":
        this.startDialogue(e.tree, e.node);
        this.persist();
        return true;
      case "act":
        this.completeAct(e.n);
        return true;
      case "win":
        this.win();
        return true;
      case "say":
        this.speak(e.text);
        break;
      case "sound":
        this.audio[e.id]();
        break;
      case "music":
        this.audio.playMusic(e.track);
        break;
      case "note":
        if (!this.notes.some((n) => n.id === e.id)) {
          this.notes.push({ id: e.id, text: e.text, act: this.act });
        }
        break;
    }
    return false;
  }

  /** Resume parked effects now, as if the line had been read. */
  private flushQueue(): void {
    const q = this.queue;
    this.queue = null;
    if (!q) return;
    this.narrationClock = Infinity;
    this.runEffects(q);
  }

  private giveItem(id: string): void {
    if (!this.inventory.includes(id)) {
      this.inventory.push(id);
      // Flip to the page holding the new item rather than making the player hunt for it.
      this.inventoryPage = Math.floor((this.inventory.length - 1) / INV_PER_PAGE);
    }
    this.persist();
  }
  private takeItem(id: string): void {
    this.inventory = this.inventory.filter((i) => i !== id);
    this.inventoryPage = Math.min(this.inventoryPage, this.pageCount() - 1);
    this.persist();
  }

  // ------------------------------------------------------------ dialogue

  private startDialogue(treeId: string, nodeId?: string): void {
    const tree = DIALOGUES[treeId];
    if (!tree) return;
    const start = nodeId && tree.nodes[nodeId] ? nodeId : tree.start;
    this.narration = null;
    this.keyboardFocus = null;
    this.enterNode(tree, start);
  }

  /**
   * Show a node. Its effects run as it is read — once, here — except one that ends the
   * conversation (go, talk, act, win), which waits until the player leaves the node.
   */
  private enterNode(tree: DialogueTree, nodeId: string): void {
    const node = tree.nodes[nodeId];
    if (!node) {
      this.dialogue = null;
      return;
    }
    this.dialogue = { tree, nodeId, shown: 0 };
    this.markSeen(tree.id, nodeId);
    this.hoverChoice = -1;
    const now = node.do?.filter((e) => !TERMINAL.has(e.k));
    if (now?.length) this.runEffects(now);
    this.announceNode();
  }

  /** Close the conversation from the node on screen, running whatever its ending holds. */
  private endDialogue(): void {
    const node = this.currentNode();
    this.dialogue = null;
    const later = node?.do?.filter((e) => TERMINAL.has(e.k));
    if (later?.length) this.runEffects(later);
    else this.persist();
  }

  /**
   * The player walks away (right-click). Lines with no choice to make still count as heard, so
   * whatever they set is set: run on through them, stopping at the first real choice.
   */
  private leaveDialogue(): void {
    const visited = new Set<string>();
    while (this.dialogue && !visited.has(this.dialogue.nodeId)) {
      visited.add(this.dialogue.nodeId);
      const node = this.currentNode();
      if (!node || this.visibleChoices().length) break;
      const tree = this.dialogue.tree;
      if (!node.next || node.next === "END" || !tree.nodes[node.next]) {
        this.endDialogue();
        return;
      }
      this.enterNode(tree, node.next);
    }
    this.dialogue = null;
    this.persist();
  }

  /** `seen:<tree>.<node>` lets later options appear only once the player has heard something. */
  private markSeen(treeId: string, nodeId: string): void {
    const node = DIALOGUES[treeId]?.nodes[nodeId];
    if (node) this.trace?.({ kind: "node", tree: treeId, node });
    this.flags[`seen:${treeId}.${nodeId}`] = true;
  }

  private currentNode(): DialogueNode | null {
    if (!this.dialogue) return null;
    return this.dialogue.tree.nodes[this.dialogue.nodeId] ?? null;
  }

  /** Read the current dialogue node, and its options, into the live region. */
  private announceNode(): void {
    const node = this.currentNode();
    if (!node) return;
    const who = characterOf(node.speaker).name;
    const options = this.visibleChoices().map((c, i) => `${i + 1}. ${c.text}`).join(". ");
    this.announce(`${who ? who + ": " : ""}${node.text}${options ? ". " + options : ""}`);
  }

  private visibleChoices(): { text: string; index: number }[] {
    const node = this.currentNode();
    if (!node?.choices) return [];
    const out: { text: string; index: number }[] = [];
    node.choices.forEach((c, i) => {
      if (c.if && !c.if.every((cond) => this.check(cond))) return;
      out.push({ text: c.text, index: i });
    });
    return out;
  }

  private pickChoice(displayIndex: number): void {
    const node = this.currentNode();
    if (!node?.choices || !this.dialogue) return;
    const current = this.dialogue;
    const tree = current.tree;
    const vis = this.visibleChoices();
    const chosen = vis[displayIndex];
    if (!chosen) return;
    const choice = node.choices[chosen.index];
    this.audio.click();
    this.trace?.({ kind: "choice", tree: tree.id, choice });

    if (choice.do) this.runEffects(choice.do);
    // An effect that took over (another conversation, the end of an act) has the last word.
    if (this.dialogue !== current) return;
    if (choice.to === "END" || !choice.to || !tree.nodes[choice.to]) {
      this.dialogue = null;
      this.persist();
      return;
    }
    this.enterNode(tree, choice.to);
  }

  /** Move on from a node with nothing to choose: to its next, or out of the conversation. */
  private advanceDialogue(): void {
    const node = this.currentNode();
    if (!node || !this.dialogue) {
      this.dialogue = null;
      return;
    }
    // Choices that are all hidden leave nothing to wait for: treat the node as an ending.
    if (this.visibleChoices().length) return;
    const tree = this.dialogue.tree;
    if (node.next && node.next !== "END" && tree.nodes[node.next]) {
      this.enterNode(tree, node.next);
      return;
    }
    this.endDialogue();
  }

  private check(cond: Cond): boolean {
    if ("atLeast" in cond) {
      const value = this.flags[cond.flag];
      return typeof value === "number" && value >= cond.atLeast;
    }
    if ("flag" in cond) {
      const value = this.flags[cond.flag];
      // Three idioms in the content:
      //   { flag }              -> set to true
      //   { flag, is: undefined } -> not yet set (an explicit undefined, not a missing key)
      //   { flag, is: false }   -> false or never set
      if (!("is" in cond)) return value === true;
      if (cond.is === undefined) return value === undefined;
      if (cond.is === false) return value === undefined || value === false;
      return value === cond.is;
    }
    if ("has" in cond) return this.inventory.includes(cond.has);
    if ("notHas" in cond) return !this.inventory.includes(cond.notHas);
    if ("room" in cond) return this.room.id === cond.room;
    if ("act" in cond) return Array.isArray(cond.act) ? cond.act.includes(this.act) : this.act === cond.act;
    if ("any" in cond) return cond.any.some((c) => this.check(c));
    if ("not" in cond) return !this.check(cond.not);
    return true;
  }

  // ------------------------------------------------------------ narration

  private speak(text: string): void {
    this.trace?.({ kind: "say", text });
    this.narration = { text, shown: this.reduced ? text.length : 0 };
    this.narrationClock = 0;
    this.announce(text);
  }

  /** Mirror the current line into an aria-live region: the canvas is opaque to a screen reader. */
  private announce(text: string): void {
    if (!this.live && typeof document !== "undefined") this.live = document.getElementById("sr");
    if (this.live) this.live.textContent = text;
  }

  private reject(text: string): void {
    this.speak(text);
    this.audio.deny();
    this.rejection = 0.38;
  }

  private clearSentenceKeepingNarration(): void {
    this.sentence = { verb: null, a: null, b: null };
  }

  // ------------------------------------------------------------ movement

  private walkTo(target: Pt, clearSentence: boolean, onArrive?: () => void): void {
    const from = { x: this.x, y: this.y };
    this.path = this.mesh.path(from, target);
    this.walkStarting = this.path.length > 0;
    this.onArrive = onArrive ?? null;
    if (clearSentence) this.clearSentence();
    if (this.path.length === 0) {
      this.onArrive?.();
      this.onArrive = null;
    }
  }
  private onArrive: (() => void) | null = null;

  /**
   * Picks the sheet for the current heading. Looks past tiny grid corners, needs a clearly
   * vertical heading to switch to the front/back cycle and a clearly horizontal one to switch
   * back, and only commits to a change that persists — so diagonals never flicker between sheets.
   */
  private chooseDirection(dt: number): void {
    let ahead = this.path[0];
    for (const p of this.path) {
      ahead = p;
      if (Math.hypot(p.x - this.x, p.y - this.y) > 40) break;
    }
    const dx = ahead.x - this.x, dy = ahead.y - this.y;
    const vertical = this.moveDirection === "up" || this.moveDirection === "down";
    const wantVertical = Math.abs(dy) > Math.abs(dx) * (vertical ? 0.8 : 1.6);
    const want = wantVertical ? (dy < 0 ? "up" : "down") : dx < 0 ? "left" : "right";
    // Keep the idle pose turned toward where we were heading, even after a mostly vertical walk.
    if (Math.abs(dx) > Math.abs(dy) * 0.35) this.facing = dx < 0 ? -1 : 1;
    if (want === this.moveDirection) {
      this.directionPending = 0;
    } else {
      this.directionPending += dt;
      if (this.walkStarting || this.directionPending > 0.15) {
        this.moveDirection = want;
        this.directionPending = 0;
      }
    }
    this.walkStarting = false;
  }

  /** Turn toward a hotspot before acting on it. */
  private faceToward(hs: Hotspot): void {
    const cx = "rect" in hs.area
      ? hs.area.rect.x + hs.area.rect.w / 2
      : hs.area.reduce((sum, p) => sum + p.x, 0) / hs.area.length;
    if (Math.abs(cx - this.x) > 24) this.facing = cx < this.x ? -1 : 1;
  }

  private update(dt: number): void {
    if (this.paused || this.cinematic.active) return;
    this.rejection = Math.max(0, this.rejection - dt);
    // fade
    if (this.fade !== this.fadeTarget) {
      const dir = Math.sign(this.fadeTarget - this.fade);
      this.fade = Math.max(0, Math.min(1, this.fade + dir * dt * 2.2));
    }

    // Room swap happens at full black, driven by the game clock.
    if (this.pendingRoom && this.fade >= 0.999) {
      const id = this.pendingRoom;
      this.pendingRoom = null;
      this.loadRoom(id);
      this.fadeTarget = 0;
    }

    // Hold the curtain while a room's art is still streaming in, but never forever: a missing
    // file must not lock the screen black.
    if (!this.title && !this.roomReady()) {
      this.roomWait += dt;
      if (this.roomWait < 8) {
        this.fade = 1;
        this.fadeTarget = 0;
      }
    } else {
      this.roomWait = 0;
    }

    if (this.title) return;

    if (this.saveWarning && !this.dialogue && !this.narration) {
      const line = this.saveWarning;
      this.saveWarning = null;
      this.speak(line);
    }

    // narration typewriter
    if (this.narration) {
      this.narrationClock += dt;
      this.narration.shown = this.reduced
        ? this.narration.text.length
        : Math.min(this.narration.text.length, Math.floor(this.narrationClock * NARRATION_SPEED) + 1);
    }

    // dialogue typewriter
    if (this.dialogue) {
      this.dialogue.shown = this.reduced ? 1e6 : this.dialogue.shown + dt * 70;
    }

    if (this.queue && (!this.narration || this.narrationClock >= this.queueDue)) {
      const q = this.queue;
      this.queue = null;
      this.runEffects(q);
    }

    // walking
    if (this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        this.x = next.x;
        this.y = next.y;
        this.path.shift();
        if (this.path.length === 0) {
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        this.chooseDirection(dt);
        // Screen pixels per body height along this heading: full size across, foreshortened in depth.
        const ux = dx / d, uy = dy / d;
        const metric = Math.hypot(ux, uy / DEPTH_SPEED);
        const step = Math.min(d, (WALK_SPEED * dt * this.personHeight(this.y)) / metric);
        this.x += ux * step;
        this.y += uy * step;
        const beat = Math.floor(this.walkPhase / (STRIDE / 2));
        this.walkPhase += (step * metric) / this.personHeight(this.y);
        if (Math.floor(this.walkPhase / (STRIDE / 2)) !== beat) this.audio.step();
      }
    } else {
      this.walkPhase = 0;
    }

    const maxCamera = Math.max(0, (this.room.width ?? LOGICAL_W) - LOGICAL_W);
    let cameraTarget = this.cameraX;
    if (this.focusCameraX !== null) {
      cameraTarget = this.focusCameraX - LOGICAL_W / 2;
    } else {
      const screenX = this.x - this.cameraX;
      if (screenX > LOGICAL_W * 0.62) cameraTarget = this.x - LOGICAL_W * 0.62;
      if (screenX < LOGICAL_W * 0.38) cameraTarget = this.x - LOGICAL_W * 0.38;
    }
    cameraTarget = Math.max(0, Math.min(maxCamera, cameraTarget));
    this.cameraX += (cameraTarget - this.cameraX) * Math.min(1, dt * 5);
    if (Math.abs(cameraTarget - this.cameraX) < 0.05) this.cameraX = cameraTarget;
  }

  // ------------------------------------------------------------ rooms

  /**
   * Enter a room. Without `pos` the player appears at the door from the previous room, or at the
   * room's entry when `atEntry` is set (or there's no such door).
   */
  private loadRoom(id: string, pos?: Pt, opts: { atEntry?: boolean } = {}): void {
    const room = ROOMS[id];
    if (!room) return;
    const from = opts.atEntry ? undefined : this.room?.id;
    this.room = room;
    this.trace?.({ kind: "room", room: id });
    this.mesh = new WalkMesh(room.walk, room.width ?? LOGICAL_W, SCENE_H);
    // Arrive at the door we came through; saved positions may predate a floor change.
    const start = clampToFloor(pos ?? (from ? room.arrive?.[from] : undefined) ?? room.entry, room.walk);
    this.x = start.x;
    this.y = start.y;
    const maxCamera = Math.max(0, (room.width ?? LOGICAL_W) - LOGICAL_W);
    this.cameraX = Math.max(0, Math.min(maxCamera, this.x - LOGICAL_W / 2));
    this.focusCameraX = null;
    this.path = [];
    this.onArrive = null;
    this.sentence = { verb: null, a: null, b: null };
    this.keyboardFocus = null;
    this.hoverHotspot = null;
    if (room.music) this.audio.playMusic(room.music);
    this.cancelGulls();
    if (room.ambience === "gulls") this.gullsTimer = setTimeout(() => { this.gullsTimer = null; this.audio.gulls(); }, 900);
    this.audio.setAmbience(room.ambience && room.ambience !== "gulls" ? room.ambience : null);
    this.persist();
    if (room.onEnter) this.runEffects(room.onEnter);
    // Story scenes belong to the voyage, not to Explore Scenes.
    const scene = this.explore ? undefined : room.scenes?.find((sc) => sc.if.every((c) => this.check(c)));
    if (scene) this.runEffects(scene.do);
  }

  private goRoom(id: string): void {
    // Whatever the player was walking to belongs to the room being left.
    this.path = [];
    this.onArrive = null;
    this.persist();
    this.audio.door();
    this.fadeTarget = 1;
    this.pendingRoom = id;
  }
  private pendingRoom: string | null = null;
  private gullsTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelGulls(): void {
    if (this.gullsTimer !== null) clearTimeout(this.gullsTimer);
    this.gullsTimer = null;
  }

  // ------------------------------------------------------------ save

  /** `at` overrides where the save puts the player (used when an act ends mid-cinematic). */
  private persist(at?: { room: string; pos?: { x: number; y: number }; actStarted?: boolean }): void {
    if (this.title || this.explore) return;
    const pos = at ? (at.pos ?? ROOMS[at.room].entry) : { x: this.x, y: this.y };
    const data: SaveData = {
      version: SAVE_VERSION,
      room: at?.room ?? this.room.id,
      x: pos.x,
      y: pos.y,
      facing: this.facing,
      flags: this.flags,
      inventory: this.inventory,
      act: this.act,
      notes: this.notes,
      actStarted: at?.actStarted ?? true,
    };
    if (this.queue?.length && !at) data.queue = this.queue;
    if (writeSave(data)) {
      this.hasSave = true;
      this.saveBroken = false;
    } else {
      // Quota or blocked storage. Say so once, in character, rather than losing the voyage quietly.
      if (!this.saveBroken) {
        this.saveBroken = true;
        this.saveWarning =
          "I try to write the day down and the page won't take ink. Something is wrong with the " +
          "ledger — my progress is not being saved.";
      }
    }
  }

  private loadGame(): void {
    this.queue = null;
    const { data: d, raw, corrupt } = readSave(KNOWN);
    if (!d) {
      if (!corrupt) return this.loadOldSave();
      // Keep the unreadable save instead of overwriting it, and tell the player.
      if (raw) backupCorrupt(raw);
      clearSave();
      this.newGame();
      this.saveWarning =
        "The last page of my notebook is ruined — the save couldn't be read. I've kept it aside " +
        "and started a fresh page.";
      return;
    }
    this.resetState();
    this.inventory = d.inventory;
    this.flags = d.flags;
    this.facing = d.facing;
    this.act = d.act;
    this.notes = d.notes;
    const pos = d.x !== undefined && d.y !== undefined ? { x: d.x, y: d.y } : ROOMS[d.room].entry;
    this.loadRoom(d.room, pos);
    if (d.actStarted === false) {
      // A save written at the act boundary has not run the act's opening yet.
      const def = ACTS[this.act];
      if (def?.caption) this.speak(def.caption);
      if (def?.onStart) this.runEffects(def.onStart);
      this.persist();
    } else if (d.queue) {
      // Lines and transitions that were still waiting when the game was saved.
      this.runEffects(d.queue);
    }
  }

  /** Content changed under older saves, so keep their progress but restart their act. */
  private loadOldSave(): void {
    const raw = takeOldSave();
    const old = raw ? migrateOldSave(raw, KNOWN) : null;
    if (old) {
      this.resetState();
      this.flags = old.flags;
      return this.startAct(old.act);
    }
    this.newGame();
  }

  private beginNewVoyage(): void {
    const intro = ACTS[FIRST_ACT]?.intro;
    const start = (): void => { this.title = false; this.newGame(); };
    if (intro) this.cinematic.play(intro, start);
    else start();
  }

  /**
   * Close an act: keep the flags the player earned, play the act's outro and the next act's
   * title card, then start the next act. With no next act, the ending card shows.
   */
  private completeAct(n: number): void {
    const next = ACTS[n + 1];
    this.resetTransient();
    if (!next) {
      // The last act built: its outro still plays, then the ending card.
      const last = ACTS[n]?.outro;
      if (last) this.cinematic.play(last, () => this.win());
      else this.win();
      return;
    }
    // Save at the next act's start, so quitting during the cinematics resumes there.
    this.act = n + 1;
    if (next.inventory) this.inventory = [...next.inventory];
    this.persist({ room: next.start.room, pos: next.start.pos, actStarted: false });

    const enter = (): void => {
      if (next.intro) this.cinematic.play(next.intro, () => this.startAct(n + 1));
      else this.startAct(n + 1);
    };
    const outro = ACTS[n]?.outro;
    if (outro) this.cinematic.play(outro, enter);
    else enter();
  }

  /** Begin act `n` in its opening room, with its own inventory, caption and start effects. */
  private startAct(n: number): void {
    const def = ACTS[n];
    if (!def) return;
    this.trace?.({ kind: "act", n });
    this.resetTransient();
    this.act = n;
    if (def.inventory) {
      this.inventory = [...def.inventory];
      this.inventoryPage = 0;
    }
    this.loadRoom(def.start.room, def.start.pos ?? ROOMS[def.start.room].entry);
    this.fade = 1;
    this.fadeTarget = 0;
    if (def.caption) this.speak(def.caption);
    if (def.onStart) this.runEffects(def.onStart);
    this.persist();
  }

  /** Drop anything in flight: conversations, parked effects, walks and fades. */
  private resetTransient(): void {
    this.cancelGulls();
    this.queue = null;
    this.dialogue = null;
    this.narration = null;
    this.path = [];
    this.onArrive = null;
    this.pendingRoom = null;
    this.fade = this.fadeTarget = 0;
  }

  /** A clean voyage: nothing carried, nothing known, and out of Explore Scenes. */
  private resetState(): void {
    this.resetTransient();
    this.explore = false;
    this.roomMenu = false;
    this.won = false;
    this.inventory = [];
    this.inventoryPage = 0;
    this.flags = {};
    this.notes = [];
  }

  private newGame(): void {
    this.resetState();
    this.startAct(FIRST_ACT);
  }

  private win(): void {
    this.resetTransient();
    this.won = true;
    this.audio.chime();
    clearSave();
    this.hasSave = false;
  }

  // ------------------------------------------------------------ hit tests

  private hotspotState(hs: Hotspot): Hotspot {
    const state = hs.states?.find((s) => s.if.every((c) => this.check(c)));
    return state
      ? { ...hs, name: state.name ?? hs.name, say: { ...hs.say, ...state.say }, do: { ...hs.do, ...state.do } }
      : hs;
  }

  private hotspotAt(x: number, y: number): Hotspot | null {
    // iterate backwards so later-defined (foreground) hotspots win
    for (let i = this.room.hotspots.length - 1; i >= 0; i--) {
      const hs = this.room.hotspots[i];
      if (hs.showIf && !hs.showIf.every((c) => this.check(c))) continue;
      if (this.inArea(x, y, hs.area)) return this.hotspotState(hs);
    }
    return null;
  }

  private inArea(x: number, y: number, area: Area): boolean {
    if ("rect" in area) {
      const r = area.rect;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }
    return pointInPoly({ x, y }, area as Poly);
  }

  // ------------------------------------------------------------ render

  private panelModel(): PanelModel {
    const inv: Chip[] = this.inventory.map((id) => ({
      id,
      name: ITEMS[id]?.name ?? id,
    }));
    return {
      verb: this.sentence.verb,
      objA: this.sentence.a?.name ?? null,
      objB: this.sentence.b?.name ?? null,
      narrationFull: this.narration?.text ?? null,
      narration: this.narration ? typewriterSlice(this.narration.text, this.narration.shown) : null,
      inventory: inv,
      page: this.inventoryPage,
      hoverVerb: this.hoverVerb,
      hoverItem: this.hoverItem,
      focusVerb: this.keyboardFocus?.kind === "verb" ? this.keyboardFocus.id : null,
      focusItem: this.keyboardFocus?.kind === "item" ? this.keyboardFocus.id : null,
      selectedItem: this.sentence.a?.kind === "item" ? this.sentence.a.id : null,
      ...this.suggestion(),
    };
  }

  /** What the hovered (or keyboard-focused) hotspot suggests, when no sentence is started. */
  private suggestion(): { suggestVerb: VerbId | null; suggestLine: string | null } {
    const id = this.hoverHotspot ?? (this.keyboardFocus?.kind === "hotspot" ? this.keyboardFocus.id : null);
    const raw = id && !this.sentence.verb && !this.sentence.a
      ? this.visibleHotspots().find((h) => h.id === id) : undefined;
    if (!raw) return { suggestVerb: null, suggestLine: null };
    const hs = this.hotspotState(raw);
    const verb = this.suggestedVerb(hs);
    const label = VERBS.find((v) => v.id === verb)?.label ?? "";
    return { suggestVerb: verb, suggestLine: `${label} ${hs.name}` };
  }

  private dialogueModel(): DialogueModel {
    const node = this.currentNode();
    const character = characterOf(node?.speaker ?? "");
    const portraitKey = character.portrait ?? null;
    const portrait = portraitKey ? this.assets.img(portraitKey) ?? null : null;
    return {
      speaker: character.name,
      speakerAccent: character.accent ?? null,
      text: node ? node.text : "",
      reveal: this.dialogue?.shown ?? 0,
      portraitKey,
      portrait,
      choices: this.visibleChoices().map((c, i) => ({ text: c.text, index: i })),
      hoverIndex: this.hoverChoice,
      layout: dialogueLayout(this.view.ctx, node?.text ?? "", this.visibleChoices().map(c => c.text)),
    };
  }

  private render(): void {
    const ctx = this.view.ctx;
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (this.title) {
      this.renderTitle(ctx);
      this.renderFade(ctx);
      drawCursor(ctx, this.input.x, this.input.y, null);
      return;
    }

    this.renderScene(ctx);
    if (this.dialogue) {
      drawDialogue(ctx, this.dialogueModel());
    } else {
      drawPanel(ctx, this.panelModel());
    }
    if (this.won) this.renderWin(ctx);
    if (this.explore) this.renderExplore(ctx);

    // hover name near cursor
    let label: string | null = null;
    if (!this.dialogue && !this.won) {
      if (this.hoverHotspot) {
        const hs = this.room.hotspots.find((h) => h.id === this.hoverHotspot);
        label = hs ? this.hotspotState(hs).name : null;
      } else if (this.hoverItem) {
        label = ITEMS[this.hoverItem]?.name ?? null;
      }
    }
    drawCursor(ctx, this.input.x, this.input.y, label, this.rejection > 0);
    this.renderFade(ctx);
  }

  /**
   * A room's grade belongs to the figures, not the background: the plate is already painted at
   * the right time of day, and filtering it again just muddies it. Sprites keep their own grade
   * and inherit the room's on top.
   */
  private figureGrade(extra?: string): string {
    const parts = [this.room.grade, extra].filter((g): g is string => !!g && g !== "none");
    return parts.length ? parts.join(" ") : "none";
  }

  /** Whether the current room's background and sprites have all arrived. */
  private roomReady(): boolean {
    const room = this.room;
    if (!room) return true;
    if (!this.assets.img(room.bg)) return false;
    for (const s of room.sprites ?? []) if (!this.assets.img(s.key)) return false;
    return true;
  }

  private renderScene(ctx: CanvasRenderingContext2D): void {
    const bg = this.assets.img(this.room.bg);
    const worldWidth = this.room.width ?? LOGICAL_W;
    ctx.save();
    ctx.translate(-this.cameraX, 0);
    if (bg) ctx.drawImage(bg, 0, 0, worldWidth, SCENE_H);

    // Depth-sorted drawables: static props/NPCs and the player share one list.
    const drawables: { y: number; draw: () => void }[] = [];

    for (const s of this.room.sprites ?? []) {
      const hs = this.room.hotspots.find((h) => h.id === s.hotspot);
      if (hs?.showIf && !hs.showIf.every((c) => this.check(c))) continue;
      if (s.showIf && !s.showIf.every((c) => this.check(c))) continue;
      const talking = this.currentNode()?.speaker === s.speaker;
      const breath = s.idle && !this.reduced
        ? Math.sin(this.time * (talking ? 5 : 1.8) + s.x) * (talking ? 0.006 : 0.0025)
        : 0;
      drawables.push({ y: s.y, draw: () => this.drawSprite(ctx, s.key, s.x, s.y, s.size * (1 + breath), s.visible ?? 1, Boolean(s.speaker), s.flip, this.figureGrade(s.grade)) });
    }
    drawables.push({ y: this.y, draw: () => this.drawPlayer(ctx) });
    // Occluders sort by where they meet the floor: they cover what stands behind them only.
    if (bg) for (const o of this.room.occluders ?? []) {
      drawables.push({ y: o.y, draw: () => {
        ctx.save(); ctx.beginPath();
        o.area.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath(); ctx.clip(); ctx.drawImage(bg, 0, 0, worldWidth, SCENE_H); ctx.restore();
      } });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    if (this.room.stars) this.drawStars(ctx, worldWidth, this.room.stars.y);
    if (this.debugOverlay) {
      drawDebugOverlay({ ctx, room: this.room, devHandle: this.devHandle, personHeight: (y) => this.personHeight(y) });
    }
    ctx.restore();

    const g = ctx.createRadialGradient(
      LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.35,
      LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.95
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, SCENE_H);

    ctx.save();
    ctx.translate(-this.cameraX, 0);
    this.drawHoverGlow(ctx);
    this.drawKeyboardFocus(ctx);
    ctx.restore();
    ctx.fillStyle = "rgba(5,13,22,0.8)";
    ctx.fillRect(24, 18, 400, 44);
    drawText(ctx, this.room.name, 40, 29, { size: 22, color: "#e8c98a", shadow: false });
    const bar = (b: readonly [number, number], label: string, centred: boolean) => {
      ctx.fillStyle = "rgba(5,13,22,0.8)";
      ctx.fillRect(b[0], BAR.y, b[1], BAR.h);
      drawText(ctx, label, centred ? b[0] + b[1] / 2 : b[0] + 20, BAR.y + 11, {
        size: 20, color: "#e8c98a", align: centred ? "center" : "left", shadow: false,
      });
    };
    bar(BAR.pause, "Pause / Esc", false);
    bar(BAR.casebook, "Casebook (J)", true);
    bar(BAR.tip, "Tip  (H)", true);
    if (this.tipMode && !this.dialogue && !this.won) {
      const tip = this.currentTip();
      ctx.save();
      ctx.font = "italic 21px Georgia, serif";
      const w = ctx.measureText("Tip: " + tip).width + 40;
      ctx.restore();
      // Short tips sit in the top bar beside the buttons; long ones get their own row.
      const x = 1515 - w;
      if (w <= 1040) {
        ctx.fillStyle = "rgba(5,13,22,0.82)";
        ctx.fillRect(x, 18, w, 44);
        drawText(ctx, "Tip: " + tip, x + 20, 30, { size: 19, color: "#cfe3ee", maxWidth: w - 40, shadow: false });
      } else {
        ctx.fillStyle = "rgba(5,13,22,0.82)";
        ctx.fillRect(440, 70, 1456, 44);
        drawText(ctx, "Tip: " + tip, 460, 82, { size: 19, color: "#cfe3ee", maxWidth: 1416, shadow: false });
      }
    }
  }

  /** A fixed scatter of stars above `maxY`, twinkling slowly; the same sky every visit. */
  private drawStars(ctx: CanvasRenderingContext2D, width: number, maxY: number): void {
    let seed = 7;
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const moon = ctx.createRadialGradient(width * 0.5, maxY * 0.3, 0, width * 0.5, maxY * 0.3, maxY * 1.1);
    moon.addColorStop(0, "rgba(170,190,240,0.22)");
    moon.addColorStop(1, "rgba(170,190,240,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, width, maxY * 1.5);
    for (let i = 0; i < Math.round(width / 9); i++) {
      const x = rand() * width, y = rand() * maxY, r = 0.6 + rand() * 1.6, phase = rand() * 6.3;
      const a = (0.5 + 0.5 * rand()) * (1 - 0.7 * y / maxY) * (0.75 + 0.25 * Math.sin(this.time * 1.3 + phase));
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Soft outline around whatever the pointer is over — the discoverability layer. */
  private drawHoverGlow(ctx: CanvasRenderingContext2D): void {
    if (!this.hoverHotspot || this.dialogue || this.won) return;
    const hs = this.room.hotspots.find((h) => h.id === this.hoverHotspot);
    if (!hs) return;

    const pulse = this.reduced ? 0.7 : 0.55 + 0.25 * Math.sin(this.time * 5);
    ctx.save();
    ctx.beginPath();
    if ("rect" in hs.area) {
      const r = hs.area.rect;
      ctx.rect(r.x, r.y, r.w, r.h);
    } else {
      const poly = hs.area;
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    }
    ctx.fillStyle = `rgba(232,201,138,${0.07 * pulse})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(232,201,138,${0.55 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = this.reduced ? 0 : -this.time * 26;
    ctx.stroke();
    ctx.restore();
  }

  private drawKeyboardFocus(ctx: CanvasRenderingContext2D): void {
    if (this.keyboardFocus?.kind !== "hotspot" || this.dialogue || this.won) return;
    const hs = this.visibleHotspots().find((hotspot) => hotspot.id === this.keyboardFocus?.id);
    if (!hs) return;

    let centerX = 0;
    let top = 0;
    ctx.save();
    ctx.beginPath();
    if ("rect" in hs.area) {
      const r = hs.area.rect;
      ctx.rect(r.x, r.y, r.w, r.h);
      centerX = r.x + r.w / 2;
      top = r.y;
    } else {
      hs.area.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      centerX = hs.area.reduce((sum, p) => sum + p.x, 0) / hs.area.length;
      top = Math.min(...hs.area.map((p) => p.y));
    }
    ctx.fillStyle = "rgba(255,243,207,0.06)";
    ctx.fill();
    ctx.strokeStyle = "#fff3cf";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const name = this.hotspotState(hs).name;
    ctx.save();
    ctx.font = "italic 20px Georgia, serif";
    const width = ctx.measureText(name).width;
    const x = Math.max(
      this.cameraX + 16 + width / 2,
      Math.min(centerX, this.cameraX + LOGICAL_W - width / 2 - 16)
    );
    const y = Math.max(74, top - 42);
    ctx.fillStyle = "rgba(4,6,12,0.88)";
    ctx.fillRect(x - width / 2 - 10, y - 5, width + 20, 34);
    ctx.restore();
    drawText(ctx, name, x, y, { size: 20, color: "#fff3cf", align: "center", shadow: false });
  }

  /** Height in pixels of a standing adult whose feet are at `y` (measured curve, else perspective). */
  private personHeight(y: number): number {
    return personHeightAt(this.room, y);
  }

  /**
   * Draws one cell of an image standing on (x, y). The cell's own opaque rows are scaled to the
   * figure's full `height` with the feet on the floor, and the torso (or, for props, the middle)
   * sits on x — so frames of uneven generated sheets neither bob nor sway. `visible` is how much
   * of a whole figure the art contains, from the top.
   */
  private drawSprite(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    size: number,
    visible: number,
    figure: boolean,
    flip = false,
    grade = "none"
  ): void {
    drawSprite(ctx, this.assets, key, x, y, size * this.personHeight(y), { visible, figure, flip, grade });
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const sheet = "char_walk_v2";
    const height = this.personHeight(this.y);
    const walking = this.path.length > 0;
    const vertical = this.moveDirection === "up" || this.moveDirection === "down";
    const cycle = this.walkPhase / STRIDE;
    const grade = this.figureGrade("saturate(0.85) brightness(0.9)");

    drawShadow(ctx, this.x, this.y, height * 0.26, 0.38);

    // Every sheet faces right; facing left mirrors about the torso.
    if (walking && vertical && this.assets.img("char_walk_vertical")) {
      const frame = (this.moveDirection === "up" ? 0 : 3) + (Math.floor(cycle * 3) % 3);
      drawFigure(ctx, this.assets, "char_walk_vertical", this.x, this.y, height, { frames: 6, frame, grade });
    } else if (walking && this.assets.img(sheet)) {
      const frame = Math.floor(cycle * 6) % 6;
      drawFigure(ctx, this.assets, sheet, this.x, this.y, height, { frames: 6, frame, grade, flip: this.facing < 0 });
    } else if (this.assets.img("char_elias")) {
      // A slow breath rather than a bob keeps the feet planted.
      const breath = 1 + Math.sin(this.time * 2.2) * 0.004;
      drawFigure(ctx, this.assets, "char_elias", this.x, this.y, height * breath, { grade, flip: this.facing < 0 });
    }
  }

  /** `?debug`: walk areas, occluders with their floor lines, hotspots, and a feet-height gauge. */
  private debugOverlay = import.meta.env.DEV && new URLSearchParams(location.search).has("debug");

  // ------------------------------------------------------------ dev tools
  //
  // The dev editor (src/editor, loaded only by `npm run dev`) observes the game through `trace`
  // and drives it through the dev* methods below. Nothing here runs in normal play.

  /** Called with each thing the game does: sentences, lines, effects, rooms, dialogue. */
  trace: ((event: TraceEvent) => void) | null = null;
  /** Overlay handle the editor is dragging, drawn highlighted. */
  devHandle: Pt | null = null;

  devState() {
    return {
      title: this.title, explore: this.explore, act: this.act, room: this.room?.id ?? null,
      x: Math.round(this.x), y: Math.round(this.y), inventory: [...this.inventory], flags: { ...this.flags },
      dialogue: this.dialogue ? { tree: this.dialogue.tree.id, node: this.dialogue.nodeId } : null,
      queue: this.queue ? [...this.queue] : null, cameraX: this.cameraX,
    };
  }
  devSetFlag(id: string, value: unknown): void {
    if (value === undefined) delete this.flags[id]; else this.flags[id] = value;
    this.persist();
  }
  devGive(id: string): void { this.giveItem(id); }
  devTake(id: string): void { this.takeItem(id); }
  devGoRoom(id: string): void {
    if (!ROOMS[id]) return;
    this.title = false;
    this.won = false;
    this.resetTransient();
    this.loadRoom(id, undefined, { atEntry: true });
  }
  devAct(n: number): void {
    this.title = false;
    this.won = false;
    this.startAct(n);
  }
  /** After new content is swapped in: pick up the new room and conversation, keeping all state. */
  devReload(): void {
    if (!this.room) return;
    const room = ROOMS[this.room.id];
    if (!room) return;
    this.room = room;
    this.mesh = new WalkMesh(room.walk, room.width ?? LOGICAL_W, SCENE_H);
    const at = clampToFloor({ x: this.x, y: this.y }, room.walk);
    this.x = at.x;
    this.y = at.y;
    this.path = [];
    this.onArrive = null;
    if (this.dialogue) {
      const tree = DIALOGUES[this.dialogue.tree.id];
      this.dialogue = tree?.nodes[this.dialogue.nodeId] ? { ...this.dialogue, tree } : null;
    }
  }
  devOverlay(on?: boolean): boolean {
    if (on !== undefined) this.debugOverlay = on;
    return this.debugOverlay;
  }
  /** Scene coordinates (world x, scene y) under a client-space point, or null off the scene. */
  devWorld(clientX: number, clientY: number): Pt | null {
    const p = this.view.toLogical(clientX, clientY);
    if (p.x < 0 || p.x > LOGICAL_W || p.y < 0 || p.y > LOGICAL_H) return null;
    return { x: p.x + this.cameraX, y: p.y };
  }
  /** Client-space distance per scene pixel. */
  devScale(): number { return this.view.scale; }
  /** What an Alt+click at a client-space point is aimed at. */
  devPick(clientX: number, clientY: number): DevPick | null {
    if (this.title) return null;
    const p = this.view.toLogical(clientX, clientY);
    if (this.dialogue) {
      const node = this.currentNode();
      if (!node) return null;
      const shown = dialogueHit(p.x, p.y, this.dialogueModel());
      const index = shown === null || shown === undefined ? -1 : this.visibleChoices()[shown]?.index ?? -1;
      const choice = node.choices?.[index];
      return choice ? { kind: "choice", tree: this.dialogue.tree.id, node, choice } : { kind: "node", tree: this.dialogue.tree.id, node };
    }
    if (p.y >= SCENE_H) return null;
    for (let i = this.room.hotspots.length - 1; i >= 0; i--) {
      const hs = this.room.hotspots[i];
      if (hs.showIf && !hs.showIf.every((c) => this.check(c))) continue;
      if (this.inArea(p.x + this.cameraX, p.y, hs.area)) return { kind: "hotspot", room: this.room.id, hotspot: hs };
    }
    return null;
  }

  // ------------------------------------------------------------ explore mode
  //
  // `?explore`: walk every scene without solving anything. Skips the intro, never touches the
  // save, and R opens a menu of every room, grouped by act. D toggles the calibration overlay.

  private explore = false;
  private roomMenu = false;
  private roomMenuFocus = 0;

  /**
   * Rooms in menu order: each act's rooms, found by following the doors that act can see from
   * its start room. A room is listed under the first act that reaches it.
   */
  private exploreRooms(): { id: string; act: number }[] {
    const out: { id: string; act: number }[] = [];
    const listed = new Set<string>();
    // A door hidden from this act by an `act` condition doesn't count.
    const inAct = (n: number, conds?: Cond[]) => !conds?.some((c) => "act" in c &&
      !(Array.isArray(c.act) ? c.act.includes(n) : c.act === n));
    for (const act of Object.values(ACTS)) {
      const queue = [act.start.room];
      const seen = new Set<string>();
      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id) || !ROOMS[id]) continue;
        seen.add(id);
        if (!listed.has(id)) { listed.add(id); out.push({ id, act: act.n }); }
        for (const h of ROOMS[id].hotspots) {
          if (!inAct(act.n, h.showIf)) continue;
          for (const st of [h, ...(h.states ?? [])]) {
            if ("if" in st && !inAct(act.n, st.if)) continue;
            for (const list of Object.values(st.do ?? {})) {
              for (const e of list ?? []) if (e.k === "go" && !seen.has(e.room)) queue.push(e.room);
            }
          }
        }
      }
    }
    for (const id of Object.keys(ROOMS)) if (!listed.has(id)) out.push({ id, act: 0 });
    return out;
  }

  private startExplore(): void {
    this.resetState();
    this.explore = true;
    this.title = false;
    this.act = FIRST_ACT;
    this.loadRoom(ACTS[FIRST_ACT].start.room);
    this.roomMenu = true;
  }

  private exploreGo(index: number): void {
    const target = this.exploreRooms()[index];
    if (!target) return;
    this.resetTransient();
    this.act = target.act || this.act;
    this.loadRoom(target.id, undefined, { atEntry: true });
    this.roomMenu = false;
  }

  /** Returns true when explore mode consumed the key. */
  private exploreKey(k: string, event: KeyboardEvent): boolean {
    if (this.title) return false;
    if (k === "r" || k === "R") { this.roomMenu = !this.roomMenu; return true; }
    if (k === "d" || k === "D") { this.debugOverlay = !this.debugOverlay; return true; }
    if (!this.roomMenu) return false;
    const count = this.exploreRooms().length;
    event.preventDefault();
    if (k === "Escape") this.roomMenu = false;
    else if (k === "ArrowDown" || k === "ArrowRight" || k === "Tab") this.roomMenuFocus = (this.roomMenuFocus + 1) % count;
    else if (k === "ArrowUp" || k === "ArrowLeft") this.roomMenuFocus = (this.roomMenuFocus - 1 + count) % count;
    else if (k === "Enter" || k === " ") this.exploreGo(this.roomMenuFocus);
    return true;
  }

  private roomMenuRect(i: number): { x: number; y: number; w: number; h: number } {
    const col = i % 3, row = Math.floor(i / 3);
    return { x: 300 + col * 450, y: 190 + row * 70, w: 430, h: 58 };
  }

  private roomMenuClick(x: number, y: number): void {
    const rooms = this.exploreRooms();
    for (let i = 0; i < rooms.length; i++) {
      const r = this.roomMenuRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.exploreGo(i); return; }
    }
    this.roomMenu = false;
  }

  private renderExplore(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(5,13,22,0.8)";
    ctx.fillRect(440, 18, 760, 44);
    drawText(ctx, "EXPLORE  ·  R rooms  ·  D overlay  ·  nothing is saved", 820, 29, {
      size: 20, color: "#9fd3ff", align: "center", shadow: false,
    });
    if (!this.roomMenu) return;
    ctx.fillStyle = "rgba(3,5,12,0.9)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawText(ctx, "Go to a scene", LOGICAL_W / 2, 110, { size: 34, color: COLORS.gold, align: "center", weight: "bold" });
    this.exploreRooms().forEach((r, i) => {
      const box = this.roomMenuRect(i);
      const hover = this.input.x >= box.x && this.input.x <= box.x + box.w &&
        this.input.y >= box.y && this.input.y <= box.y + box.h;
      const focus = hover || i === this.roomMenuFocus;
      ctx.fillStyle = focus ? "rgba(232,201,138,0.18)" : "rgba(10,16,28,0.8)";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = focus ? "rgba(232,201,138,0.9)" : "rgba(201,162,74,0.35)";
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
      const label = `${r.act ? "Act " + r.act + " · " : ""}${ROOMS[r.id].name}`;
      drawText(ctx, label, box.x + 18, box.y + 16, { size: 21, color: focus ? "#fff6e0" : "#d9c9a4", shadow: false });
    });
    drawText(ctx, "click a scene, or arrows + Enter  ·  R or Escape to close", LOGICAL_W / 2, 960, {
      size: 20, color: "rgba(201,162,74,0.8)", align: "center",
    });
  }
  // ------------------------------------------------------------ title

  private titleFocus: TitleId | null = null;

  private titleButtons() {
    return titleButtons(this.hasSave);
  }
  private hitTitle(top: number, x: number, y: number): boolean {
    return hitTitleButton(top, x, y);
  }
  private renderTitle(ctx: CanvasRenderingContext2D): void {
    drawTitle(ctx, {
      bg: this.assets.img("bg_dock_wide"),
      buttons: this.titleButtons(),
      focus: this.titleFocus,
      dev: import.meta.env.DEV,
    });
  }
  private titleActivate(id: "start" | "continue" | "explore"): void {
    this.titleFocus = null;
    if (id === "start") { this.explore = false; this.beginNewVoyage(); }
    else if (id === "continue" && this.hasSave) { this.explore = false; this.title = false; this.loadGame(); }
    else if (id === "explore") this.startExplore();
  }

  private renderWin(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(3,5,12,0.92)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const holds = (list?: Cond[]) => !list || list.every((c) => this.check(c));
    const title = ENDING.titles?.find((t) => holds(t.if))?.text ?? ENDING.title;
    const lines = ENDING.lines.filter((l) => holds(l.if)).map((l) => l.text);
    // Shrink the type until every line fits between the title and the footer.
    const top = 250, bottom = 960, maxWidth = 1300;
    let size = 28;
    const height = (sz: number): number => lines.reduce((h, text) =>
      h + wrap(ctx, text, maxWidth, { size: sz, color: "" }).length * Math.round(sz * 1.4) + Math.round(sz * 0.6), 0);
    while (size > 18 && height(size) > bottom - top) size--;
    let y = top + Math.max(0, (bottom - top - height(size)) / 3);
    drawText(ctx, title, LOGICAL_W / 2, y - 120, { size: 40, color: COLORS.gold, align: "center", weight: "bold" });
    ctx.fillStyle = "rgba(201,162,74,0.6)";
    ctx.fillRect(LOGICAL_W / 2 - 70, y - 50, 140, 2);
    lines.forEach((text, i) => {
      // The last line is the book's own: set apart, in gold.
      const last = i === lines.length - 1 && lines.length > 1;
      y += drawWrapped(ctx, text, LOGICAL_W / 2, y + (last ? size * 0.4 : 0), {
        size, color: last ? COLORS.gold : "#e6ddc8", maxWidth, align: "center",
        lineHeight: Math.round(size * 1.4), weight: last ? "bold" : "normal",
      }) + Math.round(size * 0.6);
    });
    drawText(ctx, "click to return to the title", LOGICAL_W / 2, Math.max(1000, y + 30), {
      size: 20, color: "rgba(201,162,74,0.8)", align: "center",
    });
  }

  private renderFade(ctx: CanvasRenderingContext2D): void {
    if (this.fade > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
  }
}
