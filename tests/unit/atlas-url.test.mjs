// The atlas's plates, and every other runtime URL, have to be resolved against the page's own
// path: a root-absolute /assets/... works on a domain root and 404s one directory up, which is
// exactly where itch.io and a GitHub Pages project put the game.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loader } from "../../tools/adv-lib.mjs";

// assetUrl resolves against the page's base URI. The page here stands in for one served from
// a subdirectory, which is where a root-absolute URL breaks.
globalThis.document = { baseURI: "https://example.test/game/" };

const vite = await loader();
after(() => vite.close());
const { assetUrl } = await vite.load("/src/content/assets.ts");
const { atlasImageUrl, ATLAS } = await vite.load("/src/game/atlas.ts");

/** The raw paths the atlas keeps in its own table, as the source has them. */
const RAW = {
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

test("the atlas's plates are rebased like every other asset", () => {
  // The atlas kept its own table of raw paths and handed them straight to an <img>: under a
  // subdirectory they resolved to the domain root, and the area plates 404ed while the rest
  // of the game was fine. Every plate has to come out of the same rebasing as the rest of the
  // game's art.
  for (const [key, raw] of Object.entries(RAW)) {
    const url = atlasImageUrl(key);
    assert.ok(url, `${key} has a plate`);
    assert.equal(url, assetUrl(raw), `${key} goes through assetUrl`);
    assert.notEqual(url, raw, `${key} is not handed to the page raw`);
  }
});

test("the atlas's area cards name plates that exist", () => {
  for (const area of ATLAS) {
    const url = atlasImageUrl(area.image);
    assert.ok(url, `${area.id} (${area.image}) has a plate`);
    assert.ok(url.includes("/assets/scenes/"), `${area.id} points at a scene plate: ${url}`);
  }
});
