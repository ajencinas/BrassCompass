/**
 * The recap card — what Continue owes a returning player.
 *
 * A save knows the room, the flags and the casebook; it doesn't know how to say them. This is the
 * one screen that does: where Fenn stood, what he was about to do, what he had worked out, what he
 * was carrying. It is a DOM overlay for the same reasons as the casebook (scrolling, selection,
 * screen readers work without reimplementing them), and it deliberately loads nothing: the room is
 * not entered until Set sail, so a player who came back only to remember can leave again without
 * waking anybody up.
 *
 * Everything the card says is derived here, from the save and a few names the game lends it. The
 * building of the words is a pure function, so it can be reasoned about without a browser.
 */

import type { CaseNote } from "./casebook";
import type { SaveData } from "./save";

/** What the card needs from the game: names, the act it is in, and the three ways out. */
export interface RecapHooks {
  /** "Act II · The Crew", or null for an act the content no longer has. */
  actTitle: (act: number) => string | null;
  /** A room's name as the game draws it. */
  roomName: (id: string) => string;
  /** An item's name as the game draws it. */
  itemName: (id: string) => string;
  /** The line the act opens with, for a save written at the act boundary. */
  actCaption: (act: number) => string | null;
  /** Whether this save is the last choice of a voyage that has already been finished. */
  waitingOnLastChoice: (act: number) => boolean;
  /** Down to black and into the saved room. The only way the room is entered. */
  sail: () => void;
  /** The casebook, opened over the card. */
  readCasebook: (notes: CaseNote[]) => void;
  /** Back to the title, nothing loaded, nothing written. */
  back: () => void;
}

/** Everything the card says, before it is put in a page. */
export interface RecapModel {
  /** "Act II · The Crew". */
  act: string;
  /** "Last sailed 3 days ago", or the apology when the save kept no date. */
  when: string;
  /** "Fenn was in The Marrow — Captain's Cabin." */
  where: string;
  /** What he was doing, or the act's opening line when the save was taken at the boundary. */
  doing: string;
  /** True when `doing` is the next act's caption rather than a hint. */
  opening: boolean;
  /** "He knows: 4 entries." */
  knows: string;
  /** The last two notes, oldest first. */
  notes: string[];
  /** "He is carrying: brass compass, crowbar and inspected rum." */
  carrying: string;
  /** A line was still being spoken when the save was written. */
  talking: boolean;
  /** The last choice of a finished voyage is what this save is waiting on. */
  waiting: boolean;
}

/** "just now", "1 minute ago", "3 hours ago", "3 days ago": time at the size a person says it. */
export function elapsedLabel(at: number | undefined, now: number): string | null {
  if (at === undefined || !Number.isFinite(at)) return null;
  const seconds = Math.max(0, (now - at) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes <= 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.round(seconds / 3600);
  if (hours < 24) return hours <= 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(seconds / 86400);
  if (days < 60) return days <= 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.round(days / 30.44);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

/** "a", "a and b", "a, b and c". Article-free, as the item names are. */
function joinNames(names: string[]): string {
  if (names.length === 0) return "nothing at all";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The card's words, from the save. */
export function buildRecap(data: SaveData, hooks: RecapHooks, now: number): RecapModel {
  const elapsed = elapsedLabel(data.at, now);
  const opening = data.actStarted === false;
  const caption = opening ? hooks.actCaption(data.act) : null;
  const tip = data.tip?.trim();
  return {
    act: hooks.actTitle(data.act) ?? `Act ${data.act}`,
    when: elapsed ? `Last sailed ${elapsed}.` : "Last sailed: the page doesn't say when.",
    where: `Fenn was in ${hooks.roomName(data.room)}.`,
    doing: opening
      ? caption
        ? `The act hasn't begun. It opens with: “${caption}”`
        : "The act hasn't begun. Nobody has said anything yet."
      : tip
        ? `He was doing: ${tip}`
        : "He was doing: something he didn't write down.",
    opening,
    knows: `He knows: ${data.notes.length} ${data.notes.length === 1 ? "entry" : "entries"}.`,
    notes: data.notes.slice(-2).map((n) => n.text),
    carrying: `He is carrying: ${joinNames(data.inventory.map((id) => hooks.itemName(id)))}.`,
    talking: Boolean(data.queue?.length),
    waiting: hooks.waitingOnLastChoice(data.act),
  };
}

export class Recap {
  private overlay = document.createElement("div");
  private body = document.createElement("div");
  private heading = document.createElement("h1");
  private when = document.createElement("p");
  private where = document.createElement("p");
  private doing = document.createElement("p");
  private knows = document.createElement("p");
  private notes = document.createElement("ul");
  private carrying = document.createElement("p");
  private talking = document.createElement("p");
  private waiting = document.createElement("p");
  private sailButton = document.createElement("button");
  private casebookButton = document.createElement("button");
  private backButton = document.createElement("button");
  private previousFocus: HTMLElement | null = null;
  private hooks: RecapHooks;
  private filed: CaseNote[] = [];
  /** Keys are watched on the window, in the capture phase: focus must not leak to the title. */
  private onKeyDown = (event: KeyboardEvent) => this.key(event);
  private listening = false;

  constructor(hooks: RecapHooks) {
    this.hooks = hooks;
    this.overlay.className = "recap";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="recap-heading" aria-describedby="recap-where">
        <header>
          <p class="eyebrow">PREVIOUSLY</p>
          <h1 id="recap-heading"></h1>
          <p class="recap-when" id="recap-when"></p>
        </header>
        <div class="recap-body" tabindex="0">
          <p class="recap-where" id="recap-where"></p>
          <p class="recap-doing"></p>
          <p class="recap-knows"></p>
          <ul class="recap-notes"></ul>
          <p class="recap-carrying"></p>
          <p class="recap-talking" hidden>Someone was still talking when you left.</p>
          <p class="recap-waiting" hidden>The last choice is still waiting.</p>
        </div>
        <footer>
          <div class="recap-answers">
            <button type="button" data-action="sail" class="primary">Set sail</button>
            <button type="button" data-action="casebook">Read the chart</button>
            <button type="button" data-action="back">Back</button>
          </div>
          <small>Enter sets sail · Escape goes back · the room itself waits until you do</small>
        </footer>
      </section>`;
    document.body.append(this.overlay);

    const q = <T extends HTMLElement>(selector: string): T => this.overlay.querySelector<T>(selector)!;
    this.body = q(".recap-body");
    this.heading = q("#recap-heading");
    this.when = q("#recap-when");
    this.where = q(".recap-where");
    this.doing = q(".recap-doing");
    this.knows = q(".recap-knows");
    this.notes = q(".recap-notes");
    this.carrying = q(".recap-carrying");
    this.talking = q(".recap-talking");
    this.waiting = q(".recap-waiting");
    this.sailButton = q('[data-action="sail"]');
    this.casebookButton = q('[data-action="casebook"]');
    this.backButton = q('[data-action="back"]');

    this.overlay.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest("button")?.dataset.action;
      if (action === "sail") this.sail();
      else if (action === "casebook") this.hooks.readCasebook(this.filed);
      else if (action === "back" || event.target === this.overlay) this.back();
    });
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(data: SaveData): void {
    if (this.open) return;
    this.previousFocus = document.activeElement as HTMLElement;
    this.filed = data.notes;

    const model = buildRecap(data, this.hooks, Date.now());
    this.heading.textContent = model.act;
    this.when.textContent = model.when;
    this.where.textContent = model.where;
    this.doing.textContent = model.doing;
    this.doing.classList.toggle("recap-opening", model.opening);
    this.knows.textContent = model.knows;
    this.notes.replaceChildren(...model.notes.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    this.notes.hidden = model.notes.length === 0;
    this.carrying.textContent = model.carrying;
    this.talking.hidden = !model.talking;
    this.waiting.hidden = !model.waiting;

    this.overlay.hidden = false;
    this.body.scrollTop = 0;
    this.listen();
    // Enter does what Enter should: the voyage, not the card that describes it.
    this.sailButton.focus();
  }

  /** Close the card and stay on the title. */
  hide(): void {
    if (!this.open) return;
    this.overlay.hidden = true;
    this.unlisten();
    this.previousFocus?.focus();
  }

  private back(): void {
    if (!this.open) return;
    this.hide();
    this.hooks.back();
  }

  private sail(): void {
    if (!this.open) return;
    this.hide();
    this.hooks.sail();
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    // Capture, so no key reaches the title behind the card, wherever focus has wandered.
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  private unlisten(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown, true);
  }

  private key(event: KeyboardEvent): void {
    // The casebook can sit over the card, and its keys are its own.
    if (event.target instanceof Element && event.target.closest(".casebook, .history")) return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.back();
      return;
    }
    if (event.key === "Tab") {
      // Keep focus inside the dialog: the text, then the three answers.
      const stops: HTMLElement[] = [this.body, this.sailButton, this.casebookButton, this.backButton];
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
      event.preventDefault();
      stops[next].focus();
      return;
    }
    // Enter on "Read the chart" or "Back" is that button's to answer; anywhere else — the
    // opening focus, the text, the backdrop — it sets sail.
    const onOtherButton = document.activeElement instanceof HTMLButtonElement &&
      document.activeElement !== this.sailButton;
    if (event.key === "Enter" && !onOtherButton) {
      event.preventDefault();
      this.sail();
    }
  }
}
