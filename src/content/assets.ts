/** Every image and sound the game may load, by key. */

/**
 * A site-absolute asset path — `/assets/scenes/dock_wide.webp`, as the manifest and the `.adv`
 * scripts write them — as a URL that works wherever the build is served from.
 *
 * `vite.config.ts` builds with `base: "./"`, so the game can sit at a domain root, in a
 * subdirectory (itch.io serves a packaged game under `/html/…/index.html`) or on a filesystem.
 * Anything fetched at runtime — images, music, the act cinematics — goes through here: a plain
 * `/assets/…` would otherwise be resolved against the server root and 404 one directory up.
 */
export function assetUrl(path: string): string {
  // Already relative, or a full URL (http:, data:, blob:): nothing to rebase.
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  // Resolve the build's base against the page first, so `./` means "next to index.html" even
  // when the page is loaded as /sub/index.html rather than /sub/.
  return new URL(path.slice(1), new URL(import.meta.env.BASE_URL, document.baseURI)).href;
}

/**
 * The live asset manifest. Active content only: the compiler checks room backgrounds and
 * sprites against these keys, and the startup/room loaders can only fetch what is named here.
 *
 * Everything else in `public/assets` is source art the live story does not use (superseded
 * plates, earlier character studies, item icons from old puzzles, the previous story's films).
 * It stays on disk, and the build excludes it via `src/content/active-assets.json`; see
 * `tools/asset-manifest.mjs`. Adding a key here without naming it in a room, act, dialogue,
 * item or runtime module fails `npm run test:assets`.
 */
export const MANIFEST = {
  images: {
    // Live room plates, atlas area maps, title/cold-open art and the ending paintings.
    bg_alley_restart_wide: "/assets/scenes/alley_restart_a.webp",
    bg_arcadia_cabin_restart_b_wide: "/assets/scenes/arcadia_cabin_restart_b_wide.webp",
    bg_area_harbour: "/assets/scenes/area_harbour.webp",
    bg_area_harbour_v2: "/assets/scenes/area_harbour_v2.webp",
    bg_area_lantern: "/assets/scenes/area_lantern.webp",
    bg_area_lantern_v2: "/assets/scenes/area_lantern_v2.webp",
    bg_area_marrow: "/assets/scenes/area_marrow.webp",
    bg_area_marrow_v2: "/assets/scenes/area_marrow_v2.webp",
    bg_area_shroud: "/assets/scenes/area_shroud.webp",
    bg_area_shroud_v2: "/assets/scenes/area_shroud_v2.webp",
    bg_area_town: "/assets/scenes/area_town.webp",
    bg_area_town_v2: "/assets/scenes/area_town_v2.webp",
    bg_atlas_island: "/assets/scenes/title_night.webp",
    bg_below_decks_restart_wide: "/assets/scenes/below_decks_restart_wide.webp",
    bg_bow_fog_restart_b_wide: "/assets/scenes/bow_fog_restart_b_wide.webp",
    bg_cabin_v2_wide: "/assets/scenes/cabin_v2_wide.webp",
    bg_chandlery_restart_wide: "/assets/scenes/chandlery_restart_a.webp",
    bg_coldopen: "/assets/scenes/coldopen.webp",
    bg_countinghouse_restart_wide: "/assets/scenes/countinghouse_restart_b.webp",
    bg_crows_nest_restart_wide: "/assets/scenes/crows_nest_restart_wide.webp",
    bg_deck_wide: "/assets/scenes/deck_wide.webp",
    bg_dock_cinema_wide: "/assets/scenes/dock_cinema_wide.webp",
    bg_dock_wide: "/assets/scenes/dock_wide.webp",
    bg_far_pans_v2b_wide: "/assets/scenes/far_pans_v2b_wide.webp",
    bg_gallery_v2_wide: "/assets/scenes/gallery_v2_wide.webp",
    bg_key_gate_v2b_wide: "/assets/scenes/key_gate_v2b_wide.webp",
    bg_lagoon_shore_v2b_wide: "/assets/scenes/lagoon_shore_v2b_wide.webp",
    bg_lantern_deck_restart_b_wide: "/assets/scenes/lantern_deck_restart_b_wide.webp",
    bg_marrow_deck_v2_wide: "/assets/scenes/marrow_deck_v2_wide.webp",
    bg_office_cinema_wide: "/assets/scenes/office_cinema_wide.webp",
    bg_office_wide: "/assets/scenes/office_wide.webp",
    bg_pierend_cinema_wide: "/assets/scenes/pierend_cinema_wide.webp",
    bg_quarterdeck_v2_wide: "/assets/scenes/quarterdeck_v2_wide.webp",
    bg_quay_cinema_wide: "/assets/scenes/quay_cinema_wide.webp",
    bg_reef_wreck_v2b_wide: "/assets/scenes/reef_wreck_v2b_wide.webp",
    bg_salt_camp_v2b_wide: "/assets/scenes/salt_camp_v2b_wide.webp",
    bg_shore_wide: "/assets/scenes/shore_wide.webp",
    bg_tavern_cinema_wide: "/assets/scenes/tavern_cinema_wide.webp",
    bg_title: "/assets/scenes/title_night.webp",
    bg_village_v2_wide: "/assets/scenes/village_v2_wide.webp",
    bg_warehouse_restart_wide: "/assets/scenes/warehouse_restart_b.webp",
    bg_weather_works_v2b_wide: "/assets/scenes/weather_works_v2b_wide.webp",
    // The painted cast and Fenn's walk sheets.
    char_elias: "/assets/characters/elias_painted_v2.png",
    char_walk_v2: "/assets/characters/elias_walk_v2_painted_v2.png",
    char_walk_vertical: "/assets/characters/elias_walk_vertical_painted.png",
    npc_ansel: "/assets/characters/ansel.png",
    npc_ansel_body: "/assets/characters/ansel_body_painted.png",
    npc_bramwick_body_v2: "/assets/characters/bramwick_body_painted.png",
    npc_bramwick_seated: "/assets/characters/bramwick_seated_painted.png",
    npc_dorrit: "/assets/characters/dorrit.png",
    npc_dorrit_body: "/assets/characters/dorrit_body_painted.png",
    npc_harbourmaster: "/assets/characters/harbourmaster.png",
    npc_hobb: "/assets/characters/hobb.png",
    npc_hobb_body: "/assets/characters/hobb_body_painted.png",
    npc_marta_body_v2: "/assets/characters/marta_body_painted.png",
    npc_mordant: "/assets/characters/mordant.png",
    npc_mordant_body: "/assets/characters/mordant_body_painted_v2.png",
    npc_nell: "/assets/characters/nell.png",
    npc_nell_body: "/assets/characters/nell_body_painted.png",
    npc_nib: "/assets/characters/nib_painted.png",
    npc_nib_body: "/assets/characters/nib_body_painted.png",
    npc_onn: "/assets/characters/onn.png",
    npc_onn_body: "/assets/characters/onn_body_painted.png",
    npc_pike: "/assets/characters/pike.png",
    npc_pike_body: "/assets/characters/pike_body_painted_v2.png",
    npc_quill: "/assets/characters/quill_painted.png",
    npc_quill_body: "/assets/characters/quill_body_painted.png",
    npc_rook: "/assets/characters/rook.png",
    npc_rook_body: "/assets/characters/rook_body.png",
    npc_silas: "/assets/characters/silas.png",
    npc_silas_body: "/assets/characters/silas_body.png",
    npc_tam: "/assets/characters/tam.png",
    npc_tam_body: "/assets/characters/tam_body_painted_v2.png",
    npc_tamhobb: "/assets/characters/tamhobb.png",
    npc_tamhobb_body: "/assets/characters/tamhobb_body_painted.png",
    npc_tavernkeep: "/assets/characters/tavernkeep.png",
    npc_vane: "/assets/characters/vane.png",
    npc_vane_body: "/assets/characters/vane_body.png",
    npc_vex: "/assets/characters/vex_painted.png",
    npc_vex_body: "/assets/characters/vex_body_painted.png",
    // Props and inventory icons the live items and hotspots draw.
    item_chart: "/assets/props/items/chart_painted.png",
    item_compass: "/assets/props/items/compass.png",
    item_crowbar: "/assets/props/items/crowbar_painted.png",
    item_lantern: "/assets/props/items/lantern.png",
    item_nameplate: "/assets/props/items/nameplate_painted.png",
    item_spyglass: "/assets/props/items/spyglass_painted.png",
    prop_crowbar: "/assets/props/crowbar.png",
    prop_lantern_wrapped: "/assets/props/lantern_wrapped.png",
  },
  audio: {
    // The seven looping music beds the live rooms and ending name.
    music_dock: "/assets/audio/dock.mp3",
    music_fog: "/assets/audio/fog.mp3",
    music_office: "/assets/audio/office.mp3",
    music_pans: "/assets/audio/pans.mp3",
    music_sea: "/assets/audio/sea.mp3",
    music_sunset: "/assets/audio/sunset.mp3",
    music_tavern: "/assets/audio/tavern.mp3",
  },
};
