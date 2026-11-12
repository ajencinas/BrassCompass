/** Bootstrap — wire view, assets, audio and game together. */

import { View, wantsMobileLayout } from "./engine/view";
import { Input } from "./engine/input";
import { Assets } from "./engine/assets";
import { AudioEngine } from "./engine/audio";
import { Game } from "./game/game";
import { MANIFEST, assetUrl } from "./content/assets";
import "./mobile.css";

/** Sprite sheets drawn as strips, so their cells are measured while they load. */
const SHEETS = { char_walk_v2: 6, char_walk_vertical: 6 };

// next-level: ship — the manifest writes site-absolute paths; rebase them onto the build's base
// (a subdirectory on itch.io) before anything fetches them.
const IMAGES = withBase(MANIFEST.images);
const AUDIO = withBase(MANIFEST.audio);

function withBase(urls: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).map(([key, url]) => [key, assetUrl(url)]));
}

/**
 * Boot only what the first screen shows: the title chart, the harbour room behind it, the cold
 * open's desk and Fenn. Everything else is lazy, by room (see `Assets.ensure`). The old boot
 * queued every non-boot image — ~86 MB before the manifest was pruned — while a slow connection
 * sat on the title, and a room could arrive without its plate.
 */
const BOOT = new Set([
  "bg_title", "bg_dock_cinema_wide", "bg_coldopen", "bg_office_wide",
  "char_elias", "char_walk_v2", "char_walk_vertical",
]);
const ESSENTIAL = ["bg_title", "bg_dock_cinema_wide", "char_elias"];

function pick(keep: boolean): Record<string, string> {
  return Object.fromEntries(Object.entries(IMAGES).filter(([k]) => BOOT.has(k) === keep));
}

/**
 * The first room could not load even after the loader's retries. Say so instead of leaving a
 * black canvas: name the missing picture, offer a retry, and keep it keyboard accessible.
 */
function showBootFailure(missing: string[]): void {
  const boot = document.getElementById("boot");
  boot?.classList.add("gone");
  window.setTimeout(() => boot?.remove(), 700);
  const panel = document.getElementById("bootfail");
  const detail = document.getElementById("bootfail-detail");
  if (detail) {
    detail.textContent = missing.length
      ? `The first room's art could not be loaded (${missing.join(", ")}).`
      : "The first room's art could not be loaded.";
  }
  if (panel) {
    panel.hidden = false;
    (document.getElementById("bootfail-retry") as HTMLButtonElement | null)?.focus();
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const bootEl = document.getElementById("boot");
  const bar = document.getElementById("bootbar");

  // The touch layout is chosen before the first draw: its stage has a different aspect ratio,
  // and the canvas must be fitted to that, not to the 16:9 desktop frame. The title is the
  // first screen, and it uses the full frame.
  const mobile = wantsMobileLayout();
  const syncOrientation = (): void => {
    document.body.classList.toggle("m-landscape", window.innerWidth > window.innerHeight);
  };
  if (mobile) {
    document.body.classList.add("mobile", "m-full");
    syncOrientation();
    canvas.setAttribute("aria-label",
      "The Brass Compass. The scene is a painting; the touch controls below it are buttons: the verbs, the satchel, and the action plate that confirms what you tapped.");
  }
  const view = new View(canvas, mobile);
  const input = new Input(view);
  const assets = new Assets();
  const audio = new AudioEngine(assets);

  window.addEventListener("resize", () => view.resize());

  // Teach the loader the whole manifest up front, so a room entry can ask for exactly its own
  // art later without re-reading the manifest.
  assets.setCatalog(IMAGES);

  // Audio is registered, not awaited: an <audio> element buffers when played, and iOS fetches
  // nothing before a gesture, so waiting on it only stalls boot.
  await assets.load({ images: pick(true), audio: AUDIO }, (p) => {
    if (bar) bar.style.width = `${Math.round(Math.min(1, p) * 100)}%`;
  }, { frames: SHEETS });

  // Dev/test builds load the active shelf before the first frame: the playthrough and editor
  // drive a synthetic clock and cannot wait for a lazy room request mid-frame. Production keeps
  // the lazy-by-room path above.
  if (import.meta.env.DEV) await assets.ensure(Object.keys(IMAGES));

  const missing = ESSENTIAL.filter((key) => assets.hasFailed([key]));
  if (missing.length) {
    console.error("boot failed:", missing.join(", "));
    showBootFailure(missing);
    return;
  }

  const game = new Game(view, input, assets, audio);
  game.start();

  // Dev/test helpers. Tests drive the clock synchronously (__ff), so they cannot wait for a
  // room's lazy art mid-loop; __prefetchAll lets the harness load the whole manifest first.
  // Production keeps the lazy-by-room behaviour above.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__prefetchAll = () => assets.ensure(Object.keys(IMAGES));
    // The Adventure Editor (F2): dev server only, never part of the production bundle.
    void import("./editor/editor").then((m) => m.install(game, view));
  }

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

document.getElementById("bootfail-retry")?.addEventListener("click", () => window.location.reload());
void boot();
