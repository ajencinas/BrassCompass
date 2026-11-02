/**
 * Character registry — the one place that knows who speaks, what they look like, and what
 * they're called. Dialogue refers to characters by id, never by display name, so adding a
 * cast member never means touching the renderer.
 */

export interface Character {
  id: string;
  /** Shown above dialogue, and as the hover label on a standing figure. */
  name: string;
  /** Dialogue portrait asset key. */
  portrait?: string;
  /** Standing sprite key used when composited into a scene. */
  body?: string;
  /** Accent colour for the speaker name. Defaults to panel gold. */
  accent?: string;
}

export const CHARACTERS: Record<string, Character> = {
  fenn: {
    id: "fenn",
    name: "Fenn",
    accent: "#8fd3c7",
  },
  bramwick: {
    id: "bramwick",
    name: "Harbourmaster Bramwick",
    portrait: "npc_harbourmaster",
    body: "npc_bramwick_body_v2",
    accent: "#e8c98a",
  },
  marta: {
    id: "marta",
    name: "Marta",
    portrait: "npc_tavernkeep",
    body: "npc_marta_body_v2",
    accent: "#e8c98a",
  },
  quill: {
    id: "quill",
    name: "Quill",
    portrait: "npc_quill",
    body: "npc_quill_body",
    accent: "#8fd3c7",
  },
  rook: {
    id: "rook",
    name: "Old Rook",
    portrait: "npc_rook",
    body: "npc_rook_body",
    accent: "#c9b28a",
  },
  nell: {
    id: "nell",
    name: "Nell",
    portrait: "npc_nell",
    body: "npc_nell_body",
    accent: "#e8c98a",
  },
  tam: {
    id: "tam",
    name: "Tam",
    portrait: "npc_tam",
    body: "npc_tam_body",
    accent: "#a8d8c0",
  },
  onn: {
    id: "onn",
    name: "Old Onn",
    portrait: "npc_onn",
    body: "npc_onn_body",
    accent: "#c9a2e0",
  },
  silas: {
    id: "silas",
    name: "Silas Cray",
    portrait: "npc_silas",
    body: "npc_silas_body",
    accent: "#d9a26a",
  },
  // Heard from the back room of his shop, never seen.
  tallow: {
    id: "tallow",
    name: "Mr Tallow (from the back room)",
    accent: "#c9b28a",
  },
  narrator: {
    id: "narrator",
    name: "",
    accent: "#e8c98a",
  },
  vane: {
    id: "vane",
    name: "Captain Vane",
    portrait: "npc_vane",
    body: "npc_vane_body",
    accent: "#e0a06a",
  },
  dorrit: {
    id: "dorrit",
    name: "Dorrit",
    portrait: "npc_dorrit",
    body: "npc_dorrit_body",
    accent: "#b9c7e0",
  },
  hobb: {
    id: "hobb",
    name: "Hobb",
    portrait: "npc_hobb",
    body: "npc_hobb_body",
    accent: "#c99a7a",
  },
  ansel: {
    id: "ansel",
    name: "Ansel Fenn",
    portrait: "npc_ansel",
    body: "npc_ansel_body",
    accent: "#f0c674",
  },
  pike: {
    id: "pike",
    name: "Pike",
    portrait: "npc_pike",
    body: "npc_pike_body",
    accent: "#e8d36a",
  },
  tamhobb: {
    id: "tamhobb",
    name: "Tam Hobb",
    portrait: "npc_tamhobb",
    body: "npc_tamhobb_body",
    accent: "#c99a7a",
  },
  // Cray's men on Gullet Key, speaking as one: polite, armbanded, armed.
  weather: {
    id: "weather",
    name: "A Weather man",
    accent: "#b8b8a0",
  },
  // His colleague at the pier end, who did the menacing on Tuesday.
  weather2: {
    id: "weather2",
    name: "Another Weather man",
    accent: "#a8a890",
  },
  nib: {
    id: "nib",
    name: "Nib",
    portrait: "npc_nib",
    body: "npc_nib_body",
    accent: "#b8c4a8",
  },
  // The Salty Keel's regulars, speaking as one.
  regular: {
    id: "regular",
    name: "A regular",
    accent: "#c9b28a",
  },
};

/** Resolve an id to a character; unknown ids fall back to a neutral speaker. */
export function characterOf(id: string): Character {
  return CHARACTERS[id] ?? { id, name: id, accent: "#e8c98a" };
}

export function speakerName(id: string): string {
  return characterOf(id).name;
}
