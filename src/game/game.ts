/**
 * Game — state machine, interaction model, dialogue runtime and rendering.
 *
 * Two pieces of the screen's mechanics are standalone modules with explicit inputs: the 60 fps
 * frame loop, its clock and failure recovery (frame.ts), and the scene curtain, its threshold
 * card and the arriving-room wash (fade.ts). `Game` delegates to them; their public shapes are
 * the only coupling.
 */

import { LOGICAL_W, LOGICAL_H, SCENE_H, type View } from "../engine/view";
import type { Input } from "../engine/input";
import type { Assets } from "../engine/assets";
import type { AudioEngine } from "../engine/audio";
import { drawText, typewriterSlice, wrap } from "../engine/text";
import { WalkMesh, pointInPoly, clampToFloor, type Poly, type Pt } from "../engine/walkbox";
import {
  drawPanel, hitTestPanel, drawCursor, drawDialogue, dialogueHit, dialogueLayout, DialogueStage, inventorySlotRect,
  INV_PER_PAGE, inventoryPages, COLORS, PAGE_FOCUS, isPageFocus, fitText,
  type PanelModel, type DialogueModel, type Chip, type Spot,
} from "./ui";
import { Settings } from "./settings";
import { History } from "./history";
import { Atlas, ATLAS, areaOfRoom, atlasImageUrl, escapeHtml } from "./atlas";
import {
  loadPrefs, savePrefs, hasCompleted, markCompleted, reducedMotion, onOsReducedMotion,
  effectiveTextSpeed, effectiveTextScale, autoTextScale,
  NARRATION_CPS, DIALOGUE_CPS, type Prefs,
} from "./prefs";
import { CinematicPlayer } from "./cinematic";
import { VERBS } from "./verbs";
import { characterOf } from "../content/characters";
import type {
  Room, Hotspot, VerbId, Effect, Cond, DialogueTree, DialogueNode, Area, Combo, DialogueChoice, SceneSprite, DoorSound, Rect,
} from "./types";
import { ROOMS, START_ROOM, START_POS } from "../content/rooms";
import { roomImageKeys } from "../content/room-assets";
import { ACTS, ENDING, FIRST_ACT, LAST_ACT } from "../content/acts";
import { defaultLine, noComboLine, itemAloneLine, targetOf, phrase, type Target } from "./lines";
import { personHeightAt } from "./scale";
import { Casebook, type CaseNote } from "./casebook";
// next-level: casebook
import { DeedsPage, deedTally, fileDeeds } from "./deeds";
// next-level: recap — the Continue card
import { Recap } from "./recap";
import {
  readSave, writeSave, clearSave, backupCorrupt, takeOldSave, hasAnySave,
  archiveSave, stashCurrentSave, hasStashedSave, restoreStashedSave,
  ENDING_FLAGS, ENDING_RESET_FLAGS, FINAL_CHOICE_FLAGS, withoutEndingFlags,
  SAVE_VERSION, type SaveData, type SaveKnown,
} from "./save";
import { SaveTabGuard } from "./tabguard";
import { drawDebugOverlay } from "./debug";
import { drawTitle, titleButtons, hitTitleButton, defaultTitleButton, type TitleId } from "./title";
import { drawFigure, drawSprite, drawShadow } from "./figures";
import { Transition } from "./transition";
import { Connector } from "./connector";
import { FrameLoop } from "./frame";
import { drawFade, type ExitCardSource } from "./fade";
import {
  entrySideFor, linkOf, passageOf,
  type ExitLink, type ExitSide, type PassageKind,
} from "./connect";
import { Fx } from "./fx";
import { EndingScreen, type EndingCard } from "./ending";
import { Ambient, type AmbientView } from "./ambient";
import { PAINT_PASS, Paint, figureWrap, type FigureWrap } from "./paint";
import { ITEMS } from "../content/items";
import { DIALOGUES } from "../content/dialogue";
import { GLOBAL_COMBOS } from "../content/combos";
import { TIPS } from "../content/hints";
import { MANIFEST } from "../content/assets";
import { TipLadder } from "./tips";
import { drawGlyph, roundRectPath, type BarGlyph } from "./cues";
import {
  MobileUI, type MobileBridge, type MobileButton, type MobileState,
} from "./mobile";
import { FirstWatch, readLessons, writeLessons, LESSONS, LESSON_KEY, type LessonId } from "./onboarding";
import { SHORTCUTS } from "./controls";
import { restoreFocus } from "./focus";
import { roomToneFor } from "./soundscape";
import { cuePlays } from "../engine/roomtone";

/**
 * The top bar is icon-only and quiet: small square plates, right-aligned, with no words on the
 * glass. The labels below are for the screen-reader toolbar and the canvas's hover title only.
 */
const BAR = { y: 14, h: 52, size: 52, gap: 8, right: 1896 } as const;
type BarId = "reveal" | "log" | "tip" | "casebook" | "map" | "pause";
const BAR_IDS: BarId[] = ["reveal", "log", "tip", "casebook", "map", "pause"];
const BAR_LABELS: Record<BarId, string> = {
  reveal: "Reveal interactive things", log: "Line history", tip: "Tip", casebook: "Chart", map: "Map", pause: "Pause",
};
const BAR_KEYS: Record<BarId, string> = {
  reveal: SHORTCUTS.reveal, log: SHORTCUTS.history, tip: SHORTCUTS.tip,
  casebook: SHORTCUTS.chart, map: SHORTCUTS.map, pause: SHORTCUTS.pause,
};
/** The one or two words a plate may show under the pointer or a finger. */
const BAR_SHORT: Record<BarId, string> = {
  reveal: "Reveal", log: "History", tip: "Tip", casebook: "Chart", map: "Map", pause: "Pause",
};
const BAR_GLYPHS: Record<BarId, BarGlyph> = {
  reveal: "eye", log: "scroll", tip: "candle", casebook: "chart", map: "compass", pause: "pause",
};
/**
 * Icon geometry. The glyphs do not grow with the text scale — they are pictures, not type — so
 * drawing and hit-testing read this one fixed layout.
 */
function barLayout(): Record<BarId, { x: number; y: number; w: number; h: number }> {
  const out = {} as Record<BarId, { x: number; y: number; w: number; h: number }>;
  let right = BAR.right;
  for (let i = BAR_IDS.length - 1; i >= 0; i--) {
    const id = BAR_IDS[i];
    out[id] = { x: right - BAR.size, y: BAR.y, w: BAR.size, h: BAR.h };
    right -= BAR.size + BAR.gap;
  }
  return out;
}
/** Below the top bar: where a plate's name, the tip-mode line and other banners sit. */
const BANNER_Y = 100;
/**
 * The icon bar's floor. It still fades when nobody has touched it, but a resting plate must stay
 * readable over the darkest and the brightest paintings, so it never goes below this.
 */
const BAR_IDLE_ALPHA = 0.62;

const TIPS_KEY = "brasscompass.tips.v1";

/**
 * Keys that mean something to the game. Anything else (a modifier on its own, F-keys, media
 * keys, an IME's "Process") must not skip a line or flush what is waiting on it.
 */
// next-level: a11y — PageUp/PageDown are the satchel's pages.
function actionKey(k: string): boolean {
  return k.length === 1 || k === "Enter" || k === "Escape" || k === "Tab" ||
    k === "PageUp" || k === "PageDown" || k.startsWith("Arrow");
}
/** A confirmation armed this recently is a double-click or a bounce, not a decision. */
const CONFIRM_GRACE_MS = 400;
/**
 * A touch action is armed by the first tap and confirmed by a later one. A second tap sooner
 * than this is the same gesture bouncing (a double tap), not a decision.
 */
const TOUCH_CONFIRM_MS = 400;
/** Keyboard focus moves between these with Tab, and within one with the arrows. */
type FocusGroup = "hotspot" | "verb" | "item";
/** Tab order: the scene first (what the player came to touch), then the verbs, then the satchel. */
const FOCUS_GROUPS: FocusGroup[] = ["hotspot", "verb", "item"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** The painted bounds of a hotspot's area, in world coordinates. */
function areaBox(area: Area): { x: number; y: number; w: number; h: number } {
  if ("rect" in area) return { x: area.rect.x, y: area.rect.y, w: area.rect.w, h: area.rect.h };
  const xs = area.map((p) => p.x), ys = area.map((p) => p.y);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
  };
}

/** Whether a point is on a rectangle (the little hit-test the scene chrome keeps reusing). */
function insideBox(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** A chapter column in Chapter select: one act, its rooms, one line of the chart. */
interface SceneColumn {
  act: number;
  title: string;
  x: number;
  rooms: { index: number; id: string }[];
}
interface SceneLayout {
  entries: { id: string; act: number }[];
  columns: SceneColumn[];
  rects: Rect[];
}

/** Items that have art of their own (`item_<id>` in the manifest); the rest are drawn as names. */
const ITEM_ICONS = new Set(Object.keys(MANIFEST.images).filter((k) => k.startsWith("item_")).map((k) => k.slice(5)));
/** A line that ends a sentence, for a screen reader joining several into one. */
function sentenceEnd(text: string): string {
  const t = text.trim();
  return /[.!?…:;]["”’')\]]*$/.test(t) ? t : `${t}.`;
}

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

/** A moment of play as plain data (dev tools: the fuzzer's probes snapshot and restore these). */
interface DevSnapshot {
  room: string; x: number; y: number; facing: 1 | -1; moveDirection: "left" | "right" | "up" | "down"; act: number;
  flags: Record<string, unknown>; inventory: string[]; inventoryPage: number; notes: CaseNote[];
  dialogue: { tree: string; node: string; shown: number } | null;
  narration: { text: string; shown: number } | null; narrationClock: number;
  queue: Effect[] | null; queueDue: number; cameraX: number; sentence: Sentence;
}

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
/**
 * How long a line stays up, once fully shown, before an effect that would replace it runs: at
 * least this, and at least long enough to read it (see `lineDue`). A click skips the wait.
 */
const HOLD: Partial<Record<Effect["k"], number>> = { talk: 1.5, say: 1.5, act: 2.4, win: 2.5 };
/** Reading speed, characters per second, for how long a line must stay up. */
const READ_CPS = 18;
/**
 * Ways out without Q: the soft chevron appears when Fenn is this close to an exit's stand, a
 * click this near a screen edge walks off through an exit meeting that edge, and the first
 * entry into a room (up to this many exits) breathes them once for this long.
 */
const EXIT_CUE_RANGE = 240;
const EXIT_EDGE_BAND = 70;
/** How near the viewport edge an exit's painted area must reach to count as meeting it. */
const EXIT_EDGE_TOUCH = 4;
const EXIT_INTRO_TIME = 2.5;
const EXIT_INTRO_MAX = 4; // a first-entry breath of light at up to four thresholds
/** How near the pointer must be to a threshold for its light to answer. */
const EXIT_POINTER_RANGE = 120;
/** A read line lingers this long, then its box fades away over NARRATION_FADE seconds. */
const NARRATION_LINGER = 2.5;
const NARRATION_FADE = 0.6;
/** Running is this much quicker than walking (double-click the floor). */
const RUN_FACTOR = 2.2;
/** Effects that hand the screen to something else; nothing after one in a list runs. */
const TERMINAL: ReadonlySet<Effect["k"]> = new Set(["go", "talk", "act", "win"]);
/**
 * Effects that only change the voyage's state. They never wait for a line: a save, a pause or a
 * quit while a line is still being read must not lose them (Act III's crowbar).
 */
const STATE: ReadonlySet<Effect["k"]> = new Set(["flag", "add", "give", "take", "note"]);

/**
 * `seen:` and `looked:` flags are set with nothing else to save; they wait at most this long
 * (seconds of play) for a save of their own, and a hidden or closed tab writes them at once.
 */
const AUTOSAVE_DELAY = 0.5;
/** A save notice stays up at least this long, and long enough to be read twice. */
const SAVE_NOTICE_MIN = 8;
// next-level: casebook
/** How long a pinned note's banner and the chart button's glow last, in seconds. */
const NOTE_TOAST_TIME = 4;

/** The final-choice flag each ending branch also sets; the other branch's must go. */
const ENDING_COMPANION: Readonly<Record<string, string>> = {
  ending_fog_lifts: "curse_broken",
  ending_long_way: "escaped_fog",
};

/** What a save may name, checked against the live content. */
const KNOWN: SaveKnown = {
  room: (id) => id in ROOMS,
  item: (id) => id in ITEMS,
  act: (n) => n in ACTS,
  firstAct: FIRST_ACT,
  talk: (tree, node) => tree in DIALOGUES && (node === undefined || node in DIALOGUES[tree].nodes),
  // A save is by design from before the final choice; none of its answers are part of a voyage.
  endingFlags: ENDING_RESET_FLAGS,
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
  /** Chart notes, in the order Fenn pinned them. */
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
  /** What the last hover cue named, so crossing a scene ticks once per thing, not per pixel. */
  private hoverCueKey: string | null = null;
  private keyboardFocus: KeyboardFocus | null = null;
  /** Reveal: every hotspot outlined in light. Held with Q, or toggled by its button. */
  private revealHeld = false;
  private revealToggled = false;
  /** Touch: the hotspot a first tap showed; a second tap on it acts. */
  private touchArmed: string | null = null;
  /** When that arm was shown (performance.now()); see TOUCH_CONFIRM_MS. */
  private touchArmedAt = 0;
  private touch = false;
  /** The phone/tablet layout: canvas scene plus the DOM touch chrome. */
  private mobile = false;
  private mobileUI: MobileUI | null = null;
  /** Mobile play shows the scene alone; title, cold open and ending use the full frame. */
  private mobileFull = true;
  private mobileSyncAt = -1e9;
  /** Running (double-click), and where the current walk is headed. */
  private running = false;
  private walkGoal: Pt | null = null;
  /** New Voyage is asking for confirmation before it replaces the save. */
  private confirmNew = false;
  /** When that question appeared (performance.now()): an answer this soon is a double-click. */
  private confirmArmedAt = 0;
  /** What the save holds, named in the question. */
  private confirmLabel: string | null = null;
  /** What the player last used: hints and focus follow keys or the pointer accordingly. */
  private lastInput: "pointer" | "keyboard" = "pointer";
  /** A mouse has been over the game: until then its position (0,0) points at nothing. */
  private pointerSeen = false;
  /** The sentence last sent off (its key) while Fenn walks over to do it; see `sentenceSent`. */
  private committed: string | null = null;
  /** When a conversation last closed under the pointer (performance.now()). */
  private dialogueClosedAt = -1e9;
  /** A conversation's staging: panel fade and rise, eased height, portrait crossfade, spotlight. */
  private stage = new DialogueStage();
  /**
   * World x the camera holds on (framing a conversation, then staying put after it) until Fenn
   * next walks: so the scene a player is about to click isn't scrolling under the pointer.
   */
  private cameraHold: number | null = null;
  /** The scene may have changed under a still pointer: hit-test it again. */
  private hoverDirty = false;
  /** Doors lean the view toward them as the curtain falls, and the next room settles in. */
  private transition = new Transition();
  /** The short passage shot for a cut between two genuinely apart rooms. */
  private connector = new Connector();
  /** Walk rings, pickup flights and the glow on new items. */
  private fx = new Fx();
  /** The closing card, while it shows. */
  private ending: EndingScreen | null = null;
  /** next-level: a11y — the ending has been read out, so a repeated effect cannot say it twice. */
  private announcedEnding = false;
  /** Something to do at full black (a change of scene that shouldn't be a hard cut). */
  private curtain: (() => void) | null = null;
  /** The way out being taken, so the transition leans toward it. */
  private exitAt: Pt | null = null;
  /**
   * Connectivity for a room change, keyed by its destination. A `go` can be parked in the effect
   * queue behind a line, so the cue waits here for the room it belongs to rather than on a single
   * field that a second click could overwrite.
   */
  private exitLinks = new Map<string, { from: string; link: ExitLink | null; passage: PassageKind | null; at: Pt }>();
  /** The side the arriving painting is revealed from, set when the room swaps. */
  private pendingEntry: ExitSide | null = null;
  /** The passage shot to play at full black before the room swaps, if this cut needs one. */
  private pendingPassage: { kind: PassageKind; side: ExitSide } | null = null;
  /** Rooms whose exits have already had their one-time first-entry pulse this session. */
  private exitIntroSeen = new Set<string>();
  /** Seconds left of that pulse; 0 when none is due. */
  private exitIntro = 0;
  /** How much each speaker is talking (0..1), eased, for the lean and lift of speech. */
  private talking = new Map<string, number>();
  /** Seconds since the title appeared, and where its focus marker last set off from. */
  private titleClock = 0;
  private needle: { fromY: number | null; since: number } = { fromY: null, since: -99 };
  private cursorStyle = "";
  /** Seconds of pointer/key quiet; the icon bar fades when nobody has touched it. */
  private idle = 0;
  /** Eased visibility of the icon bar: 1 when in use, still readable when idle (BAR_IDLE_ALPHA). */
  private barFade = 1;
  /** A button just pressed, so its icon shows a short focus ring even after the key is up. */
  private barFlash: { id: BarId; left: number } | null = null;
  /** A touch has no hover: the first tap names a plate and this keeps the name up for a moment. */
  private barLabel: { id: BarId; left: number } | null = null;
  /** The plate a touch has named but not yet pressed. The second tap does its work. */
  private touchBarArmed: BarId | null = null;
  /** Seconds the pointer has rested on the same thing, for the first-watch lessons. */
  private hoverDwell = 0;
  /** The button under the pointer, for the canvas's hover title. */
  private lastBarHover: BarId | null = null;
  private cameraX = 0;
  private focusCameraX: number | null = null;
  private rejection = 0;
  private time = 0;
  private hasSave = false;
  /** True while a stashed voyage from before "Begin anew" / "Restart" can be taken up. */
  private hasPrevious = false;
  /** Two tabs share one save; once the other one writes, this tab stops writing over it. */
  private tabGuard = new SaveTabGuard();
  private foreignSave = false;
  private foreignSaveWarned = false;
  /** The closing choice just made, so a corrupted pair of ending flags still resolves to one. */
  private endingChosen: string | null = null;
  private paused = false;
  private settings: Settings;
  private cinematic: CinematicPlayer;
  private casebook: Casebook;
  // next-level: recap
  private recap: Recap;
  private history: History;
  private atlas: Atlas;
  private areaCard: HTMLDivElement | null = null;
  private areaCardBusy = false;
  private areaCardLeft = 0;
  private areaCardFading = false;
  private areaCardThen: (() => void) | null = null;
  // next-level: casebook
  /** The deeds page after the ending card: the voyage's entered and unfiled optional layer. */
  private deeds: DeedsPage;
  /** The deeds page has been offered for this voyage; `advanceEnding` only offers it once. */
  private deedsShown = false;
  /** The collected casebook, read once when the title comes up (it is written by `win`). */
  private casebookTally: { filed: number; total: number } | null = null;
  private prefs: Prefs = loadPrefs();
  /** The one-time first-watch lessons this browser has not been given yet. */
  private watch: FirstWatch;

  constructor(
    private view: View,
    private input: Input,
    private assets: Assets,
    private audio: AudioEngine
  ) {
    this.mobile = view.mobile;
    this.touch = view.mobile;
    this.settings = new Settings({
      resume: () => this.setPaused(false),
      restart: () => {
        this.setPaused(false);
        // Restart replaces the voyage just as Begin anew does: keep the page it replaced.
        this.persist();
        this.hasPrevious = stashCurrentSave() || this.hasPrevious;
        this.clearForeignSave();
        this.behindCurtain(() => { this.title = false; this.newGame(); });
      },
      title: () => {
        // The save keeps anything still queued, so Continue picks up exactly here.
        this.persist();
        this.setPaused(false);
        this.behindCurtain(() => {
          this.resetTransient();
          this.explore = false;
          this.roomMenu = false;
          this.enterTitle();
        });
      },
      mute: () => { this.audio.toggleMute(); },
      volume: (value) => this.audio.setVolume(value),
      musicVolume: (value) => this.audio.setMusicVolume(value),
      sfxVolume: (value) => this.audio.setSfxVolume(value),
      audio: () => this.audio,
      tip: () => this.resumeWith("tip"),
      history: () => this.resumeWith("history"),
      tips: () => this.tipMode,
      toggleTips: () => this.setTipMode(!this.tipMode),
      prefs: () => this.prefs,
      setPrefs: (change) => {
        this.prefs = { ...this.prefs, ...change };
        savePrefs(this.prefs);
        this.syncDocument();
      },
      reduced: () => this.reduced,
      autoTextScale: () => autoTextScale(this.view.scale),
    });
    const readLesson = (key: string): string | null => {
      try { return localStorage.getItem(key); } catch { return null; }
    };
    const writeLesson = (value: string): void => {
      try { localStorage.setItem(LESSON_KEY, value); } catch { /* optional */ }
    };
    this.watch = new FirstWatch(readLessons(readLesson), (taught) => writeLessons(writeLesson, taught));
    try { this.tipMode = localStorage.getItem(TIPS_KEY) === "on"; } catch { this.tipMode = false; }
    this.cinematic = new CinematicPlayer(() => this.audio);
    const titles: Record<number, string> = {};
    for (const [n, a] of Object.entries(ACTS)) titles[Number(n)] = `${a.title}`;
    this.casebook = new Casebook(titles, () => { this.audio.page(); this.persist(); });
    // next-level: recap — Continue says what the voyage was before it resumes it.
    this.recap = new Recap({
      actTitle: (n) => this.actTitle(n),
      roomName: (id) => ROOMS[id]?.name ?? id,
      itemName: (id) => ITEMS[id]?.name ?? id,
      actCaption: (n) => ACTS[n]?.caption ?? null,
      waitingOnLastChoice: (n) => n === LAST_ACT && hasCompleted(),
      sail: () => this.sail(),
      readCasebook: (notes) => { this.audio.page(); this.casebook.show(notes); },
      back: () => { this.audio.page(); this.announce("Back at the title. Set sail when you're ready."); },
    });
    this.history = new History(() => this.audio.page());
    this.atlas = new Atlas({ onTravel: (room) => this.travelTo(room), onDismiss: () => this.audio.chart(false) });
    // next-level: casebook — after the closing card: the voyage's deeds, then home.
    this.deeds = new DeedsPage(() => this.leaveDeeds());
    // The harbour under the title: the dock's lanterns and moving water, inside the drift.
    // The title is the island chart now; the old harbour-water decoration belongs to the dock plate.
    this.titleDecor = null;
    // Timing, scheduling and failure recovery live in frame.ts; the game lends it one callback.
    this.loop = new FrameLoop({
      step: (dt, t) => this.step(t, dt),
      announce: (text) => this.announce(text),
    });
  }
  /** Tip mode keeps the current tip on screen. Remembered per browser, separate from saves. */
  private tipMode = false;
  /** Nudge first, then the full line: which rung each tip is on (tips.ts). */
  private tipLadder = new TipLadder(() => TIPS, (c) => this.check(c));
  private saveBroken = false;
  /**
   * Reduced motion (the setting, else the OS): no breathing, no twinkle, no pulsing outline, no
   * camera glides or zooms, and every line appears at once, whatever text speed was chosen.
   */
  private get reduced(): boolean {
    return reducedMotion(this.prefs);
  }
  /** The typewriter speed in effect; the settings panel shows the same one. */
  private get textSpeed() {
    return effectiveTextSpeed(this.prefs, this.reduced);
  }
  /** Seconds the typewriter takes over `chars` characters of narration. */
  private typeTime(chars: number): number {
    const cps = NARRATION_CPS[this.textSpeed];
    return Number.isFinite(cps) ? chars / cps : 0;
  }
  /** When (on the narration clock) the line on screen has been up long enough to replace. */
  private lineDue(kind: Effect["k"]): number {
    const chars = this.narration?.text.length ?? 0;
    return this.typeTime(chars) + Math.max(HOLD[kind] ?? 0, chars / READ_CPS);
  }
  /** The text size in effect: the player's choice, else what suits this screen. */
  private get textScale(): number {
    return effectiveTextScale(this.prefs, this.view.scale);
  }
  /**
   * Things outside the canvas that follow the settings: a `reduced-motion` class on <body> (CSS
   * transitions follow it) and `--text-scale` for the DOM overlays. The DOM isn't shrunk with
   * the canvas, so it only follows a size the player chose, not the automatic one.
   */
  private syncDocument(): void {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("reduced-motion", this.reduced);
    document.documentElement.style.setProperty("--text-scale", String(this.prefs.textScale ?? 1));
  }
  private live: HTMLElement | null = null;
  /**
   * next-level: a11y — the canvas top bar and the inventory pager, mirrored as real DOM buttons.
   * A screen reader cannot see or press a canvas plate; it can name, reach and press these. They
   * are visually hidden (the drawn chrome is unchanged) and do exactly what the plates do.
   */
  private a11y: {
    root: HTMLElement;
    reveal: HTMLButtonElement;
    tip: HTMLButtonElement;
    previous: HTMLButtonElement;
    next: HTMLButtonElement;
  } | null = null;

  /** Build the screen-reader toolbar once, after the canvas exists. */
  private buildA11yControls(): void {
    // On a phone the touch HUD is already real DOM with real buttons; the hidden mirror would
    // only give a screen reader a second, invisible copy.
    if (this.mobile || typeof document === "undefined" || this.a11y) return;
    const root = document.createElement("div");
    root.className = "a11y-controls sr-only";
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", "Game controls");
    const make = (label: string, action: () => void, shortcut?: string): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      // The icon plate has no words; its accessible name and hover title carry the meaning.
      button.title = shortcut ? `${label} (${shortcut})` : label;
      if (shortcut) {
        button.setAttribute("aria-keyshortcuts", shortcut);
        button.setAttribute("aria-label", `${label} (${shortcut})`);
      }
      button.addEventListener("click", action);
      root.append(button);
      return button;
    };
    const reveal = make("Reveal interactive things", () => this.barAction("reveal"), "Q");
    reveal.setAttribute("aria-pressed", "false");
    const tip = make("Tip", () => this.barAction("tip"), "H");
    tip.setAttribute("aria-pressed", "false");
    make("Line history", () => this.barAction("log"), "L");
    make("Chart", () => this.barAction("casebook"), "J");
    make("Map", () => this.barAction("map"), "A");
    make("Pause", () => this.barAction("pause"), "Escape");
    const previous = make("Previous inventory page", () => this.turnPage(-1), "PageUp");
    const next = make("Next inventory page", () => this.turnPage(1), "PageDown");
    document.body.append(root);
    root.hidden = this.title || this.won;
    this.a11y = { root, reveal, tip, previous, next };
    this.syncA11yControls();
  }

  /**
   * The screen-reader toolbar mirrors the in-play top bar. On the title and after the ending
   * there is no game behind it: hide it so Tab leaves the canvas for the browser instead of
   * landing on controls that would do nothing there.
   */
  private syncA11yVisibility(): void {
    const c = this.a11y;
    if (!c) return;
    const hide = this.title || this.won;
    if (hide === c.root.hidden) return;
    if (hide && c.root.contains(document.activeElement)) restoreFocus(null);
    c.root.hidden = hide;
  }

  /** Keep the DOM controls' labels and state in step with the canvas's. */
  private syncA11yControls(): void {
    const c = this.a11y;
    if (!c) return;
    c.reveal.setAttribute("aria-pressed", String(this.revealToggled));
    c.tip.setAttribute("aria-pressed", String(this.tipMode));
    const pages = Math.max(1, this.pageCount());
    const page = Math.min(this.inventoryPage, pages - 1) + 1;
    const disabled = pages < 2;
    c.previous.disabled = disabled;
    c.next.disabled = disabled;
    c.previous.setAttribute("aria-label", `Previous inventory page, page ${page} of ${pages}`);
    c.next.setAttribute("aria-label", `Next inventory page, page ${page} of ${pages}`);
  }

  /** Seconds spent waiting for a room's art to arrive. */
  private roomWait = 0;
  /**
   * A problem with the save, in a banner under the top bar until it has been on screen long
   * enough to read (`left` seconds): a narration line would be replaced by whatever came next.
   */
  private saveNotice: { text: string; left: number } | null = null;
  // next-level: casebook
  /**
   * A note just filed: a small banner under the top bar for a few seconds, and (separately) the
   * casebook button glowing for the same while. The banner waits for a conversation or a
   * cinematic to end rather than talking over it; the glow doesn't wait, because it says nothing.
   */
  private noteToast: { left: number } | null = null;
  /** Seconds left on the casebook button's glow; see `noteToast`. */
  private noteGlow = 0;
  /** Seconds until `seen:`/`looked:` flags set since the last save are written (0: none waiting). */
  private autosaveIn = 0;
  private setTipMode(on: boolean): void {
    this.tipMode = on;
    try { localStorage.setItem(TIPS_KEY, on ? "on" : "off"); } catch { /* ignore */ }
    this.syncA11yControls(); // next-level: a11y — the DOM Tip button's aria-pressed
  }

  /** The plain next-step hint for the current state: the current tip's full line (the tests read it). */
  currentTip(): string {
    return this.tipLadder.answer();
  }
  /** H or the Tip button: the current tip's nudge, or its full line if asked again (tips.ts). */
  private showTip(): void {
    this.audio.chime();
    this.speak(`Tip: ${this.tipLadder.ask(this.tipMode)}`);
  }
  /**
   * One of the five first-watch lessons, offered at the moment it matters. Marked as taught as
   * soon as it is offered, so a second voyage never repeats it; read out for a screen reader
   * even though the plate itself is canvas.
   */
  private teach(id: LessonId): boolean {
    if (!this.watch.offer(id)) return false;
    this.announce(LESSONS[id].text(this.touch));
    return true;
  }

  // next-level: casebook — the NEXT block and where-line are game state, not casebook state.
  /**
   * Open the casebook. Every open from play brings the next step and where Fenn is standing; the
   * title, Chapter select and the ending don't, because there is no voyage to be standing in.
   */
  private showCasebook(): void {
    if (this.title || this.won || this.explore) {
      this.casebook.show(this.notes);
      return;
    }
    this.casebook.show(this.notes, { plan: this.tipLadder.shown(), where: this.casebookWhere() });
  }

  /** "Act II: The Crew · The Marrow — Captain's Cabin", for the chart's where-line. */
  private casebookWhere(): string {
    const act = ACTS[this.act];
    const label = act ? `Act ${ROMAN[act.n] ?? act.n}: ${act.title}` : `Act ${ROMAN[this.act] ?? this.act}`;
    return `${label} · ${this.room.name}`;
  }

  /** The verb a sensible person would use on this: lit up on hover, done by a plain click. */
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
  /** Leave the pause menu for one of the things its footer offers (H, L). */
  private resumeWith(what: "tip" | "history"): void {
    this.setPaused(false);
    if (this.title || this.won || this.cinematic.active) return;
    if (what === "tip" && !this.dialogue && !this.queue && !this.inputLocked()) this.showTip();
    if (what === "history") { this.audio.page(); this.history.show(); }
  }

  // ------------------------------------------------------------ lifecycle

  /** The 60 fps animation loop: timing, scheduling and failure recovery (see frame.ts). */
  private loop: FrameLoop;

  start(): void {
    try {
      this.hasSave = hasAnySave();
      this.hasPrevious = hasStashedSave();
    } catch { this.hasSave = false; this.hasPrevious = false; }
    // Two tabs share localStorage: the other tab's write arrives here as a storage event. There
    // is no event in the tab that writes, so every event for this key is genuinely another page.
    addEventListener("storage", (event) => this.onStorage(event));
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
    // A tab being closed or hidden writes whatever is still waiting for the next save.
    addEventListener("pagehide", () => this.flushAutosave());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.flushAutosave(); });
    this.input.onDown((x, y, button, info) => {
      this.touch = info.kind !== "mouse" || this.mobile;
      this.onClick(x, y, button, info.clicks);
    });
    this.input.onMove((x, y, _b, info) => {
      // A touch emits a move before its tap: knowing it is touch now keeps that move from
      // sounding a hover cue just before the arm cue that belongs to the gesture.
      this.touch = info.kind !== "mouse" || this.mobile;
      this.onMove(x, y);
    });
    this.input.onKey((k, event) => this.onKey(k, event));
    this.input.onKeyUp((k) => {
      if (k === "" || k.toLowerCase() === "q") this.revealHeld = false;
    });
    onOsReducedMotion(() => this.syncDocument());
    this.syncDocument();
    this.buildA11yControls(); // next-level: a11y — the screen-reader toolbar
    this.loadRoom(START_ROOM, START_POS);
    this.enterTitle();
    if (this.mobile) {
      this.mobileUI = new MobileUI(this.mobileBridge());
      this.mobileUI.sync(this.mobileState());
    }
    // A desktop game is operated from the canvas; give it real DOM focus so a screen reader has
    // a focused control and Tab's edge hand-off starts from the game, not <body>. On a phone the
    // touch chrome is real DOM: Tab is left to the browser there instead.
    if (!this.mobile) this.view.canvas.focus({ preventScroll: true });
    this.loop.start();
  }

  /** One due frame: advance the game clock, the touch HUD and the canvas. */
  private step(t: number, dt: number): void {
    if (!this.paused) this.time += dt;
    this.update(dt);
    // The touch HUD only needs to match the game about ten times a second; the scene keeps 60.
    if (this.mobileUI && t - this.mobileSyncAt > 100) {
      this.mobileSyncAt = t;
      this.mobileUI.sync(this.mobileState());
    }
    // Under the pause menu, a cinematic or the casebook the canvas barely shows: draw it a few
    // times a second, not sixty. A resize clears the canvas, so that draws at once.
    // next-level: casebook
    const covered = this.paused || this.cinematic.active || this.casebook.open || this.history.open ||
      this.deeds.open;
    const sized = this.view.canvas.width === this.drawnW && this.view.canvas.height === this.drawnH;
    if (!covered || !sized || t - this.drawnAt > 250) {
      this.render();
      this.drawnAt = t;
      this.drawnW = this.view.canvas.width;
      this.drawnH = this.view.canvas.height;
    }
  }
  private drawnAt = -1e9;
  private drawnW = 0;
  private drawnH = 0;


  /** Fade to black, do `then` there, and fade back up: a change of scene without a hard cut. */
  private behindCurtain(then: () => void): void {
    this.curtain = then;
    this.fadeTarget = 1;
  }

  // ------------------------------------------------------------ input

  /**
   * True while the screen is changing hands (a door's fade, a room still arriving, a cutscene):
   * clicks and keys then could act on a room that is about to go, or trigger a door twice.
   */
  private inputLocked(): boolean {
    if (this.curtain) return true;
    // next-level: casebook
    if (this.deeds.open) return true;
    if (this.atlas?.open) return true;
    if (this.areaCardBusy) return true;
    if (this.title || this.won) return false;
    // Past half-way back from black the new room is plainly there to be clicked.
    return this.paused || this.cinematic.active || this.pendingRoom !== null || this.fade > 0.5;
  }

  private onKey(k: string, event: KeyboardEvent): void {
    // Browser and system shortcuts (Ctrl+L, Cmd+1, Alt+Tab) are not the game's: let them through.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // next-level: a11y — the screen-reader toolbar is real DOM: its buttons get their own keys
    // (Tab moves between them, Enter and Space press them). Escape still belongs to the game.
    if (this.a11y && k !== "Escape" && event.target instanceof Node && this.a11y.root.contains(event.target)) return;
    // The touch chrome is real DOM too: a focused verb, satchel or title button owns Enter,
    // Space and Tab; the canvas's shortcuts must not fire a second action behind it.
    if (this.mobileUI && k !== "Escape" && event.target instanceof Node && this.mobileUI.contains(event.target)) return;
    // On a phone every control is a real DOM button. Leave Tab to the browser so it can walk
    // the touch chrome, the overlays and the page: the old canvas focus groups trapped it.
    if (this.mobile && k === "Tab") return;
    // Tab from <body> is also the browser's: it has to be able to land on the canvas first
    // (and, after the canvas's focus cycle, on real page controls). A modal overlay holds its
    // own focus and handles its own Tab, so this only applies while nothing is covering play.
    if (k === "Tab" && event.target === document.body && !this.paused && !this.cinematic.active &&
      !this.casebook.open && !this.history.open && !this.deeds.open && !this.recap.open &&
      !this.atlas.open) return;
    // A modifier on its own, an F-key or a media key means nothing here, and must not skip a line.
    if (!actionKey(k)) return;
    // Any key the game takes counts as use: the icon bar wakes for it. A touch's first tap on
    // a plate no longer needs its second: the keyboard has taken over.
    this.idle = 0;
    this.touchBarArmed = null;
    // A held key acts once. Only movement repeats (Tab and the arrows walk focus along a row): a
    // held Enter, letter or Escape would confirm twice, flicker the pause menu, reopen and close
    // the casebook, or race through lines the player hasn't read.
    // next-level: a11y — PageUp/PageDown may repeat, like the arrows.
    const nav = k === "Tab" || k.startsWith("Arrow") || k === "PageUp" || k === "PageDown";
    if (event.repeat && !nav) {
      if (k === "Enter" || k === " " || k === "Escape") event.preventDefault();
      return;
    }
    if (this.areaCardBusy) { this.clearAreaCard(); return; }
    if (this.paused) {
      // Focus can leave the pause dialog (a click on its backdrop); its keys still work from here.
      this.pausedKey(k, event);
      return;
    }
    if (this.cinematic.active) return;
    if (this.atlas?.open) {
      event.preventDefault();
      if (k === "Escape" || k.toLowerCase() === "a") this.atlas.hide();
      return;
    }
    if (nav || k === "Enter" || k === " ") this.lastInput = "keyboard";
    if (this.explore && this.exploreKey(k, event)) return;
    // next-level: casebook — the deeds page too
    if (this.casebook.open || this.history.open || this.deeds.open) {
      // The overlay has focus of its own; never let a stray key reach the game behind it.
      event.preventDefault();
      if (k === "Escape" || k.toLowerCase() === "j") this.casebook.hide();
      if (k === "Escape" || k.toLowerCase() === "l") this.history.hide();
      // The deeds page normally handles its own keys; this is the fallback if focus slips.
      if (this.deeds.open && (k === "Escape" || k === "Enter" || k === " ")) this.deeds.hide();
      return;
    }
    this.audio.unlock();
    if (this.title && this.confirmNew && k === "Escape") {
      event.preventDefault();
      this.cancelConfirmNew();
      return;
    }
    if (k === "Escape" && !this.won) {
      // next-level: a11y — back out of what is being built or read before pausing. A second
      // Escape, with nothing left to cancel, opens the pause menu as it always has.
      event.preventDefault();
      if (this.dialogue) {
        this.leaveDialogue();
        this.dialogueClosedAt = performance.now();
        this.announce("Left the conversation.");
        return;
      }
      if (this.sentence.verb || this.sentence.a || this.sentence.b || this.committed) {
        this.path = [];
        this.onArrive = null;
        this.walkGoal = null;
        this.running = false;
        this.touchArmed = null;
        this.clearSentence();
        this.announce("Cancelled.");
        return;
      }
      this.flashBar("pause");
      this.setPaused(true);
      return;
    }
    if (k.toLowerCase() === "m") { this.audio.toggleMute(); return; }
    if (this.inputLocked()) {
      // Tab is never held: even mid-fade it must be able to leave the canvas for real controls.
      if (k === "Enter" || k === " " || k.startsWith("Arrow")) event.preventDefault();
      return;
    }
    if (k.toLowerCase() === "a" && !this.title && !this.won && !this.cinematic.active) {
      event.preventDefault();
      this.flashBar("map");
      this.showAtlas();
      return;
    }
    if (k.toLowerCase() === "j" && !this.title && !this.won && !this.cinematic.active) {
      event.preventDefault();
      this.flashBar("casebook");
      this.audio.page();
      // next-level: casebook — pass the plan from the J key too
      this.showCasebook();
      return;
    }
    if (k.toLowerCase() === "l" && !this.title && !this.cinematic.active) {
      event.preventDefault();
      this.flashBar("log");
      this.audio.page();
      this.history.show();
      return;
    }
    if (k.toLowerCase() === "q" && !this.title && !this.won) {
      // Held, not toggled: let go and the outlines go with it.
      event.preventDefault();
      this.flashBar("reveal");
      if (!this.revealHeld) this.announce(this.revealSummary());
      this.revealHeld = true;
      return;
    }
    if ((k === "h" || k === "H") && !this.title && !this.won && !this.dialogue && !this.queue) {
      this.flashBar("tip");
      this.showTip();
      return;
    }
    if (this.won && (k === "Enter" || k === " ")) {
      event.preventDefault();
      this.advanceEnding();
      return;
    }
    if (this.title) {
      this.titleKey(k, event);
      return;
    }
    // Moving focus doesn't skip a line: reading and looking around go together.
    if (!nav && this.narration && this.narration.shown < this.narration.text.length) {
      event.preventDefault();
      this.narration.shown = this.narration.text.length;
      this.narrationClock = this.typeTime(this.narration.text.length);
      return;
    }
    if (!nav && this.queue) {
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
        this.cueHover(`choice:${this.hoverChoice}`);
        const c = choices[this.hoverChoice];
        this.announce(`${this.hoverChoice + 1} of ${choices.length}: ${sentenceEnd(c.text)}${c.seen ? " Asked before." : ""}`);
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
      } else if (k === "Tab") {
        event.preventDefault();
      }
      return;
    }
    if (k === "Tab") {
      // At either end of the scene/verb/satchel cycle, let the browser take Tab onward to the
      // real DOM controls (the screen-reader toolbar or browser chrome). preventDefault here
      // used to make the canvas a keyboard trap.
      if (!this.moveFocus(event.shiftKey ? -1 : 1)) return;
      event.preventDefault();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
      event.preventDefault();
      this.moveFocusGrid(k);
    } else if (k === "PageUp" || k === "PageDown") {
      // next-level: a11y — the satchel's pages from anywhere in play, no pointer needed.
      event.preventDefault();
      this.turnPage(k === "PageUp" ? -1 : 1);
    } else if (k === "Enter" || k === " ") {
      event.preventDefault();
      this.activateFocus();
    }
  }

  /** Keys while the pause dialog is up but doesn't have focus: the ones its footer lists. */
  private pausedKey(k: string, event: KeyboardEvent): void {
    const key = k.toLowerCase();
    if (k === "Escape") { event.preventDefault(); this.setPaused(false); }
    else if (key === "h") { event.preventDefault(); this.resumeWith("tip"); }
    else if (key === "l") { event.preventDefault(); this.resumeWith("history"); }
    else if (k === "Tab") { event.preventDefault(); this.settings.focus(); }
  }

  private titleKey(k: string, event: KeyboardEvent): void {
    const buttons = this.titleButtons();
    const focus = buttons.findIndex((b) => b.id === this.titleFocus);
    if ((k === "c" || k === "C") && this.hasSave) this.titleActivate("continue");
    else if ((k === "e" || k === "E") && this.chaptersUnlocked()) this.titleActivate("explore");
    else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(k)) {
      const delta = k === "ArrowUp" || k === "ArrowLeft" || (k === "Tab" && event.shiftKey) ? -1 : 1;
      // Nothing focused: the first press lands on what Enter would do. From the last answer
      // (or before the first) Tab is the browser's: a menu must not trap the keyboard either.
      if (focus >= 0 && (focus + delta < 0 || focus + delta >= buttons.length)) return;
      event.preventDefault();
      const next = focus < 0
        ? buttons.find((b) => b.id === defaultTitleButton(buttons)) ?? buttons[0]
        : buttons[focus + delta];
      this.setTitleFocus(next.id);
      this.announce(`${next.label}, button ${buttons.indexOf(next) + 1} of ${buttons.length}`);
    } else if (k === "Enter" || k === " ") {
      event.preventDefault();
      this.titleActivate(focus < 0 ? defaultTitleButton(buttons) : this.titleFocus!);
    }
  }

  // ------------------------------------------------------------ keyboard focus
  //
  // Three groups: the scene's hotspots, the verbs and the inventory. Tab and Shift+Tab move
  // between groups (landing where focus last was in each); the arrows move within one.

  private groupIds(group: FocusGroup): string[] {
    if (group === "verb") return VERBS.map((v) => v.id);
    if (group === "item") {
      // next-level: a11y — the pager is part of the satchel for keyboard focus, so a page turn
      // is reachable (and announced) without a pointer.
      const items = this.pageInventory();
      return this.pageCount() > 1 ? [...items, PAGE_FOCUS.prev, PAGE_FOCUS.next] : items;
    }
    return this.sceneOrder().map((h) => h.id);
  }

  /** Visible hotspots left to right, as the eye reads the scene, not in script order. */
  private sceneOrder(): Hotspot[] {
    return this.visibleHotspots()
      .map((h) => ({ h, c: this.areaCentre(h.area) }))
      .sort((a, b) => a.c.x - b.c.x || a.c.y - b.c.y)
      .map((e) => e.h);
  }
  private focusMemory: Partial<Record<FocusGroup, string>> = {};

  private focusValid(): boolean {
    const f = this.keyboardFocus;
    return Boolean(f && this.groupIds(f.kind).includes(f.id));
  }

  private setFocus(focus: KeyboardFocus): void {
    this.keyboardFocus = focus;
    this.focusMemory[focus.kind] = focus.id;
    this.hoverHotspot = null;
    this.cueHover(`focus:${focus.kind}:${focus.id}`);
    this.syncKeyboardCamera();
    this.announceFocus();
  }

  /**
   * Tab: the next group (Shift+Tab: the previous), back where focus last was in it. Returns
   * false at either end of the cycle, so the caller can let the browser move focus out of the
   * canvas instead of wrapping forever.
   */
  private moveFocus(delta: number): boolean {
    const groups = FOCUS_GROUPS.filter((g) => this.groupIds(g).length > 0);
    if (!groups.length) return false;
    const at = this.focusValid() ? groups.indexOf(this.keyboardFocus!.kind) : -1;
    const index = at < 0 ? (delta < 0 ? groups.length - 1 : 0) : at + delta;
    if (index < 0 || index >= groups.length) return false;
    const group = groups[index];
    const ids = this.groupIds(group);
    const remembered = this.focusMemory[group];
    const id = remembered && ids.includes(remembered) ? remembered
      : group === "hotspot" ? this.nearestHotspot() ?? ids[0] : ids[0];
    this.setFocus({ kind: group, id } as KeyboardFocus);
    return true;
  }

  /** The thing on screen closest to Fenn: where a player's eye already is. */
  private nearestHotspot(): string | null {
    let best: string | null = null, bestD = Infinity;
    for (const h of this.visibleHotspots()) {
      const c = this.areaCentre(h.area);
      const onScreen = c.x >= this.cameraX && c.x <= this.cameraX + LOGICAL_W;
      const d = Math.abs(c.x - this.x) + (onScreen ? 0 : 1e5);
      if (d < bestD) { bestD = d; best = h.id; }
    }
    return best;
  }

  /** Arrows: within the focused group. Nothing focused yet, they start in the scene. */
  private moveFocusGrid(key: string): void {
    if (!this.focusValid()) {
      this.moveFocus(1);
      return;
    }
    const focus = this.keyboardFocus!;
    if (focus.kind === "hotspot") {
      const ids = this.groupIds("hotspot");
      const current = ids.indexOf(focus.id);
      const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      this.setFocus({ kind: "hotspot", id: ids[(current + delta + ids.length) % ids.length] });
      return;
    }
    if (focus.kind === "item") {
      this.moveItemFocus(key, focus.id);
      return;
    }
    const columns = 6;
    const ids = this.groupIds(focus.kind);
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
    this.setFocus({ kind: "verb", id: ids[next] } as KeyboardFocus);
  }

  /**
   * next-level: a11y — arrows in the satchel. The grid is four columns; the pager sits below it
   * (Down from the last row), and Left/Right there turn the page. At a row's ends Left/Right also
   * turn the page, landing on the same row of the next one.
   */
  private moveItemFocus(key: string, id: string): void {
    const pages = this.pageCount();
    const items = this.pageInventory();
    const columns = 4;
    if (isPageFocus(id)) {
      if (key === "ArrowLeft" || key === "ArrowRight") {
        this.turnPage(key === "ArrowLeft" ? -1 : 1);
        this.setFocus({ kind: "item", id: key === "ArrowLeft" ? PAGE_FOCUS.prev : PAGE_FOCUS.next });
      } else if (key === "ArrowUp" && items.length) {
        const lastRow = Math.max(0, Math.ceil(items.length / columns) - 1);
        this.setFocus({ kind: "item", id: items[Math.min(items.length - 1, lastRow * columns)] });
      }
      return;
    }
    const current = items.indexOf(id);
    if (current < 0) {
      if (items.length) this.setFocus({ kind: "item", id: items[0] });
      return;
    }
    const row = Math.floor(current / columns);
    const col = current % columns;
    const rows = Math.ceil(items.length / columns);
    if (key === "ArrowDown" && row >= rows - 1 && pages > 1) {
      this.setFocus({ kind: "item", id: PAGE_FOCUS.prev });
      return;
    }
    if (pages > 1 && ((key === "ArrowLeft" && col === 0) || (key === "ArrowRight" && col === columns - 1))) {
      this.turnPage(key === "ArrowLeft" ? -1 : 1);
      const next = this.pageInventory();
      if (next.length) this.setFocus({ kind: "item", id: next[Math.min(row * columns, next.length - 1)] });
      return;
    }
    let nextRow = row;
    let nextCol = col;
    if (key === "ArrowUp") nextRow = Math.max(0, row - 1);
    if (key === "ArrowDown") nextRow = Math.min(rows - 1, row + 1);
    if (key === "ArrowLeft") nextCol = Math.max(0, col - 1);
    if (key === "ArrowRight") nextCol = Math.min(columns - 1, col + 1);
    this.setFocus({ kind: "item", id: items[Math.min(items.length - 1, nextRow * columns + nextCol)] });
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
    // A page control keeps the keyboard where the player put it; anything else lets go.
    if (!(this.keyboardFocus?.kind === "item" && isPageFocus(this.keyboardFocus.id))) this.keyboardFocus = null;
    this.syncA11yControls();
    // next-level: a11y — the page is a thing that changed; say so.
    this.announce(`Page ${Math.min(this.inventoryPage, pages - 1) + 1} of ${pages}`);
  }

  private visibleHotspots(): Hotspot[] {
    return this.room.hotspots.filter((hotspot) =>
      !hotspot.showIf || hotspot.showIf.every((cond) => this.check(cond))
    );
  }

  /** Say what keyboard focus landed on: the canvas can't tell a screen reader itself. */
  private announceFocus(): void {
    const f = this.keyboardFocus;
    if (!f) return;
    if (f.kind === "verb") {
      const i = VERBS.findIndex((v) => v.id === f.id);
      this.announce(`Verb: ${VERBS[i]?.label ?? f.id}, ${i + 1} of ${VERBS.length}`);
    } else if (f.kind === "item") {
      // next-level: a11y — the pager is a control of its own.
      if (isPageFocus(f.id)) {
        const pages = this.pageCount();
        const page = Math.min(this.inventoryPage, pages - 1) + 1;
        this.announce(`${f.id === PAGE_FOCUS.prev ? "Previous" : "Next"} page, page ${page} of ${pages}`);
        return;
      }
      const items = this.pageInventory();
      this.announce(`Item: ${ITEMS[f.id]?.name ?? f.id}, ${items.indexOf(f.id) + 1} of ${items.length}`);
    } else {
      const all = this.sceneOrder();
      const raw = all.find((h) => h.id === f.id);
      if (!raw) return;
      const hs = this.hotspotState(raw);
      // A door says what it is before what Enter does: focus landing on a way out must be
      // audible as a way out, not just another named thing.
      const exit = this.isExit(hs);
      const verb = exit ? "Go through" : VERBS.find((v) => v.id === this.suggestedVerb(hs))?.label;
      const wayOut = exit ? " A way out." : "";
      const action = this.sentence.verb ? "" : ` Enter: ${verb}.`;
      this.announce(`${hs.name}, ${all.indexOf(raw) + 1} of ${all.length}.${wayOut}${action}`);
    }
  }

  private syncKeyboardCamera(): void {
    this.focusCameraX = null;
    this.cameraHold = null;
    if (this.keyboardFocus?.kind !== "hotspot") return;
    const hotspot = this.visibleHotspots().find((candidate) => candidate.id === this.keyboardFocus?.id);
    if (hotspot) this.focusCameraX = (hotspot.stand ?? this.areaStand(hotspot.area)).x;
  }

  private activateFocus(): void {
    if (!this.focusValid()) {
      this.moveFocus(1);
      return;
    }
    const focus = this.keyboardFocus!;
    if (focus.kind === "verb") {
      this.audio.click();
      this.setVerb(focus.id);
    } else if (focus.kind === "item" && isPageFocus(focus.id)) {
      // next-level: a11y — Enter on a pager button turns the page.
      this.audio.click();
      this.turnPage(focus.id === PAGE_FOCUS.prev ? -1 : 1);
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
    this.lastInput = "pointer";
    this.pointerSeen = true;
    this.idle = 0;
    this.keyboardFocus = null;
    this.focusCameraX = null;
    this.hoverVerb = null;
    this.hoverItem = null;
    this.hoverHotspot = null;
    this.hoverChoice = -1;

    if (this.title) {
      const over = this.titleButtons().find((b) => this.hitTitle(b.y, x, y))?.id ?? null;
      if (over !== this.titleFocus) this.setTitleFocus(over);
      return;
    }

    if (this.roomMenu) {
      // The scene list is pointer and keyboard together: hovering moves the same marker the
      // arrows move, so Enter always goes where the eye is.
      const layout = this.roomMenuLayout();
      const i = layout.rects.findIndex((r) => insideBox(x, y, r));
      if (i >= 0) this.roomMenuFocus = i;
      this.cueHover(i >= 0 ? `menu:${i}` : null);
      return;
    }

    if (this.dialogue) {
      const m = this.dialogueModel();
      const i = dialogueHit(x, y, m);
      this.hoverChoice = i ?? -1;
      this.cueHover(i === null ? null : `choice:${i}`);
      return;
    }

    const hit = hitTestPanel(x, y, this.panelModel());
    if (hit) {
      if (hit.kind === "verb") this.hoverVerb = hit.id;
      else if (hit.kind === "item") { this.hoverItem = hit.id; this.fx.seen(hit.id); }
      this.cueHover("id" in hit ? `${hit.kind}:${hit.id}` : `panel:${hit.kind}`);
      return;
    }

    const hs = y < SCENE_H ? this.hotspotAt(x + this.cameraX, y) : null;
    this.hoverHotspot = hs?.id ?? null;
    this.cueHover(hs ? `hotspot:${hs.id}` : null);
  }

  /**
   * A new thing under the pointer or the keyboard focus: one very quiet tick, once. The same
   * thing again is silent, so a hand crossing a scene (or a camera sliding under a still
   * pointer) never chatters. Reduced motion leaves the hover cue out; touch has `arm` instead.
   */
  private cueHover(key: string | null): void {
    if (key === this.hoverCueKey) return;
    this.hoverCueKey = key;
    if (!key || this.touch || !cuePlays("hover", this.reduced)) return;
    // The screen may be changing hands under the pointer: no hover feedback over a pause menu,
    // a chart, a conversation's overlay, a cutscene or a curtain.
    if (this.paused || this.cinematic.active || this.won || this.areaCardBusy || this.curtain ||
        this.pendingRoom !== null || this.fade > 0.5 || this.atlas.open || this.casebook.open ||
        this.history.open || this.deeds.open) return;
    this.audio.hover();
  }

  /** next-level: a11y — which top-bar button a point is on, in the same layout it is drawn with. */
  private barHit(x: number, y: number): BarId | null {
    if (this.title || this.won || y < BAR.y || y > BAR.y + BAR.h) return null;
    const boxes = barLayout();
    for (const id of BAR_IDS) {
      const b = boxes[id];
      if (x >= b.x && x <= b.x + b.w) return id;
    }
    return null;
  }

  /**
   * next-level: a11y — what a top-bar button does, whether the pointer pressed its plate or a
   * screen reader pressed the matching DOM button. (The plates are canvas; the DOM is the labels.)
   */
  /** A short establishing card of the area, before its rooms. Title -> macro -> room. */
  private showAreaCard(areaId: string, then: () => void): void {
    const area = ATLAS.find((a) => a.id === areaId);
    if (!area) { then(); return; }
    void this.assets.ensure([area.image]);
    this.clearAreaCard();
    const card = document.createElement("div");
    card.className = "area-card";
    card.innerHTML = `
      <img src="${atlasImageUrl(area.image)}" alt="" />
      <div class="area-card-text">
        <p>ACT ${area.act} · DREADWATER ISLE</p>
        <h1>${escapeHtml(area.name)}</h1>
        <p class="area-card-blurb">${escapeHtml(area.blurb)}</p>
      </div>`;
    document.body.append(card);
    this.areaCard = card;
    this.areaCardBusy = true;
    this.areaCardLeft = 2.55;
    this.areaCardFading = false;
    this.areaCardThen = then;
    requestAnimationFrame(() => card.classList.add("in"));
  }

  /** The establishing card runs on game time, so a paused or scripted tick never strands it. */
  private tickAreaCard(dt: number): void {
    if (!this.areaCardBusy) return;
    this.areaCardLeft -= dt;
    if (!this.areaCardFading && this.areaCardLeft <= 0.45) {
      this.areaCardFading = true;
      this.areaCard?.classList.remove("in");
    }
    if (this.areaCardLeft <= 0) {
      const then = this.areaCardThen;
      this.areaCardThen = null;
      this.clearAreaCard();
      then?.();
    }
  }

  private clearAreaCard(): void {
    this.areaCardLeft = 0;
    this.areaCardFading = false;
    this.areaCardThen = null;
    this.areaCard?.remove();
    this.areaCard = null;
    this.areaCardBusy = false;
  }

  /** The atlas: chart of the island, then the area, then the rooms. */
  private showAtlas(): void {
    if (this.title || this.won || this.paused || this.cinematic.active || this.dialogue || this.queue || this.atlas.open) return;
    // The chart is a full-screen hand-over: opening it while a door is already fading, a room
    // is still swapping, or Fenn is walking to an effect would let that walk (or its `onArrive`)
    // play out unseen behind the chart and leave a queue when it closes. Wait for the scene to
    // settle instead; nothing is cancelled or lost.
    if (this.areaCardBusy || this.pendingRoom !== null || this.curtain || this.fade > 0) return;
    if (this.path.length > 0 || this.onArrive || this.walkGoal || this.running) return;
    this.audio.chart(true);
    this.atlas.show({
      act: this.act,
      room: this.room?.id ?? null,
      visited: (id) => Boolean(this.flags[`visited:${id}`]),
    });
  }

  private travelTo(roomId: string): void {
    const area = areaOfRoom(roomId);
    if (!area || area.act !== this.act || roomId === this.room?.id) return;
    this.path = [];
    this.onArrive = null;
    this.walkGoal = null;
    this.running = false;
    this.clearSentence();
    this.goRoom(roomId, "stairs");
  }

  private barAction(id: BarId): void {
    if (this.cinematic.active) return;
    this.clearTouchArm();
    this.flashBar(id);
    if (id === "pause") {
      if (!this.paused) this.setPaused(true);
      return;
    }
    if (this.title || this.won) return;
    if (id === "map") { this.showAtlas(); return; }
    if (id === "casebook") { this.audio.page(); this.showCasebook(); return; }
    if (id === "log") { this.audio.page(); this.history.show(); return; }
    if (id === "reveal") {
      this.revealToggled = !this.revealToggled;
      this.announce(this.revealToggled ? this.revealSummary() : "Reveal off.");
      this.syncA11yControls();
      return;
    }
    if (id === "tip") {
      // Like H: a tip would talk over a conversation or a line still waiting its turn.
      if (!this.dialogue && !this.queue && !this.inputLocked()) this.showTip();
    }
  }

  /** Whether the reveal outlines are showing (Q held, or the button toggled on). */
  private get revealing(): boolean {
    return (this.revealHeld || this.revealToggled) && !this.title && !this.won && !this.dialogue;
  }
  /** Wake the icon bar and light the button just used, so a shortcut has a visible answer. */
  private flashBar(id: BarId): void {
    this.idle = 0;
    this.barFlash = { id, left: 0.65 };
  }
  private revealSummary(): string {
    const names = this.visibleHotspots().map((h) => this.hotspotState(h).name);
    return names.length
      ? `In ${this.room.name}: ${sentenceEnd(names.join(", "))}`
      : `Nothing to use in ${this.room.name}.`;
  }

  /** A way out: walking to it runs its walk effects (a door, a gangway, the stairs). */
  private isExit(hs: Hotspot): boolean {
    return Boolean(this.hotspotState(hs).do?.walk?.length);
  }

  /**
   * The way out meeting the left or right frame edge under a point near it: a path or doorway
   * painted to run off the picture. Only its own side counts, and a nowalk exit is not a
   * walk-off. Ties go to the exit whose stand is nearest the click.
   */
  private edgeExitAt(x: number, y: number): Hotspot | null {
    const side = x <= EXIT_EDGE_BAND ? "left" : x >= LOGICAL_W - EXIT_EDGE_BAND ? "right" : null;
    if (!side || y < 0 || y >= SCENE_H) return null;
    const edgeX = side === "left" ? this.cameraX : this.cameraX + LOGICAL_W;
    let best: Hotspot | null = null, bestD = Infinity;
    for (const raw of this.visibleHotspots()) {
      const hs = this.hotspotState(raw);
      if (!hs.do?.walk?.length || hs.noWalk) continue;
      const b = areaBox(hs.area);
      // "Touches" means the painted area crosses the frame edge (or reaches within a pixel or
      // two of it); an exit merely near the edge is still only reached by clicking it.
      const meets = side === "left"
        ? b.x <= edgeX + EXIT_EDGE_TOUCH && b.x + b.w >= edgeX
        : b.x + b.w >= edgeX - EXIT_EDGE_TOUCH && b.x <= edgeX;
      if (!meets) continue;
      const stand = hs.stand ?? this.areaStand(hs.area);
      const d = Math.hypot(stand.x - edgeX, stand.y - y);
      if (d < bestD) { bestD = d; best = raw; }
    }
    return best;
  }

  private onClick(x: number, y: number, button: number, clicks = 1): void {
    // next-level: casebook — the deeds page takes the pointer too
    if (this.deeds.open) {
      // It handles its own clicks; a click delivered to the canvas (a dev tool, a scripted
      // playtest) means the same as one on the page: go home.
      this.deeds.hide();
      return;
    }
    if (this.areaCardBusy) { this.clearAreaCard(); return; }
    if (this.paused || this.cinematic.active || this.casebook.open || this.history.open) return;
    if (this.roomMenu) {
      // On a phone the scene list is a DOM sheet; a click on the canvas behind it goes nowhere.
      if (!this.mobile) this.roomMenuClick(x, y);
      return;
    }
    this.audio.unlock();
    this.lastInput = "pointer";
    this.idle = 0;
    this.keyboardFocus = null;
    this.focusCameraX = null;

    // The canvas top bar is not drawn on a phone; the DOM one is. Its old boxes lie over the
    // scene, so a tap near the picture's top must not quietly press Pause.
    const bar = this.mobile ? null : this.barHit(x, y);
    if (bar) {
      // A finger has no hover. The first tap names the plate and the second does its work, the
      // same two-tap grammar a touch player already uses on the scene.
      if (this.touch && this.touchBarArmed !== bar) {
        this.audio.arm();
        this.touchBarArmed = bar;
        this.barLabel = { id: bar, left: 3.2 };
        this.idle = 0;
        this.announce(`${BAR_LABELS[bar]} (${BAR_KEYS[bar]}). Tap again.`);
        return;
      }
      this.touchBarArmed = null;
      this.barAction(bar);
      return;
    }
    this.touchBarArmed = null;
    this.barLabel = null;
    if (this.inputLocked()) return;

    if (this.won) {
      this.advanceEnding();
      return;
    }

    if (this.title) {
      // Right-click is never a menu choice. On the title it must not answer "Begin anew", nor
      // even dismiss the question: the destructive answer has to be a deliberate left click.
      if (button === 2) return;
      // The mobile title menu is DOM; a tap on the painting is not an answer.
      if (this.mobile) return;
      // The second click of a double-click (or a double tap) belongs to the first: it must never
      // answer the question the first one asked.
      if (clicks >= 2) return;
      const hit = this.titleButtons().find((b) => this.hitTitle(b.y, x, y));
      if (hit) this.titleActivate(hit.id);
      else if (this.confirmNew) this.cancelConfirmNew();
      return;
    }

    if (this.narration && this.narration.shown < this.narration.text.length) {
      this.narration.shown = this.narration.text.length;
      this.narrationClock = this.typeTime(this.narration.text.length);
      return;
    }
    if (this.queue) {
      this.flushQueue();
      return;
    }

    if (this.dialogue) {
      if (button === 2) {
        this.leaveDialogue();
        if (!this.dialogue) this.dialogueClosedAt = performance.now();
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
      if (!this.dialogue) this.dialogueClosedAt = performance.now();
      return;
    }
    // The second click of a double-click that closed a conversation is not meant for the scene
    // that has just reappeared under it (it would walk, or run, somewhere).
    if (clicks >= 2 && performance.now() - this.dialogueClosedAt < 500) return;

    const hit = hitTestPanel(x, y, this.panelModel());

    if (button === 2) {
      // Right-click looks at a thing (in the scene or the satchel). Mid-sentence, or on
      // anything else, it cancels.
      this.clearTouchArm();
      const fresh = !this.sentence.verb && !this.sentence.a;
      if (fresh && hit?.kind === "item") {
        this.audio.click();
        this.setVerb("look");
        this.pickItem(hit.id);
        return;
      }
      const look = fresh && y < SCENE_H ? this.hotspotAt(x + this.cameraX, y) : null;
      if (look) {
        this.setVerb("look");
        this.onHotspotClick(look);
        return;
      }
      this.path = []; this.onArrive = null; this.walkGoal = null; this.running = false;
      this.clearSentence();
      return;
    }

    if (hit) {
      this.clearTouchArm();
      this.onPanelHit(hit);
      return;
    }

    if (y >= SCENE_H) return;

    // A finger is not a pixel: a small painted thing still gets a 24 CSS-pixel halo to be
    // tapped in, without changing what a mouse hits.
    const hs = (y < SCENE_H ? this.hotspotAt(x + this.cameraX, y) : null) ??
      (this.touch && y < SCENE_H ? this.nearestHotspotAt(x + this.cameraX, y) : null);
    if (!hs) {
      // Walk-off: floor clicked in the last few pixels beside an exit that meets this edge is
      // that exit's own click. Without this, a painted path running off the frame ends in a
      // walk to the edge and no way through. Respect a sentence being built (the click means
      // that verb instead), input locks (handled above) and exits marked nowalk.
      const edge = this.edgeExitAt(x, y);
      const onFloor = this.room.walk.some((poly) => pointInPoly({ x: x + this.cameraX, y }, poly));
      if (edge && onFloor && !this.sentence.verb && !this.sentence.a && !this.sentence.b) {
        if (this.touch) {
          if (this.touchArmed !== edge.id) this.armTouch(edge);
          else if (performance.now() - this.touchArmedAt >= TOUCH_CONFIRM_MS) {
            this.clearTouchArm();
            this.onHotspotClick(edge, 1);
          }
          return;
        }
        this.onHotspotClick(edge, clicks);
        return;
      }
      this.clearTouchArm();
      const target = clampToFloor({ x: x + this.cameraX, y }, this.room.walk);
      // A double-click, or a second click on where Fenn is already headed, runs.
      const again = this.path.length > 0 && this.walkGoal !== null &&
        Math.hypot(target.x - this.walkGoal.x, target.y - this.walkGoal.y) < 60;
      this.walkTo(target, true);
      if ((clicks >= 2 || again) && this.path.length > 0) this.running = true;
      if (this.path.length > 0) this.fx.ring(target, this.personHeight(target.y));
      return;
    }

    // Touch has no hover: the first tap inspects a thing and lights what a tap would do; a
    // later, separate tap confirms it. A verb already chosen means the player has said what
    // they want. Double taps are never treated as a confirmation: the same gesture that armed
    // the action cannot also spend it.
    if (this.touch && !this.sentence.verb) {
      this.hoverHotspot = hs.id;
      this.hoverDirty = false;
      this.teach("look");
      if (this.touchArmed === hs.id) {
        if (performance.now() - this.touchArmedAt < TOUCH_CONFIRM_MS) return;
        this.clearTouchArm();
        this.onHotspotClick(hs, 1);
        return;
      }
      this.armTouch(hs);
      return;
    }
    this.clearTouchArm();
    this.onHotspotClick(hs, this.touch ? 1 : clicks);
  }


  // ------------------------------------------------------------ touch / mobile

  /**
   * Confirm the action a first tap armed. Used by the DOM action plate as well as the second
   * tap; it re-checks the hotspot is still on screen and that no verb has taken over.
   */
  private confirmTouchArm(): void {
    const id = this.touchArmed;
    if (!id) return;
    if (this.inputLocked() || this.dialogue) { this.clearTouchArm(); return; }
    const hs = this.visibleHotspots().find((candidate) => candidate.id === id);
    this.clearTouchArm();
    if (!hs) return;
    this.hoverHotspot = hs.id;
    this.onHotspotClick(hs, 1);
  }

  /** Show what a first tap on `hs` would do, and wait for a separate confirmation. */
  private armTouch(hs: Hotspot): void {
    this.audio.arm();
    this.hoverHotspot = hs.id;
    this.hoverDirty = false;
    this.touchArmed = hs.id;
    this.touchArmedAt = performance.now();
    const what = this.suggestion();
    this.announce(`${sentenceEnd(hs.name)} Tap again: ${sentenceEnd(what.suggestLine ?? "act")}`);
  }

  /** Let go of an armed action or a half-built sentence from the touch HUD. */
  private cancelTouch(): void {
    this.clearTouchArm();
    this.sentence = { verb: null, a: null, b: null };
    this.committed = null;
    this.hoverHotspot = null;
    this.hoverVerb = null;
    this.hoverItem = null;
  }

  /** The DOM's Continue: reveal a typing line, or let a parked scene run on. */
  private continueStory(): void {
    if (this.narration && this.narration.shown < this.narration.text.length) {
      this.narration.shown = this.narration.text.length;
      this.narrationClock = this.typeTime(this.narration.text.length);
      return;
    }
    if (this.queue) this.flushQueue();
  }

  /** A tap on the conversation sheet: first reveal the line, then advance when it is done. */
  private mobileDialogueTap(): void {
    if (!this.dialogue) return;
    const node = this.currentNode();
    if (node && this.dialogue.shown < node.text.length) {
      this.dialogue.shown = node.text.length;
      return;
    }
    if (this.visibleChoices().length === 0) {
      this.advanceDialogue();
      if (!this.dialogue) this.dialogueClosedAt = performance.now();
    }
  }

  private mobileDialogueChoice(index: number): void {
    if (!this.dialogue) return;
    this.pickChoice(index);
    if (!this.dialogue) this.dialogueClosedAt = performance.now();
  }

  /** "Look at Dock": the same grammar the desktop sentence line uses. */
  private sentenceText(): string {
    const { verb, a, b } = this.sentence;
    if (!verb) return "";
    const def = VERBS.find((v) => v.id === verb);
    const line = [def?.label ?? "", a?.name ?? ""].filter(Boolean).join(" ");
    if (!line) return "";
    const link = verb === "give" ? "to" : "with";
    if (b) return `${line} ${link} ${b.name}`;
    if (def?.twoObject && a) return `${line} ${link} …`;
    return line;
  }

  /** The mobile stage: scene alone in play, the full 16:9 frame for title/cold open/ending. */
  private syncMobileLayout(): void {
    if (!this.mobile || typeof document === "undefined") return;
    const full = this.title || this.won;
    document.body.classList.toggle("m-full", full);
    if (full !== this.mobileFull) {
      this.mobileFull = full;
      this.view.setSceneOnly(!full);
    }
  }

  /** Canvas type for the full-frame screens (the ending) at a phone-readable size. */
  private get mobileTextScale(): number {
    if (!this.mobile) return this.textScale;
    return Math.max(this.textScale, Math.min(3, 15 / Math.max(1, 27 * this.view.scale)));
  }

  /** Everything the touch HUD paints, as plain data: no private methods cross the boundary. */
  private mobileState(): MobileState {
    // The title's buttons are only built while the title is up: `chaptersUnlocked` reads
    // localStorage, and the HUD asks for this state ten times a second during play.
    const menu = this.title ? this.titleButtons() : [];
    const defaultId = menu.length ? defaultTitleButton(menu) : null;
    const confirmWait = this.title && this.confirmNew && performance.now() - this.confirmArmedAt < CONFIRM_GRACE_MS;
    const titleButtons: MobileButton[] = menu.map((b) => ({
      id: b.id,
      label: b.label,
      sub: b.sub,
      kind: b.id === "confirm" ? "danger" : b.id === "explore" ? "quiet" : b.id === defaultId || b.id === "keep" ? "primary" : "quiet",
      disabled: b.id === "confirm" && confirmWait,
    }));

    const dialogue = this.dialogue;
    let dialogueState: MobileState["dialogue"] = null;
    if (dialogue) {
      const node = this.currentNode();
      const choices = this.visibleChoices();
      dialogueState = {
        speaker: characterOf(node?.speaker ?? "").name,
        text: node?.text ?? "",
        shown: dialogue.shown,
        choices: choices.map((c) => ({ text: c.text, seen: Boolean(c.seen) })),
        canAdvance: Boolean(node && dialogue.shown >= node.text.length && choices.length === 0),
      };
    }

    const rawArmed = this.touchArmed
      ? this.visibleHotspots().find((candidate) => candidate.id === this.touchArmed)
      : undefined;
    let armed: MobileState["play"]["armed"] = null;
    if (rawArmed) {
      const hs = this.hotspotState(rawArmed);
      const verb = this.isExit(hs) ? "walk" : this.suggestedVerb(hs);
      const label = VERBS.find((v) => v.id === verb)?.label ?? "";
      armed = {
        label: [label, hs.name].filter(Boolean).join(" "),
        hint: "Tap again in the scene, or tap here",
      };
    }

    const pages = inventoryPages(this.inventory.length);
    const page = Math.min(this.inventoryPage, pages - 1);
    const selected = new Set([this.sentence.a?.id, this.sentence.b?.id].filter((id): id is string => Boolean(id)));
    const act = ACTS[this.act];

    return {
      screen: this.title ? "title" : this.won ? "ending"
        : dialogueState ? "dialogue" : "play",
      blocked: this.paused || this.cinematic.active || this.casebook.open || this.history.open ||
        this.atlas.open || this.deeds.open,
      title: { buttons: titleButtons },
      prologue: {
        text: "", shown: 0, speaker: "", canStamp: false, skippable: false, stamped: false,
      },
      dialogue: dialogueState,
      ending: this.won && this.ending ? { page: this.ending.pageNumber, pages: this.ending.pageCount } : null,
      play: {
        act: act ? `Act ${ROMAN[act.n] ?? act.n}` : "",
        room: this.room?.name ?? "",
        narration: this.narration?.text ?? "",
        narrationShown: this.narration?.shown ?? 0,
        sentence: this.sentenceText(),
        explore: this.explore,
        armed,
        waiting: Boolean(this.queue && this.narration),
        verbs: VERBS.map((v) => ({
          id: v.id,
          label: v.id === "walk" ? "Walk" : v.label,
          active: this.sentence.verb === v.id,
          suggested: !this.sentence.verb && this.suggestion().suggestVerb === v.id,
        })),
        inventory: this.inventory.map((id) => ({
          id,
          name: ITEMS[id]?.name ?? id,
          selected: selected.has(id),
        })),
        page,
        pages,
      },
      reveal: this.revealToggled,
      tip: this.tipMode,
      roomMenu: this.roomMenu ? {
        open: true,
        rooms: this.exploreRooms().map((r) => ({
          id: r.id,
          label: `${r.act ? `Act ${r.act} · ` : ""}${ROOMS[r.id]?.name ?? r.id}`,
        })),
      } : null,
    };
  }

  /** The touch HUD's every action, in one place. */
  private mobileBridge(): MobileBridge {
    return {
      bar: (id) => this.barAction(id),
      verb: (id) => { this.audio.click(); this.setVerb(id); },
      item: (id) => { this.audio.click(); this.pickItem(id); },
      page: (delta) => this.turnPage(delta),
      clear: () => this.clearSentence(),
      confirm: () => this.confirmTouchArm(),
      cancel: () => this.cancelTouch(),
      continueStory: () => this.continueStory(),
      dialogueTap: () => this.mobileDialogueTap(),
      dialogueChoice: (index) => this.mobileDialogueChoice(index),
      title: (id) => this.titleActivate(id),
      prologueStamp: () => {},
      prologueSkip: () => {},
      advanceEnding: () => this.advanceEnding(),
      room: (id) => {
        const at = this.exploreRooms().findIndex((r) => r.id === id);
        if (at >= 0) this.exploreGo(at);
      },
      openRooms: () => {
        if (!this.explore || this.roomMenu) return;
        this.roomMenu = true;
        this.announce("Chapter select.");
      },
      closeRooms: () => {
        if (!this.roomMenu) return;
        this.roomMenu = false;
        this.announce("Chapter select closed.");
      },
      state: () => this.mobileState(),
    };
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
    this.clearTouchArm();
    this.sentence = { verb: null, a: null, b: null };
    this.committed = null;
    this.narration = null;
  }

  /** Forget a touch action that was armed but not confirmed. */
  private clearTouchArm(): void {
    this.touchArmed = null;
    this.touchArmedAt = 0;
  }

  /**
   * The sentence on the line has already been sent off: Fenn is walking over to do it, and it
   * stays on the line until he does. A verb, item or target chosen meanwhile starts a new one
   * rather than finishing that one ("Use crate with crowbar"), and the walk carries out its own.
   */
  private get sentenceSent(): boolean {
    return this.committed !== null && this.committed === this.sentenceKey();
  }
  private startSentence(): void {
    if (this.sentenceSent) {
      this.sentence = { verb: null, a: null, b: null };
      this.committed = null;
    }
  }

  private setVerb(verb: VerbId): void {
    this.clearTouchArm();
    this.startSentence();
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
    this.clearTouchArm();
    this.startSentence();
    this.fx.seen(itemId);
    this.narration = null;
    const name = ITEMS[itemId]?.name ?? itemId;
    const ref: Ref = { kind: "item", id: itemId, name };

    if (!this.sentence.verb) {
      this.sentence.verb = "use";
    }
    const def = VERBS.find((v) => v.id === this.sentence.verb);

    // Two-object verb: the second pick completes the pair.
    if (def?.twoObject && this.sentence.a && this.sentence.a.id !== ref.id) {
      this.sentence.b = ref;
      this.execute();
      return;
    }
    this.sentence.a = ref;
    this.sentence.b = null;
    // The first item taken in hand is the moment Use and Give can be explained: item first,
    // then the thing it acts on. One lesson, once, in the sentence line's own grammar.
    if (def?.twoObject) this.teach("use");
    if (!def?.twoObject) this.execute();
  }

  /**
   * A click on a hotspot. With a verb chosen, that verb; without one, the obvious thing: walk
   * through a way out, otherwise its suggested verb (talk, pick up, open, look). `clicks` is 2
   * for a double-click, which takes a way out at once instead of walking there first.
   */
  private onHotspotClick(hs: Hotspot, clicks = 1): void {
    this.audio.click();
    this.startSentence();
    const state = this.hotspotState(hs);
    let verb = this.sentence.verb;
    if (!verb) {
      verb = this.isExit(state) ? "walk" : this.suggestedVerb(state);
      if (verb !== "walk") this.setVerb(verb);
    }
    if (verb === "walk") {
      const target = hs.stand ?? this.areaStand(hs.area);
      const effects = state.do?.walk;
      const line = state.say.walk;
      if (effects && clicks >= 2) {
        // Double-click a door: out at once.
        this.path = []; this.onArrive = null; this.walkGoal = null; this.running = false;
        this.clearSentence();
        this.goThrough(hs, effects);
        return;
      }
      const again = this.path.length > 0 && this.walkGoal !== null &&
        Math.hypot(target.x - this.walkGoal.x, target.y - this.walkGoal.y) < 2;
      const arrive = effects
        ? () => this.goThrough(hs, effects)
        : line ? () => { this.faceToward(hs); this.speak(line); } : undefined;
      this.walkTo(target, true, arrive);
      if (again && this.path.length > 0) this.running = true;
      return;
    }

    const name = hs.name;
    const ref: Ref = { kind: "hotspot", id: hs.id, name };
    const def = VERBS.find((v) => v.id === verb);

    if (def?.twoObject) {
      // A finished pair still on the line: this click begins the next sentence.
      if (this.sentence.b) this.sentence = { verb, a: null, b: null };
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

  /** Take a way out: its effects run, and the curtain leans toward the door. */
  private goThrough(hs: Hotspot, effects: Effect[]): void {
    this.exitAt = this.areaCentre(hs.area);
    const b = areaBox(hs.area);
    const image = this.assets.img(this.room.bg);
    if (image) {
      // The threshold card is a close-up of the room's own painting held under the fade. It
      // must wear the same `backdrop` grade as the plate behind it, or a brightened room snaps
      // back to its raw exposure as the door opens. `plate()` is that grade, baked once.
      const plate = this.ambient.plate() ?? image;
      this.exitCard = {
        image: plate, imageW: image.naturalWidth, imageH: image.naturalHeight,
        x: b.x, y: b.y, w: b.w, h: b.h,
      };
    }
    // The cue belongs to the room this exit leads to. A `go` may run later, out of the queue,
    // so it is kept by destination instead of on a field a second click could replace.
    const link = linkOf(this.room.id, hs.id);
    const passage = passageOf(this.room.id, hs.id);
    for (const e of effects) if (e.k === "go") {
      this.exitLinks.set(e.room, { from: this.room.id, link, passage, at: this.exitAt });
    }
    this.runEffects(effects);
    this.exitAt = null;
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
      if (verb === "look") {
        // next-level: audio
        if (a.id === "compass") this.audio.compass(this.act);
        this.speak(this.itemLook(a.id));
      } else this.reject(itemAloneLine(verb, this.itemTarget(a.id)));
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
    if (this.committed === key) this.committed = null;
  }

  private runHotspot(verb: VerbId, hs: Hotspot): void {
    const raw = hs;
    hs = this.hotspotState(hs);
    const target = hs.stand ?? this.areaStand(hs.area);
    const key = this.sentenceKey();
    this.committed = key;
    const act = (): void => {
      this.trace?.({ kind: "verb", text: `${VERBS.find((v) => v.id === verb)?.label ?? verb} ${hs.name}`, hotspot: raw });
      if (!hs.noWalk) this.faceToward(hs);
      const line = hs.say[verb];
      const effects = hs.do?.[verb];
      if (verb === "look") this.markLooked(hs.id);

      if (verb === "pickup" && hs.item) {
        const c = this.areaCentre(hs.area);
        this.fx.flight(hs.item, ITEMS[hs.item]?.name ?? hs.item, { x: c.x - this.cameraX, y: c.y },
          ITEM_ICONS.has(hs.item) ? this.assets.img(`item_${hs.item}`) ?? null : null);
        this.giveItem(hs.item);
        this.speak(line ?? `I take ${this.itemPhrase(hs.item)}.`);
        this.audio.pickup();
        effects && this.runEffects(effects);
        this.clearSentenceIfUnchanged(key);
        return;
      }

      const fallback = defaultLine(verb, this.hotspotTarget(hs), verb + hs.id, this.act);
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
    this.committed = key;
    const act = (): void => {
      this.trace?.({ kind: "combo", text: `${VERBS.find((v) => v.id === verb)?.label ?? verb} ${ITEMS[itemId]?.name ?? itemId} ${verb === "give" ? "to" : "with"} ${target.name}`, combo });
      // next-level: audio
      if (itemId === "compass") this.audio.compass(this.act);
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
   * Effects already parked go first: a new list lines up behind them, never replacing them.
   */
  private runEffects(list: Effect[]): void {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const hold = HOLD[e.k];
      const waiting = Boolean(this.queue?.length);
      const due = waiting ? this.queueDue : this.lineDue(e.k);
      if (waiting || (hold !== undefined && this.narration && !this.dialogue && this.narrationClock < due)) {
        const parked: Effect[] = [];
        let ended = false;
        for (const rest of list.slice(i)) {
          if (!ended && STATE.has(rest.k)) this.applyEffect(rest);
          else parked.push(rest);
          if (TERMINAL.has(rest.k)) ended = true;
        }
        this.queue = [...(this.queue ?? []), ...parked];
        this.queueDue = due;
        this.persist();
        return;
      }
      if (this.applyEffect(e)) { this.hoverDirty = true; return; }
    }
    this.hoverDirty = true;
    this.persist();
  }
  private queue: Effect[] | null = null;
  private queueDue = 0;

  /** One effect. Returns true when it ended the list (a door, a conversation, an act's end). */
  private applyEffect(e: Effect): boolean {
    this.trace?.({ kind: "effect", effect: e });
    switch (e.k) {
      case "flag":
        // Only one ending can be chosen. If the player left the last choice after setting one
        // and then came back for the other, the first must not colour the second.
        if (e.v && ENDING_FLAGS.has(e.id)) {
          this.onlyEnding(e.id);
          this.onlyFinalChoice(e.id);
          this.endingChosen = e.id;
        }
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
        this.goRoom(e.room, e.sound);
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
          // next-level: audio + casebook
          this.audio.note();
          this.noteFiled();
        }
        break;
    }
    return false;
  }

  /** Keep `keep` as the only closing choice; the others belong to a choice not taken. */
  private onlyEnding(keep: string): void {
    for (const id of ENDING_FLAGS) if (id !== keep) delete this.flags[id];
  }

  /** Drop the other branch's marker (`curse_broken` / `escaped_fog`) along with its ending. */
  private onlyFinalChoice(ending: string): void {
    const keep = ENDING_COMPANION[ending];
    for (const id of FINAL_CHOICE_FLAGS) if (id !== keep) delete this.flags[id];
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
    this.hoverDirty = true;
    if (ITEM_ICONS.has(id)) void this.assets.ensure([`item_${id}`]);
    if (!this.inventory.includes(id)) {
      this.inventory.push(id);
      this.fx.freshen(id);
      // Flip to the page holding the new item rather than making the player hunt for it.
      this.inventoryPage = Math.floor((this.inventory.length - 1) / INV_PER_PAGE);
    }
    this.syncA11yControls(); // next-level: a11y — pager labels
    this.persist();
  }
  private takeItem(id: string): void {
    this.hoverDirty = true;
    this.inventory = this.inventory.filter((i) => i !== id);
    this.inventoryPage = Math.min(this.inventoryPage, this.pageCount() - 1);
    this.syncA11yControls(); // next-level: a11y — pager labels
    this.persist();
  }
  /** Inventory icons are lazy too: ask for the ones the satchel is about to draw. */
  private warmInventoryIcons(): void {
    const keys = this.inventory.filter((id) => ITEM_ICONS.has(id)).map((id) => `item_${id}`);
    if (keys.length) void this.assets.ensure(keys);
  }

  // ------------------------------------------------------------ dialogue

  private startDialogue(treeId: string, nodeId?: string): void {
    this.clearTouchArm();
    const tree = DIALOGUES[treeId];
    if (!tree) return;
    const start = nodeId && tree.nodes[nodeId] ? nodeId : tree.start;
    this.narration = null;
    this.keyboardFocus = null;
    if (!this.dialogue) this.stage.reset();
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
    this.history.add({ speaker: characterOf(node.speaker).name, text: node.text });
    this.hoverChoice = -1;
    this.frameConversation(node.speaker);
    const now = node.do?.filter((e) => !TERMINAL.has(e.k));
    if (now?.length) this.runEffects(now);
    this.announceNode();
  }

  /** Close the conversation from the node on screen, running whatever its ending holds. */
  private endDialogue(): void {
    const node = this.currentNode();
    this.dialogue = null;
    this.afterConversation();
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
    this.afterConversation();
    this.persist();
  }

  /**
   * Bring the speaker and Fenn into view together (or the speaker alone, if they stand too far
   * apart). Someone speaking from off-stage, or the narrator, leaves the camera where it is.
   */
  private frameConversation(speaker: string): void {
    const sprite = speaker === "fenn" ? null : this.speakerSprite(speaker);
    if (!sprite) return;
    const far = Math.abs(sprite.x - this.x) > LOGICAL_W * 0.7;
    this.cameraHold = far ? sprite.x : (sprite.x + this.x) / 2;
  }
  /** After a conversation the camera stays where it is: the next click is aimed at this view. */
  private afterConversation(): void {
    this.cameraHold = this.cameraX + LOGICAL_W / 2;
    this.hoverDirty = true;
  }
  /** The figure in this room who speaks as `speaker`, if one is showing. */
  private speakerSprite(speaker: string): SceneSprite | null {
    return this.room.sprites?.find((s) => s.speaker === speaker && this.spriteShown(s)) ?? null;
  }
  private spriteShown(s: SceneSprite): boolean {
    const hs = s.hotspot ? this.room.hotspots.find((h) => h.id === s.hotspot) : undefined;
    if (hs?.showIf && !hs.showIf.every((c) => this.check(c))) return false;
    return !s.showIf || s.showIf.every((c) => this.check(c));
  }
  /** The spotlight on whoever is talking: their head and shoulders, above the dialogue panel. */
  private speakerSpot(): Spot | null {
    const node = this.currentNode();
    if (!node) return null;
    let x: number, y: number, h: number;
    if (node.speaker === "fenn") {
      x = this.x; y = this.y; h = this.personHeight(this.y);
    } else {
      const s = this.speakerSprite(node.speaker);
      if (!s) return null;
      x = s.x; y = s.y; h = this.personHeight(s.y) * s.size;
    }
    return { x: x - this.cameraX, y: y - h * 0.7, rx: Math.max(110, h * 0.46), ry: Math.max(150, h * 0.62) };
  }
  /** Conversations where nobody has a portrait use the whole panel width. */
  private portraitColumns = new Map<string, boolean>();
  private hasPortraits(tree: DialogueTree): boolean {
    let yes = this.portraitColumns.get(tree.id);
    if (yes === undefined) {
      yes = Object.values(tree.nodes).some((n) => Boolean(characterOf(n.speaker).portrait));
      this.portraitColumns.set(tree.id, yes);
    }
    return yes;
  }

  /** `seen:<tree>.<node>` lets later options appear only once the player has heard something. */
  private markSeen(treeId: string, nodeId: string): void {
    const node = DIALOGUES[treeId]?.nodes[nodeId];
    if (node) this.trace?.({ kind: "node", tree: treeId, node });
    this.flags[`seen:${treeId}.${nodeId}`] = true;
    this.autosaveSoon();
  }
  /** `looked:<room>.<hotspot>`: the player has looked at it (some things change once seen). */
  private markLooked(hotspotId: string): void {
    this.flags[`looked:${this.room.id}.${hotspotId}`] = true;
    this.autosaveSoon();
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
    const options = this.visibleChoices()
      .map((c, i) => `${i + 1}. ${sentenceEnd(c.text)}${c.seen ? " (asked before)" : ""}`).join(" ");
    this.announce(`${who ? who + ": " : ""}${sentenceEnd(node.text)}${options ? " " + options : ""}`);
  }

  /**
   * The choices on offer. `seen` marks one whose answer the player has already heard, so a menu
   * that comes round again shows what's been asked (going back to the start isn't an answer).
   */
  private visibleChoices(): { text: string; index: number; seen: boolean }[] {
    const node = this.currentNode();
    const tree = this.dialogue?.tree;
    if (!node?.choices || !tree) return [];
    const out: { text: string; index: number; seen: boolean }[] = [];
    node.choices.forEach((c, i) => {
      if (c.if && !c.if.every((cond) => this.check(cond))) return;
      const answer = c.to && c.to !== "END" && c.to !== tree.start && c.to !== node.id && tree.nodes[c.to];
      out.push({ text: c.text, index: i, seen: Boolean(answer) && this.flags[`seen:${tree.id}.${c.to}`] === true });
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
    this.audio.choice();
    this.trace?.({ kind: "choice", tree: tree.id, choice });
    this.history.add({ speaker: characterOf("fenn").name, text: choice.text, choice: true });

    if (choice.do) this.runEffects(choice.do);
    // An effect that took over (another conversation, the end of an act) has the last word.
    if (this.dialogue !== current) return;
    if (choice.to === "END" || !choice.to || !tree.nodes[choice.to]) {
      this.dialogue = null;
      this.afterConversation();
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
    this.audio.advance();
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
    this.narration = { text, shown: this.textSpeed === "instant" ? text.length : 0 };
    this.narrationClock = 0;
    const tip = /^Tip: /.test(text);
    this.history.add({ speaker: tip ? "Tip" : characterOf("fenn").name, text: tip ? text.slice(5) : text });
    this.announce(text);
  }

  /**
   * Mirror text into an aria-live region: the canvas is opaque to a screen reader. Everything
   * announced in one turn (a room's name, then its opening line) is read together.
   */
  private announce(text: string): void {
    if (!this.live && typeof document !== "undefined") this.live = document.getElementById("sr");
    if (!this.live) return;
    if (!this.announcing.length) {
      queueMicrotask(() => {
        if (this.live) this.live.textContent = this.announcing.join(" ");
        this.announcing = [];
      });
    }
    this.announcing.push(text);
  }
  private announcing: string[] = [];

  private reject(text: string): void {
    this.speak(text);
    this.audio.deny();
    this.rejection = 0.38;
  }

  private clearSentenceKeepingNarration(): void {
    this.sentence = { verb: null, a: null, b: null };
    this.committed = null;
  }

  // ------------------------------------------------------------ movement

  private walkTo(target: Pt, clearSentence: boolean, onArrive?: () => void): void {
    const from = { x: this.x, y: this.y };
    this.path = this.mesh.path(from, target);
    // Fenn is off somewhere: the camera follows him again.
    if (this.path.length) this.cameraHold = null;
    this.walkGoal = this.path.length ? target : null;
    this.running = false;
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
    this.tick++;
    this.syncA11yVisibility();
    // The icon bar is quiet chrome: it stays up for a few seconds after use, then settles to a
    // low alpha until the pointer or a key wakes it. Its hit boxes never move or go away.
    this.idle = Math.min(this.idle + dt, 600);
    if (this.barFlash && (this.barFlash.left -= dt) <= 0) this.barFlash = null;
    if (this.barLabel && (this.barLabel.left -= dt) <= 0) this.barLabel = null;
    // The first-watch plates ride the game clock, but never under a card, a conversation, a
    // cutscene, a pause or a curtain: they wait for the moment the screen is plainly playable.
    const lessonsFrozen = this.title || this.won || this.paused || this.cinematic.active ||
      this.areaCardBusy || Boolean(this.dialogue) || Boolean(this.queue) || this.explore || this.fade > 0.5;
    this.watch.tick(dt, lessonsFrozen);
    const barHot = this.barHit(this.input.x, this.input.y);
    // The bar is quiet chrome, not invisible chrome. It drops to BAR_IDLE_ALPHA when untouched,
    // and wakes for the pointer, a finger, a lesson or a note.
    const barWant = this.paused || this.cinematic.active || barHot || this.noteGlow > 0 ||
      this.barLabel || this.touchBarArmed || this.watch.current || this.idle < 3.5 ? 1 : BAR_IDLE_ALPHA;
    this.barFade += (barWant - this.barFade) * Math.min(1, dt * (barWant < this.barFade ? 2.4 : 8));
    this.tickAreaCard(dt);
    // The establishing card holds the scene under it, so no opening line plays unseen.
    if (this.areaCardBusy) return;
    if (this.paused || this.cinematic.active) return;
    // First watch: a pointer that rests on a thing gets taught what a right-click is; resting on
    // something that can be picked up also names taking. Both are offered once, then never again.
    const resting = !this.touch && this.lastInput === "pointer" && Boolean(this.hoverHotspot) &&
      !this.inputLocked() && !this.dialogue;
    if (resting && (!this.watch.learnt("look") || !this.watch.learnt("take"))) {
      this.hoverDwell += dt;
      if (this.hoverDwell > 0.65) {
        this.teach("look");
        const raw = this.room.hotspots.find((h) => h.id === this.hoverHotspot);
        if (raw && this.hotspotState(raw).do?.pickup?.length) this.teach("take");
      }
    } else {
      this.hoverDwell = 0;
    }
    this.rejection = Math.max(0, this.rejection - dt);
    // fade
    if (this.fade !== this.fadeTarget) {
      const dir = Math.sign(this.fadeTarget - this.fade);
      this.fade = Math.max(0, Math.min(1, this.fade + dir * dt * 2.2));
    }

    // Room swap happens at full black, driven by the game clock. A cut with no shared threshold
    // holds the curtain a little longer for a short passage shot, then swaps at the end of it.
    if (this.pendingRoom && this.fade >= 0.999) {
      const id = this.pendingRoom;
      if (this.pendingPassage) {
        if (!this.connector.active) {
          this.connector.begin(this.pendingPassage.kind, this.pendingPassage.side, this.room.id, id);
        }
        if (this.connector.update(dt)) {
          this.connector.end();
          this.enterPendingRoom();
        }
      } else {
        this.enterPendingRoom();
      }
    }
    if (this.curtain && this.fade >= 0.999) {
      const then = this.curtain;
      this.curtain = null;
      then();
      this.fade = 1;
      this.fadeTarget = 0;
    }
    this.fx.update(dt);
    this.ending?.update(dt);

    // Hold the curtain while a room's art is still streaming in, but never forever: a missing
    // file must not lock the screen black.
    if (!this.title && !this.curtain && !this.roomReady()) {
      this.roomWait += dt;
      if (this.roomWait < 8) {
        this.fade = 1;
        this.fadeTarget = 0;
      }
    } else {
      this.roomWait = 0;
    }

    // The room's ambience follows the camera even on the title screen (music plays there).
    this.audio.frame(this.cameraX + LOGICAL_W / 2, this.dialogue !== null);
    if (this.title) {
      this.titleClock += dt;
      return;
    }
    // The first-entry pulse is spent only while the scene is plainly playable: a conversation,
    // cutscene, pause, fade or held Q leaves it waiting rather than burning it unseen.
    if (this.exitIntro > 0 && !this.dialogue && !this.paused && !this.cinematic.active &&
        !this.won && this.fade < 0.5 && !this.revealing) {
      this.exitIntro = Math.max(0, this.exitIntro - dt);
    }
    // (r3-robust replaced the old `saveWarning` line with a banner: see saveNotice below.)
    this.updateSpeech(dt);

    // A save notice counts down only while it can be read; flags with nothing else to save get
    // a save of their own shortly.
    if (this.saveNotice && this.saveNoticeShown() && (this.saveNotice.left -= dt) <= 0) this.saveNotice = null;
    // next-level: casebook — the filed-note banner and the button's glow
    // The filed-note banner counts down only while it can be read; the glow counts down on the
    // chrome, which is on screen even under a conversation (but not under a cutscene or pause).
    if (this.noteToast && this.noteToastShown() && (this.noteToast.left -= dt) <= 0) this.noteToast = null;
    if (this.noteGlow > 0 && !this.title && !this.won && !this.paused && !this.cinematic.active) {
      this.noteGlow = Math.max(0, this.noteGlow - dt);
    }
    if (this.autosaveIn > 0 && (this.autosaveIn -= dt) <= 0) this.persist();

    // narration typewriter
    if (this.narration) {
      this.narrationClock += dt;
      const cps = NARRATION_CPS[this.textSpeed];
      this.narration.shown = !Number.isFinite(cps)
        ? this.narration.text.length
        : Math.min(this.narration.text.length, Math.floor(this.narrationClock * cps) + 1);
    }

    // dialogue typewriter
    if (this.dialogue) {
      const cps = DIALOGUE_CPS[this.textSpeed];
      this.dialogue.shown = Number.isFinite(cps) ? this.dialogue.shown + dt * cps : 1e6;
    }

    // Parked effects run once the line has been read — or, with "wait for click", on a click.
    const waitForClick = this.prefs.waitForClick && this.narration !== null;
    if (this.queue && !waitForClick && (!this.narration || this.narrationClock >= this.queueDue)) {
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
          this.walkGoal = null;
          this.running = false;
          cb?.();
        }
      } else {
        this.chooseDirection(dt);
        // Screen pixels per body height along this heading: full size across, foreshortened in depth.
        const ux = dx / d, uy = dy / d;
        const metric = Math.hypot(ux, uy / DEPTH_SPEED);
        const speed = WALK_SPEED * (this.running ? RUN_FACTOR : 1);
        const step = Math.min(d, (speed * dt * this.personHeight(this.y)) / metric);
        this.x += ux * step;
        this.y += uy * step;
        const beat = Math.floor(this.walkPhase / (STRIDE / 2));
        this.walkPhase += (step * metric) / this.personHeight(this.y);
        if (Math.floor(this.walkPhase / (STRIDE / 2)) !== beat) {
          // Panned to where Fenn is on screen, and quieter the further back he walks.
          const depth = 1 - this.personHeight(this.y) / this.personHeight(SCENE_H);
          this.audio.step(((this.x - this.cameraX) / LOGICAL_W) * 2 - 1, depth, this.running);
        }
      }
    } else {
      this.walkPhase = 0;
    }

    const maxCamera = Math.max(0, (this.room.width ?? LOGICAL_W) - LOGICAL_W);
    let cameraTarget = this.cameraX;
    const cameraWas = this.cameraX;
    if (this.focusCameraX !== null) {
      cameraTarget = this.focusCameraX - LOGICAL_W / 2;
    } else if (this.cameraHold !== null) {
      cameraTarget = this.cameraHold - LOGICAL_W / 2;
    } else {
      const screenX = this.x - this.cameraX;
      if (screenX > LOGICAL_W * 0.62) cameraTarget = this.x - LOGICAL_W * 0.62;
      if (screenX < LOGICAL_W * 0.38) cameraTarget = this.x - LOGICAL_W * 0.38;
    }
    cameraTarget = Math.max(0, Math.min(maxCamera, cameraTarget));
    // Reduced motion: the view cuts to where it's going rather than gliding across the room.
    if (this.reduced) this.cameraX = cameraTarget;
    else this.cameraX += (cameraTarget - this.cameraX) * Math.min(1, dt * 5);
    if (Math.abs(cameraTarget - this.cameraX) < 0.05) this.cameraX = cameraTarget;
    // The scene slid under a still pointer: what it's over may have changed.
    if (Math.abs(this.cameraX - cameraWas) > 0.5) this.hoverDirty = true;

    if (this.dialogue) {
      const m = this.dialogueModel(this.frameChoices());
      this.stage.update(dt, m.layout, m.portrait, this.speakerSpot(), this.reduced);
    }
    if (this.hoverDirty) this.refreshHover();
  }

  /**
   * Hit-test the pointer again where it stands, without it moving: after a pickup takes the
   * thing away, an item is used up, or the camera slides. Keyboard focus is left alone.
   */
  private refreshHover(): void {
    this.hoverDirty = false;
    if (!this.pointerSeen || this.touch || this.lastInput !== "pointer" || this.title || this.won || this.dialogue) return;
    const { x, y } = this.input;
    this.hoverVerb = null;
    this.hoverItem = null;
    this.hoverHotspot = null;
    const hit = hitTestPanel(x, y, this.panelModel());
    if (hit?.kind === "verb") this.hoverVerb = hit.id;
    else if (hit?.kind === "item") this.hoverItem = hit.id;
    else if (!hit && y < SCENE_H) this.hoverHotspot = this.hotspotAt(x + this.cameraX, y)?.id ?? null;
    // The scene moved out from under a still pointer: start the hover cue clean, so coming
    // back to the same thing is a new arrival rather than a suppressed repeat.
    if (!this.hoverVerb && !this.hoverItem && !this.hoverHotspot) this.hoverCueKey = null;
  }

  // ------------------------------------------------------------ rooms

  /**
   * Enter a room. Without `pos` the player appears at the door from the previous room, or at the
   * room's entry when `atEntry` is set (or there's no such door). `scenes: false` skips the
   * arrival scenes (Continue resuming a saved queue: it is their continuation).
   */
  private loadRoom(id: string, pos?: Pt, opts: { atEntry?: boolean; scenes?: boolean } = {}): void {
    const room = ROOMS[id];
    if (!room) return;
    const from = opts.atEntry ? undefined : this.room?.id;
    this.room = room;
    if (!this.title) this.flags[`visited:${id}`] = true;
    this.ambient.setRoom(room);
    this.trace?.({ kind: "room", room: id });
    this.mesh = new WalkMesh(room.walk, room.width ?? LOGICAL_W, SCENE_H);
    this.roomWait = 0;
    // Lazy loading: ask for this room's plate, sprites and portraits now. The curtain stays
    // down until they arrive (roomReady), and the loader retries a flaky image before falling
    // back, so a slow or missing plate cannot leave the room black.
    void this.assets.ensure(roomImageKeys(room));
    // Arrive at the door we came through; saved positions may predate a floor change.
    const start = clampToFloor(pos ?? (from ? room.arrive?.[from] : undefined) ?? room.entry, room.walk);
    this.x = start.x;
    this.y = start.y;
    const maxCamera = Math.max(0, (room.width ?? LOGICAL_W) - LOGICAL_W);
    this.cameraX = Math.max(0, Math.min(maxCamera, this.x - LOGICAL_W / 2));
    this.focusCameraX = null;
    this.cameraHold = null;
    this.hoverDirty = true;
    this.fx.clear();
    this.path = [];
    this.onArrive = null;
    this.sentence = { verb: null, a: null, b: null };
    this.keyboardFocus = null;
    this.hoverHotspot = null;
    this.hoverCueKey = null;
    this.clearTouchArm();
    this.walkGoal = null;
    this.running = false;
    if (!this.title) this.announce(`${room.name}.`);
    if (room.music) this.audio.playMusic(room.music);
    this.audio.setRoom({
      ambience: room.ambience, roomTone: roomToneFor(room.id) ?? undefined,
      footsteps: room.footsteps, emitters: room.emitters,
    });
    this.persist();
    // The title only borrows the harbour's painting, music and ambience as a backdrop. Its
    // arrival scene belongs to the voyage: running it here would set `dock_landed`, speak the
    // boatman's lines to a screen reader (and the log) before the player has chosen anything,
    // and then skip the scene for the voyage that actually starts. `onEnter` is skipped for the
    // same reason: the title's backdrop must not change story state.
    if (!this.title) {
      if (room.onEnter) this.runEffects(room.onEnter);
      // Story scenes belong to the voyage, not to Explore Scenes.
      const scene = this.explore || opts.scenes === false ? undefined : room.scenes?.find((sc) => sc.if.every((c) => this.check(c)));
      if (scene) this.runEffects(scene.do);
    }
    // First entry in this session: breathe the ways out once so they are noticed, unless the
    // room has too many to read as a hint or this load is only the title's backdrop. The timer
    // is held by update() while a conversation or cutscene has the screen.
    this.exitIntro = 0;
    if (!this.title) {
      const exits = this.visibleHotspots().filter((hs) => this.isExit(hs));
      if (!this.exitIntroSeen.has(id) && exits.length > 0 && exits.length <= EXIT_INTRO_MAX) {
        this.exitIntro = EXIT_INTRO_TIME;
      }
      this.exitIntroSeen.add(id);
    }
  }

  private goRoom(id: string, sound?: Extract<Effect, { k: "go" }>["sound"]): void {
    // Whatever the player was walking to belongs to the room being left.
    this.path = [];
    this.onArrive = null;
    this.persist();
    this.audio.door(sound);
    // The air changing under the door's own sound; a plain walk out in the open has no threshold.
    if (sound !== "none" && cuePlays("threshold", this.reduced)) this.audio.threshold();
    // Fetch the next room's art while the curtain falls.
    const next = ROOMS[id];
    if (next) void this.assets.ensure(roomImageKeys(next));
    // The exit cue: which side we left by, and whether this cut needs a passage shot. A cue
    // only applies if it came from the room we are standing in now.
    const cue = this.exitLinks.get(id) ?? null;
    this.exitLinks.delete(id);
    const current = cue && cue.from === this.room.id ? cue : null;
    this.pendingEntry = entrySideFor(current?.link ?? null);
    this.pendingPassage = current?.passage && current.link && !this.reduced
      ? { kind: current.passage, side: current.link.side }
      : null;
    // A `go` queued behind a line still knows the threshold it came from.
    this.transition.leave(current?.at ?? this.exitAt);
    this.fadeTarget = 1;
    this.pendingRoom = id;
  }

  /** The swap itself, at full black: load the room, then start its entry reveal. */
  private enterPendingRoom(): void {
    const id = this.pendingRoom;
    if (!id) return;
    this.pendingRoom = null;
    this.pendingPassage = null;
    this.loadRoom(id);
    this.exitCard = null;
    this.transition.arrive(
      { x: this.x, y: this.y - this.personHeight(this.y) * 0.5 },
      this.pendingEntry,
    );
    this.pendingEntry = null;
    this.fadeTarget = 0;
  }
  private pendingRoom: string | null = null;
  /** The painted threshold the player is passing through, held during the curtain (fade.ts). */
  private exitCard: ExitCardSource | null = null;

  // ------------------------------------------------------------ save

  /**
   * `at` overrides where the save puts the player (used when an act ends mid-cinematic). After
   * the ending nothing is written: the save stays just before the final choice.
   */
  private persist(at?: { room: string; pos?: { x: number; y: number }; actStarted?: boolean }): void {
    this.autosaveIn = 0;
    if (this.title || this.explore || this.won) return;
    // Another tab owns the notebook now. Writing would silently erase its page; the notice tells
    // the player to reload instead. An explicit new/continued voyage clears the block.
    if (this.foreignSave) return;
    const pos = at ? (at.pos ?? ROOMS[at.room].entry) : { x: this.x, y: this.y };
    const data: SaveData = {
      version: SAVE_VERSION,
      room: at?.room ?? this.room.id,
      x: pos.x,
      y: pos.y,
      facing: this.facing,
      // The save is the moment *before* the last choice. Its answer must be made again on
      // Continue, so the ending flags never ride along — not even for a second.
      flags: withoutEndingFlags(this.flags, ENDING_RESET_FLAGS),
      inventory: this.inventory,
      act: this.act,
      notes: this.notes,
      actStarted: at?.actStarted ?? true,
      // next-level: recap — what the Continue card remembers: the hint he had, and when.
      tip: this.tipLadder.shown(),
      at: Date.now(),
    };
    // A pending `win` is not persisted: the save is the moment before the final choice, and a
    // Continue must make that choice rather than roll credits from a half-played queue.
    const queue = this.queue?.filter((e) => e.k !== "win");
    if (queue?.length && !at) data.queue = queue;
    if (writeSave(data)) {
      this.hasSave = true;
      this.saveBroken = false;
      this.audio.saved();
    } else {
      // Quota or blocked storage. Say so once, in character, rather than losing the voyage quietly.
      if (!this.saveBroken) {
        this.saveBroken = true;
        this.showSaveNotice(
          "I try to write the day down and the page won't take ink. Something is wrong with the " +
          "ink — my progress is not being saved.");
      }
    }
  }

  /** Save soon: something changed that no save is on its way for (a `seen:` or `looked:` flag). */
  private autosaveSoon(): void {
    if (this.autosaveIn <= 0) this.autosaveIn = AUTOSAVE_DELAY;
  }
  /**
   * Write a waiting save now (the tab is going away) — only a waiting one: during an act's
   * cinematics the save already holds the next act's start, and must keep it.
   */
  private flushAutosave(): void {
    if (this.autosaveIn > 0) this.persist();
  }

  /** Another tab wrote (or removed) shared storage. Only a save write is a conflict. */
  private onStorage(event: StorageEvent): void {
    this.hasPrevious = hasStashedSave();
    if (this.tabGuard.observe(event)) {
      this.foreignSave = true;
      if (this.title) {
        // Nothing is at risk on the title yet; just offer the page they wrote.
        this.hasSave = hasAnySave();
        this.continueLabel = this.hasSave ? this.saveLabel(" ·") : null;
        return;
      }
      if (!this.foreignSaveWarned) {
        this.foreignSaveWarned = true;
        // Sticky: it must still be up after a conversation or a fade, since from now on this
        // tab is deliberately not saving.
        this.showSaveNotice(
          "Another window has written in this notebook. I won't ink over their page from here — " +
          "reload this page to take up where they left off.", true);
      }
    }
  }

  /** This tab is deliberately taking up (or starting) a voyage: it may write again. */
  private clearForeignSave(): void {
    if (this.foreignSave) this.saveNotice = null;
    this.foreignSave = false;
    this.foreignSaveWarned = false;
    this.tabGuard.clear();
  }

  /** Put a save problem up in its banner; it's in the log (L) and read out too. */
  private showSaveNotice(text: string, sticky = false): void {
    this.audio.error();
    this.saveNotice = { text, left: sticky ? 1e9 : Math.max(SAVE_NOTICE_MIN, (2 * text.length) / READ_CPS) };
    this.history.add({ speaker: characterOf("fenn").name, text });
    this.announce(text);
  }
  /** Whether the save banner can be seen: not under a conversation, the ending or the curtain. */
  private saveNoticeShown(): boolean {
    return !this.title && !this.dialogue && !this.won && this.fade < 0.5 &&
      !this.casebook.open && !this.history.open;
  }
  // next-level: casebook — note toast, drawn in the save notice's geometry in gold
  /** A note effect filed something new: the paper sound, the banner, and the button's glow. */
  private noteFiled(): void {
    this.noteToast = { left: NOTE_TOAST_TIME };
    this.noteGlow = NOTE_TOAST_TIME;
    this.audio.page();
  }
  /** Whether the filed-note banner can be seen: not over a conversation, a cutscene or a page. */
  private noteToastShown(): boolean {
    return !this.title && !this.dialogue && !this.won && !this.paused && !this.cinematic.active &&
      this.fade < 0.5 && !this.casebook.open && !this.history.open && !this.deeds.open;
  }
  /** The save banner: the tip line's style under the top bar (below the tip line when it's on). */
  private drawSaveNotice(ctx: CanvasRenderingContext2D): void {
    if (!this.saveNotice || !this.saveNoticeShown()) return;
    const size = Math.round(20 * this.textScale), lh = Math.round(27 * this.textScale);
    const style = { size, color: "#f3e6cf", weight: "normal", shadow: false };
    let y = BANNER_Y;
    if (this.tipMode) y += this.tipBannerHeight(ctx);
    const lines = wrap(ctx, this.saveNotice.text, 1830, style);
    const h = lines.length * lh + Math.round(17 * this.textScale);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.saveNotice.left / 0.4);
    ctx.font = `${size}px Georgia, serif`;
    const w = Math.min(1872, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40);
    ctx.fillStyle = "rgba(5,13,22,0.92)";
    ctx.fillRect(24, y, w, h);
    ctx.fillStyle = "#d9785a";
    ctx.fillRect(24, y, 3, h);
    lines.forEach((line, i) => drawText(ctx, line, 44, y + Math.round(10 * this.textScale) + i * lh, style));
    ctx.restore();
  }

  private loadGame(): void {
    this.queue = null;
    const { data: d, raw, corrupt, future, futureVersion, migratedFrom } = readSave(KNOWN);
    if (future) {
      // A newer copy of the game wrote this page. Do not reinterpret it: keep the raw page, then
      // begin clean. The archive is the only copy, and it is never overwritten.
      if (raw) archiveSave(raw, "future", undefined, futureVersion);
      clearSave();
      this.clearForeignSave();
      this.newGame();
      this.showSaveNotice(
        "This page was written by a newer copy of the game, so I can't read it as mine. I've " +
        "kept it safe and begun a fresh one.");
      return;
    }
    if (!d) {
      if (!corrupt) return this.loadOldSave();
      // Keep the unreadable save instead of overwriting it, and tell the player.
      if (raw) backupCorrupt(raw);
      clearSave();
      this.clearForeignSave();
      this.newGame();
      this.showSaveNotice(
        "The last page of my notebook is ruined — the save couldn't be read. I've kept it aside " +
        "and started a fresh page.");
      return;
    }
    // Keep the exact page the old shape was read from; migrating in memory must not lose what
    // this build doesn't understand.
    if (raw && migratedFrom !== undefined) archiveSave(raw, "migrated", undefined, migratedFrom);
    this.clearForeignSave();
    this.resetState();
    this.inventory = d.inventory;
    this.warmInventoryIcons();
    this.flags = d.flags;
    this.facing = d.facing;
    this.act = d.act;
    this.notes = d.notes;
    const pos = d.x !== undefined && d.y !== undefined ? { x: d.x, y: d.y } : ROOMS[d.room].entry;
    // A saved queue is the rest of whatever was playing, often this room's arrival scene: that
    // must not start over underneath it.
    this.loadRoom(d.room, pos, { scenes: !(d.queue && d.actStarted !== false) });
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

  /**
   * Content changed under older saves, so keep their progress but restart their act — without
   * the flags that act sets itself, which would say its one-shot sources are spent.
   */
  private loadOldSave(): void {
    // A save from the previous game (or an older shape) cannot be carried into this voyage:
    // its rooms, flags and one-shot sources are gone. Archive its raw page, then start the new
    // story; takeOldSave does both, so the page survives even though the voyage cannot.
    const raw = takeOldSave();
    this.clearForeignSave();
    this.newGame();
    if (raw) this.showSaveNotice("The old voyage is over. Its page is kept in the archive; a new one begins.");
  }

  private beginNewVoyage(): void {
    // The title is the island chart; the harbour's establishing card plays over the started
    // room (its opening scene waits under the card), then the first line.
    // Keep the voyage this replaces, so the title can offer it back.
    this.hasPrevious = stashCurrentSave() || this.hasPrevious;
    this.clearForeignSave();
    this.playIntro();
    const first = areaOfRoom(ACTS[1]?.start.room ?? "");
    if (first) this.showAreaCard(first.id, () => {});
  }

  /** The opening film, then a clean voyage. Title stays up (and nothing saves) until it ends. */
  private playIntro(): void {
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
    // Only an act that exists can end; the ending card comes from the last act ending.
    if (!ACTS[n]) {
      console.warn(`completeAct: there is no act ${n}`);
      return;
    }
    const next = ACTS[n + 1];
    this.resetTransient();
    if (!next) {
      // The last act built: its outro still plays, then the ending card. The save stays just
      // before the final choice, so nothing still waiting to be written may land now.
      this.autosaveIn = 0;
      const last = ACTS[n]?.outro;
      if (last) this.cinematic.play(last, () => this.win());
      else this.win();
      return;
    }
    // Save at the next act's start, so quitting during the cinematics resumes there.
    this.act = n + 1;
    if (next.inventory) this.inventory = [...next.inventory];
    this.persist({ room: next.start.room, pos: next.start.pos, actStarted: false });

    const nextArea = areaOfRoom(next.start.room);
    const begin = (): void => {
      this.startAct(n + 1);
      if (nextArea) this.showAreaCard(nextArea.id, () => {});
    };
    const enter = (): void => {
      if (next.intro) this.cinematic.play(next.intro, begin);
      else begin();
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
    this.warmInventoryIcons();
    this.loadRoom(def.start.room, def.start.pos ?? ROOMS[def.start.room].entry);
    this.fade = 1;
    this.fadeTarget = 0;
    if (def.caption) this.speak(def.caption);
    if (def.onStart) this.runEffects(def.onStart);
    this.persist();
  }

  /** Drop anything in flight: conversations, parked effects, walks and fades. */
  private resetTransient(): void {
    this.clearTouchArm();
    this.clearAreaCard();
    this.queue = null;
    this.dialogue = null;
    this.narration = null;
    this.path = [];
    this.onArrive = null;
    this.pendingRoom = null;
    this.pendingPassage = null;
    this.pendingEntry = null;
    this.exitLinks.clear();
    this.connector.end();
    // A first-entry pulse belongs to the room it was started in, not to whatever comes next.
    this.exitIntro = 0;
    // A curtain still waiting to fire must not outlive the reset: inputLocked() would stay true
    // forever and the screen would stay dark (fuzz: input-locked>10s).
    this.curtain = null;
    this.transition.clear();
    this.fx.clear();
    this.fade = this.fadeTarget = 0;
  }

  /** A clean voyage: nothing carried, nothing known, and out of Explore Scenes. */
  private resetState(): void {
    this.resetTransient();
    // A new voyage is a new session for the way-out hints.
    this.exitIntroSeen.clear();
    this.explore = false;
    this.roomMenu = false;
    this.won = false;
    this.announcedEnding = false;
    this.endingChosen = null;
    // next-level: casebook
    this.deedsShown = false;
    this.inventory = [];
    this.inventoryPage = 0;
    this.flags = {};
    this.notes = [];
    this.noteToast = null;
    this.noteGlow = 0;
    this.history.clear();
    this.tipLadder.reset();
    this.watch.clearQueue();
    this.barLabel = null;
    this.touchBarArmed = null;
    this.hoverDwell = 0;
    this.syncA11yControls(); // next-level: a11y — an empty satchel has no second page
  }

  private newGame(): void {
    this.resetState();
    this.startAct(FIRST_ACT);
    // First watch: the satchel and the chart are on screen from the first room, so their names
    // are the first lessons. They wait for the opening scene to finish (see update()).
    if (!hasCompleted()) {
      this.teach("inventory");
      this.teach("chart");
    }
  }

  /**
   * The ending. The save stays where it was — the last moment before the final choice — so
   * Continue can go back and choose again; finishing once unlocks Chapter select.
   */
  private win(): void {
    this.resetTransient();
    // One closing card, always. Content sets one flag, but a damaged or hand-edited state may
    // hold both; the last one set wins, so the two endings' lines can never run together.
    const chosen = Object.keys(this.flags).filter((id) => ENDING_FLAGS.has(id) && this.flags[id]);
    if (chosen.length) {
      const keep = chosen.length === 1
        ? chosen[0]
        : (this.endingChosen && chosen.includes(this.endingChosen) ? this.endingChosen : chosen.at(-1)!);
      this.onlyEnding(keep);
      this.onlyFinalChoice(keep);
    }
    this.won = true;
    // next-level: casebook — record the voyage's optional layer as it ends
    this.deedsShown = false;
    const card = this.endingCard();
    // The ending painting is not a room plate: ask for it as the card rises.
    void this.assets.ensure([card.image]);
    // next-level: a11y — the card reads its page turns out; the ending itself is read out below.
    this.ending = new EndingScreen(card, this.assets, (text) => this.announce(text));
    if (card.music) this.audio.playMusic(card.music);
    // The resolving chord r3-audio added (the chime stays for tips). // next-level: audio
    this.audio.resolve(this.act);
    markCompleted();
    // next-level: a11y — once: the title and the first line, so a screen reader hears where the
    // voyage has arrived even though the card is canvas.
    if (!this.announcedEnding) {
      this.announcedEnding = true;
      this.announce(`${card.title}.${card.lines[0] ? " " + card.lines[0] : ""}`);
    }
    // next-level: casebook — enter this voyage's optional layer now, not when the page is opened:
    // the player may close the tab on the ending, and what they did should still be theirs.
    fileDeeds((deed) => deed.if.every((c) => this.check(c)));
  }

  /** What the closing card says, and which painting it rises over. */
  private endingCard(): EndingCard & { music?: string } {
    const holds = (list?: Cond[]) => !list || list.every((c) => this.check(c));
    const title = ENDING.titles?.find((t) => holds(t.if))?.text ?? ENDING.title;
    const lines = ENDING.lines.filter((l) => holds(l.if)).map((l) => l.text);
    // The script names the painting (`ENDING.paintings`); until it does, the voyage's own.
    const painting = ENDING.paintings?.find((p) => holds(p.if)) ??
      (this.check({ flag: "ending_pirate" }) ? { image: "bg_deck_wide", focus: { x: 1250, y: 300 }, music: "music_sea" }
        : this.check({ flag: "ending_desk" }) ? { image: "bg_office_wide", focus: { x: 1130, y: 60 }, music: "music_dock" }
        : { image: "bg_dock_wide", focus: { x: 1280, y: 420 }, music: "music_dock" });
    return { title, lines, image: painting.image, focus: painting.focus, music: painting.music };
  }

  // next-level: casebook — chain the deeds page between the closing card and the title
  /**
   * A click or Enter on the card: everything up first, then the deeds page, then home to the
   * title. The page is its own overlay (deeds.ts); when it is dismissed it calls `leaveDeeds`.
   */
  private advanceEnding(): void {
    if (!this.ending || !this.ending.advance()) return;
    if (!this.deedsShown) {
      this.deedsShown = true;
      this.audio.page();
      this.deeds.show((deed) => deed.if.every((c) => this.check(c)));
      return;
    }
    this.leaveDeeds();
  }

  /** The end of the ending: through the curtain to the title, with the casebook tally updated. */
  private leaveDeeds(): void {
    if (!this.won) return;
    this.behindCurtain(() => {
      this.won = false;
      this.ending = null;
      this.deedsShown = false;
      this.enterTitle();
    });
  }

  // ------------------------------------------------------------ hit tests

  /** Merged states, made once each: the merge is pure, and this runs many times a frame. */
  private stateCache = new WeakMap<Hotspot, Map<number, Hotspot>>();
  private hotspotState(hs: Hotspot): Hotspot {
    const states = hs.states;
    if (!states) return hs;
    const i = states.findIndex((s) => s.if.every((c) => this.check(c)));
    if (i < 0) return hs;
    let merged = this.stateCache.get(hs);
    if (!merged) this.stateCache.set(hs, merged = new Map());
    let state = merged.get(i);
    if (!state) {
      const s = states[i];
      state = { ...hs, name: s.name ?? hs.name, say: { ...hs.say, ...s.say }, do: { ...hs.do, ...s.do } };
      merged.set(i, state);
    }
    return state;
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
      icon: ITEM_ICONS.has(id) ? this.assets.img(`item_${id}`) ?? null : null,
    }));
    return {
      verb: this.sentence.verb,
      objA: this.sentence.a?.name ?? null,
      objB: this.sentence.b?.name ?? null,
      narrationFull: this.narration?.text ?? null,
      narration: this.narration ? typewriterSlice(this.narration.text, this.narration.shown) : null,
      narrationAlpha: this.narrationAlpha(),
      target: this.targetName(),
      inventory: inv,
      page: this.inventoryPage,
      hoverVerb: this.hoverVerb,
      hoverItem: this.hoverItem,
      focusVerb: this.keyboardFocus?.kind === "verb" ? this.keyboardFocus.id : null,
      focusItem: this.keyboardFocus?.kind === "item" ? this.keyboardFocus.id : null,
      selectedItem: this.sentence.a?.kind === "item" ? this.sentence.a.id : null,
      ...this.suggestion(),
      scale: this.textScale,
      touch: this.touch,
      keyboard: this.lastInput === "keyboard",
      waiting: Boolean(this.queue && this.narration),
      fresh: this.fx.glows(),
      time: this.time,
      reduced: this.reduced,
    };
  }

  /**
   * How much of the narration box to show: all of it while the line is typing or something
   * waits on it; once it has been read (and lingered a moment) it fades, so it stops covering
   * the bottom of the scene. The line itself stays put, and in the history (L).
   */
  private narrationAlpha(): number {
    const n = this.narration;
    if (!n) return 0;
    if (n.shown < n.text.length || this.queue || this.dialogue) return 1;
    const t = this.narrationClock - this.lineDue("say") - NARRATION_LINGER;
    return t <= 0 ? 1 : Math.max(0, 1 - t / NARRATION_FADE);
  }

  /** The name of what the pointer (or keyboard focus) is on, to preview a sentence's end. */
  private targetName(): string | null {
    if (!this.sentence.verb || this.sentence.b) return null;
    const own = this.sentence.a?.id;
    const item = this.hoverItem ?? (this.keyboardFocus?.kind === "item" ? this.keyboardFocus.id : null);
    if (item) return item === own ? null : ITEMS[item]?.name ?? null;
    const id = this.hoverHotspot ?? (this.keyboardFocus?.kind === "hotspot" ? this.keyboardFocus.id : null);
    const raw = id && id !== own ? this.room.hotspots.find((h) => h.id === id) : undefined;
    return raw ? this.hotspotState(raw).name : null;
  }

  /** What the hovered (or keyboard-focused) hotspot suggests, when no sentence is started. */
  private suggestion(): { suggestVerb: VerbId | null; suggestLine: string | null; suggestExit: boolean } {
    const id = this.hoverHotspot ?? (this.keyboardFocus?.kind === "hotspot" ? this.keyboardFocus.id : null);
    const raw = id && !this.sentence.verb && !this.sentence.a
      ? this.visibleHotspots().find((h) => h.id === id) : undefined;
    if (!raw) return { suggestVerb: null, suggestLine: null, suggestExit: false };
    const hs = this.hotspotState(raw);
    // A way out is walked through; anything else gets its natural verb. Either way, a click.
    const exit = this.isExit(hs);
    const verb = exit ? "walk" : this.suggestedVerb(hs);
    const label = VERBS.find((v) => v.id === verb)?.label ?? "";
    return { suggestVerb: verb, suggestLine: `${label} ${hs.name}`, suggestExit: exit };
  }

  /** The visible choices, worked out once a tick for the stage and the drawing (input asks afresh). */
  private frameChoices(): ReturnType<Game["visibleChoices"]> {
    const c = this.choiceCache;
    if (c && c.tick === this.tick && c.dialogue === this.dialogue) return c.list;
    const list = this.visibleChoices();
    this.choiceCache = { tick: this.tick, dialogue: this.dialogue, list };
    return list;
  }
  private tick = 0;
  private choiceCache: { tick: number; dialogue: unknown; list: ReturnType<Game["visibleChoices"]> } | null = null;

  private dialogueModel(choices = this.visibleChoices()): DialogueModel {
    const node = this.currentNode();
    const character = characterOf(node?.speaker ?? "");
    const portraitKey = character.portrait ?? null;
    const portrait = portraitKey ? this.assets.img(portraitKey) ?? null : null;
    const column = this.dialogue ? this.hasPortraits(this.dialogue.tree) : true;
    // A speaker without a portrait, among people who have one: their initial in the frame.
    const name = character.name.replace(/^(A|An|Another|The|Mr|Mrs|Old|Captain|Harbourmaster)\s+/, "");
    return {
      speaker: character.name,
      speakerAccent: character.accent ?? null,
      text: node ? node.text : "",
      reveal: this.dialogue?.shown ?? 0,
      portraitKey,
      portrait,
      choices: choices.map((c, i) => ({ text: c.text, index: i, seen: c.seen })),
      hoverIndex: this.hoverChoice,
      layout: dialogueLayout(this.view.ctx, node?.text ?? "", choices.map((c) => c.text), this.textScale, column),
      scale: this.textScale,
      touch: this.touch,
      keyboard: this.lastInput === "keyboard",
      stage: this.stage,
      monogram: column && !portraitKey ? (name ? name[0].toUpperCase() : "") : null,
    };
  }

  private render(): void {
    const ctx = this.view.ctx;
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.syncMobileLayout();

    this.updateCursor();

    if (this.title) {
      this.renderTitle(ctx);
      this.renderFade(ctx);
      if (!this.mobile) drawCursor(ctx, this.input.x, this.input.y, null);
      return;
    }

    if (this.won && this.ending) {
      // The ceremony has the whole screen: no scene, no verbs, no top bar behind it.
      this.ending.render(ctx, this.reduced, this.mobile ? this.mobileTextScale : this.textScale);
      this.renderFade(ctx);
      if (!this.mobile) drawCursor(ctx, this.input.x, this.input.y, null);
      return;
    }

    const zoom = this.transition.zoom(this.fade, this.cameraX, this.reduced);
    if (zoom) {
      // Through a door: the scene leans toward it (or settles in), the panel stays put.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, LOGICAL_W, SCENE_H);
      ctx.clip();
      ctx.translate(zoom.x, zoom.y);
      ctx.scale(zoom.k, zoom.k);
      ctx.translate(-zoom.x, -zoom.y);
    }
    this.renderScene(ctx);
    ctx.save();
    ctx.translate(-this.cameraX, 0);
    this.fx.drawWorld(ctx, this.reduced);
    ctx.restore();
    if (zoom) ctx.restore();
    let narrationBox = null;
    if (!this.mobile) {
      this.renderTopBar(ctx);
      if (this.dialogue) {
        drawDialogue(ctx, this.dialogueModel(this.frameChoices()));
      } else {
        narrationBox = drawPanel(ctx, this.panelModel()).narrationBox;
        this.fx.drawScreen(ctx, (id) => this.slotOf(id), this.reduced);
      }
      if (this.explore) this.renderExplore(ctx);
      this.drawSaveNotice(ctx);
      // The cursor is a shape, not a word chip: hover is answered by the gold rim in the scene.
      drawCursor(ctx, this.input.x, this.input.y, null, this.rejection > 0, this.textScale, narrationBox);
    }
    this.drawFirstWatch(ctx);
    this.renderFade(ctx);
  }

  /** Where an item's chip is on the inventory page showing, if it's there. */
  private slotOf(id: string): { x: number; y: number; w: number; h: number } | null {
    const i = this.pageInventory().indexOf(id);
    return i < 0 ? null : inventorySlotRect(i);
  }

  /** The OS cursor says what a click would do: a hand on things, an arrow toward a way out. */
  private updateCursor(): void {
    let cursor = "default";
    const x = this.input.x, y = this.input.y;
    if (this.touch || this.paused || this.cinematic.active) cursor = "default";
    else if (this.title) cursor = this.titleButtons().some((b) => this.hitTitle(b.y, x, y)) ? "pointer" : "default";
    else if (this.roomMenu) cursor = "default";
    else if (this.barHit(x, y)) cursor = "pointer";
    else if (this.dialogue) cursor = this.hoverChoice >= 0 ? "pointer" : "default";
    else if (this.hoverVerb || this.hoverItem) cursor = "pointer";
    else if (this.hoverHotspot && !this.won) {
      const raw = this.room.hotspots.find((h) => h.id === this.hoverHotspot);
      if (raw && !this.sentence.verb && this.isExit(raw)) cursor = this.exitCursor(raw, x);
      else cursor = "pointer";
    }
    // The strip beside an exit that runs off the frame is itself a way out (see the walk-off
    // in onClick), so say so with the cursor even when the pointer is on bare floor — but only
    // over floor, since the click there must actually be a walk-off.
    else if (!this.won && y < SCENE_H && !this.sentence.verb && !this.sentence.a && !this.sentence.b &&
             this.edgeExitAt(x, y) &&
             this.room.walk.some((poly) => pointInPoly({ x: x + this.cameraX, y }, poly))) {
      cursor = x <= LOGICAL_W / 2 ? "w-resize" : "e-resize";
    }
    if (cursor !== this.cursorStyle) {
      this.cursorStyle = cursor;
      this.view.canvas.style.cursor = cursor;
    }
  }

  /**
   * What the OS cursor says on a way out: a hand on a door, an up/down arrow on stairs or a
   * hatch, a sideways arrow on a path that runs out of the frame. The bare floor at a frame
   * edge gets the same walk-off arrow (see onClick).
   */
  private exitCursor(hs: Hotspot, screenX: number): string {
    if (screenX <= EXIT_EDGE_BAND) return "w-resize";
    if (screenX >= LOGICAL_W - EXIT_EDGE_BAND) return "e-resize";
    const sound = this.exitSound(hs);
    if (sound === "stairs" || sound === "hatch") return "ns-resize";
    if (sound === "none") {
      const stand = this.exitStand(this.hotspotState(hs));
      return stand.x < this.x ? "w-resize" : "e-resize";
    }
    return "pointer";
  }

  /**
   * The painted thing nearest a touch point, within a finger's halo. The scene is drawn at 390
   * CSS pixels on a phone, so a 60 px prop is a 12 px target; accepting taps this close makes
   * the small things usable without moving a mouse's hit test by a pixel.
   */
  private nearestHotspotAt(x: number, y: number): Hotspot | null {
    const reach = 24 / Math.max(0.05, this.view.scale); // 24 CSS px in world units
    let best: Hotspot | null = null;
    let bestD = Infinity;
    for (const raw of this.visibleHotspots()) {
      const b = areaBox(this.hotspotState(raw).area);
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
      const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
      const d = Math.hypot(dx, dy);
      if (d <= reach && d < bestD) { bestD = d; best = raw; }
    }
    return best;
  }

  private areaCentre(area: Area): Pt {
    if ("rect" in area) return { x: area.rect.x + area.rect.w / 2, y: area.rect.y + area.rect.h / 2 };
    return {
      x: area.reduce((sum, p) => sum + p.x, 0) / area.length,
      y: area.reduce((sum, p) => sum + p.y, 0) / area.length,
    };
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
    // A failed image counts as arrived: a missing file must not hold the curtain.
    if (!this.assets.isReady(room.bg)) return false;
    for (const s of room.sprites ?? []) if (!this.assets.isReady(s.key)) return false;
    return true;
  }

  /** Lights, water, fog, motes and the night sky; it also keeps the room's graded plate. */
  private ambient = new Ambient({ image: (key) => this.assets.img(key), check: (c) => this.check(c) });
  /** The camera and clock the ambient layers draw at: one object, refreshed each frame. */
  private readonly ambientView: AmbientView = { cameraX: 0, time: 0, reduced: false };
  /** The shared finish over the scene (see paint.ts): one constant turns it all off. */
  private paint = new Paint();

  private renderScene(ctx: CanvasRenderingContext2D): void {
    // The plate comes already graded by the room's backdrop, baked once: a filter here would
    // cost a full-plate pass every frame, and Safari before 18 ignores canvas filters.
    const bg = this.ambient.plate();
    const worldWidth = this.room.width ?? LOGICAL_W;
    const view = this.ambientView;
    view.cameraX = this.cameraX;
    view.time = this.time;
    view.reduced = this.reduced;
    ctx.save();
    ctx.translate(-this.cameraX, 0);
    if (bg) ctx.drawImage(bg, 0, 0, worldWidth, SCENE_H);
    this.ambient.under(ctx, view);

    // Depth-sorted drawables: static props/NPCs and the player share one list.
    const drawables: { y: number; draw: () => void }[] = [];

    for (const s of this.room.sprites ?? []) {
      const hs = this.room.hotspots.find((h) => h.id === s.hotspot);
      if (hs?.showIf && !hs.showIf.every((c) => this.check(c))) continue;
      if (s.showIf && !s.showIf.every((c) => this.check(c))) continue;
      const breath = s.idle && !this.reduced ? Math.sin(this.time * 1.8 + s.x) * 0.0025 : 0;
      const speech = this.speech(s.speaker, s.x);
      // The halo follows the figure's own silhouette; tint comes from the lamp or fog at its feet.
      // Props don't get one: a lamp or a sign with a light wrap looks lit from nowhere.
      const height = s.size * (1 + breath) * this.personHeight(s.y);
      const wrap = s.speaker ? this.wrapAt(s.x, s.y, height) : undefined;
      drawables.push({ y: s.y, draw: () => this.drawSprite(ctx, s.key, s.x, s.y, s.size * (1 + breath), s.visible ?? 1, Boolean(s.speaker), s.flip, this.figureGrade(s.grade), speech, wrap) });
    }
    drawables.push({ y: this.y, draw: () => this.drawPlayer(ctx) });
    // Occluders sort by where they meet the floor: they cover what stands behind them only.
    if (bg) for (const o of this.room.occluders ?? []) {
      drawables.push({ y: o.y, draw: () => this.ambient.occlude(ctx, o) });
    }
    // Fog and smoke hang at their own floor lines, between what stands behind and in front.
    this.ambient.depth(drawables, ctx, view);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    this.ambient.over(ctx, view);

    if (this.debugOverlay) {
      drawDebugOverlay({ ctx, room: this.room, devHandle: this.devHandle, personHeight: (y) => this.personHeight(y) });
    }
    ctx.restore();

    // One shared finish over the plate and the figures: grain, a filmic grade and a gentler
    // vignette. It sits under the exit cues and chrome, and never over the title or a panel.
    if (PAINT_PASS) {
      this.paint.draw(ctx);
    } else {
      ctx.fillStyle = this.vignette(ctx);
      ctx.fillRect(0, 0, LOGICAL_W, SCENE_H);
    }

    ctx.save();
    ctx.translate(-this.cameraX, 0);
    if (this.revealing) this.drawReveal(ctx);
    // Exit legibility lives in the scene layer, under the chrome: warm threshold light, a
    // breathing rim on the door/ladder in reach, then one small unlabeled chevron if needed.
    this.drawExitLighting(ctx);
    this.drawHoverGlow(ctx);
    this.drawKeyboardFocus(ctx);
    this.drawExitChevron(ctx);
    ctx.restore();
  }

  /** The icon bar and the tip line: chrome, steady over the scene. The bar carries no words. */
  private renderTopBar(ctx: CanvasRenderingContext2D): void {
    const hover = this.barHit(this.input.x, this.input.y);
    // The canvas title is the wordless icon's name on hover; the hidden DOM toolbar below the
    // canvas carries the same names, with their shortcuts, for a screen reader.
    if (hover !== this.lastBarHover) {
      this.lastBarHover = hover;
      this.view.canvas.title = hover ? `${BAR_LABELS[hover]} (${BAR_KEYS[hover]})` : "";
    }
    const boxes = barLayout();
    ctx.save();
    ctx.globalAlpha = this.barFade;
    for (const id of BAR_IDS) {
      const b = boxes[id];
      const on = (id === "reveal" && this.revealing) || (id === "tip" && this.tipMode);
      const focus = hover === id || this.barFlash?.id === id;
      const glow = id === "casebook" && this.noteGlow > 0;
      const k = this.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(this.time * 6);
      // Quiet, but never lost in the painting: a dark glass plate with a brass edge that keeps
      // its contrast at rest, a black rim to separate it from the art, one glyph.
      roundRectPath(ctx, b.x - 1, b.y - 1, b.w + 2, b.h + 2, 12);
      ctx.fillStyle = "rgba(0,0,0,0.46)";
      ctx.fill();
      roundRectPath(ctx, b.x, b.y, b.w, b.h, 11);
      ctx.fillStyle = hover === id ? "rgba(27,46,62,0.97)" : on ? "rgba(7,15,25,0.96)" : "rgba(3,9,16,0.9)";
      ctx.fill();
      ctx.strokeStyle = hover === id ? "rgba(255,231,172,0.62)" : on ? "rgba(232,201,138,0.42)" : "rgba(232,201,138,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (on || focus || glow) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 19, 0, Math.PI * 2);
        ctx.strokeStyle = glow ? `rgba(255,230,168,${0.55 + 0.45 * k})`
          : focus ? "rgba(255,240,200,0.95)" : "rgba(232,201,138,0.8)";
        ctx.lineWidth = focus ? 2 : 1.5;
        ctx.shadowColor = "rgba(255,206,130,0.7)";
        ctx.shadowBlur = focus ? 10 : 6 + 6 * (glow ? k : 0);
        ctx.stroke();
        ctx.restore();
      }
      const color = on || focus || glow ? "#fff6df" : "#ffe2a6";
      ctx.save();
      ctx.shadowColor = "rgba(255,204,120,0.28)";
      ctx.shadowBlur = 6;
      drawGlyph(ctx, BAR_GLYPHS[id], b.x + b.w / 2, b.y + b.h / 2, focus ? 28 : 27, color, 1);
      ctx.restore();
    }
    ctx.restore();
    // A name for the plate: under the pointer on a mouse, or under a finger's first tap, since a
    // finger has no hover. Short enough for the rail; the shortcut rides with it.
    const named = this.touch ? (this.touchBarArmed ?? this.barLabel?.id ?? null) : hover;
    if (named) {
      const label = `${BAR_SHORT[named]} · ${BAR_KEYS[named]}`;
      const size = Math.round(15 * Math.min(this.textScale, 1.3));
      const box = boxes[named];
      ctx.save();
      ctx.globalAlpha = Math.max(0.86, this.barFade);
      ctx.font = `${size}px Georgia, "Times New Roman", serif`;
      const w = ctx.measureText(label).width + 20;
      const h = size + 10;
      const x = Math.max(8, Math.min(LOGICAL_W - w - 8, box.x + box.w / 2 - w / 2));
      const y = box.y + box.h + 5;
      roundRectPath(ctx, x, y, w, h, 6);
      ctx.fillStyle = "rgba(3,8,14,0.94)";
      ctx.fill();
      ctx.strokeStyle = "rgba(232,201,138,0.38)";
      ctx.lineWidth = 1;
      ctx.stroke();
      drawText(ctx, label, x + w / 2, y + 5, {
        size, color: "#ffe9bb", align: "center", shadow: false,
      });
      ctx.restore();
    }
    if (this.tipMode && !this.dialogue && !this.won) {
      // Its own row under the bar, so it never covers the buttons.
      const text = "Tip: " + this.tipLadder.shown();
      const size = Math.round(20 * this.textScale), lh = Math.round(27 * this.textScale);
      const lines = wrap(ctx, text, 1830, { size, color: "", weight: "normal" });
      const h = lines.length * lh + Math.round(17 * this.textScale);
      ctx.save();
      ctx.font = `${size}px Georgia, serif`;
      const w = Math.min(1872, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40);
      ctx.restore();
      ctx.fillStyle = "rgba(5,13,22,0.86)";
      ctx.fillRect(24, BANNER_Y, w, h);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(24, BANNER_Y, 3, h);
      lines.forEach((line, i) => drawText(ctx, line, 44, BANNER_Y + Math.round(10 * this.textScale) + i * lh, { size, color: "#dcebf2", shadow: false }));
    }
  }

  /**
   * The first-watch plate: one line, once, at the thing it belongs to. It is not a footer and
   * not a legend — it appears when the interface is first met, sits in the same glass and brass
   * as the rest of the chrome, and is gone for good after a few seconds.
   */
  private drawFirstWatch(ctx: CanvasRenderingContext2D): void {
    if (this.title || this.won || this.explore || this.dialogue || this.cinematic.active ||
        this.areaCardBusy || this.paused || this.fade > 0.5) return;
    const lesson = this.watch.current;
    if (!lesson) return;
    const alpha = this.watch.alpha;
    if (alpha <= 0.01) return;
    const def = LESSONS[lesson.id];
    const text = def.text(this.touch);
    const size = Math.round(20 * Math.min(this.textScale, 1.3));
    const maxW = def.anchor === "satchel" ? 640 : 900;
    const fitted = fitText(ctx, text, maxW, size, 14);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${fitted.size}px Georgia, "Times New Roman", serif`;
    const w = ctx.measureText(fitted.text).width + 52;
    const h = fitted.size + 22;
    const top = BANNER_Y + (this.tipMode ? this.tipBannerHeight(ctx) + 6 : 0);
    let x = 40, y = top;
    if (def.anchor === "satchel") {
      // Over the empty quay, just above the satchel's leather head.
      const slot = inventorySlotRect(0);
      x = slot.x - 4;
      y = slot.y - 92;
    } else if (def.anchor === "bar") {
      // Under the chart plate itself: the one icon the lesson is naming.
      const box = barLayout().casebook;
      x = box.x + box.w - w;
    }
    x = Math.max(24, Math.min(LOGICAL_W - w - 24, x));
    y = Math.max(24, Math.min(LOGICAL_H - h - 24, y));
    roundRectPath(ctx, x, y, w, h, 7);
    ctx.fillStyle = "rgba(4,10,18,0.94)";
    ctx.fill();
    ctx.strokeStyle = "rgba(232,201,138,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x, y, 3, h);
    // A small brass diamond, the same mark the chart uses for a fix.
    ctx.save();
    ctx.translate(x + 22, y + h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#e8c98a";
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
    drawText(ctx, fitted.text, x + 38, y + 10, {
      size: fitted.size, color: "#f2e6cb", shadow: false,
    });
    ctx.restore();
  }

  /** The scene's vignette: one gradient for the life of the context, not one a frame. */
  private vignetteFor: { ctx: CanvasRenderingContext2D; g: CanvasGradient } | null = null;
  private vignette(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (this.vignetteFor?.ctx !== ctx) {
      const g = ctx.createRadialGradient(
        LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.35,
        LOGICAL_W / 2, SCENE_H / 2, SCENE_H * 0.95
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.5)");
      this.vignetteFor = { ctx, g };
    }
    return this.vignetteFor.g;
  }

  /** How strongly the one-time first-entry breath is still showing (0 when spent). */
  private introGlow(): number {
    if (this.exitIntro <= 0) return 0;
    const t = EXIT_INTRO_TIME - this.exitIntro;
    // Quick rise, one slow breath, and out before the eye starts ignoring it.
    return Math.max(0, Math.min(1, t / 0.3, this.exitIntro / 0.65));
  }

  /**
   * The way out, told in light. Every exit keeps a soft warm pool on its threshold; the door or
   * ladder under the pointer, under keyboard focus, or within reach of Fenn breathes a little
   * harder and picks up a warm rim. Q fills every exit with the same light at once. No names,
   * no arrows drawn as signs — just the warm place on the floor where the room lets you leave.
   */
  private drawExitLighting(ctx: CanvasRenderingContext2D): void {
    if (this.title || this.won || this.dialogue || this.cinematic.active || this.paused) return;
    const visible = this.visibleHotspots();
    const hoveredId = this.hoverHotspot;
    const focusedId = this.keyboardFocus?.kind === "hotspot" ? this.keyboardFocus.id : null;
    const intro = this.introGlow();
    let seed = 0;
    for (const raw of visible) {
      if (!this.isExit(raw)) continue;
      seed++;
      const hs = this.hotspotState(raw);
      const stand = this.exitStand(hs);
      const threshold = this.exitThreshold(hs);
      if (threshold.x < this.cameraX - 150 || threshold.x > this.cameraX + LOGICAL_W + 150) continue;
      const b = areaBox(hs.area);
      const active = raw.id === hoveredId || raw.id === focusedId || this.pointerNear(threshold) || this.revealing;
      const nearFenn = Math.hypot(stand.x - this.x, stand.y - this.y) <= EXIT_CUE_RANGE;
      const strength = (active ? 1.3 : nearFenn ? 1.0 : 0.68) + intro * 0.8;
      this.drawThresholdLight(ctx, threshold.x, threshold.y, b.w, b.h, strength, active, seed);
      // The opening itself breathes a little light when the pointer, focus or Fenn is on it:
      // the door leaf, the ladder, the rigging — whatever the threshold belongs to.
      if (active && !this.revealing) {
        const breath = this.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(this.time * 3.1 + seed * 1.9);
        ctx.save();
        this.areaPath(ctx, hs.area);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(255,206,140,${0.025 + 0.025 * breath})`;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Is the pointer close enough to a threshold for its light to answer? */
  private pointerNear(threshold: Pt): boolean {
    if (!this.pointerSeen || this.touch || this.input.y >= SCENE_H) return false;
    return Math.hypot(this.input.x + this.cameraX - threshold.x, this.input.y - threshold.y) <= EXIT_POINTER_RANGE;
  }

  /**
   * A warm light pool and short rising column at a threshold. The dark contact ellipse keeps the
   * warm light legible on a pale plate; on a dark one the pool and its soft rim do the work.
   * `strength` is overall, `active` makes the breath quicker and deeper.
   */
  private drawThresholdLight(
    ctx: CanvasRenderingContext2D, x: number, y: number, areaW: number, areaH: number,
    strength: number, active: boolean, seed: number
  ): void {
    const pulse = this.reduced ? 0.74 : 0.56 + 0.44 * Math.sin(this.time * (active ? 3.2 : 1.55) + seed * 1.7);
    const k = strength * Math.max(0.25, pulse);
    const r = Math.max(42, Math.min(130, areaW * 0.62 || 64));
    const rise = Math.max(70, Math.min(230, areaH * 0.55));
    const beam = Math.max(26, Math.min(110, areaW * 0.52 || 44));
    ctx.save();
    // A soft shadow ring under the light: contrast on bright plates, invisible on dark ones.
    const dark = ctx.createRadialGradient(x, y, r * 0.12, x, y, r * 1.55);
    dark.addColorStop(0, "rgba(0,0,0,0)");
    dark.addColorStop(0.6, "rgba(0,0,0,0)");
    dark.addColorStop(0.78, `rgba(18,8,2,${0.10 + 0.07 * pulse})`);
    dark.addColorStop(1, "rgba(18,8,2,0)");
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.55, r * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    // A warm tint first: on a pale plate a purely additive pool goes white and disappears, but
    // a low amber wash turns the cool floor warm and reads at once. On a dark plate it is gentle.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(255,168,78,${0.1 * k})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // Warm pool on the floor.
    ctx.globalCompositeOperation = "lighter";
    const pool = ctx.createRadialGradient(x, y, 0, x, y, r);
    pool.addColorStop(0, `rgba(255,214,150,${0.22 * k})`);
    pool.addColorStop(0.45, `rgba(255,172,86,${0.11 * k})`);
    pool.addColorStop(1, "rgba(255,140,50,0)");
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    // A short column of light rising into the opening: it reads as "through here" without a sign.
    const column = ctx.createLinearGradient(0, y, 0, y - rise);
    column.addColorStop(0, `rgba(255,205,130,${0.11 * k})`);
    column.addColorStop(0.45, `rgba(255,185,100,${0.05 * k})`);
    column.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = column;
    ctx.beginPath();
    ctx.moveTo(x - beam / 2, y);
    ctx.quadraticCurveTo(x - beam * 0.34, y - rise * 0.55, x - beam * 0.14, y - rise);
    ctx.lineTo(x + beam * 0.14, y - rise);
    ctx.quadraticCurveTo(x + beam * 0.34, y - rise * 0.55, x + beam / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Where Fenn stands before taking a way out: its own stand, else the base of its area. */
  private exitStand(hs: Hotspot): Pt {
    return hs.stand ?? this.areaStand(hs.area);
  }

  /** The painted threshold a pool should sit on: the stand's floor, kept within the opening. */
  private exitThreshold(hs: Hotspot): Pt {
    // Anchor the cue to the painted opening, not to wherever the walk stand happens to be:
    // a hatch, door or stair is at the bottom centre of its own painted area.
    const b = areaBox(hs.area);
    return { x: b.x + b.w / 2, y: b.y + b.h };
  }

  /** How the way out sounds: a door, stairs, a hatch, or the open air. */
  private exitSound(hs: Hotspot): DoorSound | null {
    for (const effect of this.hotspotState(hs).do?.walk ?? []) {
      if (effect.k === "go") return effect.sound ?? "door";
    }
    return null;
  }

  /**
   * One small unlabeled chevron, only when it is needed: the exit under the pointer or keyboard
   * focus, else the single one Fenn is close enough to take. Q already shows every way out in
   * light, so no chevron competes with it.
   */
  private drawExitChevron(ctx: CanvasRenderingContext2D): void {
    if (this.title || this.won || this.dialogue || this.cinematic.active ||
        this.paused || this.revealing) return;
    // A verb or object on the line changes what clicking a door would do: no cue can promise
    // "walk through" while the sentence says "use crowbar".
    if (this.sentence.verb || this.sentence.a || this.sentence.b) return;

    const visible = this.visibleHotspots();
    const hovered = this.hoverHotspot ? visible.find((h) => h.id === this.hoverHotspot) : undefined;
    const focusedId = this.keyboardFocus?.kind === "hotspot" ? this.keyboardFocus.id : null;
    // Every way out carries a small, quiet chevron. A door, hatch, ladder or path should never
    // be visible only to a player who happens to stand close enough. No names, no signs.
    const placed: Array<{ x: number; y: number }> = [];
    for (const raw of visible) {
      if (!this.isExit(raw)) continue;
      const hs = this.hotspotState(raw);
      const threshold = this.exitThreshold(hs);
      const sound = this.exitSound(hs);
      let x = threshold.x;
      const y = Math.max(76, Math.min(SCENE_H - 34, threshold.y - 26));
      let angle = 0;
      if (sound === "none") {
        const dx = threshold.x - this.x;
        angle = Math.abs(dx) < 18 ? 0 : dx < 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      if (x < this.cameraX + 24 || x > this.cameraX + LOGICAL_W - 24) {
        const edge = x < this.cameraX ? "left" : "right";
        x = edge === "left" ? this.cameraX + 30 : this.cameraX + LOGICAL_W - 30;
        angle = edge === "left" ? -Math.PI / 2 : Math.PI / 2;
      }
      const near = raw === hovered || raw.id === focusedId || this.pointerNear(threshold) ||
        Math.hypot(threshold.x - this.x, threshold.y - this.y) <= EXIT_CUE_RANGE;
      // Two thresholds that share a screen spot (the dock stair foot) get one cue, not a pile.
      if (!near && placed.some((p) => Math.hypot(p.x - x, p.y - y) < 70)) continue;
      placed.push({ x, y });
      this.drawChevronAt(ctx, x, y, angle, near ? 1 : 0.72);
    }
  }

  /** One small, soft chevron with a dark contour so it survives a bright plate. */
  private drawChevronAt(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, strength = 1): void {
    const pulse = this.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(this.time * 2.6);
    const alpha = (0.62 + 0.24 * pulse) * strength;
    const bob = this.reduced ? 0 : Math.sin(this.time * 2) * 1.4;
    ctx.save();
    ctx.translate(x, y + bob);
    // A soft light behind the glyph so it sits in the pool rather than on top of it.
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(0, 2, 0, 0, 2, 26);
    halo.addColorStop(0, `rgba(255,206,130,${0.16 * strength})`);
    halo.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 2, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.rotate(angle);
    ctx.scale(1.48, 1.48);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // A leading chevron and a fainter echo: enough motion to catch the eye, never a signpost.
    for (const [dy, echo] of [[0, 1], [9, 0.5]] as const) {
      ctx.globalAlpha = echo;
      const shape = (): void => {
        ctx.beginPath();
        ctx.moveTo(-9, dy + 4);
        ctx.lineTo(0, dy - 4);
        ctx.lineTo(9, dy + 4);
      };
      // A dark contour first (contrast on light plates), then the warm light itself.
      ctx.strokeStyle = "rgba(16,8,2,0.38)";
      ctx.lineWidth = 5;
      shape();
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,238,200,${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "rgba(255,186,96,0.8)";
      ctx.shadowBlur = 10;
      shape();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Reveal: every thing in the room outlined in light, ways out warmer and fuller. No names. */
  private drawReveal(ctx: CanvasRenderingContext2D): void {
    const pulse = this.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(this.time * 3.4);
    for (const raw of this.visibleHotspots()) {
      const hs = this.hotspotState(raw);
      const exit = this.isExit(hs);
      // Exits are warm amber; everything else is a paler gold. Both are light, neither is a label.
      this.outlineHotspot(ctx, hs, {
        fill: exit ? `rgba(255,196,120,${0.05 + 0.025 * pulse})` : `rgba(255,214,150,${0.055 + 0.03 * pulse})`,
        stroke: exit ? `rgba(255,206,140,${0.58 + 0.24 * pulse})` : `rgba(255,228,175,${0.5 + 0.22 * pulse})`,
        width: exit ? 2.2 : 2,
        glow: exit ? 18 : 14,
        glowColor: exit ? "rgba(255,170,80,0.8)" : "rgba(255,196,110,0.72)",
        core: 0.2,
        edge: 0.2,
      });
    }
  }

  /** The tip row's height (0 when it is off), measured the way it is drawn. */
  private tipBannerHeight(ctx: CanvasRenderingContext2D): number {
    if (!this.tipMode) return 0;
    const size = Math.round(20 * this.textScale), lh = Math.round(27 * this.textScale);
    const lines = wrap(ctx, "Tip: " + this.tipLadder.shown(), 1830, { size, color: "", weight: "normal" });
    return lines.length * lh + Math.round(17 * this.textScale) + 8;
  }

  private areaPath(ctx: CanvasRenderingContext2D, area: Area): void {
    ctx.beginPath();
    if ("rect" in area) {
      const r = area.rect;
      ctx.rect(r.x, r.y, r.w, r.h);
    } else {
      area.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    }
  }

  private outlineHotspot(ctx: CanvasRenderingContext2D, hs: Hotspot,
    style: {
      stroke: string; fill: string; dash?: number[]; width: number; glow?: number; glowColor?: string;
      /** How much of the pale inner core to draw; a big area wants less of a crisp box. */
      core?: number;
      /** A dark thin contour under the light, so the rim survives a pale plate. */
      edge?: number;
    }): void {
    ctx.save();
    this.areaPath(ctx, hs.area);
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (style.glow) {
      // A broad, very soft halo first: the shape is lit, not framed.
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = style.glowColor ?? style.stroke;
      ctx.lineWidth = Math.max(7, style.width * 4.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = style.glowColor ?? style.stroke;
      ctx.shadowBlur = style.glow;
    }
    if (style.edge) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(12,7,2,${style.edge})`;
      ctx.lineWidth = style.width + 2.4;
      ctx.stroke();
      if (style.glow) {
        ctx.shadowColor = style.glowColor ?? style.stroke;
        ctx.shadowBlur = style.glow * 0.7;
      }
    }
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.width;
    if (style.dash) ctx.setLineDash(style.dash);
    ctx.stroke();
    if (style.glow && (style.core ?? 0.3) > 0) {
      // A thin pale core inside the glow: the rim reads as light, not as a selection box.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,246,220,${style.core ?? 0.3})`;
      ctx.lineWidth = Math.max(0.8, style.width * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Soft gold rim and a slight warm brightening around whatever the pointer is over. */
  private drawHoverGlow(ctx: CanvasRenderingContext2D): void {
    if (!this.hoverHotspot || this.dialogue || this.won) return;
    const raw = this.room.hotspots.find((h) => h.id === this.hoverHotspot);
    if (!raw) return;
    const hs = this.hotspotState(raw);
    // A way out has its own light language (threshold pool, pulse, chevron): a rim here would
    // trace the whole painted opening, which on a door or a rigging is a wireframe, not a light.
    if (this.isExit(hs)) return;
    const pulse = this.reduced ? 0.72 : 0.58 + 0.32 * Math.sin(this.time * 4.4);
    const heat = 0.5 + 0.5 * pulse;
    // A soft warm cloud, not a box: the shape itself brightens under the pointer.
    ctx.save();
    this.areaPath(ctx, hs.area);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255,215,150,${0.05 + 0.045 * heat})`;
    ctx.fill();
    ctx.restore();
  }

  /** A small warm focus ring where Fenn would act: for openings too big to outline honestly. */
  private drawFocusRing(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const pulse = this.reduced ? 0.8 : 0.7 + 0.24 * Math.sin(this.time * 3.1);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 38);
    pool.addColorStop(0, `rgba(255,230,170,${0.2 * pulse})`);
    pool.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = `rgba(255,243,207,${0.62 + 0.26 * pulse})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,210,140,0.9)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Tab/arrow focus: the same light, steadier and a little brighter, still without a name. */
  private drawKeyboardFocus(ctx: CanvasRenderingContext2D): void {
    if (this.keyboardFocus?.kind !== "hotspot" || this.dialogue || this.won) return;
    const raw = this.visibleHotspots().find((hotspot) => hotspot.id === this.keyboardFocus?.id);
    if (!raw) return;
    const hs = this.hotspotState(raw);
    const b = areaBox(hs.area);
    const huge = Math.max(b.w, b.h) > 500;
    const pulse = this.reduced ? 0.8 : 0.68 + 0.2 * Math.sin(this.time * 3.2);
    ctx.save();
    this.areaPath(ctx, hs.area);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255,243,207,${(huge ? 0.03 : 0.055) + 0.025 * pulse})`;
    ctx.fill();
    ctx.restore();
    if (huge) {
      // A whole rigging or a sky cannot be ringed like a cupboard: put the ring where Fenn acts.
      const at = this.isExit(hs) ? this.exitThreshold(hs) : this.areaStand(hs.area);
      this.drawFocusRing(ctx, at.x, at.y);
      return;
    }
    this.outlineHotspot(ctx, hs, {
      fill: "rgba(255,243,207,0.02)",
      stroke: `rgba(255,246,220,${0.7 + 0.2 * pulse})`,
      width: 3,
      glow: 20,
      glowColor: "rgba(255,220,150,0.85)",
      core: 0.5,
      edge: 0.18,
    });
  }

  /**
   * Who is talking, eased: the speaker of a line that is still typing leans into it and lifts on
   * its words; Fenn does the same with his own lines. Reduced motion: nobody moves.
   */
  private updateSpeech(dt: number): void {
    const node = this.currentNode();
    const typing = this.dialogue && node && this.dialogue.shown < node.text.length ? node.speaker : null;
    const narrating = this.narration && this.narration.shown < this.narration.text.length ? "fenn" : null;
    const ids = new Set([...this.talking.keys(), ...(typing ? [typing] : []), ...(narrating ? [narrating] : [])]);
    for (const id of ids) {
      const target = id === typing || id === narrating ? 1 : 0;
      const level = target + ((this.talking.get(id) ?? 0) - target) * Math.exp(-dt / 0.14);
      if (level < 0.01 && target === 0) this.talking.delete(id);
      else this.talking.set(id, level);
    }
  }
  /** The lean and lift of someone speaking, for a figure at `x` (they lean toward Fenn). */
  private speech(id: string | undefined, x: number): { lean: number; squash: number } | null {
    const level = id ? this.talking.get(id) ?? 0 : 0;
    if (!id || level <= 0.001 || this.reduced) return null;
    const toward = id === "fenn" ? 0 : Math.sign(this.x - x);
    return {
      lean: toward * 0.022 * level,
      squash: 1 + 0.011 * level * Math.abs(Math.sin(this.time * 8.5 + x * 0.01)),
    };
  }

  /** Height in pixels of a standing adult whose feet are at `y` (measured curve, else perspective). */
  private personHeight(y: number): number {
    return personHeightAt(this.room, y);
  }

  /** The halo tint for a figure at (x, y), if the pass is on and the light is actually lit. */
  private wrapAt(x: number, y: number, height: number): FigureWrap | undefined {
    if (!PAINT_PASS) return undefined;
    return figureWrap(this.room, x, y, height, (l) => !l.showIf || l.showIf.every((c) => this.check(c)));
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
    grade = "none",
    speech: { lean: number; squash: number } | null = null,
    wrap?: { colour: string; blur: number }
  ): void {
    drawSprite(ctx, this.assets, key, x, y, size * this.personHeight(y), { visible, figure, flip, grade, ...speech, wrap });
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const sheet = "char_walk_v2";
    const height = this.personHeight(this.y);
    const walking = this.path.length > 0;
    const vertical = this.moveDirection === "up" || this.moveDirection === "down";
    const cycle = this.walkPhase / STRIDE;
    const grade = this.figureGrade("saturate(0.85) brightness(0.9)");
    const wrap = this.wrapAt(this.x, this.y, height);

    drawShadow(ctx, this.x, this.y, height * 0.26, 0.38);

    // Every sheet faces right; facing left mirrors about the torso.
    if (walking && vertical && this.assets.img("char_walk_vertical")) {
      const frame = (this.moveDirection === "up" ? 0 : 3) + (Math.floor(cycle * 3) % 3);
      drawFigure(ctx, this.assets, "char_walk_vertical", this.x, this.y, height, { frames: 6, frame, grade, wrap });
    } else if (walking && this.assets.img(sheet)) {
      const frame = Math.floor(cycle * 6) % 6;
      drawFigure(ctx, this.assets, sheet, this.x, this.y, height, { frames: 6, frame, grade, flip: this.facing < 0, wrap });
    } else if (this.assets.img("char_elias")) {
      // A slow breath rather than a bob keeps the feet planted. Reduced motion: still.
      const breath = this.reduced ? 1 : 1 + Math.sin(this.time * 2.2) * 0.004;
      const speech = this.speech("fenn", this.x);
      drawFigure(ctx, this.assets, "char_elias", this.x, this.y, height * breath, { grade, flip: this.facing < 0, ...speech, wrap });
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
  /** The whole of a moment, idle or mid-conversation, as plain data (see devRestore). */
  devSnapshot(): DevSnapshot {
    return {
      room: this.room.id, x: this.x, y: this.y, facing: this.facing, moveDirection: this.moveDirection, act: this.act,
      flags: structuredClone(this.flags), inventory: [...this.inventory], inventoryPage: this.inventoryPage,
      notes: structuredClone(this.notes),
      dialogue: this.dialogue ? { tree: this.dialogue.tree.id, node: this.dialogue.nodeId, shown: this.dialogue.shown } : null,
      narration: this.narration ? { ...this.narration } : null, narrationClock: this.narrationClock,
      queue: this.queue ? structuredClone(this.queue) : null, queueDue: this.queueDue,
      cameraX: this.cameraX, sentence: structuredClone(this.sentence),
    };
  }
  /**
   * Put the game exactly into a moment from devSnapshot, as if play had led there: nothing in
   * flight (walks, fades, hovers, notices) and, unless `persist` is false, saved as play would
   * save it. DOM overlays (cinematic, pause, casebook, log) are the caller's to close.
   */
  devRestore(s: DevSnapshot, { persist = true }: { persist?: boolean } = {}): void {
    this.resetTransient();
    this.title = false; this.won = false; this.explore = false; this.roomMenu = false; this.confirmNew = false; this.paused = false;
    const room = ROOMS[s.room];
    if (this.room !== room) { this.room = room; this.mesh = new WalkMesh(room.walk, room.width ?? LOGICAL_W, SCENE_H); }
    this.roomWait = 0;
    void this.assets.ensure(roomImageKeys(room));
    this.x = s.x; this.y = s.y; this.facing = s.facing; this.moveDirection = s.moveDirection; this.act = s.act;
    this.flags = structuredClone(s.flags); this.inventory = [...s.inventory]; this.inventoryPage = s.inventoryPage;
    this.warmInventoryIcons();
    this.notes = structuredClone(s.notes);
    this.cameraX = s.cameraX; this.focusCameraX = null;
    this.path = []; this.onArrive = null; this.walkGoal = null; this.running = false;
    this.walkPhase = 0; this.walkStarting = false; this.directionPending = 0;
    this.sentence = s.sentence ? structuredClone(s.sentence) : { verb: null, a: null, b: null };
    this.keyboardFocus = null; this.hoverHotspot = null; this.hoverVerb = null; this.hoverItem = null; this.hoverChoice = -1;
    this.touchArmed = null; this.touch = false; this.revealHeld = false; this.revealToggled = false; this.rejection = 0;
    this.narration = s.narration ? { ...s.narration } : null; this.narrationClock = s.narrationClock;
    this.queue = s.queue ? structuredClone(s.queue) : null; this.queueDue = s.queueDue;
    const tree = s.dialogue ? DIALOGUES[s.dialogue.tree] : undefined;
    this.dialogue = tree && s.dialogue ? { tree, nodeId: s.dialogue.node, shown: s.dialogue.shown } : null;
    this.saveNotice = null; this.autosaveIn = 0;
    this.history.clear();
    if (persist) this.persist();
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
    this.ambient.setRoom(room);
    this.mesh = new WalkMesh(room.walk, room.width ?? LOGICAL_W, SCENE_H);
    this.roomWait = 0;
    // Lazy loading: ask for this room's plate, sprites and portraits now. The curtain stays
    // down until they arrive (roomReady), and the loader retries a flaky image before falling
    // back, so a slow or missing plate cannot leave the room black.
    void this.assets.ensure(roomImageKeys(room));
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
    this.focusCurrentScene();
    this.announce("Chapter select.");
    this.announceSceneFocus();
  }

  private exploreGo(index: number): void {
    const target = this.exploreRooms()[index];
    if (!target) return;
    this.resetTransient();
    this.act = target.act || this.act;
    this.loadRoom(target.id, undefined, { atEntry: true });
    this.roomMenu = false;
  }

  /**
   * The scene list as a chart: one column per act, the acts left to right, the scenes down each
   * column. The shape says "chapters" before a word is read, which a flat grid of equal boxes
   * never did.
   */
  private roomMenuLayout(): SceneLayout {
    const entries = this.exploreRooms();
    const acts = [...new Set(entries.map((e) => e.act))];
    const cols = Math.max(1, acts.length);
    const colW = cols <= 4 ? 380 : Math.max(250, Math.floor((LOGICAL_W - 240 - (cols - 1) * 24) / cols));
    const gap = cols <= 4 ? 36 : 24;
    const total = cols * colW + (cols - 1) * gap;
    const left = Math.round((LOGICAL_W - total) / 2);
    const rects: Rect[] = new Array(entries.length);
    const columns = acts.map((act, ci) => {
      const x = left + ci * (colW + gap);
      const rooms = entries
        .map((e, index) => ({ ...e, index }))
        .filter((e) => e.act === act)
        .map(({ index, id }) => ({ index, id }));
      rooms.forEach((room, row) => {
        rects[room.index] = { x, y: 236 + row * 50, w: colW, h: 44 };
      });
      return { act, title: ACTS[act]?.title ?? "Elsewhere", x, rooms };
    });
    return { entries, columns, rects };
  }

  /** Put the keyboard's marker on the scene currently being walked. */
  private focusCurrentScene(): void {
    const layout = this.roomMenuLayout();
    const i = layout.entries.findIndex((e) => e.id === this.room?.id);
    if (i >= 0) this.roomMenuFocus = i;
  }

  /** Read the focused scene out: the canvas list is invisible to a screen reader otherwise. */
  private announceSceneFocus(): void {
    const layout = this.roomMenuLayout();
    const entry = layout.entries[this.roomMenuFocus];
    if (!entry) return;
    const column = layout.columns.find((c) => c.rooms.some((r) => r.index === this.roomMenuFocus));
    const row = column ? column.rooms.findIndex((r) => r.index === this.roomMenuFocus) + 1 : 1;
    const total = column?.rooms.length ?? 1;
    const act = entry.act ? `Act ${ROMAN[entry.act] ?? entry.act}, ` : "";
    this.announce(`${ROOMS[entry.id].name}. ${act}scene ${row} of ${total}.`);
  }

  /** Returns true when explore mode consumed the key. */
  private exploreKey(k: string, event: KeyboardEvent): boolean {
    if (this.title) return false;
    if (k === "r" || k === "R") {
      this.roomMenu = !this.roomMenu;
      if (this.roomMenu) {
        this.focusCurrentScene();
        this.announce("Chapter select.");
        this.announceSceneFocus();
      } else this.announce("Chapter select closed.");
      return true;
    }
    if ((k === "d" || k === "D") && import.meta.env.DEV) { this.debugOverlay = !this.debugOverlay; return true; }
    if (!this.roomMenu) return false;
    const layout = this.roomMenuLayout();
    const count = layout.entries.length;
    if (!count) return false;
    const focus = Math.max(0, Math.min(count - 1, this.roomMenuFocus));
    if (k === "Escape") {
      event.preventDefault();
      this.roomMenu = false;
      this.announce("Chapter select closed.");
      return true;
    }
    if (k === "Tab") {
      const delta = event.shiftKey ? -1 : 1;
      const next = focus + delta;
      // The ends of the chart are the way out: let Tab continue to the browser's controls.
      if (next < 0 || next >= count) return true;
      event.preventDefault();
      this.roomMenuFocus = next;
      this.announceSceneFocus();
      return true;
    }
    event.preventDefault();
    if (k === "Enter" || k === " ") { this.exploreGo(focus); return true; }
    if (k !== "ArrowUp" && k !== "ArrowDown" && k !== "ArrowLeft" && k !== "ArrowRight") return true;
    // Columns are acts; arrows move like the chart is read, not just along a single list.
    const ci = layout.columns.findIndex((c) => c.rooms.some((r) => r.index === focus));
    const column = layout.columns[ci];
    if (!column) return true;
    const row = Math.max(0, column.rooms.findIndex((r) => r.index === focus));
    if (k === "ArrowUp" || k === "ArrowDown") {
      const next = Math.max(0, Math.min(column.rooms.length - 1, row + (k === "ArrowDown" ? 1 : -1)));
      this.roomMenuFocus = column.rooms[next].index;
    } else {
      const nextColumn = layout.columns[Math.max(0, Math.min(layout.columns.length - 1,
        ci + (k === "ArrowRight" ? 1 : -1)))];
      const nextRow = Math.max(0, Math.min(nextColumn.rooms.length - 1, row));
      if (nextColumn.rooms[nextRow]) this.roomMenuFocus = nextColumn.rooms[nextRow].index;
    }
    this.announceSceneFocus();
    return true;
  }

  private roomMenuClick(x: number, y: number): void {
    const layout = this.roomMenuLayout();
    for (let i = 0; i < layout.rects.length; i++) {
      if (insideBox(x, y, layout.rects[i])) { this.exploreGo(i); return; }
    }
    this.roomMenu = false;
  }

  /** One small brass mark: the diamond the chart uses for a fix. */
  private drawChartDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  private renderExplore(ctx: CanvasRenderingContext2D): void {
    // next-level: a11y — chapter select is chrome too: its banner and headings follow the scale,
    // fitted so the fixed plates (and the top bar beside them) are never overflowed.
    const scale = this.textScale;
    if (!this.roomMenu) {
      // A quiet plate under the top bar while a scene is walked: the way back to the list.
      ctx.fillStyle = "rgba(4,10,18,0.88)";
      ctx.fillRect(470, BAR.y, 610, BAR.h);
      ctx.strokeStyle = "rgba(201,162,74,0.38)";
      ctx.lineWidth = 1;
      ctx.strokeRect(470.5, BAR.y + 0.5, 609, BAR.h - 1);
      this.drawChartDiamond(ctx, 492, BAR.y + BAR.h / 2, 4, "rgba(232,201,138,0.85)");
      const bannerText = `CHAPTER SELECT  ·  R scenes${import.meta.env.DEV ? "  ·  D overlay" : ""}`;
      const banner = fitText(ctx, bannerText, 610 - 50, Math.round(20 * scale), 13);
      drawText(ctx, banner.text, 775, BAR.y + Math.round((BAR.h - banner.size) / 2) - 1, {
        size: banner.size, color: "#e8c98a", align: "center", weight: "bold", shadow: false,
      });
      return;
    }
    ctx.fillStyle = "rgba(3,5,12,0.92)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // The title of the chart, and the one fact worth keeping: nothing here is saved.
    const heading = fitText(ctx, "CHAPTER SELECT", 900, Math.round(34 * scale), 20, "bold");
    drawText(ctx, heading.text, LOGICAL_W / 2, 78, {
      size: heading.size, color: COLORS.gold, align: "center", weight: "bold",
    });
    const sub = fitText(ctx, "walk any scene  ·  nothing is saved", 900, Math.round(18 * scale), 12);
    drawText(ctx, sub.text, LOGICAL_W / 2, 122, {
      size: sub.size, color: "#a99a7a", align: "center", shadow: false,
    });
    const layout = this.roomMenuLayout();
    for (const column of layout.columns) {
      // The act heading: a roman numeral, the act's own name, and a chart rule under both.
      const actLabel = column.act ? `ACT ${ROMAN[column.act] ?? column.act}` : "ELSEWHERE";
      const head = fitText(ctx, actLabel, 180, Math.round(15 * scale), 11, "bold");
      drawText(ctx, head.text, column.x, 172, {
        size: head.size, color: "#e8c98a", weight: "bold", shadow: false,
      });
      this.drawChartDiamond(ctx, column.x + 200, 180, 3.5, "rgba(232,201,138,0.55)");
      const title = fitText(ctx, column.title.toUpperCase(), column.rooms.length ? 380 : 380, Math.round(17 * scale), 11);
      drawText(ctx, title.text, column.x + 216, 170, {
        size: title.size, color: "#a99a7a", shadow: false,
      });
      ctx.strokeStyle = "rgba(201,162,74,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(column.x, 200);
      ctx.lineTo(column.x + (layout.rects[column.rooms[0]?.index]?.w ?? 380), 200);
      ctx.stroke();
    }
    for (const column of layout.columns) {
      for (const room of column.rooms) {
        const box = layout.rects[room.index];
        if (!box) continue;
        const focus = room.index === this.roomMenuFocus;
        const here = room.id === this.room?.id;
        // A dark chart slip; focus lifts it with brass and a left rule, "here" with a hollow mark.
        ctx.fillStyle = focus ? "rgba(232,201,138,0.16)" : "rgba(10,16,28,0.82)";
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeStyle = focus ? "rgba(255,231,172,0.9)" : "rgba(201,162,74,0.26)";
        ctx.lineWidth = focus ? 1.5 : 1;
        ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
        if (focus) {
          ctx.fillStyle = "#e8c98a";
          ctx.fillRect(box.x, box.y, 3, box.h);
          ctx.strokeStyle = "rgba(255,230,168,0.55)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
        }
        // The scene's name, fitted to the slip; no "Act N ·" here, the column already says it.
        const label = fitText(ctx, ROOMS[room.id].name, box.w - (here ? 82 : 54), Math.round(20 * scale), 13);
        drawText(ctx, label.text, box.x + 32, box.y + Math.round((box.h - label.size) / 2) - 1, {
          size: label.size, color: focus ? "#fff6e0" : here ? "#e8c98a" : "#d9c9a4", shadow: false,
        });
        this.drawChartDiamond(ctx, box.x + 17, box.y + box.h / 2, 3.5,
          focus ? "#ffe6a8" : here ? "rgba(232,201,138,0.9)" : "rgba(201,162,74,0.45)");
        if (here) {
          const mark = fitText(ctx, "HERE", 60, Math.round(12 * scale), 9, "bold");
          drawText(ctx, mark.text, box.x + box.w - 16, box.y + Math.round((box.h - mark.size) / 2) - 1, {
            size: mark.size, color: "#e8c98a", align: "right", weight: "bold", shadow: false,
          });
        }
      }
    }
  }
  // ------------------------------------------------------------ title

  private titleFocus: TitleId | null = null;
  /** What Continue would carry on into ("Act II · The Crew"), read when the title opens. */
  private continueLabel: string | null = null;

  private titleButtons() {
    // next-level: recap — Continue's sub-label
    return titleButtons(this.hasSave, this.chaptersUnlocked(), this.confirmNew, this.continueLabel,
      this.hasPrevious);
  }
  /** Chapter select: for players once they have finished; always on the dev server. */
  private chaptersUnlocked(): boolean {
    return import.meta.env.DEV || hasCompleted();
  }
  private setTitleFocus(id: TitleId | null): void {
    if (id === this.titleFocus) return;
    // The marker sets off from the button it's on now (focus, or what Enter would press).
    const buttons = this.titleButtons();
    const on = buttons.find((b) => b.id === this.titleFocus) ?? buttons.find((b) => b.id === defaultTitleButton(buttons));
    this.needle = { fromY: on?.y ?? null, since: this.titleClock };
    this.titleFocus = id;
    this.cueHover(id ? `title:${id}` : null);
  }
  /** Show the title, with focus on what Enter would do: Continue when there's a voyage. */
  private enterTitle(): void {
    this.clearTouchArm();
    this.title = true;
    this.confirmNew = false;
    this.titleClock = 0;
    // Storage can have changed while the voyage was running (another tab, a cleared save): read
    // both facts once here rather than every frame the title is drawn.
    try { this.hasSave = hasAnySave(); this.hasPrevious = hasStashedSave(); }
    catch { this.hasSave = false; this.hasPrevious = false; }
    const buttons = this.titleButtons();
    // next-level: recap — read the act once, here, not every frame the title is drawn.
    this.continueLabel = this.hasSave ? this.saveLabel(" ·") : null;
    this.titleFocus = defaultTitleButton(buttons);
    this.needle = { fromY: null, since: -99 };
    // next-level: a11y — say where the player is and what the screen offers.
    const chosen = buttons.find((b) => b.id === this.titleFocus);
    this.announce(`Title screen. ${buttons.map((b) => b.label).join(", ")}.${
      chosen ? ` Enter chooses ${chosen.label}.` : ""} Arrow keys move between them.`);
    // next-level: casebook — written when the voyage ended; read once here, not every frame.
    this.casebookTally = deedTally();
  }
  private cancelConfirmNew(): void {
    this.confirmNew = false;
    this.setTitleFocus("start");
    this.announce("Kept your saved voyage.");
  }
  /** "Act II: The Crew", for the save a new voyage would replace; " ·" for Continue. */
  private saveLabel(separator = ":"): string | null {
    try {
      const { data } = readSave(KNOWN);
      const act = data && ACTS[data.act];
      return act ? `Act ${ROMAN[act.n] ?? act.n}${separator} ${act.title}` : null;
    } catch {
      return null;
    }
  }
  /** "Act II · The Crew": the recap's heading. */
  private actTitle(n: number): string | null {
    const def = ACTS[n];
    return def ? `Act ${ROMAN[def.n] ?? def.n} · ${def.title}` : null;
  }
  /** Down to black on the title and up on the voyage: no hard cut. What Set sail does. */
  private sail(): void {
    this.behindCurtain(() => { this.explore = false; this.title = false; this.loadGame(); });
  }
  private hitTitle(top: number, x: number, y: number): boolean {
    return hitTitleButton(top, x, y);
  }
  private renderTitle(ctx: CanvasRenderingContext2D): void {
    drawTitle(ctx, {
      bg: this.assets.img("bg_title"),
      // On a phone the menu is the DOM's, at 52 CSS pixels a line; the painting keeps the name.
      buttons: this.mobile ? [] : this.titleButtons(),
      focus: this.mobile ? null : this.titleFocus,
      dev: import.meta.env.DEV,
      confirmNew: this.mobile ? false : this.confirmNew,
      saveLabel: this.confirmLabel,
      time: this.titleClock,
      reduced: this.reduced,
      scale: this.textScale, // next-level: a11y — the title's chrome follows the text scale
      needle: this.needle,
      // next-level: casebook — "Chart: N of M notes" under the menu
      casebook: this.mobile ? null : this.casebookTally,
      decorate: this.titleDecor ?? undefined,
    });
  }
  /**
   * Drawn over the title painting, inside its drift: a hook for the harbour's ambient life
   * (lights on the water) so it moves with the picture. Nothing by default.
   */
  titleDecor: ((ctx: CanvasRenderingContext2D) => void) | null = null;
  private titleActivate(id: TitleId): void {
    if (id === "previous") {
      // The undo of Begin anew / Restart: put back the page that was replaced.
      if (restoreStashedSave()) {
        this.hasSave = true;
        this.hasPrevious = false;
        this.clearForeignSave();
        this.enterTitle();
        this.announce("Your earlier voyage is back. Continue takes it up.");
      } else {
        this.hasPrevious = false;
        this.announce("There is no earlier voyage to take up.");
      }
      return;
    }
    if (id === "start" && this.hasSave) {
      // A new voyage replaces the save: ask first, the way Restart does.
      if (this.confirmNew) return;
      this.confirmNew = true;
      this.confirmArmedAt = performance.now();
      this.confirmLabel = this.saveLabel();
      this.setTitleFocus("keep");
      this.audio.deny();
      this.announce("Start a new voyage? It replaces your saved one, which you can take up again " +
        "from the title. Keep my voyage, or Yes, start anew.");
      return;
    }
    if (id === "keep") {
      this.cancelConfirmNew();
      return;
    }
    // An answer within moments of the question is the hand that asked it (a double-click, a
    // key bounce): only a separate, later choice starts anew.
    if (id === "confirm" && (!this.confirmNew || performance.now() - this.confirmArmedAt < CONFIRM_GRACE_MS)) return;
    this.confirmNew = false;
    this.titleFocus = null;
    if (id === "start" || id === "confirm") { this.explore = false; this.beginNewVoyage(); }
    else if (id === "continue" && this.hasSave) {
      // next-level: recap — a save this browser can read gets the card first, and the room
      // waits behind Set sail. A corrupt (or older) save skips it, so loadGame's banner shows.
      const { data } = readSave(KNOWN);
      if (!data) this.sail();
      else {
        this.audio.page();
        this.recap.show(data);
        this.announce("Previously: where you left off. Set sail, read the chart, or go back.");
      }
    }
    else if (id === "explore") this.startExplore();
  }

  /** The scene curtain and its threshold card (fade.ts); the passage shot owns itself. */
  private renderFade(ctx: CanvasRenderingContext2D): void {
    // A cut with no shared threshold gets the short passage shot at full black.
    if (this.connector.active) {
      this.connector.draw(ctx, this.reduced);
      return;
    }
    drawFade(ctx, {
      fade: this.fade,
      reduced: this.reduced,
      entry: this.transition.entrySide(),
      card: this.exitCard,
    });
  }
}
