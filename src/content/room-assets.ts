/** The image keys a room draws: its plate, its sprites and the portraits of who stands in it. */

import type { Room } from "../game/types";
import { CHARACTERS } from "./characters";

export function roomImageKeys(room: Room | undefined): string[] {
  if (!room) return [];
  const keys = [room.bg];
  for (const sprite of room.sprites ?? []) {
    keys.push(sprite.key);
    const portrait = sprite.speaker ? CHARACTERS[sprite.speaker]?.portrait : undefined;
    if (portrait) keys.push(portrait);
  }
  return [...new Set(keys)];
}
