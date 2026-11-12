/**
 * The ship's log, made real: the optional record after the closing card.
 *
 * The ending itself belongs to ending.ts. This is a separate DOM page shown once the card has
 * been read: what the voyage entered in the log, and what it left for another night. It is
 * a DOM overlay for the same reason the chart is — scrolling, selection and screen readers
 * come for free — and every click, Enter or Escape takes the player home, so it can never keep
 * them.
 *
 * What has been entered is remembered per browser in `brasscompass.deeds.v1`, apart from the
 * save, so the log accumulates across voyages. That is what the title screen counts.
 */

import { DEEDS, DEED_TOTAL, type Deed } from "../content/deeds";
import { restoreFocus } from "./focus";

export const DEEDS_KEY = "brasscompass.deeds.v1";
/** The last line of the voyage, and the bookend under both columns. */
export const DEEDS_BOOKEND = "DREADWATER: the light burning. All hands.";

/** The deeds entered so far, as ids. Unknown ids are kept (a future deed may claim one). */
export function readFiledDeeds(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DEEDS_KEY) || "[]");
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeFiledDeeds(ids: Iterable<string>): void {
  try { localStorage.setItem(DEEDS_KEY, JSON.stringify([...new Set(ids)])); } catch { /* the book is optional */ }
}

/**
 * Add every deed that holds now to the book and write it. Returns the full set of ids entered,
 * this voyage and earlier ones together.
 */
export function fileDeeds(holds: (deed: Deed) => boolean): Set<string> {
  const filed = readFiledDeeds();
  for (const deed of DEEDS) if (holds(deed)) filed.add(deed.id);
  writeFiledDeeds(filed);
  return filed;
}

/** How many of the deeds in this build have been entered, for the title screen. */
export function deedTally(): { filed: number; total: number } {
  const filed = readFiledDeeds();
  return { filed: DEEDS.reduce((n, deed) => n + (filed.has(deed.id) ? 1 : 0), 0), total: DEED_TOTAL };
}

/**
 * The page after the ending card: ENTERED on the left (label, stamped mark, what Fenn wrote),
 * NOT YET on the right (label and one spoiler-light line of where). Footer: N of M in the log.
 */
export class DeedsPage {
  private overlay = document.createElement("div");
  private body = document.createElement("div");
  private entered = document.createElement("ol");
  private unfiled = document.createElement("ol");
  private enteredCount = document.createElement("span");
  private unfiledCount = document.createElement("span");
  private tally = document.createElement("p");
  private previousFocus: HTMLElement | null = null;
  private onDismiss: () => void;

  constructor(onDismiss: () => void) {
    this.onDismiss = onDismiss;
    this.overlay.className = "deeds";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="deeds-heading">
        <header>
          <p class="eyebrow">THE SHIP'S LOG</p>
          <h1 id="deeds-heading">The voyage, entered</h1>
          <p class="lede">What the log keeps, and what I left for another night.</p>
        </header>
        <div class="deeds-body" tabindex="0">
          <div class="deeds-columns">
            <section class="deeds-column deeds-entered">
              <h2>Entered <span class="deeds-count"></span></h2>
              <ol></ol>
            </section>
            <section class="deeds-column deeds-unfiled">
              <h2>Not yet <span class="deeds-count"></span></h2>
              <ol></ol>
            </section>
          </div>
        </div>
        <p class="deeds-bookend"></p>
        <footer>
          <p class="deeds-tally"></p>
          <button data-action="close">Go home</button>
          <small>Enter, click or Escape to go home · the log keeps every voyage</small>
        </footer>
      </section>`;
    document.body.append(this.overlay);

    this.body = this.overlay.querySelector(".deeds-body")!;
    this.entered = this.overlay.querySelector(".deeds-entered ol")!;
    this.unfiled = this.overlay.querySelector(".deeds-unfiled ol")!;
    this.enteredCount = this.overlay.querySelector(".deeds-entered .deeds-count")!;
    this.unfiledCount = this.overlay.querySelector(".deeds-unfiled .deeds-count")!;
    this.tally = this.overlay.querySelector(".deeds-tally")!;
    this.overlay.querySelector(".deeds-bookend")!.textContent = DEEDS_BOOKEND;

    this.overlay.addEventListener("click", () => this.hide());
    this.overlay.addEventListener("keydown", (event) => {
      // The page owns its keys: nothing may leak to the game on the canvas behind it.
      event.stopPropagation();
      // A key still held from the ending card arrives as an auto-repeat; it is not a choice.
      if (event.repeat) {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") event.preventDefault();
        return;
      }
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.hide();
        return;
      }
      if (event.key === "Tab") {
        // Keep focus inside the dialog: the reading pane or the one button.
        const stops = [this.body, this.overlay.querySelector<HTMLElement>("button")!];
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

  show(holds: (deed: Deed) => boolean): void {
    if (this.open) return;
    this.previousFocus = document.activeElement as HTMLElement;

    // `win` has already filed them; filing again here is idempotent and keeps the page and the
    // title screen in agreement even if a dev tool opened the page without going through `win`.
    const filed = fileDeeds(holds);
    this.entered.replaceChildren();
    this.unfiled.replaceChildren();
    let enteredCount = 0;

    for (const deed of DEEDS) {
      const done = filed.has(deed.id);
      if (done) enteredCount++;
      const row = document.createElement("li");
      row.className = done ? "deed entered" : "deed unfiled";
      const head = document.createElement("div");
      head.className = "deed-head";
      const label = document.createElement("p");
      label.className = "deed-label";
      label.textContent = deed.label;
      head.append(label);
      if (done) {
        const stamp = document.createElement("span");
        stamp.className = "deed-stamp";
        stamp.setAttribute("aria-hidden", "true");
        stamp.textContent = "ENTERED";
        const said = document.createElement("span");
        said.className = "sr-only";
        said.textContent = "Entered.";
        head.append(stamp, said);
      }
      row.append(head);
      const note = document.createElement("p");
      if (done) {
        note.className = "deed-line";
        note.textContent = deed.line;
        row.append(note);
        this.entered.append(row);
      } else {
        note.className = "deed-where";
        note.textContent = deed.where;
        row.append(note);
        this.unfiled.append(row);
      }
    }

    const unfiledCount = DEED_TOTAL - enteredCount;
    this.enteredCount.textContent = `${enteredCount}`;
    this.unfiledCount.textContent = `${unfiledCount}`;
    this.entered.hidden = enteredCount === 0;
    this.unfiled.hidden = unfiledCount === 0;
    this.tally.textContent = `${enteredCount} of ${DEED_TOTAL} in the log`;

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
