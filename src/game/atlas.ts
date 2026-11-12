/**
 * The atlas — Fenn's chart of Dreadwater Isle, and the area views above the rooms.
 *
 * The rooms are close-ups; this is the layer that says where a close-up sits. From the island
 * the player picks an area (the harbour, upper town, the Marrow, the Shroud, the Grey Lantern),
 * then a place inside it. Only places already visited can be travelled to, so the map is a way
 * of seeing the world, not a way of skipping it.
 *
 * Laid out as a painted chart: the picture fills the screen and the places are marks of light on
 * it. A visited place burns; a place not yet found is under fog; the place Fenn stands in is a
 * small breathing compass. Names are not written on the chart — they appear on a slip of paper
 * only when a mark is hovered or focused. The numbered column and the legend are gone; the same
 * places remain as an invisible list for screen readers and for the tests that drive them.
 */

import { restoreFocus } from "./focus";

export interface AtlasRoom {
  id: string;
  name: string;
  /** Position in the area painting, 0..1. */
  x: number;
  y: number;
  /** One line for the hidden list. */
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
    image: "bg_area_harbour_v2",
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
      { id: "counting_house", name: "Vex's Warehouse", x: 0.70, y: 0.52, note: "Green lamps, cubbies, and Vex's charts." },
      { id: "chandlery", name: "The Shipwright's", x: 0.86, y: 0.56, note: "Quill's counter, and Hobb's mast." },
    ],
  },
  {
    id: "town",
    name: "Upper Town",
    act: 1,
    blurb: "The lane climbs from the harbour to the light on the headland.",
    image: "bg_area_town_v2",
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
    image: "bg_area_marrow_v2",
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
    image: "bg_area_shroud_v2",
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
    image: "bg_area_lantern_v2",
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
  private chart = document.createElement("canvas");
  private wash!: HTMLElement;
  private stage = document.createElement("div");
  private markers = document.createElement("div");
  private heading = document.createElement("h1");
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
        <div class="atlas-wash" aria-hidden="true"></div>
        <header class="atlas-head">
          <h1 id="atlas-heading"></h1>
        </header>
        <div class="atlas-stage">
          <canvas class="atlas-chart" role="img" aria-label=""></canvas>
          <div class="atlas-markers"></div>
        </div>
        <aside class="atlas-key" aria-label="Places on the chart">
          <ol class="atlas-list"></ol>
        </aside>
        <p class="atlas-note" aria-live="polite"></p>
        <button class="atlas-back" type="button" aria-label="Back to the island" title="Back to the island"><span aria-hidden="true">←</span></button>
        <button class="atlas-close" type="button" aria-label="Close the chart" title="Close the chart"><span aria-hidden="true">✕</span></button>
      </section>`;
    document.body.append(this.overlay);

    this.chart = this.overlay.querySelector(".atlas-chart")!;
    this.wash = this.overlay.querySelector(".atlas-wash")!;
    this.stage = this.overlay.querySelector(".atlas-stage")!;
    this.markers = this.overlay.querySelector(".atlas-markers")!;
    this.heading = this.overlay.querySelector(".atlas-head h1")!;
    this.list = this.overlay.querySelector(".atlas-list")!;
    this.note = this.overlay.querySelector(".atlas-note")!;
    this.back = this.overlay.querySelector(".atlas-back")!;
    this.closeBtn = this.overlay.querySelector(".atlas-close")!;

    // A window resize re-lays-out the stage; the chart is redrawn to fill it.
    window.addEventListener("resize", () => { if (this.open) this.drawChart(); });
    this.back.addEventListener("click", () => this.goIsland());
    this.closeBtn.addEventListener("click", () => this.hide());
    // The chart is a full-screen object, so "outside the chart" is the dark water around it.
    this.wash.addEventListener("click", () => this.hide());
    // Clicking the painted chart itself should not strand keyboard focus on <body>: return it to
    // the current marker so arrows/Enter keep working.
    this.chart.addEventListener("pointerdown", () => {
      if (document.activeElement === document.body) this.focusFirst();
    });
    this.overlay.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (this.view !== "island") this.goIsland();
        else this.hide();
        return;
      }
      const dir = event.key === "ArrowDown" || event.key === "ArrowRight" || (event.key === "Tab" && !event.shiftKey)
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft" || (event.key === "Tab" && event.shiftKey) ? -1 : 0;
      if (!dir) return;
      const all = [...this.overlay.querySelectorAll<HTMLElement>("button")]
        .filter((b) => !b.hidden && b.tabIndex >= 0);
      // Tab walks the whole dialog, screen-reader list included. The arrows walk the marks the
      // eye can see on the chart, so keyboard focus never seems to vanish onto a hidden row.
      const stops = event.key === "Tab"
        ? all
        : [...this.overlay.querySelectorAll<HTMLElement>(".atlas-marker, .atlas-back, .atlas-close")]
          .filter((b) => !b.hidden && b.offsetParent !== null);
      const use = stops.length ? stops : all;
      if (!use.length) return;
      const at = use.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? (dir < 0 ? use.length - 1 : 0) : (at + dir + use.length) % use.length;
      event.preventDefault();
      this.overlay.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
      use[next]?.classList.add("selected");
      use[next]?.focus();
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
    // Drop the large chart allocation; it is repainted the next time it opens.
    this.chart.width = 1;
    this.chart.height = 1;
    restoreFocus(this.previousFocus);
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
      const url = atlasImageUrl("bg_atlas_island");
      this.paintChart(url, "Fenn's chart of Dreadwater Isle");
      this.heading.textContent = "Dreadwater Isle";
      this.back.hidden = true;
      const currentArea = areaOfRoom(this.state.room ?? "");
      ATLAS.forEach((a) => {
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
        this.marker(a.x, a.y, { klass: here ? "here" : locked ? "locked" : "", label, tag: a.name, onPick: pick });
        this.row(a.name, here ? "You are here." : locked ? "Beyond the fog. Not yet." : `Act ${a.act}`, {
          klass: here ? "here" : locked ? "locked" : "",
          label,
          onPick: pick,
        });
      });
      this.focusFirst();
      return;
    }

    const url = atlasImageUrl(area.image);
    this.paintChart(url, `${area.name} on Dreadwater Isle`);
    this.heading.textContent = area.name;
    this.back.hidden = false;
    area.rooms.forEach((room) => {
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
      this.marker(room.x, room.y, { klass, label, tag: room.name, onPick: pick });
      this.row(room.name, here ? "You are here." : room.note ?? "", { klass, label, onPick: pick });
    });
    this.focusFirst();
  }

  /**
   * The chart itself is painted onto a canvas that fills the stage. A full-window <img> of the
   * same painting stalls this Chrome's screenshot path; the canvas also keeps the chart crisp
   * at every window size and gives the markers a stable box to stand on.
   */
  private chartUrl = "";
  private art: HTMLImageElement | null = null;

  private paintChart(url: string, label: string): void {
    this.chart.setAttribute("aria-label", label);
    if (url !== this.chartUrl) {
      this.chartUrl = url;
      this.art = null;
      const art = new Image();
      art.decoding = "async";
      art.onload = () => {
        if (this.chartUrl !== url) return;
        this.art = art;
        this.drawChart();
      };
      art.src = url;
    }
    this.drawChart();
  }

  private drawChart(): void {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // A static chart does not need a 4K/8K backing store; cap it like the game canvas.
    const dprCapped = Math.min(dpr, 1920 / w, 1080 / h);
    const cw = Math.max(1, Math.round(w * dprCapped)), ch = Math.max(1, Math.round(h * dprCapped));
    if (this.chart.width !== cw) this.chart.width = cw;
    if (this.chart.height !== ch) this.chart.height = ch;
    const ctx = this.chart.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(cw / w, 0, 0, ch / h, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#04090c";
    ctx.fillRect(0, 0, w, h);
    const art = this.art;
    if (!art || !art.width || !art.height) return;
    const k = Math.min(w / art.width, h / art.height);
    const dw = art.width * k, dh = art.height * k;
    ctx.drawImage(art, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  private marker(x: number, y: number, opts: { klass: string; label: string; tag: string; onPick: () => void }): void {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `atlas-marker ${opts.klass}`;
    b.style.left = `${x * 100}%`;
    b.style.top = `${y * 100}%`;
    b.setAttribute("aria-label", opts.label);
    b.title = opts.tag;
    const glow = document.createElement("span");
    glow.className = "atlas-glow";
    glow.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("span");
    glyph.className = "atlas-glyph";
    glyph.setAttribute("aria-hidden", "true");
    const tag = document.createElement("span");
    tag.className = "atlas-tag";
    tag.setAttribute("aria-hidden", "true");
    tag.textContent = opts.tag;
    b.append(glow, glyph, tag);
    b.addEventListener("click", () => {
      opts.onPick();
      // Fog does not open: the mark shivers, so a click on it is plainly answered.
      if (opts.klass.includes("locked")) {
        b.classList.remove("denied");
        void b.offsetWidth;
        b.classList.add("denied");
        window.setTimeout(() => b.classList.remove("denied"), 620);
      }
    });
    b.addEventListener("focus", () => {
      b.classList.add("selected");
      this.note.textContent = `Selected: ${opts.tag}. Enter to open.`;
    });
    b.addEventListener("blur", () => b.classList.remove("selected"));
    this.markers.append(b);
  }

  /** The same place, as a row in the list only a screen reader (or a test) reads. */
  private row(name: string, note: string, opts: { klass: string; label: string; onPick: () => void }): void {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = `atlas-row ${opts.klass}`;
    // The list mirrors the marks for a screen reader; Tab stays on the marks a sighted player
    // can see, so keyboard focus never vanishes into the hidden list.
    b.tabIndex = -1;
    b.setAttribute("aria-label", opts.label);
    b.innerHTML = `<span class="atlas-row-name">${escapeHtml(name)}</span><span class="atlas-row-note">${escapeHtml(note)}</span>`;
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
    const mobile = document.body.classList.contains("mobile");
    const first = (mobile
      ? this.overlay.querySelector<HTMLElement>(".atlas-row")
      : this.overlay.querySelector<HTMLElement>(".atlas-marker")) ?? this.back;
    if (!first) return;
    this.overlay.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    first.classList.add("selected");
    first.focus();
  }
}

export function atlasImageUrl(key: string): string {
  const images: Record<string, string> = {
    bg_atlas_island: "/assets/scenes/title_night.webp",
    bg_title: "/assets/scenes/title_night.webp",
    bg_area_harbour: "/assets/scenes/area_harbour.webp",
    bg_area_town: "/assets/scenes/area_town.webp",
    bg_area_marrow: "/assets/scenes/area_marrow.webp",
    bg_area_shroud: "/assets/scenes/area_shroud.webp",
    bg_area_lantern: "/assets/scenes/area_lantern.webp",
    bg_area_harbour_v2: "/assets/scenes/area_harbour_v2.webp",
    bg_area_town_v2: "/assets/scenes/area_town_v2.webp",
    bg_area_marrow_v2: "/assets/scenes/area_marrow_v2.webp",
    bg_area_shroud_v2: "/assets/scenes/area_shroud_v2.webp",
    bg_area_lantern_v2: "/assets/scenes/area_lantern_v2.webp",
  };
  return images[key] ?? "";
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
