/**
 * The ship's log: the optional layer of the voyage, entered in Fenn's own hand.
 *
 * Each entry is something a player may or may not have done, expressed only in the flags and
 * dialogue nodes the scripts already set (no new content flags). The closing page shows the ones
 * entered with the voyage and the ones missed with a spoiler-light pointer back to where they
 * were. The words are Fenn's: past tense, specific, and not proud of themselves.
 */

import type { Cond } from "../game/types";

export interface Deed {
  /** Stored in the ship's log across voyages; never reuse one for a different entry. */
  id: string;
  /** What the log calls it: short, and not a spoiler. */
  label: string;
  /** Fenn's account of it, shown once it is entered. */
  line: string;
  /** A one-line hint for the missed column: act, place, and who or what to look for. */
  where: string;
  /** Holds once the player has done it. All must hold (an `any` is one condition). */
  if: Cond[];
}

export const DEEDS: readonly Deed[] = [
  {
    id: "dorrit_cleared",
    label: "Dorrit's name",
    line: "Pike's man talked, and I said it where the island could hear. Dorrit is cleared. He packed forty spoons and came aboard, and the Salty Keel has found someone else to blame.",
    where: "The Salty Keel, Act I — Dorrit, after the thief in the boat shed talks.",
    if: [{ flag: "dorrit_cleared" }],
  },
  {
    id: "quill_compass",
    label: "Quill's compass",
    line: "Vex kept Quill's compass against a debt, then gave it back when we struck the deal. She turned it over twice, said the debt was paid, and went up to the nest.",
    where: "Vex's Warehouse, Act I — Captain Vex, and the price of a passage.",
    if: [{ flag: "quill_compass" }],
  },
  {
    id: "rook_story",
    label: "Rook's log",
    line: "I fetched Rook's old log from the lighthouse store. He read out the part about the bell, then gave me my father's chart folded in the back, and would not look at either of us.",
    where: "The Lighthouse, Act I — the keeper's store, then Rook at the Salty Keel.",
    if: [{ flag: "rook_story" }],
  },
  {
    id: "hobb_joined",
    label: "The iron band",
    line: "I got the crowbar under the iron band and Hobb got the mast free. He said she would hold, and that he was coming with her, and then he went to look for his brother.",
    where: "The Shipwright's, Act I — Hobb, the seized mast, and the crowbar on the counter.",
    if: [{ flag: "hobb_joined" }],
  },
  {
    id: "gallery_sundown",
    label: "Sundown on the gallery",
    line: "Quill was off watch on the stern gallery with the sunset and no use for it. We talked until the sun went into the sea, and agreed not to mention the part where neither of us wanted to leave.",
    where: "The Marrow's stern gallery, Act II — Quill, off watch at sundown.",
    if: [{ flag: "seen:quill.gallery" }],
  },
  {
    id: "tam_bell",
    label: "The bell on the flats",
    line: "The bell rang across the flats, three notes and then one. Hobb put his hand on the wreck and said it was Tam, and none of us asked him how he knew.",
    where: "The Sunken Wreck, Act III — the bell across the flats.",
    if: [{ flag: "wreck_bell" }],
  },
  {
    id: "elias_found",
    label: "My father, drawing",
    line: "My father stood up from behind the tents with his work still in his hand. He was thin and sunburnt and alive, and the first thing he did was move the chart to make room for me.",
    where: "The Castaway Camp, Act III — the man who stands up behind the tents.",
    if: [{ flag: "elias_found" }],
  },
  {
    id: "far_pans",
    label: "The far pans",
    line: "I walked out to the far pans where the boardwalk loses its nerve. Quill had her glass up and the fog in front of her, and she said the things she would not say in front of Vex.",
    where: "The Far Flats, Act III — the boardwalk out of the castaway camp.",
    if: [{ flag: "pans_seen" }],
  },
  {
    id: "bell_cut",
    label: "The bell, cut loose",
    line: "Hobb went up the rigging with the crowbar and cut the bell rope. The clapper came away in his hand. The bell hangs dumb now, and the ringing stopped.",
    where: "The Grey Lantern — Deck, Act IV — the bell rope above the rigging.",
    if: [{ flag: "bell_cut" }],
  },
  {
    id: "tam_freed",
    label: "Tam Hobb, off the rope",
    line: "Tam came down out of the rigging with salt in his hair and three months missing from his eyes. Hobb said his name once, and Tam answered, and that was the whole reunion.",
    where: "The Grey Lantern — Deck, Act IV — the hand on the bell rope.",
    if: [{ flag: "tam_freed" }],
  },
  {
    id: "lantern_doused",
    label: "The great lantern",
    line: "Quill and I got the wet canvas over the great lantern and held it until the green light went out. Every rope on the ship went slack at once, like a held breath letting go.",
    where: "The Grey Lantern — Deck, Act IV — the great lantern in the rigging.",
    if: [{ flag: "lantern_doused" }],
  },
  {
    id: "name_spoken",
    label: "The name on the brass",
    line: "I read the name off the brass plate in the captain's cabin. Elias said it aloud. Mordant. The fog let go of the ship the way a hand lets go of a rope.",
    where: "The Grey Lantern — Captain's Cabin, Act IV — the nameplate.",
    if: [{ flag: "name_spoken" }],
  },
  {
    id: "vex_trust",
    label: "Vex, trusted",
    line: "At the end, Vex could have taken the salvage and run. I gave him the boat, and he noticed. What he does with that is his own business.",
    where: "The Grey Lantern — Captain's Cabin, Act IV — Vex, at the last.",
    if: [{ flag: "vex_trust" }],
  },
  {
    id: "fog_lifts",
    label: "Lay them to rest",
    line: "We rang the bell for the dead and said the name, and the fog lifted off Dreadwater like a curtain. My father came home with the chart under his arm, and the island went back to sailing.",
    where: "The Grey Lantern, Act IV — the bell, the name, and the choice you make.",
    if: [{ flag: "ending_fog_lifts" }],
  },
];

/** How many entries the ship's log has room for. */
export const DEED_TOTAL = DEEDS.length;
