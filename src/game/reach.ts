/**
 * What each act can reach, read statically from the compiled content: the rooms its doors,
 * scenes and conversations lead to, the conversations it can open, the items it can hand out and
 * the flags it can set (`set` and `add` effects, the `seen:` flag of every node of its
 * conversations, and the `looked:` flag of everything in its rooms).
 *
 * Only `act` conditions are honoured (anything else might come true), so the answer errs
 * generous: everything an act might do. Content is passed in, as with save.ts, so this can be
 * tested on its own; the fuzzer (tools/fuzz) uses it too.
 */

import type { ActDef } from "../content/acts";
import type { Combo, Cond, DialogueTree, Effect, Room } from "./types";

export interface ReachContent {
  rooms: Record<string, Room>;
  dialogues: Record<string, DialogueTree>;
  acts: Record<number, ActDef>;
  /** The combinations that work anywhere; each room's own come with the room. */
  combos: Combo[];
}

export interface ActReach {
  rooms: Set<string>;
  trees: Set<string>;
  items: Set<string>;
  flags: Set<string>;
}

/** Whether conditions can hold in act `n`, judged on their own `act` conditions alone. */
function allowsAct(conds: Cond[] | undefined, n: number): boolean {
  return !(conds ?? []).some((c) => "act" in c && !(Array.isArray(c.act) ? c.act.includes(n) : c.act === n));
}

/** Per act number, what that act's content can reach. */
export function actReach(content: ReachContent): Map<number, ActReach> {
  const out = new Map<number, ActReach>();
  for (const act of Object.values(content.acts)) {
    const n = act.n;
    const reach: ActReach = { rooms: new Set(), trees: new Set(), items: new Set(act.inventory ?? []), flags: new Set() };
    const roomQueue = [act.start.room];
    const treeQueue: string[] = [];
    const take = (list: Effect[] | undefined): void => {
      for (const e of list ?? []) {
        if (e.k === "go") roomQueue.push(e.room);
        else if (e.k === "talk") treeQueue.push(e.tree);
        else if (e.k === "give") reach.items.add(e.item);
        else if (e.k === "flag" || e.k === "add") reach.flags.add(e.id);
      }
    };
    take(act.onStart);
    while (roomQueue.length || treeQueue.length) {
      const roomId = roomQueue.shift();
      if (roomId !== undefined) {
        const room = content.rooms[roomId];
        if (!room || reach.rooms.has(roomId)) continue;
        reach.rooms.add(roomId);
        take(room.onEnter);
        for (const scene of room.scenes ?? []) if (allowsAct(scene.if, n)) take(scene.do);
        for (const h of room.hotspots) {
          if (!allowsAct(h.showIf, n)) continue;
          reach.flags.add(`looked:${roomId}.${h.id}`);
          if (h.item) reach.items.add(h.item);
          for (const lists of [h.do, ...(h.states ?? []).filter((s) => allowsAct(s.if, n)).map((s) => s.do)]) {
            for (const list of Object.values(lists ?? {})) take(list);
          }
        }
        for (const combo of [...(room.combos ?? []), ...content.combos]) if (allowsAct(combo.if, n)) take(combo.do);
        continue;
      }
      const treeId = treeQueue.shift()!;
      const tree = content.dialogues[treeId];
      if (!tree || reach.trees.has(treeId)) continue;
      reach.trees.add(treeId);
      for (const node of Object.values(tree.nodes)) {
        reach.flags.add(`seen:${treeId}.${node.id}`);
        take(node.do);
        for (const choice of node.choices ?? []) if (allowsAct(choice.if, n)) take(choice.do);
      }
    }
    out.set(n, reach);
  }
  return out;
}
