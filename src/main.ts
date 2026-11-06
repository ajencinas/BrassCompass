/** Bootstrap — wire view, assets, audio and game together. */

import { View } from "./engine/view";
import { Input } from "./engine/input";
import { Assets } from "./engine/assets";
import { AudioEngine } from "./engine/audio";
import { Game } from "./game/game";
import { MANIFEST } from "./content/assets";
import { ROOMS, START_ROOM } from "./content/rooms";
import { ACTS, FIRST_ACT } from "./content/acts";
import { CHARACTERS } from "./content/characters";
import { SAVE_KEY } from "./game/save";

/** Sprite sheets drawn as strips, so their cells are measured while they load. */
const SHEETS = { char_walk_v2: 6, char_walk_vertical: 6 };

/** Every image a room draws: its plate, its sprites and the portraits of who stands in it. */
function roomImages(id: string): string[] {
  const room = ROOMS[id];
  if (!room) return [];
  const keys = [room.bg];
  for (const s of room.sprites ?? []) {
    keys.push(s.key);
    const portrait = s.speaker ? CHARACTERS[s.speaker]?.portrait : undefined;
    if (portrait) keys.push(portrait);
  }
  return keys;
}

/** Rooms a room's scripts can send the player to (exits, scene changes). */
function roomsReachedFrom(id: string): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Record<string, unknown>;
    if (o.k === "go" && typeof o.room === "string") out.push(o.room);
    for (const child of Object.values(o)) walk(child);
  };
  walk(ROOMS[id]);
  return out;
}

/**
 * The order to stream art in: where the player will be first (the saved room, or the start of
 * their act), then rooms by how few doors away they are. Anything unreachable follows after.
 */
function streamOrder(): string[] {
  let start = START_ROOM;
  let act = FIRST_ACT;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const save = raw ? (JSON.parse(raw) as { room?: unknown; act?: unknown }) : null;
    if (save && typeof save.act === "number" && ACTS[save.act]) act = save.act;
    if (save && typeof save.room === "string" && ROOMS[save.room]) start = save.room;
    else start = ACTS[act]?.start.room ?? START_ROOM;
  } catch { /* no storage: stream from the start */ }

  const rooms: string[] = [];
  const seen = new Set<string>();
  const frontier = [start, ACTS[act]?.start.room, ACTS[act + 1]?.start.room].filter((r): r is string => !!r);
  while (frontier.length) {
    const id = frontier.shift()!;
    if (seen.has(id) || !ROOMS[id]) continue;
    seen.add(id);
    rooms.push(id);
    frontier.push(...roomsReachedFrom(id));
  }
  return rooms.flatMap(roomImages);
}


async function boot(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const bootEl = document.getElementById("boot");
  const bar = document.getElementById("bootbar");

  const view = new View(canvas);
  const input = new Input(view);
  const assets = new Assets();
  const audio = new AudioEngine(assets);

  window.addEventListener("resize", () => view.resize());

  // Boot on the title art and the player only. The rest is ~86 MB, and nothing on the title
  // screen needs it: it streams in while the opening cinematic plays.
  const BOOT = new Set(["bg_dock_wide", "char_elias", "char_walk_v2", "char_walk_vertical"]);
  const pick = (keep: boolean) =>
    Object.fromEntries(Object.entries(MANIFEST.images).filter(([k]) => BOOT.has(k) === keep));

  // Audio is registered, not awaited: an <audio> element buffers when played, and iOS fetches
  // nothing before a gesture, so waiting on it only stalls boot.
  await assets.load({ images: pick(true), audio: MANIFEST.audio }, (p) => {
    if (bar) bar.style.width = `${Math.round(Math.min(1, p) * 100)}%`;
  }, { frames: SHEETS });

  const game = new Game(view, input, assets, audio);
  game.start();

  // Everything else in the background, a few at a time, nearest rooms first. A room the game
  // asks for before it has arrived jumps the queue (see Assets.img).
  void assets.load({ images: pick(false), audio: {} }, () => { /* no progress UI */ }, { priority: streamOrder(), frames: SHEETS });

  // The Adventure Editor (F2): dev server only, never part of the production bundle.
  if (import.meta.env.DEV) void import("./editor/editor").then((m) => m.install(game, view));

  // First gesture unlocks audio (browser autoplay policy).
  const unlock = (): void => {
    audio.unlock();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  bootEl?.classList.add("gone");
  window.setTimeout(() => bootEl?.remove(), 700);
}

void boot();
