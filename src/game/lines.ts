/**
 * Fallback lines for actions the content didn't write a line for.
 *
 * Names are phrased properly ("the bar", "Marta", "the Marrow", never "the the bar" or
 * "carry the Marta"), people get their own set of refusals, and each verb has a few variants
 * picked per target and stepped on each time, so the same joke doesn't fire twice in a row.
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

// How many times each seed has asked, so repeating an action walks through its variants
// instead of firing the same joke twice in a row.
const asked = new Map<string, number>();

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A variant chosen per target, stepping on by one each time the same thing is tried. */
function pick<T>(options: T[], seed: string): T {
  const key = `${seed}#${options.length}`;
  const n = asked.get(key) ?? 0;
  asked.set(key, n + 1);
  return options[(hash(seed) + n) % options.length];
}

/** The line for a verb on a hotspot that has nothing written for it. */
export function defaultLine(verb: VerbId, t: Target, seed: string): string {
  const n = phrase(t);
  const N = cap(n);
  if (t.person) {
    switch (verb) {
      case "look": return pick([
        `${N}. Exactly as advertised.`,
        `I look at ${n}. ${N} looks back, which is about as far as that goes.`,
        `${N}, in full. Nothing I'd write down, and I write down everything.`,
        `I study ${n} with a clerk's eye. Nothing's out of order, except possibly me, for staring.`,
      ], verb + seed);
      case "talk": return pick([
        `${N} isn't in the mood.`,
        `${N} has nothing more to say to me just now. I respect that; I've nothing more to say either.`,
        `I open my mouth. ${N} raises an eyebrow. I close my mouth.`,
        `${N} gives me the look people give a clerk who arrives at five to closing.`,
      ], verb + seed);
      case "pickup": return pick([
        `${N} would object to being carried, and so would my back.`,
        `I am not going to pick up ${n}. There are laws, and some of them are mine.`,
        `${N} is not luggage, whatever the manifest says.`,
        `I consider lifting ${n}. ${N} considers me considering it.`,
      ], verb + seed);
      case "push": case "pull": return pick([
        `Manhandling ${n} would end this conversation and possibly my career.`,
        `${N} has a firm look that says "try it".`,
        `I keep my hands to myself. It's the one regulation I've never had to look up.`,
        `${N} is not a door, a drawer or a stubborn crate, and would like that on record.`,
      ], verb + seed);
      case "open": case "close": return pick([
        `${N} is a person, not a cupboard.`,
        `${N} is not available for opening. Try conversation.`,
      ], verb + seed);
      case "turnon": case "turnoff": return `${N} doesn't have a switch. I checked, with my eyes.`;
      case "use": return pick([
        `I don't use people. That's what factors are for.`,
        `${N} is not a tool, and would be the first to say so.`,
        `Using ${n} for anything would want their consent and a countersignature.`,
      ], verb + seed);
      default: return `${N} gives me a look that ends the idea.`;
    }
  }
  switch (verb) {
    case "look": return pick([
      `${N}. Exactly as advertised.`,
      `${N}. I've filed less interesting things, but not many.`,
      `I look at ${n} for a while. It holds up well under inspection, which is more than most things do.`,
      `${N}, present and correct. I'd stamp it if anyone asked.`,
      `Nothing about ${n} needs reporting. I make a mental note of that anyway.`,
    ], verb + seed);
    case "talk": return pick([
      `${N} has nothing to say. Restful.`,
      `I could talk to ${n}, but I'd only be practising.`,
      `I say a few words to ${n}. It takes them better than most of my supervisors.`,
      `${N} keeps its own counsel. I've worked with worse colleagues.`,
    ], verb + seed);
    case "open": return pick([
      `${N} isn't the sort of thing that opens.`,
      `I look for a way to open ${n}. There isn't one, which is its own kind of answer.`,
      `${N} has no lid, no latch and no intention.`,
      `I'd need a hinge to work with, and ${n} has declined to provide one.`,
    ], verb + seed);
    case "close": return pick([
      `${N} is already as closed as it intends to be.`,
      `There's nothing on ${n} to close. I check twice, out of habit.`,
    ], verb + seed);
    case "pickup": return pick([
      `I can't carry ${n}. Not without a second career.`,
      `${N} stays where it is. It was here first.`,
      `My pockets are generous, but not that generous.`,
      `I'd have to sign for ${n}, and nobody's offering the form.`,
    ], verb + seed);
    case "push": case "pull": return pick([
      `I ${verb} ${n}. Nothing moves except my dignity.`,
      `${N} doesn't budge. Neither of us is surprised.`,
      `I give ${n} a good ${verb}. It gives me nothing back but splinters of self-respect.`,
      `${N} has been where it is for years, and a clerk isn't going to change its mind.`,
    ], verb + seed);
    case "turnon": case "turnoff": return `${N} has no switch, and I have no ideas.`;
    case "use": return pick([
      `I can't see how to use ${n} on its own.`,
      `I fiddle with ${n}. It's patient with me, which is worse.`,
      `${N} doesn't do anything by itself. Neither did I, for three years.`,
      `I'd need a reason, or at least something to use it with.`,
    ], verb + seed);
    case "give": return `I'd need something to give first.`;
    default: return `Nothing happens, but politely.`;
  }
}

/** Using or giving an item to a target with no combo. */
export function noComboLine(verb: VerbId, item: Target, target: Target, seed: string): string {
  const i = phrase(item);
  const t = phrase(target);
  const T = cap(t);
  if (verb === "give") {
    if (target.person) return pick([
      `${T} has no use for ${i}.`,
      `${T} looks at ${i}, then at me, and declines both.`,
      `${T} hands ${i} straight back, the way you'd return a wrong order.`,
      `"What would I do with that?" is written all over ${t}'s face, in a good firm hand.`,
    ], "give" + seed);
    return pick([
      `I'm not handing ${i} to ${t}. It has no hands.`,
      `${T} can't take ${i}. It's not that kind of relationship.`,
      `I offer ${i} to ${t}. The silence is very understanding.`,
      `Giving things to ${t} is how clerks end up talking to furniture.`,
    ], "give" + seed);
  }
  if (target.person) return pick([
    `I'd rather not use ${i} on ${t}. Not yet, anyway.`,
    `${T} looks at ${i}, then at me, and the idea quietly leaves the room.`,
    `I hold out ${i}. ${T} waits politely for me to explain. I can't.`,
    `There's no regulation against using ${i} on ${t}. There's a look, though, and it's worse.`,
  ], "use" + seed);
  return pick([
    `${cap(i)} doesn't work on ${t}.`,
    `I try ${i} on ${t}. Nothing. Not even a promising noise.`,
    `${cap(i)} and ${t} have nothing to say to each other.`,
    `I put ${i} to ${t} several ways. None of them are the right way, if there is one.`,
  ], "use" + seed);
}

/** Using an item with nothing else selected. */
export function itemAloneLine(verb: VerbId, item: Target): string {
  const i = phrase(item);
  const I = cap(i);
  if (verb === "pickup") return pick([
    `I already have ${i}. That's how pockets work.`,
    `${I} is already mine. Picking it up again would be greedy.`,
  ], "pickup" + item.name);
  if (verb === "talk") return pick([
    `I'm not going to talk to ${i}. Not out loud.`,
    `I have a quiet word with ${i}. It keeps it to itself.`,
  ], "talk" + item.name);
  if (verb === "open") return `There's nothing to open on ${i}.`;
  return pick([
    `${I} needs something to work on.`,
    `I wave ${i} about. It wants a target, and so, frankly, do I.`,
    `${I} on its own does nothing. It's waiting for me to have an idea.`,
    `I'd use ${i} on something, if I could decide what.`,
  ], verb + item.name);
}
