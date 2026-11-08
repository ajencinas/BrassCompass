/** Rooms, compiled from src/content/scripts/rooms/*.adv. Coordinates are world pixels; height is 880. */

import type { Pt } from "../engine/walkbox";
import { CONTENT } from "./content";

export const START_ROOM = "dock";
export const START_POS: Pt = { x: 1100, y: 800 };

export const ROOMS = CONTENT.rooms;
