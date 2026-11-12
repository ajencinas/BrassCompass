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
 *
 * Character and prop art is named as `.webp`: `python3 tools/optimize_assets.py --webp-only`
 * writes it beside each source `.png` (alpha identical, about a quarter of the weight). The
 * PNGs stay on disk as the editable source and are never shipped.
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
    bg_countinghouse_restart_wide: "/assets/scenes/countinghouse_restart_b.webp",
    bg_crows_nest_restart_b_wide: "/assets/scenes/crows_nest_restart_b_wide.webp",
    bg_deck_wide: "/assets/scenes/deck_wide.webp",
    bg_dock_cinema_wide: "/assets/scenes/dock_cinema_wide.webp",
    bg_dock_wide: "/assets/scenes/dock_wide.webp",
    bg_far_pans_v2b_wide: "/assets/scenes/far_pans_r3_wide.webp",
    bg_gallery_v2_wide: "/assets/scenes/gallery_v2_wide.webp",
    bg_key_gate_v2b_wide: "/assets/scenes/key_gate_r3_wide.webp",
    bg_lagoon_shore_v2b_wide: "/assets/scenes/lagoon_shore_r3_wide.webp",
    bg_lantern_deck_restart_b_wide: "/assets/scenes/lantern_deck_bell_r2_wide.webp",
    bg_marrow_deck_v2_wide: "/assets/scenes/marrow_deck_v2_wide.webp",
    bg_office_cinema_wide: "/assets/scenes/office_cinema_wide.webp",
    bg_office_wide: "/assets/scenes/office_wide.webp",
    bg_pierend_cinema_wide: "/assets/scenes/pierend_cinema_wide.webp",
    bg_quarterdeck_v2_wide: "/assets/scenes/quarterdeck_v2_wide.webp",
    bg_quay_cinema_wide: "/assets/scenes/quay_cinema_wide.webp",
    bg_reef_wreck_v2b_wide: "/assets/scenes/reef_wreck_v2b_wide.webp",
    bg_salt_camp_v2b_wide: "/assets/scenes/salt_camp_r3_wide.webp",
    bg_shore_wide: "/assets/scenes/shore_wide_r3.webp",
    bg_tavern_cinema_wide: "/assets/scenes/tavern_cinema_wide.webp",
    bg_title: "/assets/scenes/title_night.webp",
    bg_village_v2_wide: "/assets/scenes/village_v2_wide.webp",
    bg_warehouse_restart_wide: "/assets/scenes/warehouse_restart_b.webp",
    bg_weather_works_v2b_wide: "/assets/scenes/weather_works_v2b_wide.webp",
    // The painted cast and Fenn's walk sheets.
    char_elias: "/assets/characters/elias_painted_v2.webp",
    char_walk_v2: "/assets/characters/elias_walk_v2_painted_r2.webp",
    char_walk_vertical: "/assets/characters/elias_walk_vertical_painted_r2.webp",
    npc_ansel: "/assets/characters/ansel.webp",
    npc_ansel_body: "/assets/characters/ansel_body_painted_g.webp",
    npc_bramwick_body_v2: "/assets/characters/bramwick_body_painted.webp",
    npc_bramwick_seated: "/assets/characters/bramwick_seated_painted.webp",
    npc_dorrit: "/assets/characters/dorrit.webp",
    npc_dorrit_body: "/assets/characters/dorrit_body_painted.webp",
    npc_harbourmaster: "/assets/characters/harbourmaster.webp",
    npc_hobb: "/assets/characters/hobb.webp",
    npc_hobb_body: "/assets/characters/hobb_body_painted.webp",
    npc_marta_body_v2: "/assets/characters/marta_body_painted.webp",
    npc_mordant: "/assets/characters/mordant.webp",
    npc_mordant_body: "/assets/characters/mordant_body_painted_v2.webp",
    npc_nell: "/assets/characters/nell.webp",
    npc_nell_body: "/assets/characters/nell_body_painted.webp",
    npc_nib: "/assets/characters/nib_painted_r3.webp",
    npc_nib_body: "/assets/characters/nib_body_painted_g.webp",
    npc_onn: "/assets/characters/onn.webp",
    npc_onn_body: "/assets/characters/onn_body_painted.webp",
    npc_pike: "/assets/characters/pike.webp",
    npc_pike_body: "/assets/characters/pike_body_painted_v2_g.webp",
    npc_quill: "/assets/characters/quill_painted.webp",
    npc_quill_body: "/assets/characters/quill_body_painted.webp",
    npc_rook: "/assets/characters/rook.webp",
    npc_rook_body: "/assets/characters/rook_body.webp",
    npc_silas: "/assets/characters/silas.webp",
    npc_silas_body: "/assets/characters/silas_body.webp",
    npc_tam: "/assets/characters/tam.webp",
    npc_tam_body: "/assets/characters/tam_body_painted_v2_g.webp",
    npc_tamhobb: "/assets/characters/tamhobb.webp",
    npc_tamhobb_body: "/assets/characters/tamhobb_body_boathook_r3.webp",
    npc_tavernkeep: "/assets/characters/tavernkeep.webp",
    npc_vane: "/assets/characters/vane.webp",
    npc_vane_body: "/assets/characters/vane_body.webp",
    npc_vex: "/assets/characters/vex_painted.webp",
    npc_vex_body: "/assets/characters/vex_body_painted.webp",
    // Props and inventory icons the live items and hotspots draw.
    item_chart: "/assets/props/items/chart_painted.webp",
    item_compass: "/assets/props/items/compass.webp",
    item_crowbar: "/assets/props/items/crowbar_painted.webp",
    item_lantern: "/assets/props/items/lantern.webp",
    item_nameplate: "/assets/props/items/nameplate_painted.webp",
    item_spyglass: "/assets/props/items/spyglass_painted.webp",
    prop_crowbar: "/assets/props/crowbar.webp",
    prop_lantern_wrapped: "/assets/props/lantern_wrapped.webp",
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
