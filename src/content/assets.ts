/** Every image and sound the game loads at boot, by key. */

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

export const MANIFEST = {
  images: {
    bg_dock_wide: "/assets/scenes/dock_wide.webp",
    bg_office_wide: "/assets/scenes/office_wide.webp",
    bg_tavern_wide: "/assets/scenes/tavern_wide.webp",
    // The harbour's three rooms as side-on close-ups of bg_area_harbour: the same fog-bound
    // timber quay, iron lanterns, warm windows and green counting-house lamp. The three `_wide`
    // plates above remain for the archived act paintings and the prologue.
    bg_dock_close_wide: "/assets/scenes/dock_close_wide.webp",
    // The dock's readable close-up: strict side-on, the Marrow's bow at the left, the
    // harbourmaster's lit door at the centre, and the quay running on past the green
    // counting-house lamp to the signpost and steps at the far right. bg_dock_close_wide
    // (three-quarter, too dark, way out off-frame) and bg_dock_wide (the wide plate, still
    // the ending card's painting) both stay in the manifest.
    bg_dock_v2_wide: "/assets/scenes/dock_quay_wide.webp",
    bg_tavern_close_wide: "/assets/scenes/tavern_close_wide.webp",
    bg_office_close_wide: "/assets/scenes/office_close_wide.webp",
    // The harbour's back lane and outbuildings, repainted to the same close-up standard as the
    // three hero rooms: the same fog-bound timber quay, iron lanterns, warm windows, green
    // counting-house lamp and empty lower-third walking band. The old `_wide` plates below stay
    // for the archived act paintings and the prologue.
    bg_alley_close_wide: "/assets/scenes/alley_close_wide.webp",
    bg_chandlery_close_wide: "/assets/scenes/chandlery_close_wide.webp",
    bg_countinghouse_close_wide: "/assets/scenes/countinghouse_close_wide.webp",
    bg_alley_wide: "/assets/scenes/alley_wide.webp",
    bg_chandlery_wide: "/assets/scenes/chandlery_wide.webp",
    bg_warehouse_wide: "/assets/scenes/warehouse_wide.webp",
    bg_deck_wide: "/assets/scenes/deck_wide.webp",
    bg_crowsnest_wide: "/assets/scenes/crowsnest_wide.webp",
    bg_quarterdeck_wide: "/assets/scenes/quarterdeck_wide.webp",
    bg_cabin_wide: "/assets/scenes/cabin_wide.webp",
    bg_gallery_wide: "/assets/scenes/gallery_wide.webp",
    bg_village_wide: "/assets/scenes/village_wide.webp",
    bg_island_map: "/assets/scenes/island_map.webp",
    bg_area_harbour: "/assets/scenes/area_harbour.webp",
    bg_area_town: "/assets/scenes/area_town.webp",
    bg_area_marrow: "/assets/scenes/area_marrow.webp",
    bg_area_shroud: "/assets/scenes/area_shroud.webp",
    bg_area_lantern: "/assets/scenes/area_lantern.webp",
    // Rooms cut from the macro views: Upper Town's lane and lighthouse headland from area_town,
    // the Fog Flats from area_shroud. The wider plates above stay for the chart and ending art.
    bg_town_lane_wide: "/assets/scenes/town_lane_wide.webp",
    bg_town_head_wide: "/assets/scenes/town_head_wide.webp",
    bg_shroud_flats_wide: "/assets/scenes/shroud_flats_wide.webp",
    // The ships' rooms, painted as side-on close-ups of the area views above.
    bg_marrow_deck_wide: "/assets/scenes/marrow_deck_wide.webp",
    bg_grey_lantern_deck_wide: "/assets/scenes/grey_lantern_deck_wide.webp",
    bg_arcadia_cabin_wide: "/assets/scenes/arcadia_cabin_wide.webp",
    // The visual restart: the five lower-ship rooms as full-bleed cinematic plates with no
    // painted lettering, where each exit reads by light alone. The old `_wide` plates above
    // stay in the manifest for the archive and the act paintings.
    bg_below_decks_restart_wide: "/assets/scenes/below_decks_restart_wide.webp",
    bg_bow_fog_restart_b_wide: "/assets/scenes/bow_fog_restart_b_wide.webp",
    bg_crows_nest_restart_wide: "/assets/scenes/crows_nest_restart_wide.webp",
    bg_lantern_deck_restart_b_wide: "/assets/scenes/lantern_deck_restart_b_wide.webp",
    bg_arcadia_cabin_restart_b_wide: "/assets/scenes/arcadia_cabin_restart_b_wide.webp",
    bg_boatshed_wide: "/assets/scenes/boatshed_wide.webp",
    bg_ghostcabin_wide: "/assets/scenes/ghostcabin_wide.webp",
    bg_ghostwreck_wide: "/assets/scenes/ghostwreck_wide.webp",
    bg_crowsnest_high_wide: "/assets/scenes/crowsnest_high_wide.webp",
    bg_below_wide: "/assets/scenes/below_wide.webp",
    bg_bow_wide: "/assets/scenes/bow_wide.webp",
    bg_reef_wide: "/assets/scenes/reef_wide.webp",
    bg_wreckcabin_wide: "/assets/scenes/wreckcabin_wide.webp",
    bg_shore_wide: "/assets/scenes/shore_wide.webp",
    bg_gate_wide: "/assets/scenes/gate_wide.webp",
    // Act III: the Shroud's own cold, fog-bound flats and reef gate (repaints of the two
    // daylight island plates above, which remain for the archived story and the ending card).
    bg_fogflats_wide: "/assets/scenes/fogflats_wide.webp",
    bg_gate_fog_wide: "/assets/scenes/gate_fog_wide.webp",
    bg_works_wide: "/assets/scenes/works_wide.webp",
    bg_lighthouse_wide: "/assets/scenes/lighthouse_wide.webp",
    bg_saltcamp_wide: "/assets/scenes/saltcamp_wide.webp",
    bg_farpans_wide: "/assets/scenes/farpans_wide.webp",
    bg_countinghouse_wide: "/assets/scenes/countinghouse_wide.webp",
    bg_pierend_wide: "/assets/scenes/pierend_wide.webp",
    // The short connective quay between the harbour and the harbour mouth.
    bg_quay_wide: "/assets/scenes/quay_wide.webp",
    // The cold open's full-screen plate (1920x1080, not a room background).
    bg_coldopen: "/assets/scenes/coldopen.webp",
    // Fenn repainted to the plates' painterly finish: the same clerk, no anime cel shading.
    // The v2 idle keeps the walk cells' solid, fully painted boot soles; the first idle study
    // let the leather dissolve into the key colour and read as hovering.
    char_elias: "/assets/characters/elias_painted_v2.png",
    char_walk_v2: "/assets/characters/elias_walk_v2_painted.png",
    char_walk_vertical: "/assets/characters/elias_walk_vertical_painted.png",
    npc_harbourmaster: "/assets/characters/harbourmaster.png",
    npc_tavernkeep: "/assets/characters/tavernkeep.png",
    // The painted cast: full-length oil studies in the same hand as the plates.
    npc_bramwick_body_v2: "/assets/characters/bramwick_body_painted.png",
    npc_marta_body_v2: "/assets/characters/marta_body_painted.png",
    npc_quill: "/assets/characters/quill.png",
    npc_vane: "/assets/characters/vane.png",
    npc_quill_body: "/assets/characters/quill_body_painted.png",
    npc_vane_body: "/assets/characters/vane_body.png",
    npc_vane_rum: "/assets/characters/vane_rum.png",
    npc_silas: "/assets/characters/silas.png",
    npc_rook: "/assets/characters/rook.png",
    npc_silas_body: "/assets/characters/silas_body.png",
    npc_rook_body: "/assets/characters/rook_body.png",
    npc_nell: "/assets/characters/nell.png",
    npc_nell_body: "/assets/characters/nell_body_painted.png",
    npc_tam: "/assets/characters/tam.png",
    npc_tam_body: "/assets/characters/tam_body_painted_v2.png",
    npc_onn: "/assets/characters/onn.png",
    npc_onn_body: "/assets/characters/onn_body_painted.png",
    npc_dorrit: "/assets/characters/dorrit.png",
    npc_dorrit_body: "/assets/characters/dorrit_body_painted.png",
    npc_hobb: "/assets/characters/hobb.png",
    npc_hobb_body: "/assets/characters/hobb_body_painted.png",
    npc_ansel: "/assets/characters/ansel.png",
    npc_ansel_body: "/assets/characters/ansel_body_painted.png",
    npc_ansel_seated: "/assets/characters/ansel_seated.png",
    npc_pike: "/assets/characters/pike.png",
    npc_pike_body: "/assets/characters/pike_body_painted_v2.png",
    npc_tamhobb: "/assets/characters/tamhobb.png",
    npc_tamhobb_body: "/assets/characters/tamhobb_body_painted.png",
    npc_nib: "/assets/characters/nib.png",
    npc_nib_body: "/assets/characters/nib_body.png",
    npc_bramwick_seated: "/assets/characters/bramwick_seated_painted.png",
    npc_weather_body: "/assets/characters/weather_body.png",
    prop_flag16: "/assets/props/flag16.png",
    prop_qflag: "/assets/props/qflag.png",
    prop_crate: "/assets/props/crate.png",
    prop_crowbar: "/assets/props/crowbar.png",
    prop_spyglass: "/assets/props/spyglass.png",
    prop_longboat: "/assets/props/longboat.png",
    prop_invoices: "/assets/props/invoices.png",
    // The painted sign at the harbour end of the quay: HARBOUR MOUTH and an arrow.
    prop_quay_sign: "/assets/props/quay_sign.png",
    prop_quay_sign_mouth: "/assets/props/quay_sign_mouth.png",
    prop_quay_lamp: "/assets/props/quay_lamp.png",
    prop_quay_steps: "/assets/props/quay_steps.png",
    // Painted on the ghost ship: Mordant's plate on the cabin desk, and the canvas-wrapped lantern.
    prop_nameplate: "/assets/props/nameplate.png",
    prop_lantern_wrapped: "/assets/props/lantern_wrapped.png",
    // The Father and the Fog: new cast and the ghost ship.
    npc_vex: "/assets/characters/vex.png",
    npc_vex_body: "/assets/characters/vex_body_painted.png",
    npc_mordant: "/assets/characters/mordant.png",
    npc_mordant_body: "/assets/characters/mordant_body_painted_v2.png",
    bg_lantern_deck_wide: "/assets/scenes/lantern_deck_wide.webp",
    item_bell_clapper: "/assets/props/items/bell_clapper.png",
    item_lantern: "/assets/props/items/lantern.png",
    // Reused art for the remaining new-story items (a proper nameplate icon can come later).
    item_chart: "/assets/props/items/ledger.png",
    item_bottle: "/assets/props/items/rum.png",
    item_nameplate: "/assets/props/items/claims_book.png",
    // Inventory icons, one per item in scripts/items.adv, keyed `item_<id>`. Painted, keyed to
    // transparency and trimmed; the longer side is 256 px (tools/generate.py, post_icon).
    item_crowbar: "/assets/props/items/crowbar.png",
    item_rum: "/assets/props/items/rum.png",
    item_licence_form: "/assets/props/items/licence_form.png",
    item_drawer_key: "/assets/props/items/drawer_key.png",
    item_stamp: "/assets/props/items/stamp.png",
    item_licence: "/assets/props/items/licence.png",
    item_compass: "/assets/props/items/compass.png",
    item_spyglass: "/assets/props/items/spyglass.png",
    item_sextant: "/assets/props/items/sextant.png",
    item_pell_log: "/assets/props/items/pell_log.png",
    item_bill: "/assets/props/items/bill.png",
    item_calendar_leaf: "/assets/props/items/calendar_leaf.png",
    item_bucket: "/assets/props/items/bucket.png",
    item_bucket_water: "/assets/props/items/bucket_water.png",
    item_flag16: "/assets/props/items/flag16.png",
    item_ansel_log: "/assets/props/items/ansel_log.png",
    item_purse: "/assets/props/items/purse.png",
    item_requisition: "/assets/props/items/requisition.png",
    item_claims_book: "/assets/props/items/claims_book.png",
    item_ledger: "/assets/props/items/ledger.png",
    item_kelp_manifest: "/assets/props/items/kelp_manifest.png",
    item_manifest: "/assets/props/items/manifest.png",
  },
  audio: {
    music_dock: "/assets/audio/dock.mp3",
    music_office: "/assets/audio/office.mp3",
    music_tavern: "/assets/audio/tavern.mp3",
    music_sea: "/assets/audio/sea.mp3",
    music_fog: "/assets/audio/fog.mp3",
    music_sunset: "/assets/audio/sunset.mp3",
    music_pans: "/assets/audio/pans.mp3",
  },
};
