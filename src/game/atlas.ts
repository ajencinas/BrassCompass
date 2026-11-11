/**
 * The atlas — Fenn's chart of Dreadwater Isle, and the area views above the rooms.
 *
 * The rooms are close-ups; this is the layer that says where a close-up sits. From the island
 * the player picks an area (the harbour, upper town, the Marrow, the Shroud, the Grey Lantern),
 * then a place inside it. Only places already visited can be travelled to, so the map is a way
 * of seeing the world, not a way of skipping it.
 *
 * Laid out like a chart: the painting on the left, a numbered key on the right. The key avoids
 * the label collisions that make maps of nine places unreadable.
 */

export interface AtlasRoom {
  id: string;
  name: string;
  /** Position in the area painting, 0..1. */
  x: number;
  y: number;
  /** One line for the key. */
  note?: string;
}

export interface AtlasArea {
  id: string;
  name: string;
  act: number;
  blurb: string;
  /** Asset key of the area painting. */
  image: string;
  /** Position on the island chart, 0..1. */
  x: number;
  y: number;
  rooms: AtlasRoom[];
}

export const ATLAS: AtlasArea[] = [
  {
    id: "harbour",
    name: "The Harbour",
    act: 1,
    blurb: "The quay, the Salty Keel, the harbourmaster's house, and the lanes behind them.",
    image: "bg_area_harbour",
    x: 0.455,
    y: 0.605,
    rooms: [
      { id: "dock", name: "Dreadwater Harbour", x: 0.09, y: 0.62, note: "The Marrow and the harbourmaster's house." },
      { id: "pier_end", name: "The Harbour Mouth", x: 0.035, y: 0.66, note: "Vex at the lamp, where the harbour opens." },
      { id: "quay", name: "The Quay", x: 0.19, y: 0.72, note: "The boards between the harbour and the mouth." },
      { id: "tavern", name: "The Salty Keel", x: 0.295, y: 0.57, note: "Marta's fire, and the island's talk." },
      { id: "office", name: "The Harbourmaster's House", x: 0.39, y: 0.48, note: "Bramwick, his desk, and the harbour's book." },
      { id: "alley", name: "Wreckers' Lane", x: 0.49, y: 0.53, note: "The lane between the warehouses." },
      { id: "warehouse", name: "The Boat Shed", x: 0.60, y: 0.55, note: "A boat on its cradle, and someone hiding." },
      { id: "counting_house", name: "Vex's Warehouse", x: 0.70, y: 0.52, note: "Green lamps, cubbies, and Vex's ledger." },
      { id: "chandlery", name: "The Shipwright's", x: 0.86, y: 0.56, note: "Quill's counter, and Hobb's mast." },
    ],
  },
  {
    id: "town",
    name: "Upper Town",
    act: 1,
    blurb: "The lane climbs from the harbour to the light on the headland.",
    image: "bg_area_town",
    x: 0.275,
    y: 0.335,
    rooms: [
      { id: "village", name: "Upper Town", x: 0.38, y: 0.60, note: "Cobbles, a well, and the island's oldest inhabitants." },
      { id: "weather_works", name: "The Lighthouse", x: 0.80, y: 0.22, note: "Rook's light, and his old log." },
    ],
  },
  {
    id: "marrow",
    name: "The Marrow",
    act: 2,
    blurb: "Vex's ship, out on the water, with her crew and her cargo.",
    image: "bg_area_marrow",
    x: 0.155,
    y: 0.60,
    rooms: [
      { id: "bow_fog", name: "The Bow of the Marrow", x: 0.10, y: 0.48, note: "The first attempt at the Shroud." },
      { id: "marrow_deck", name: "The Deck", x: 0.30, y: 0.68, note: "The crew, the hatch and the rigging." },
      { id: "crows_nest", name: "The Crow's Nest", x: 0.36, y: 0.10, note: "Quill's office, high on the foremast." },
      { id: "below_decks", name: "The Crew Deck", x: 0.44, y: 0.62, note: "Dorrit's stove, and the hold below." },
      { id: "marrow_quarterdeck", name: "The Helm", x: 0.62, y: 0.58, note: "Vex at the wheel and the binnacle." },
      { id: "marrow_cabin", name: "The Captain's Cabin", x: 0.84, y: 0.52, note: "Vex's chart table." },
      { id: "marrow_gallery", name: "The Stern Gallery", x: 0.92, y: 0.55, note: "The wake, the sunset, and Quill off watch." },
    ],
  },
  {
    id: "shroud",
    name: "The Shroud",
    act: 3,
    blurb: "The fog flats, the wreck, the castaway camp, and the gate to the Grey Lantern.",
    image: "bg_area_shroud",
    x: 0.705,
    y: 0.425,
    rooms: [
      { id: "lagoon_shore", name: "The Wrack Line", x: 0.10, y: 0.66, note: "The longboat, and the way into the Shroud." },
      { id: "reef_wreck", name: "The Sunken Wreck", x: 0.46, y: 0.55, note: "The bell, the nameplate, and the dead." },
      { id: "salt_camp", name: "The Castaway Camp", x: 0.68, y: 0.60, note: "Elias, alive, and still charting." },
      { id: "far_pans", name: "The Far Flats", x: 0.82, y: 0.66, note: "The edge of the fog, and the ghost ship beyond." },
      { id: "key_gate", name: "The Reef Gate", x: 0.91, y: 0.54, note: "Where the longboat goes out to the Grey Lantern." },
    ],
  },
  {
    id: "lantern",
    name: "The Grey Lantern",
    act: 4,
    blurb: "Mordant's ship, deep in the fog, where the bell and the name wait.",
    image: "bg_area_lantern",
    x: 0.79,
    y: 0.335,
    rooms: [
      { id: "lantern_deck", name: "The Deck", x: 0.45, y: 0.62, note: "The great lantern, the bell, and Mordant's crew." },
      { id: "arcadia_cabin", name: "The Captain's Cabin", x: 0.78, y: 0.50, note: "The nameplate on Mordant's desk." },
    ],
  },
];

export function areaOfRoom(room: string): AtlasArea | undefined {
  return ATLAS.find((a) => a.rooms.some((r) => r.id === room));
}

export interface AtlasState {
  act: number;
  room: string | null;
  visited: (room: string) => boolean;
}

interface AtlasHandlers {
  onTravel: (room: string) => void;
  onDismiss: () => void;
}

export class Atlas {
  private overlay = document.createElement("div");
  private image = document.createElement("img");
  private stage = document.createElement("div");
  private markers = document.createElement("div");
  private eyebrow = document.createElement("p");
  private heading = document.createElement("h1");
  private lede = document.createElement("p");
  private keyTitle = document.createElement("p");
  private list = document.createElement("ol");
  private note = document.createElement("p");
  private back = document.createElement("button");
  private closeBtn = document.createElement("button");
  private previousFocus: HTMLElement | null = null;
  private view: "island" | string = "island";
  private state: AtlasState = { act: 1, room: null, visited: () => false };
  private handlers: AtlasHandlers;

  constructor(handlers: AtlasHandlers) {
    this.handlers = handlers;
    this.overlay.className = "atlas";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section class="atlas-frame" role="dialog" aria-modal="true" aria-labelledby="atlas-heading">
        <div class="atlas-main">
          <div class="atlas-view">
            <header class="atlas-head">
              <p class="eyebrow"></p>
              <h1 id="atlas-heading"></h1>
              <p class="lede"></p>
            </header>
            <div class="atlas-stage">
              <img class="atlas-image" alt="" />
              <div class="atlas-markers"></div>
            </div>
          </div>
          <aside class="atlas-key">
            <p class="atlas-key-title">KEY</p>
            <ol class="atlas-list"></ol>
            <p class="atlas-note" aria-live="polite"></p>
            <p class="atlas-legend">Bright: visited · Dim: not yet found · Fog: beyond</p>
          </aside>
        </div>
        <footer class="atlas-foot">
          <button class="atlas-back" type="button">← The island</button>
          <small>Click a place to travel · ↑ ↓ + Enter · Esc or Close</small>
          <button class="atlas-close" type="button">Close</button>
        </footer>
      </section>`;
    document.body.append(this.overlay);

    this.image = this.overlay.querySelector(".atlas-image")!;
    this.stage = this.overlay.querySelector(".atlas-stage")!;
    this.markers = this.overlay.querySelector(".atlas-markers")!;
    this.eyebrow = this.overlay.querySelector(".atlas-head .eyebrow")!;
    this.heading = this.overlay.querySelector(".atlas-head h1")!;
    this.lede = this.overlay.querySelector(".atlas-head .lede")!;
    this.keyTitle = this.overlay.querySelector(".atlas-key-title")!;
    this.list = this.overlay.querySelector(".atlas-list")!;
    this.note = this.overlay.querySelector(".atlas-note")!;
    this.back = this.overlay.querySelector(".atlas-back")!;
    this.closeBtn = this.overlay.querySelector(".atlas-close")!;

    this.back.addEventListener("click", () => this.goIsland());
    this.closeBtn.addEventListener("click", () => this.hide());
    // A click on the dark chart table outside the panel closes it, like every other page.
    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.hide();
    });
    this.overlay.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (this.view !== "island") this.goIsland();
        else this.hide();
        return;
      }
      if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp" ||
          event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const stops = [...this.overlay.querySelectorAll<HTMLElement>("button")]
          .filter((b) => !b.hidden && b.offsetParent !== null);
        if (!stops.length) return;
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const back = event.shiftKey || event.key === "ArrowUp" || event.key === "ArrowLeft";
        const next = at < 0 ? (back ? stops.length - 1 : 0) : (at + (back ? -1 : 1) + stops.length) % stops.length;
        event.preventDefault();
        this.overlay.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
        stops[next]?.classList.add("selected");
        stops[next]?.focus();
      }
    });
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(state: AtlasState): void {
    this.state = state;
    this.previousFocus = document.activeElement as HTMLElement;
    this.view = "island";
    this.overlay.hidden = false;
    this.render();
  }

  hide(): void {
    if (this.overlay.hidden) return;
    this.overlay.hidden = true;
    this.previousFocus?.focus();
    this.handlers.onDismiss();
  }

  private goIsland(): void {
    this.view = "island";
    this.render();
  }

  private goArea(id: string): void {
    this.view = id;
    this.render();
  }

  private area(): AtlasArea | undefined {
    return this.view === "island" ? undefined : ATLAS.find((a) => a.id === this.view);
  }

  private render(): void {
    const area = this.area();
    this.markers.replaceChildren();
    this.list.replaceChildren();
    this.note.textContent = "";
    this.stage.classList.toggle("island", !area);

    if (!area) {
      this.image.src = atlasImageUrl("bg_island_map");
      this.image.alt = "Fenn's chart of Dreadwater Isle";
      this.eyebrow.textContent = "FENN'S CHART";
      this.heading.textContent = "Dreadwater Isle";
      this.lede.textContent = "The harbour, the town, the ship, and the fog. Where I have been, and where I have not.";
      this.keyTitle.textContent = "THE ISLAND";
      this.back.hidden = true;
      const currentArea = areaOfRoom(this.state.room ?? "");
      ATLAS.forEach((a, i) => {
        const locked = a.act > this.state.act;
        const here = a.id === currentArea?.id;
        const label = `${a.name}${locked ? " — beyond the fog" : here ? " — you are here" : ""}`;
        const pick = (): void => {
          if (locked) {
            this.note.textContent = "The fog hides that part of the island. Not yet.";
            return;
          }
          this.goArea(a.id);
        };
        this.marker(i + 1, a.x, a.y, { klass: here ? "here" : locked ? "locked" : "", label, onPick: pick });
        this.row(i + 1, a.name, locked ? "Beyond the fog. Not yet." : `Act ${a.act}`, {
          klass: here ? "here" : locked ? "locked" : "",
          label,
          onPick: pick,
        });
      });
      this.focusFirst();
      return;
    }

    this.image.src = atlasImageUrl(area.image);
    this.image.alt = `${area.name} on Dreadwater Isle`;
    this.eyebrow.textContent = `ACT ${area.act} · DREADWATER ISLE`;
    this.heading.textContent = area.name;
    this.lede.textContent = area.blurb;
    this.keyTitle.textContent = area.name.toUpperCase();
    this.back.hidden = false;
    area.rooms.forEach((room, i) => {
      const here = room.id === this.state.room;
      const known = here || this.state.visited(room.id);
      const klass = here ? "here" : known ? "known" : "locked";
      const label = `${room.name}${here ? " — you are here" : known ? "" : " — not yet found"}`;
      const pick = (): void => {
        if (here) {
          this.hide();
          return;
        }
        if (!known) {
          this.note.textContent = "I have not found my way there yet.";
          return;
        }
        if (area.act !== this.state.act) {
          this.note.textContent = "That is another voyage. Not this one.";
          return;
        }
        this.hide();
        this.handlers.onTravel(room.id);
      };
      this.marker(i + 1, room.x, room.y, { klass, label, onPick: pick });
      this.row(i + 1, room.name, room.note ?? "", { klass, label, onPick: pick });
    });
    this.focusFirst();
  }

  private marker(n: number, x: number, y: number, opts: { klass: string; label: string; onPick: () => void }): void {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `atlas-marker ${opts.klass}`;
    b.style.left = `${x * 100}%`;
    b.style.top = `${y * 100}%`;
    b.setAttribute("aria-label", opts.label);
    b.textContent = String(n);
    b.addEventListener("click", opts.onPick);
    b.addEventListener("focus", () => {
      b.classList.add("selected");
      this.note.textContent = `Selected: ${opts.label}. Enter to open.`;
    });
    b.addEventListener("blur", () => b.classList.remove("selected"));
    this.markers.append(b);
  }

  private row(n: number, name: string, note: string, opts: { klass: string; label: string; onPick: () => void }): void {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = `atlas-row ${opts.klass}`;
    b.setAttribute("aria-label", opts.label);
    b.innerHTML = `<span class="atlas-num">${n}</span><span class="atlas-row-text"><span class="atlas-row-name">${escapeHtml(name)}</span><span class="atlas-row-note">${escapeHtml(note)}</span></span>`;
    b.addEventListener("click", opts.onPick);
    b.addEventListener("focus", () => {
      b.classList.add("selected");
      this.note.textContent = `Selected: ${name}. Enter to travel.`;
    });
    b.addEventListener("blur", () => b.classList.remove("selected"));
    li.append(b);
    this.list.append(li);
  }

  private focusFirst(): void {
    const first = this.overlay.querySelector<HTMLElement>(".atlas-marker") ?? this.back;
    if (!first) return;
    this.overlay.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    first.classList.add("selected");
    first.focus();
  }
}

export function atlasImageUrl(key: string): string {
  const images: Record<string, string> = {
    bg_island_map: "/assets/scenes/island_map.webp",
    bg_area_harbour: "/assets/scenes/area_harbour.webp",
    bg_area_town: "/assets/scenes/area_town.webp",
    bg_area_marrow: "/assets/scenes/area_marrow.webp",
    bg_area_shroud: "/assets/scenes/area_shroud.webp",
    bg_area_lantern: "/assets/scenes/area_lantern.webp",
  };
  return images[key] ?? "";
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
