/**
 * The chart — Fenn's notes, in the order he pinned them.
 *
 * A four-act story needs somewhere to put what you have learned. The tip line tells you the next
 * step; the chart tells you why it is a step. It is a DOM overlay rather than a canvas one so
 * that scrolling, selection and screen readers work without reimplementing them.
 */

import { restoreFocus } from "./focus";

export interface CaseNote {
  id: string;
  text: string;
  /** Act the note was filed in, taken at the moment of discovery. */
  act: number;
}

/** What the chart knows about this moment, besides the notes. */
export interface CasebookView {
  /**
   * What to do next, at the rung the player has earned (TipLadder.shown(): the nudge unless
   * they asked for the answer). Omitted on the title, in Chapter select and after the ending.
   */
  plan?: string;
  /** Act and room, so the notes have a place as well as an order. */
  where?: string;
}

export class Casebook {
  private overlay = document.createElement("div");
  private body = document.createElement("div");
  private count = document.createElement("p");
  private previousFocus: HTMLElement | null = null;
  private onDismiss: () => void;

  constructor(actTitles: Record<number, string>, onDismiss: () => void) {
    this.onDismiss = onDismiss;
    this.overlay.className = "casebook";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="casebook-heading">
        <header>
          <p class="eyebrow">FENN'S CHART OF THE SHROUD</p>
          <h1 id="casebook-heading">What I know so far</h1>
          <p class="lede">Everything I've pinned to the chart, in the order I found it.</p>
        </header>
        <div class="casebook-body" tabindex="0"></div>
        <footer>
          <button data-action="close">Close</button>
          <small>J or Escape to close · the chart is kept with your save</small>
        </footer>
      </section>`;
    document.body.append(this.overlay);

    this.body = this.overlay.querySelector(".casebook-body")!;
    this.count = document.createElement("p");
    this.count.className = "casebook-count";
    this.overlay.querySelector("header")!.append(this.count);

    this.overlay.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest("button")?.dataset.action;
      if (action === "close" || event.target === this.overlay) this.hide();
    });
    this.overlay.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        this.hide();
        return;
      }
      if (event.key === "Tab") {
        // Keep focus inside the dialog: body -> button -> body.
        const stops = [this.body, this.overlay.querySelector<HTMLElement>("button")!];
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
        event.preventDefault();
        stops[next].focus();
      }
    });

    this.titles = actTitles;
  }

  private titles: Record<number, string>;

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(notes: CaseNote[], view: CasebookView = {}): void {
    if (this.open) return;
    this.previousFocus = document.activeElement as HTMLElement;

    this.body.replaceChildren();
    // next-level: casebook — the next step sits above the notes: a plan, not a confession. It is
    // the nudge the tip ladder is showing unless the player has asked for the answer.
    const plan = view.plan?.trim();
    const where = view.where?.trim();
    if (plan || where) {
      const next = document.createElement("div");
      next.className = "casebook-next";
      const label = document.createElement("p");
      label.className = "eyebrow";
      label.textContent = "NEXT";
      next.append(label);
      if (plan) {
        const line = document.createElement("p");
        line.className = "casebook-plan";
        line.textContent = plan;
        next.append(line);
      }
      if (where) {
        const place = document.createElement("p");
        place.className = "casebook-where";
        place.textContent = where;
        next.append(place);
      }
      this.body.append(next);
    }
    if (notes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "casebook-empty";
      empty.textContent = "Nothing pinned yet. I have been busy being shouted at.";
      this.body.append(empty);
    } else {
      const acts = [...new Set(notes.map((n) => n.act))].sort((a, b) => a - b);
      for (const act of acts) {
        const heading = document.createElement("h2");
        heading.textContent = this.titles[act] ?? `Act ${act}`;
        this.body.append(heading);
        for (const note of notes.filter((n) => n.act === act)) {
          const row = document.createElement("p");
          row.className = "casebook-entry";
          row.textContent = note.text;
          this.body.append(row);
        }
      }
    }
    this.count.textContent = notes.length === 1 ? "1 note" : `${notes.length} notes`;

    this.overlay.hidden = false;
    this.body.scrollTop = 0;
    this.body.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.overlay.hidden = true;
    restoreFocus(this.previousFocus);
    this.onDismiss();
  }
}
