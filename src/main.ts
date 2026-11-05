/** Bootstrap — wire view, assets, audio and game together. */

import { View } from "./engine/view";
import { Input } from "./engine/input";
import { Assets } from "./engine/assets";
import { AudioEngine } from "./engine/audio";
import { Game } from "./game/game";
import { MANIFEST } from "./content/assets";


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

  await assets.load({ images: pick(true), audio: MANIFEST.audio }, (p) => {
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  });

  const game = new Game(view, input, assets, audio);
  game.start();

  // Everything else in the background, at low priority.
  void assets.load({ images: pick(false), audio: {} }, () => { /* no progress UI */ });

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
