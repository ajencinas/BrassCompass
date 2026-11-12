/**
 * MobileUI — the touch chrome.
 *
 * The game is painted into a 1920-wide canvas. On a phone that canvas is 390 CSS pixels wide, so
 * its 20–28 px labels become four-pixel type and its 44 px plates become nine-pixel buttons. No
 * amount of scaling fixes both at once. The touch layout therefore keeps the canvas for the
 * scene (the part that wants to be a picture) and builds the interface a second time in DOM,
 * where a button is 44 CSS pixels because it is written in CSS pixels.
 *
 * This file owns only the DOM and its styling hooks. It never reaches into the game: every
 * button calls a callback on MobileBridge, and every frame the game hands it a plain MobileState
 * to render. That keeps the touch UI testable and the desktop path untouched.
 */

import type { VerbId } from "./types";

export type MobileBarId = "reveal" | "log" | "tip" | "casebook" | "map" | "pause";
export type MobileTitleId = "continue" | "start" | "explore" | "keep" | "confirm" | "previous";

export interface MobileButton {
  id: MobileTitleId;
  label: string;
  sub?: string;
  kind: "primary" | "quiet" | "danger";
  disabled?: boolean;
}

export interface MobileVerb {
  id: VerbId;
  label: string;
  active: boolean;
  suggested: boolean;
}

export interface MobileItem {
  id: string;
  name: string;
  selected: boolean;
}

export interface MobileDialogueChoice {
  text: string;
  seen: boolean;
}

export interface MobileRoom {
  id: string;
  label: string;
}

export interface MobileState {
  screen: "title" | "prologue" | "play" | "dialogue" | "ending";
  blocked: boolean;
  title: { buttons: MobileButton[] };
  prologue: {
    text: string;
    shown: number;
    speaker: string;
    canStamp: boolean;
    skippable: boolean;
    stamped: boolean;
  };
  dialogue: {
    speaker: string;
    text: string;
    shown: number;
    choices: MobileDialogueChoice[];
    canAdvance: boolean;
  } | null;
  ending: { page: number; pages: number } | null;
  play: {
    act: string;
    room: string;
    narration: string;
    narrationShown: number;
    sentence: string;
    explore: boolean;
    armed: { label: string; hint: string } | null;
    waiting: boolean;
    verbs: MobileVerb[];
    inventory: MobileItem[];
    page: number;
    pages: number;
  };
  reveal: boolean;
  tip: boolean;
  roomMenu: { open: boolean; rooms: MobileRoom[] } | null;
}

export interface MobileBridge {
  bar(id: MobileBarId): void;
  verb(id: VerbId): void;
  item(id: string): void;
  page(delta: number): void;
  clear(): void;
  confirm(): void;
  cancel(): void;
  continueStory(): void;
  dialogueTap(): void;
  dialogueChoice(index: number): void;
  title(id: MobileTitleId): void;
  prologueStamp(): void;
  prologueSkip(): void;
  advanceEnding(): void;
  room(id: string): void;
  openRooms(): void;
  closeRooms(): void;
  state(): MobileState;
}

const BARS: { id: MobileBarId; glyph: string; label: string }[] = [
  { id: "reveal", glyph: "◉", label: "Reveal interactive things" },
  { id: "log", glyph: "≡", label: "Line history" },
  { id: "tip", glyph: "✦", label: "Tip" },
  { id: "casebook", glyph: "◈", label: "Chart" },
  { id: "map", glyph: "⌖", label: "Map" },
  { id: "pause", glyph: "Ⅱ", label: "Pause" },
];

export class MobileUI {
  private root: HTMLElement;
  private top: HTMLElement;
  private scenes: HTMLButtonElement;
  private hud: HTMLElement;
  private where: HTMLElement;
  private roomName: HTMLElement;
  private narration: HTMLElement;
  private sentence: HTMLElement;
  private action: HTMLButtonElement;
  private actionLabel: HTMLElement;
  private actionHint: HTMLElement;
  private cancel: HTMLButtonElement;
  private verbs: HTMLElement;
  private bag: HTMLButtonElement;
  private bagCount: HTMLElement;
  private clear: HTMLButtonElement;
  private title: HTMLElement;
  private titleButtons: HTMLElement;
  private prologue: HTMLElement;
  private prologueSpeaker: HTMLElement;
  private prologueText: HTMLElement;
  private prologueStamp: HTMLButtonElement;
  private prologueSkip: HTMLButtonElement;
  private dialogue: HTMLElement;
  private speaker: HTMLElement;
  private dialogueText: HTMLButtonElement;
  private choices: HTMLElement;
  private dialogueContinue: HTMLButtonElement;
  private ending: HTMLElement;
  private endingPage: HTMLElement;
  private drawers: HTMLElement;
  private items: HTMLElement;
  private itemsEmpty: HTMLElement;
  private pager: HTMLElement;
  private pagerLabel: HTMLElement;
  private rooms: HTMLElement;
  private roomList: HTMLElement;

  private drawerOpen = false;
  /** The last screen state sync saw, so a real screen change can move focus once. */
  private lastScreen: MobileState["screen"] | null = null;
  /** The chapter-select sheet was up on the previous sync. */
  private roomsWereOpen = false;
  /** What had focus before a conversation took it, so the play screen gets it back. */
  private dialogueReturnFocus: HTMLElement | null = null;
  /** The title was built once already; a later rebuild is a menu change worth focusing. */
  private titleBuilt = false;
  private itemKey = "";
  private choiceKey = "";
  private titleKey = "";
  private roomKey = "";
  private lastNarration = "";
  private lastWhere = "";
  private lastRoom = "";
  private lastLine = "";
  private lastSpeaker = "";
  private lastDialogue = "";
  private lastPrologue = "";
  private lastEnding = "";

  constructor(private bridge: MobileBridge) {
    this.root = document.createElement("div");
    this.root.id = "mobile-ui";
    this.root.innerHTML = `
      <div class="m-top" role="toolbar" aria-label="Game controls"></div>
      <section class="m-hud" aria-label="Game controls">
        <div class="m-context">
          <p class="m-where"></p>
          <p class="m-room-name"></p>
          <p class="m-narration"></p>
          <p class="m-line"></p>
          <button type="button" class="m-action" hidden>
            <span class="m-action-label"></span>
            <span class="m-action-hint"></span>
          </button>
          <button type="button" class="m-quiet m-cancel" hidden>Cancel</button>
        </div>
        <div class="m-verbs" role="toolbar" aria-label="Verbs"></div>
        <div class="m-bag-row">
          <button type="button" class="m-bag" aria-expanded="false" aria-controls="m-drawer">
            <span class="m-bag-glyph" aria-hidden="true">◈</span>
            <span class="m-bag-label">Satchel</span>
            <span class="m-bag-count"></span>
          </button>
          <button type="button" class="m-quiet m-clear" hidden>Clear</button>
        </div>
      </section>
      <section class="m-title" aria-label="Title" hidden>
        <div class="m-title-inner">
          <p class="m-title-eyebrow">A TALE OF DREADWATER ISLE</p>
          <div class="m-title-buttons"></div>
        </div>
      </section>
      <section class="m-prologue" aria-label="Cold open" hidden>
        <div class="m-prologue-inner">
          <p class="m-prologue-speaker"></p>
          <p class="m-prologue-text" aria-live="polite"></p>
          <div class="m-prologue-actions">
            <button type="button" class="m-primary m-prologue-stamp">Stamp the day-book</button>
            <button type="button" class="m-quiet m-prologue-skip" hidden>Skip</button>
          </div>
        </div>
      </section>
      <section class="m-dialogue" role="dialog" aria-label="Conversation" hidden>
        <div class="m-dialogue-inner">
          <p class="m-speaker"></p>
          <button type="button" class="m-dialogue-text"></button>
          <div class="m-choices"></div>
          <button type="button" class="m-primary m-dialogue-continue" hidden>Continue</button>
        </div>
      </section>
      <section class="m-ending" aria-label="Voyage's end" hidden>
        <div class="m-ending-inner">
          <p class="m-ending-page"></p>
          <button type="button" class="m-primary m-ending-continue">Continue</button>
        </div>
      </section>
      <section class="m-drawer" id="m-drawer" aria-label="Satchel" hidden>
        <header class="m-drawer-head">
          <h2>Satchel</h2>
          <button type="button" class="m-quiet m-drawer-close">Done</button>
        </header>
        <div class="m-items"></div>
        <p class="m-items-empty" hidden>Nothing yet.</p>
        <div class="m-pager" hidden>
          <button type="button" class="m-quiet m-page-prev" aria-label="Previous satchel page">‹</button>
          <span class="m-pager-label"></span>
          <button type="button" class="m-quiet m-page-next" aria-label="Next satchel page">›</button>
        </div>
      </section>
      <section class="m-rooms" aria-label="Go to a scene" hidden>
        <div class="m-rooms-inner">
          <header class="m-drawer-head">
            <h2>Go to a scene</h2>
            <button type="button" class="m-quiet m-rooms-close">Done</button>
          </header>
          <div class="m-room-list"></div>
        </div>
      </section>`;
    document.body.append(this.root);

    this.top = this.q(".m-top");
    this.hud = this.q(".m-hud");
    this.where = this.q(".m-where");
    this.roomName = this.q(".m-room-name");
    this.narration = this.q(".m-narration");
    this.sentence = this.q(".m-line");
    this.action = this.q<HTMLButtonElement>(".m-action");
    this.actionLabel = this.q(".m-action-label");
    this.actionHint = this.q(".m-action-hint");
    this.cancel = this.q<HTMLButtonElement>(".m-cancel");
    this.verbs = this.q(".m-verbs");
    this.bag = this.q<HTMLButtonElement>(".m-bag");
    this.bagCount = this.q(".m-bag-count");
    this.clear = this.q<HTMLButtonElement>(".m-clear");
    this.title = this.q(".m-title");
    this.titleButtons = this.q(".m-title-buttons");
    this.prologue = this.q(".m-prologue");
    this.prologueSpeaker = this.q(".m-prologue-speaker");
    this.prologueText = this.q(".m-prologue-text");
    this.prologueStamp = this.q<HTMLButtonElement>(".m-prologue-stamp");
    this.prologueSkip = this.q<HTMLButtonElement>(".m-prologue-skip");
    this.dialogue = this.q(".m-dialogue");
    this.speaker = this.q(".m-speaker");
    this.dialogueText = this.q<HTMLButtonElement>(".m-dialogue-text");
    this.choices = this.q(".m-choices");
    this.dialogueContinue = this.q<HTMLButtonElement>(".m-dialogue-continue");
    this.ending = this.q(".m-ending");
    this.endingPage = this.q(".m-ending-page");
    this.drawers = this.q(".m-drawer");
    this.items = this.q(".m-items");
    this.itemsEmpty = this.q(".m-items-empty");
    this.pager = this.q(".m-pager");
    this.pagerLabel = this.q(".m-pager-label");
    this.rooms = this.q(".m-rooms");
    this.roomList = this.q(".m-room-list");

    this.buildTopBar();
    this.scenes = this.q<HTMLButtonElement>(".m-scenes");
    this.bind();
    document.body.classList.add("m-ready");
  }

  /** Whether a focused/keyboard event belongs to the touch chrome rather than the canvas. */
  contains(node: Node | null): boolean {
    return Boolean(node && this.root.contains(node));
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) throw new Error(`mobile UI: missing ${selector}`);
    return el;
  }

  private buildTopBar(): void {
    for (const bar of BARS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "m-icon";
      button.dataset.bar = bar.id;
      button.setAttribute("aria-label", bar.label);
      button.title = bar.label;
      if (bar.id === "reveal" || bar.id === "tip") button.setAttribute("aria-pressed", "false");
      button.innerHTML = `<span aria-hidden="true">${bar.glyph}</span>`;
      this.top.append(button);
    }
    // Chapter select is a mode, not one of the six icon actions; it only appears while the
    // player is exploring, so an ordinary voyage's bar stays quiet.
    this.scenes = document.createElement("button");
    this.scenes.type = "button";
    this.scenes.className = "m-icon m-scenes";
    this.scenes.hidden = true;
    this.scenes.setAttribute("aria-label", "Chapter select");
    this.scenes.title = "Chapter select";
    this.scenes.innerHTML = `<span aria-hidden="true">▦</span>`;
    this.top.append(this.scenes);
  }

  private bind(): void {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-bar],[data-verb],[data-item],[data-title],[data-room],[data-choice]");
      if (target) {
        const bar = target.dataset.bar as MobileBarId | undefined;
        if (bar) { this.bridge.bar(bar); return; }
        const verb = target.dataset.verb as VerbId | undefined;
        if (verb) { this.bridge.verb(verb); return; }
        const item = target.dataset.item;
        if (item) {
          this.bridge.item(item);
          this.setDrawer(false);
          return;
        }
        const title = target.dataset.title as MobileTitleId | undefined;
        if (title) { this.bridge.title(title); return; }
        const room = target.dataset.room;
        if (room) { this.bridge.room(room); return; }
        const choice = Number(target.dataset.choice);
        if (Number.isInteger(choice)) { this.bridge.dialogueChoice(choice); return; }
        return;
      }
      if (event.target === this.action || this.action.contains(event.target as Node)) {
        if (this.action.dataset.action === "continue") this.bridge.continueStory();
        else this.bridge.confirm();
        return;
      }
      if (event.target === this.cancel) { this.bridge.cancel(); return; }
      if (event.target === this.clear) { this.bridge.clear(); return; }
      if (this.scenes.contains(event.target as Node)) { this.bridge.openRooms(); return; }
      if (this.bag.contains(event.target as Node)) { this.setDrawer(!this.drawerOpen); return; }
      if ((event.target as Element | null)?.closest(".m-drawer-close")) { this.setDrawer(false); return; }
      if (event.target === this.dialogueText) { this.bridge.dialogueTap(); return; }
      if (event.target === this.dialogueContinue) { this.bridge.dialogueTap(); return; }
      if (event.target === this.prologueStamp) { this.bridge.prologueStamp(); return; }
      if (event.target === this.prologueSkip) { this.bridge.prologueSkip(); return; }
      if (event.target === this.endingPage) return;
      if ((event.target as Element | null)?.closest(".m-ending-continue")) { this.bridge.advanceEnding(); return; }
      if ((event.target as Element | null)?.closest(".m-rooms-close")) { this.bridge.closeRooms(); return; }
      if ((event.target as Element | null)?.closest(".m-page-prev")) { this.bridge.page(-1); return; }
      if ((event.target as Element | null)?.closest(".m-page-next")) { this.bridge.page(1); return; }
    });
  }

  private setDrawer(open: boolean): void {
    const was = this.drawerOpen;
    this.drawerOpen = open;
    this.drawers.hidden = !open;
    this.bag.setAttribute("aria-expanded", String(open));
    if (open) this.renderItems(this.bridge.state());
    // The satchel is a real drawer: opening it puts the keyboard on the first thing inside,
    // and closing it returns to the bag that opened it, not to <body>.
    if (open && !was) {
      const first = this.items.querySelector<HTMLButtonElement>(".m-item")
        ?? this.q<HTMLButtonElement>(".m-drawer-close");
      first?.focus({ preventScroll: true });
    } else if (!open && was && this.drawers.contains(document.activeElement)) {
      if (this.isShowing(this.bag)) this.bag.focus({ preventScroll: true });
      else this.focusGame();
    }
  }

  /** Whether an element is actually rendered (its ancestors are not hidden). */
  private isShowing(el: HTMLElement | null): boolean {
    return Boolean(el && !el.hidden && el.getClientRects().length > 0);
  }

  /** Put the keyboard back on the canvas. */
  private focusGame(): void {
    const canvas = document.getElementById("game");
    canvas?.focus({ preventScroll: true });
  }

  /** Update the DOM from the game's plain state. Cheap enough to call ten times a second. */
  sync(state: MobileState): void {
    const play = state.play;
    this.root.classList.toggle("is-blocked", state.blocked);
    this.top.hidden = state.screen !== "play";
    this.hud.hidden = state.screen !== "play";
    this.title.hidden = state.screen !== "title";
    this.prologue.hidden = state.screen !== "prologue";
    this.dialogue.hidden = state.screen !== "dialogue";
    this.ending.hidden = state.screen !== "ending";
    this.rooms.hidden = !(state.screen === "play" && state.roomMenu?.open);
    if (state.screen !== "play") this.setDrawer(false);
    this.scenes.hidden = state.screen !== "play" || !play.explore;
    this.syncTopBar(state);
    this.syncTitle(state);
    this.syncPrologue(state);
    this.syncDialogue(state);
    this.syncEnding(state);
    this.syncRooms(state);

    const where = play.act;
    if (where !== this.lastWhere) { this.where.textContent = where; this.lastWhere = where; }
    if (play.room !== this.lastRoom) { this.roomName.textContent = play.room; this.lastRoom = play.room; }

    const narration = play.narration.slice(0, Math.max(0, play.narrationShown));
    if (narration !== this.lastNarration) {
      this.narration.textContent = narration;
      this.narration.hidden = narration.length === 0;
      this.lastNarration = narration;
    }
    const line = play.sentence;
    if (line !== this.lastLine) {
      this.sentence.textContent = line;
      this.sentence.hidden = line.length === 0;
      this.lastLine = line;
    }

    const armed = play.armed;
    const context = this.hud.querySelector(".m-context");
    context?.classList.toggle("is-idle", !play.narration && !line && !armed && !play.waiting);
    context?.classList.toggle("is-armed", Boolean(armed));
    if (armed) {
      this.action.hidden = false;
      this.action.dataset.action = "confirm";
      this.actionLabel.textContent = armed.label;
      this.actionHint.textContent = armed.hint;
    } else if (play.waiting) {
      this.action.hidden = false;
      this.action.dataset.action = "continue";
      this.actionLabel.textContent = "Continue";
      this.actionHint.textContent = "Tap to go on";
    } else {
      this.action.hidden = true;
      delete this.action.dataset.action;
    }
    this.cancel.hidden = !armed && line.length === 0;
    this.clear.hidden = line.length === 0 && !play.inventory.some((item) => item.selected);
    this.bagCount.textContent = play.inventory.length ? String(play.inventory.length) : "";
    this.bag.setAttribute("aria-label", play.inventory.length
      ? `Satchel, ${play.inventory.length} ${play.inventory.length === 1 ? "thing" : "things"}`
      : "Satchel, empty");

    this.syncVerbs(state);
    if (this.drawerOpen) this.renderItems(state);

    // A sheet or a screen that replaced another one moves focus with it: a real DOM button that
    // has just been put away (or shown) must not leave the keyboard on <body>.
    const screenChanged = this.lastScreen !== null && this.lastScreen !== state.screen;
    this.lastScreen = state.screen;
    const roomsOpen = state.screen === "play" && Boolean(state.roomMenu?.open);
    if (roomsOpen && !this.roomsWereOpen) this.focusRooms();
    else if (!roomsOpen && this.roomsWereOpen && !screenChanged) this.focusAfterRooms();
    this.roomsWereOpen = roomsOpen;
    if (screenChanged) this.focusScreen(state.screen);
  }

  /** Focus the first scene of the chapter-select sheet (or its Done button if it is empty). */
  private focusRooms(): void {
    const first = this.roomList.querySelector<HTMLButtonElement>(".m-room")
      ?? this.q<HTMLButtonElement>(".m-rooms-close");
    first.focus({ preventScroll: true });
  }

  /** The sheet closed: back to the button that opens it, or to the scene if focus had left. */
  private focusAfterRooms(): void {
    const active = document.activeElement;
    if (!this.rooms.contains(active) && active !== document.body) return;
    if (this.isShowing(this.scenes)) this.scenes.focus({ preventScroll: true });
    else this.focusGame();
  }

  /** Move focus onto the control the new screen is built around. */
  private focusScreen(screen: MobileState["screen"]): void {
    if (screen === "title") {
      // Land on the recommended answer (Continue, Keep, Begin), as the canvas title does.
      const button = this.titleButtons.querySelector<HTMLButtonElement>("button.m-primary:not([disabled])")
        ?? this.titleButtons.querySelector<HTMLButtonElement>("button:not([disabled])");
      if (this.isShowing(this.title)) button?.focus({ preventScroll: true });
      return;
    }
    if (screen === "dialogue") {
      this.dialogueReturnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
      this.dialogueText.focus({ preventScroll: true });
      return;
    }
    if (screen === "ending") {
      this.q<HTMLButtonElement>(".m-ending-continue").focus({ preventScroll: true });
      return;
    }
    if (screen === "play" && !this.roomsWereOpen) {
      const back = this.dialogueReturnFocus;
      this.dialogueReturnFocus = null;
      if (back && this.isShowing(back)) back.focus({ preventScroll: true });
      else this.focusGame();
    }
  }

  private syncTopBar(state: MobileState): void {
    const reveal = this.top.querySelector<HTMLButtonElement>('[data-bar="reveal"]');
    const tip = this.top.querySelector<HTMLButtonElement>('[data-bar="tip"]');
    reveal?.setAttribute("aria-pressed", String(state.reveal));
    tip?.setAttribute("aria-pressed", String(state.tip));
    reveal?.classList.toggle("on", state.reveal);
    tip?.classList.toggle("on", state.tip);
  }

  private syncTitle(state: MobileState): void {
    const key = state.title.buttons.map((b) => `${b.id}|${b.label}|${b.sub ?? ""}|${b.kind}|${b.disabled ? 1 : 0}`).join("§");
    if (key === this.titleKey) return;
    this.titleKey = key;
    const rebuild = this.titleBuilt;
    this.titleBuilt = true;
    this.titleButtons.replaceChildren();
    for (const b of state.title.buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.title = b.id;
      button.className = `m-title-button m-${b.kind}`;
      button.disabled = Boolean(b.disabled);
      const label = document.createElement("span");
      label.className = "m-title-label";
      label.textContent = b.label;
      button.append(label);
      if (b.sub) {
        const sub = document.createElement("span");
        sub.className = "m-title-sub";
        sub.textContent = b.sub;
        button.append(sub);
      }
      this.titleButtons.append(button);
    }
    // A confirmation or a finished voyage changed the menu under the keyboard: land on its
    // recommended answer instead of losing focus with the buttons that were replaced.
    if (rebuild && state.screen === "title" && this.isShowing(this.title)) {
      const primary = this.titleButtons.querySelector<HTMLButtonElement>(".m-primary");
      (primary ?? this.titleButtons.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll: true });
    }
  }

  private syncPrologue(state: MobileState): void {
    const p = state.prologue;
    const text = p.text.slice(0, Math.max(0, p.shown));
    if (text !== this.lastPrologue) {
      this.prologueText.textContent = text;
      this.lastPrologue = text;
    }
    this.prologueSpeaker.textContent = p.speaker;
    this.prologueSpeaker.hidden = !p.speaker;
    this.prologueStamp.disabled = !p.canStamp;
    this.prologueStamp.textContent = p.stamped ? "Stamped" : "Stamp the day-book";
    this.prologueSkip.hidden = !p.skippable;
  }

  private syncDialogue(state: MobileState): void {
    const d = state.dialogue;
    if (!d) return;
    if (d.speaker !== this.lastSpeaker) { this.speaker.textContent = d.speaker; this.lastSpeaker = d.speaker; }
    const text = d.text.slice(0, Math.max(0, d.shown));
    if (text !== this.lastDialogue) { this.dialogueText.textContent = text; this.lastDialogue = text; }
    const key = d.choices.map((c) => `${c.text}|${c.seen ? 1 : 0}`).join("§");
    if (key !== this.choiceKey) {
      this.choiceKey = key;
      const hadFocus = this.choices.contains(document.activeElement);
      this.choices.replaceChildren();
      d.choices.forEach((choice, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.choice = String(i);
        button.className = `m-choice${choice.seen ? " seen" : ""}`;
        button.textContent = choice.text;
        this.choices.append(button);
      });
      if (hadFocus) {
        const first = this.choices.querySelector<HTMLButtonElement>(".m-choice");
        (first ?? this.dialogueText).focus({ preventScroll: true });
      }
    }
    this.dialogueContinue.hidden = !d.canAdvance || d.choices.length > 0;
  }

  private syncEnding(state: MobileState): void {
    const e = state.ending;
    if (!e) return;
    const text = `Page ${e.page} of ${e.pages}`;
    if (text !== this.lastEnding) { this.endingPage.textContent = text; this.lastEnding = text; }
  }

  private syncRooms(state: MobileState): void {
    const menu = state.roomMenu;
    if (!menu?.open) return;
    const key = menu.rooms.map((room) => `${room.id}|${room.label}`).join("§");
    if (key === this.roomKey) return;
    this.roomKey = key;
    this.roomList.replaceChildren();
    for (const room of menu.rooms) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.room = room.id;
      button.className = "m-room";
      button.textContent = room.label;
      this.roomList.append(button);
    }
  }

  private syncVerbs(state: MobileState): void {
    const verbs = state.play.verbs;
    if (this.verbs.childElementCount !== verbs.length) {
      this.verbs.replaceChildren();
      for (const verb of verbs) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.verb = verb.id;
        button.setAttribute("aria-label", verb.label);
        button.textContent = verb.label;
        this.verbs.append(button);
      }
    }
    for (let i = 0; i < verbs.length; i++) {
      const button = this.verbs.children[i] as HTMLButtonElement | undefined;
      if (!button) continue;
      button.classList.toggle("active", verbs[i].active);
      button.classList.toggle("suggested", verbs[i].suggested);
      button.setAttribute("aria-pressed", String(verbs[i].active));
    }
  }

  private renderItems(state: MobileState): void {
    const items = state.play.inventory;
    const key = `${state.play.page}|${items.map((item) => `${item.id}|${item.name}`).join("§")}`;
    if (key !== this.itemKey) {
      this.itemKey = key;
      this.items.replaceChildren();
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.item = item.id;
        button.className = "m-item";
        button.textContent = item.name;
        this.items.append(button);
      }
    }
    this.items.hidden = items.length === 0;
    this.itemsEmpty.hidden = items.length > 0;
    for (let i = 0; i < items.length; i++) {
      const button = this.items.children[i] as HTMLButtonElement | undefined;
      if (button) button.classList.toggle("selected", items[i].selected);
    }
    this.pager.hidden = state.play.pages < 2;
    this.pagerLabel.textContent = `${state.play.page + 1} / ${state.play.pages}`;
  }
}
