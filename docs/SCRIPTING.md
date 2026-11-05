# Scripting The Brass Compass

All of the game's content (rooms, hotspots, combinations, conversations, items, tips, acts
and the ending) is written in `.adv` scripts under `src/content/scripts/`:

```
src/content/scripts/
  rooms/<room>.adv        one room each
  dialogue/<tree>.adv     one conversation each
  items.adv               the inventory catalogue
  combos.adv              combinations that work anywhere, and shared combo groups
  tips.adv                the H / tip-mode hints
  acts.adv                the four acts and the ending card
```

The game compiles every script when it starts (`src/adv/compile.ts`), producing exactly the
`Room`, `DialogueTree`, `Item`... data in `src/game/types.ts`. A file can hold any number of
top-level blocks, and blocks can move between files; file names are only for people.
`npm run test:scripts` compiles everything in about a second, and the in-browser editor (F2 in
`npm run dev`) recompiles as you type.

## The shape of a script

- One statement per line. Nesting is by indentation, **two spaces** per level (no tabs).
- `#` starts a comment, anywhere outside a string.
- Text is in double quotes, JSON style: `"She said \"no\"."`. Curly quotes and dashes can be
  typed as they are.
- Names (ids) are letters, digits, `_`, and also `:` and `.` inside a name
  (`seen:rook.who`).
- Points are `x,y`; polygons are a list of `(x,y)` points; rectangles are `x,y WxH`.

Errors name the file, line and column: `rooms/tavern.adv:14:9: no item 'lemmon'`.

## Rooms

```
room tavern "The Salty Keel"
  bg bg_tavern_wide
  width 2560                       # world width; defaults to 1920
  music music_tavern
  ambience gulls                   # optional
  grade "saturate(0.85) brightness(0.9)"   # optional CSS filter (night grade)
  stars 260                        # optional: stars over the top 260 px
  perspective horizon 450 ref 875 height 327
  walk (470,875) (640,790) (820,772) (1735,880)   # one line per walkable polygon
  entry 720,830
  arrive dock 590,835              # where you appear when you come from that room

  sprite npc_marta_body_v2 at 1960,728 size 1.25 idle speaker marta for marta
  occluder floor 730 (1308,568) (2560,590) (2560,880) (1328,716)

  on enter                         # every time the room loads
    music music_tavern
  scene if act 4 and not cray_toast   # arrival scenes: the first that holds runs
    set cray_toast
    say "Silas Cray is at the bar..."
```

`perspective`: a standing adult whose feet are at `ref` is `height` pixels tall, shrinking to
nothing at `horizon`.

**Sprite options** (after `at x,y size s`, in any order, `if` last): `visible 0.7` (fraction
of the figure the art shows), `flip`, `idle` (breathes), `speaker <character>`,
`for <hotspot>` (glows with it, hides with it), `grade "<filter>"`, `if <conditions>`.

**Occluders** repaint the background over anything standing behind them; `floor y` is where
the object meets the floor.

## Hotspots

```
  hotspot marta "Marta"
    show if not marta_gone         # optional: only there while this holds
    area 1890,460 140x125          # or a polygon: area (0,0) (650,0) (700,550)
    stand 1500,800                 # where Fenn walks to first
    look "Marta, who runs the Salty Keel and, by most accounts, Port Vela."
    talk "I catch Marta's eye. It takes some catching."
      talk tavernkeeper            # effects nested under a verb run after its line
    give "She only takes things worth trading."
    open: say "Not a door."        # one effect can go on the verb's own line
```

**Verbs:** `look talk give use open close push pull pickup walk turnon turnoff`. A verb line
has its text in quotes, nested effects, or both. Verbs without a line fall back to the
game's generic replies.

**Flags:**

| line | meaning |
|---|---|
| `person` / `thing` | force person or object wording in fallback lines (normally guessed) |
| `nowalk` | act without walking over (the sky, a distant ship) |
| `verb talk` | the natural verb, lit on hover and done by right-click (normally guessed) |
| `article the` / `a` / `none` | article for fallback lines |
| `item crowbar` | Pick up gives this item |
| `exit dock` | shorthand: open, use and walk all `go dock` |

**States** override the name, lines and effects while their condition holds; the first match
wins, so put the most specific first:

```
    state if act 4 and iou_paid
      name "Marta, smiling"
      look "She's humming. Nobody has ever heard Marta hum."
      talk: talk marta4 at cards
    state if act 4
      talk "Everyone I'd want to talk to has come ashore."
        nothing                    # an explicitly empty effect list: cancels the base effects
```

## Combinations

```
  use mushroom on marta if not marta_paid
    "Jet-caps! The broth lives."    # the line, first
    take mushroom
    give drawer_key
    set marta_paid
```

In a room, the target is a hotspot or an item; the first combination whose condition holds
wins, and room combinations win over the global ones. Top-level `use` blocks in any file
(by convention `combos.adv`) work everywhere. `consume` takes the item after the line.

**Combo groups** share combinations between rooms:

```
combos quill_combos                # combos.adv
  use crowbar on quill
    "She pushes it back."

room reef_wreck "..."              # in each room that wants them
  combos quill_combos
```

## Conversations

```
dialogue tavernkeeper
  node root marta "Clerk! Here for a drink?"
    > "What's everyone celebrating?" -> marrow
    > "I need a favour." if not knows_key -> favour
    > "I've got one right here." if has lemon -> traded
      take lemon                   # effects of choosing this
      give drawer_key
    > "Nothing. Goodnight." -> END
  node marrow marta "The Marrow sails at dawn."
    -> crew                        # no choices: carry on to the next node
  node traded narrator "She bites the lemon."
    set marta_paid                 # effects when the node is read
```

`node <id> <speaker> "<line>"`: the speaker is a character id or `narrator`. The first node
is where the conversation starts (`start <node>` overrides it). `-> END` (or no next and no
choices) closes the conversation. Every node shown sets `seen:<tree>.<node>`, so a choice can
wait for something: `if seen:rook.who`.

## Items, tips, acts

```
item lemon "lemon"
  look "A lemon from the Marrow's galley stores."
  state if act 3                   # name and look can change with the story
    look "Still a lemon. Somehow."

tip if act 1 and has lemon         # the first tip that holds is the current one
  "Give the lemon to Marta in the Salty Keel."

act 2 "The Vela Straits"
  start marrow_deck                # or: start dock at 880,830
  intro "/assets/video/act-ii-intro.mp4"
  outro "/assets/video/act-ii-outro.mp4"
  inventory compass stamp manifest crowbar
  caption "Dawn, and the Marrow is mine to stand on."
  on start
    give crowbar

ending "ALL HANDS RETURNED"
  title if ending_pirate
    "THE PURSER OF THE MARROW"
  line if ending_pirate and aff >= 14
    "Her hand is in mine before the Liar has even set."
  line
    "ARCADIA: returned. All hands."
```

## Conditions

Conditions follow `if` and are joined with `and`. `or` goes in parentheses.

| write | true when |
|---|---|
| `knows_key` | the flag is `true` |
| `not knows_key` | the flag is false or was never set |
| `knows_key = true` | the flag is exactly `true` (likewise `= 3`, `= "red"`) |
| `knows_key = unset` | the flag was never set |
| `aff >= 14` | a counter (raised by `add`) has reached 14 |
| `has lemon` / `not has lemon` | in the inventory, or not |
| `room tavern` | the player is in that room |
| `act 4` / `act 3,4` | the current act is 4 / is 3 or 4 |
| `(a or b or c)` | at least one holds |
| `not (aff >= 14)` / `not act 1` | the opposite |

Example: `if has lemon and not knows_key and act 1 and (aff >= 14 or night_watch)`.

## Effects

| write | does |
|---|---|
| `say "text"` | narrate a line (waits for the previous one to be read) |
| `set flag` / `set flag = false` | set a flag (to `true`, or any value) |
| `add aff 1` | raise a counter (`-1` lowers it) |
| `give lemon` / `take lemon` | add to or remove from the inventory |
| `go tavern` | walk out to another room |
| `talk tavernkeeper` / `talk marta4 at cards` | open a conversation, at its start or a node |
| `act 2` | finish act 2 (outro, then the next act) |
| `win` | the ending card |
| `sound chime` | `click pickup chime deny door gulls` |
| `music music_tavern` | change the music |
| `nothing` | an explicitly empty list (a state cancelling the base effects) |

## Checks

The compiler checks every name: items, rooms, conversations and nodes, speakers, images,
hotspots named by sprites and combinations. Flags read but never set are errors; flags set but
never read are warnings. The end-to-end test (`npm test`) also runs the content lint and the
placement lint over the compiled data.

## Converting and round trips

`tools/to-adv.mjs` wrote these scripts from the hand-written TypeScript at commit `1014f5e`
and proved them identical; `npm run test:scripts -- --against 1014f5e` re-runs that proof
(it holds until the content is next changed). `npm run test:scripts` always checks that the
scripts compile and that `src/adv/serialize.ts` writes back exactly what the compiler reads.
