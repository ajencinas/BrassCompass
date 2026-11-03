/**
 * The casebook — Fenn's notes, in the order he made them.
 *
 * A four-act story needs somewhere to put what you have learned. The tip line tells you the next
 * step; the casebook tells you why it is a step. It is a DOM overlay rather than a canvas one so
 * that scrolling, selection and screen readers work without reimplementing them.
 */

export interface CaseNote {
  id: string;
  text: string;
  /** Act the note was filed in, taken at the moment of discovery. */
  act: number;
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
          <p class="eyebrow">FENN'S CASEBOOK</p>
          <h1 id="casebook-heading">What I know so far</h1>
          <p class="lede">Everything worth writing down, in the order I wrote it.</p>
        </header>
        <div class="casebook-body"></div>
        <footer>
          <button data-action="close">Close</button>
          <small>J or Escape to close · the casebook is kept with your save</small>
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
      }
    });

    this.titles = actTitles;
  }

  private titles: Record<number, string>;

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(notes: CaseNote[]): void {
    if (this.open) return;
    this.previousFocus = document.activeElement as HTMLElement;

    this.body.replaceChildren();
    if (notes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "casebook-empty";
      empty.textContent = "Nothing yet. I have been busy being shouted at.";
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
    this.count.textContent = notes.length === 1 ? "1 entry" : `${notes.length} entries`;

    this.overlay.hidden = false;
    this.body.scrollTop = this.body.scrollHeight;
    this.overlay.querySelector<HTMLButtonElement>("button")!.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.overlay.hidden = true;
    this.previousFocus?.focus();
    this.onDismiss();
  }
}
