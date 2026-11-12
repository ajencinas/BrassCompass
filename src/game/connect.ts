/**
 * Room connectivity: what each way out is, which side of the painting it leaves from, and which
 * cuts are hard enough to need a short passage shot between the two rooms.
 *
 * The .adv scripts carry the exits themselves. This table adds the one thing a hotspot cannot
 * know from its shape: the side it is *read* from. A door on a left wall is `left`; a stair that
 * climbs is `above`; a lane running off the right edge is `right`. The sides are authored, not
 * guessed from a bounding box, so the audit can fail on an exit with no side rather than invent
 * one.
 *
 * `PASSAGES` is deliberately small. A cut through a seen door, hatch or stair is the Monkey
 * Island cut and needs no bridge: the painted threshold is the bridge. A passage shot is only
 * for the cuts that are genuinely apart — a different area, a boat crossing, a reversed view,
 * or two paintings whose exits land on the same side and therefore break the direction of
 * travel. `tools/connect-audit.mjs` derives those edges and fails if this table disagrees.
 */

/** The side of the painting a way out leaves through. */
export type ExitSide = "left" | "right" | "above" | "below";
/** What kind of threshold the way out is. `path` means open ground, not a door. */
export type ExitKind = "door" | "hatch" | "stair" | "path";
/** The look of the short shot that bridges two rooms which do not share a threshold. */
export type PassageKind = "street" | "steps" | "quay" | "water" | "planks";
/** The painted area a room belongs to; a path between two areas is a genuine cut. */
export type AreaId = "harbour" | "town" | "headland" | "ship" | "lantern" | "shroud";

export interface ExitLink {
  side: ExitSide;
  kind: ExitKind;
}

/**
 * Every exit in the game, keyed `room.hotspot`. Sides are the side of the painting the exit is
 * on. Doors use the wall they are painted into; a mid-frame facade door still reads from the
 * half of the painting it occupies. Stairs and hatches use above/below by the way they climb.
 */
export const EXITS: Record<string, ExitLink> = {
  // Wreckers' Lane
  "alley.boat_shed": { side: "left", kind: "door" },
  "alley.counting_door": { side: "right", kind: "door" },
  "alley.chandlery_door": { side: "right", kind: "door" },
  "alley.to_dock": { side: "left", kind: "path" },

  // The Grey Lantern
  "arcadia_cabin.ladder": { side: "above", kind: "stair" },
  "lantern_deck.cabin_door": { side: "right", kind: "door" },

  // The Marrow
  "below_decks.ladder": { side: "above", kind: "stair" },
  "bow_fog.aft": { side: "left", kind: "path" },
  "crows_nest.shrouds": { side: "below", kind: "hatch" },
  "marrow_cabin.gallery": { side: "right", kind: "door" },
  "marrow_cabin.door_out": { side: "left", kind: "door" },
  "marrow_deck.shrouds": { side: "above", kind: "stair" },
  "marrow_deck.forward": { side: "left", kind: "path" },
  "marrow_deck.hatch": { side: "below", kind: "hatch" },
  "marrow_deck.stairs_up": { side: "above", kind: "stair" },
  "marrow_gallery.doors": { side: "left", kind: "door" },
  "marrow_quarterdeck.cabin_door": { side: "right", kind: "door" },
  "marrow_quarterdeck.stairs_down": { side: "below", kind: "stair" },

  // Dreadwater Harbour
  "chandlery.door_out": { side: "left", kind: "door" },
  "counting_house.door_out": { side: "left", kind: "door" },
  "dock.tavern_door": { side: "left", kind: "door" },
  "dock.office_door": { side: "right", kind: "door" },
  "dock.alley_mouth": { side: "right", kind: "path" },
  "dock.road": { side: "right", kind: "path" },
  "dock.pier": { side: "right", kind: "path" },
  "office.door_out": { side: "left", kind: "door" },
  "pier_end.town": { side: "left", kind: "path" },
  "quay.harbour_mouth": { side: "left", kind: "path" },
  "quay.harbour": { side: "right", kind: "path" },
  "tavern.door_out": { side: "left", kind: "door" },
  "warehouse.lane_door": { side: "right", kind: "door" },

  // The Shroud
  "far_pans.camp": { side: "right", kind: "path" },
  "key_gate.path": { side: "left", kind: "path" },
  "lagoon_shore.reef_gate": { side: "right", kind: "path" },
  "lagoon_shore.boat": { side: "left", kind: "path" },
  "reef_wreck.boat": { side: "left", kind: "path" },
  "reef_wreck.salt_flats": { side: "right", kind: "path" },
  "salt_camp.shore_path": { side: "left", kind: "path" },
  "salt_camp.pans_path": { side: "left", kind: "path" },

  // Upper Town and the light
  "village.steps_down": { side: "left", kind: "path" },
  "village.light_path": { side: "right", kind: "path" },
  "weather_works.path_down": { side: "left", kind: "path" },
};

/**
 * The cuts that get a short passage shot, keyed by the exit being taken. Each one is a different
 * walk: the town steps, the lane to the light, the quay, the boat out to the wreck, and the
 * forward walk along the Marrow's deck. All of them are 0.5–0.9 s and carry no text.
 */
export const PASSAGES: Record<string, PassageKind> = {
  "dock.road": "steps",
  "village.steps_down": "steps",
  "village.light_path": "street",
  "weather_works.path_down": "street",
  "dock.pier": "quay",
  "quay.harbour": "quay",
  "quay.harbour_mouth": "quay",
  "pier_end.town": "quay",
  "lagoon_shore.boat": "water",
  "reef_wreck.boat": "water",
  "marrow_deck.forward": "planks",
  "bow_fog.aft": "planks",
};

const AREAS: Record<string, AreaId> = {
  alley: "harbour",
  arcadia_cabin: "lantern",
  below_decks: "ship",
  bow_fog: "ship",
  chandlery: "harbour",
  counting_house: "harbour",
  crows_nest: "ship",
  dock: "harbour",
  far_pans: "shroud",
  key_gate: "shroud",
  lagoon_shore: "shroud",
  lantern_deck: "lantern",
  marrow_cabin: "ship",
  marrow_deck: "ship",
  marrow_gallery: "ship",
  marrow_quarterdeck: "ship",
  office: "harbour",
  pier_end: "harbour",
  quay: "harbour",
  reef_wreck: "shroud",
  salt_camp: "shroud",
  tavern: "harbour",
  village: "town",
  warehouse: "harbour",
  weather_works: "headland",
};

export function roomArea(roomId: string): AreaId | null {
  return AREAS[roomId] ?? null;
}

/** The side you enter the next room from: the opposite of the side you left by. */
export function opposite(side: ExitSide): ExitSide {
  switch (side) {
    case "left": return "right";
    case "right": return "left";
    case "above": return "below";
    case "below": return "above";
  }
}

/**
 * The side the arriving room should be entered from. Doors are a hard cut through a seen
 * threshold, so they have no forced side; open paths and vertical thresholds continue the
 * direction of travel and do.
 */
export function entrySideFor(link: ExitLink | null): ExitSide | null {
  if (!link || link.kind === "door") return null;
  return opposite(link.side);
}

export function linkOf(roomId: string, hotspotId: string): ExitLink | null {
  return EXITS[`${roomId}.${hotspotId}`] ?? null;
}

export function passageOf(roomId: string, hotspotId: string): PassageKind | null {
  return PASSAGES[`${roomId}.${hotspotId}`] ?? null;
}
