/**
 * Fallback lines for actions the content didn't write a line for.
 *
 * Names are phrased properly ("the bar", "Marta", "the Marrow", never "the the bar" or
 * "carry the Marta"), people get their own set of refusals, and each verb has a few variants
 * picked deterministically per target so the same joke doesn't fire twice in a row.
 */

import type { Hotspot, VerbId } from "./types";

export interface Target {
  name: string;
  person: boolean;
  article?: "the" | "a" | "none";
}

/** "the bar", "Marta", "the Marrow", "a lantern". */
export function phrase(t: Target): string {
  const name = t.name.trim();
  if (t.person || t.article === "none") return name;
  if (/^(the|a|an)\s/i.test(name)) return name;
  if (t.article === "a") return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
  // Proper names (Captain Vane, Old Rook, Port Vela) stand on their own.
  if (/^[A-Z]/.test(name) && t.article !== "the") return name;
  return `the ${name}`;
}

export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function targetOf(hs: Hotspot, person: boolean): Target {
  return { name: hs.name, person, article: hs.article };
}

function pick<T>(options: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length];
}

/** The line for a verb on a hotspot that has nothing written for it. */
export function defaultLine(verb: VerbId, t: Target, seed: string): string {
  const n = phrase(t);
  const N = cap(n);
  if (t.person) {
    switch (verb) {
      case "look": return `${N}. Exactly as advertised.`;
      case "talk": return `${N} isn't in the mood.`;
      case "pickup": return pick([
        `${N} would object to being carried, and so would my back.`,
        `I am not going to pick up ${n}. There are laws, and some of them are mine.`,
      ], seed);
      case "push": case "pull": return pick([
        `Manhandling ${n} would end this conversation and possibly my career.`,
        `${N} has a firm look that says "try it".`,
      ], seed);
      case "open": case "close": return `${N} is a person, not a cupboard.`;
      case "turnon": case "turnoff": return `${N} doesn't have a switch. I checked, with my eyes.`;
      default: return `${N} gives me a look that ends the idea.`;
    }
  }
  switch (verb) {
    case "look": return `${N}. Exactly as advertised.`;
    case "talk": return pick([
      `${N} has nothing to say. Restful.`,
      `I could talk to ${n}, but I'd only be practising.`,
    ], seed);
    case "open": return pick([
      `${N} isn't the sort of thing that opens.`,
      `I look for a way to open ${n}. There isn't one, which is its own kind of answer.`,
    ], seed);
    case "close": return `${N} is already as closed as it intends to be.`;
    case "pickup": return pick([
      `I can't carry ${n}. Not without a second career.`,
      `${N} stays where it is. It was here first.`,
    ], seed);
    case "push": case "pull": return pick([
      `I ${verb} ${n}. Nothing moves except my dignity.`,
      `${N} doesn't budge. Neither of us is surprised.`,
    ], seed);
    case "turnon": case "turnoff": return `${N} has no switch, and I have no ideas.`;
    case "use": return `I can't see how to use ${n} on its own.`;
    case "give": return `I'd need something to give first.`;
    default: return `Nothing happens, but politely.`;
  }
}

/** Using or giving an item to a target with no combo. */
export function noComboLine(verb: VerbId, item: Target, target: Target, seed: string): string {
  const i = phrase(item);
  const t = phrase(target);
  if (verb === "give") {
    if (target.person) return pick([
      `${cap(t)} has no use for ${i}.`,
      `${cap(t)} looks at ${i}, then at me, and declines both.`,
    ], seed);
    return `I'm not handing ${i} to ${t}. It has no hands.`;
  }
  if (target.person) return `I'd rather not use ${i} on ${t}. Not yet, anyway.`;
  return pick([
    `${cap(i)} doesn't work on ${t}.`,
    `I try ${i} on ${t}. Nothing. Not even a promising noise.`,
  ], seed);
}

/** Using an item with nothing else selected. */
export function itemAloneLine(verb: VerbId, item: Target): string {
  const i = phrase(item);
  if (verb === "pickup") return `I already have ${i}. That's how pockets work.`;
  if (verb === "talk") return `I'm not going to talk to ${i}. Not out loud.`;
  if (verb === "open") return `There's nothing to open on ${i}.`;
  return `${cap(i)} needs something to work on.`;
}
