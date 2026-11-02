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

  await assets.load(MANIFEST, (p) => {
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  });

  const game = new Game(view, input, assets, audio);
  game.start();

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
