/** The twelve verbs — the genre's classic interface, kept intact. */

import type { VerbId } from "./types";

export interface VerbDef {
  id: VerbId;
  label: string;
  /** Needs a second object (e.g. "Use X with Y"). */
  twoObject?: boolean;
}

export const VERBS: VerbDef[] = [
  { id: "open", label: "Open" },
  { id: "close", label: "Close" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "walk", label: "Walk to" },
  { id: "pickup", label: "Pick up" },
  { id: "talk", label: "Talk to" },
  { id: "give", label: "Give", twoObject: true },
  { id: "use", label: "Use", twoObject: true },
  { id: "look", label: "Look at" },
  { id: "turnon", label: "Turn on" },
  { id: "turnoff", label: "Turn off" },
];

export const VERB_LABEL: Record<VerbId, string> = VERBS.reduce(
  (acc, v) => ((acc[v.id] = v.label), acc),
  {} as Record<VerbId, string>
);
