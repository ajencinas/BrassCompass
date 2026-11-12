/**
 * Which rooms are indoors, and what their air sounds like.
 *
 * This is the only place the game maps a room to a room tone. The engine knows how to make a
 * bed; it does not know the island's room ids, and the room scripts stay story/art data with no
 * audio syntax added. An outdoor room simply has no entry here, so `roomToneFor` returns null
 * and the engine crossfades the last interior's air away as the painting opens.
 *
 * The gallery is the one deliberate hybrid: open to the sea on one side, so it keeps its sea
 * ambience and gains only the deck's low wooden tone under it.
 */
import type { RoomToneKind } from "../engine/roomtone";

export const ROOM_TONE_FOR_ROOM: Readonly<Record<string, RoomToneKind>> = {
  tavern: "hearth",
  office: "study",
  chandlery: "workshop",
  warehouse: "workshop",
  counting_house: "counting",
  marrow_cabin: "cabin",
  arcadia_cabin: "cabin",
  below_decks: "hold",
  marrow_gallery: "gallery",
};

/** The room tone for a room, or null outdoors. */
export function roomToneFor(roomId: string): RoomToneKind | null {
  return ROOM_TONE_FOR_ROOM[roomId] ?? null;
}

/**
 * A hotspot's line that says a way is shut ("Padlocked.", "Locked. The drawer is winning on
 * points.", "bolted", "barred"). Used to give a refused open/use the sound of a door that will
 * not give, without any audio syntax in the room scripts. "Unlocked" does not match.
 */
const LOCKED_LINE = /\b(?:locked|padlocked|bolted|barred|sealed shut)\b/i;
export function isLockedLine(text: string): boolean {
  return LOCKED_LINE.test(text);
}
