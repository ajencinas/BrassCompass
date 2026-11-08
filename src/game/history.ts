/**
 * The line history — the last thirty things said, for a line that went by too quickly.
 *
 * A DOM overlay like the casebook, so scrolling, selection and screen readers come for free.
 * It is not saved: it is a reading aid, not a record of the voyage (that is the casebook).
 */

export interface HistoryLine {
  speaker: string;
  text: string;
  /** A choice the player made, rather than something said to them. */
  choice?: boolean;
}

export const HISTORY_MAX = 30;

export class History {
  private overlay = document.createElement("div");
  private list: HTMLOListElement;
  private previousFocus: HTMLElement | null = null;
  readonly lines: HistoryLine[] = [];

  constructor(private onDismiss: () => void) {
    this.overlay.className = "casebook history";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="history-heading">
        <header>
          <p class="eyebrow">LINE HISTORY</p>
          <h1 id="history-heading">What was just said</h1>
          <p class="lede">The last ${HISTORY_MAX} lines, newest at the bottom.</p>
        </header>
        <ol class="casebook-body history-body" tabindex="0" aria-label="Recent lines"></ol>
        <footer>
          <button data-action="close">Close</button>
          <small>L or Escape to close</small>
        </footer>
      </section>`;
    document.body.append(this.overlay);
    this.list = this.overlay.querySelector("ol")!;

    this.overlay.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest("button")?.dataset.action;
      if (action === "close" || event.target === this.overlay) this.hide();
    });
    this.overlay.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key.toLowerCase() === "l") {
        event.preventDefault();
        this.hide();
        return;
      }
      if (event.key === "Tab") {
        const stops = [this.list, this.overlay.querySelector<HTMLElement>("button")!];
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
        event.preventDefault();
        stops[next].focus();
      }
    });
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  /** Record a line. The same line twice in a row (a re-shown tip) is kept once. */
  add(line: HistoryLine): void {
    const last = this.lines[this.lines.length - 1];
    if (last && last.text === line.text && last.speaker === line.speaker) return;
    this.lines.push(line);
    if (this.lines.length > HISTORY_MAX) this.lines.splice(0, this.lines.length - HISTORY_MAX);
  }

  clear(): void {
    this.lines.length = 0;
  }

  show(): void {
    if (this.open) return;
    this.previousFocus = document.activeElement as HTMLElement;
    this.list.replaceChildren();
    if (!this.lines.length) {
      const empty = document.createElement("li");
      empty.className = "casebook-empty";
      empty.textContent = "Nothing has been said yet.";
      this.list.append(empty);
    }
    for (const line of this.lines) {
      const row = document.createElement("li");
      row.className = line.choice ? "casebook-entry history-choice" : "casebook-entry";
      const who = document.createElement("strong");
      who.textContent = line.speaker ? `${line.speaker}: ` : "";
      row.append(who, document.createTextNode(line.text));
      this.list.append(row);
    }
    this.overlay.hidden = false;
    this.list.focus();
    this.list.scrollTop = this.list.scrollHeight;
  }

  hide(): void {
    if (!this.open) return;
    this.overlay.hidden = true;
    this.previousFocus?.focus();
    this.onDismiss();
  }
}
