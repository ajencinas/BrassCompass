# Dialogue & Story Review — The Brass Compass

*2026-11-06. Six parallel reviewers read [`docs/FULL_SCRIPT.md`](../FULL_SCRIPT.md) (generated from the
.adv scripts by `npm run script:export`): one per act, one on characters across the game, one on story
structure and continuity. Their full findings, with proposed rewrites for every item, are in this folder:*

| File | Scope |
|---|---|
| [act1.md](act1.md) | Act I, A Licence to Sail |
| [act2.md](act2.md) | Act II, The Vela Straits |
| [act3.md](act3.md) | Act III, Tidy Weather |
| [act4.md](act4.md) | Act IV, All Hands Returned, and the endings |
| [characters.md](characters.md) | Voices and arcs, whole game |
| [structure.md](structure.md) | Mystery release, continuity, setups/payoffs, theme |

All refs are `file:line` under `src/content/scripts/`. This page merges the six into one prioritised plan
and settles where reviewers disagreed.

---

## Verdict

The writing is strong. Every major character can be identified with the names hidden. The jokes come from
character and from paperwork, and almost every callback in STORY.md pays off on screen. Several shipped
inventions are better than the design docs:

- Form 9 releases *Persons*, plural.
- Rook's "SURPLUS TO REQUIREMENTS" slip rhymes with Ansel's "One captain, used".
- Upper Town gives the town its own stakes.

The problems are structural, not about line quality:

1. **The mystery mostly lives in optional text.** On the critical path, a player can reach Act III without:
   - learning that six ships vanished,
   - hearing Rook's quarantine story,
   - meeting Cray.
2. **Continuity holes at the act seams.**
   - The Marrow is inside the reef at the end of Act II and outside it at the start of Act III.
   - In Act IV, Fenn walks ashore under a quarantine that bans everyone from the Marrow.
   - Act I says the Arcadia was "found drifting". She was never found.
3. **Three supporting arcs end off screen.**
   - Hobb's reunion with his brother is only reported.
   - Vane has no lines after Act II.
   - Pike is never "recruited".
4. **Fenn feels least at the moments that matter most.**
   - "Ansel's boy" is read aloud, and Fenn has no reaction.
   - Bramwick confesses, and Fenn's only reply is "I won't, sir."
   - The reunion with his father only starts if the player clicks on Ansel afterwards.
5. **The theme is stated but never argued.** Fenn wins by writing paperwork, just as Cray does. The script
   never says the difference is that Fenn's is true.

---

## Tier 1: Bugs and contradictions (fix first)

| # | Problem | Fix | Detail |
|---|---|---|---|
| 1 | **BUG.** Bramwick's Act IV states are checked first-match, so `inquiry_done` hides `iou_paid`. The `bramwick4 at cards` scene can never play, and his Look still says "suspended" after he is reinstated. | Reorder the states in `rooms/tavern.adv:125-133`, the same way Marta's are ordered. Add a reinstated Look line. | act4 #1 |
| 2 | The Arcadia is "found drifting" in four places. In canon she was never found. | Make it five hulls found and one never found. That turns her into the hook. Lines in tavernkeeper:25, nell:16, vane:16, marrow_quarterdeck:20. | structure P2, act1 #1 |
| 3 | The Marrow runs the Needle at the end of Act II but is outside the reef in Act III. The flag-signal objective is only in optional text. | Vane's bridging order after "That's the Arcadia" (bearings). | structure P1 |
| 4 | Fenn is ashore in Act IV despite the quarantine. | Quill: "Except customs… Congratulations. You're a clerk again." (quill4:3) | structure P5 |
| 5 | Timeline slips. | Hobb has waited "three days" for stew and been on biscuit "since Vela" (below_decks:97, hobb:10); the Marrow left this dawn. "Last night I came home" should be tonight (pier_end:72). The Act I outro says "Tomorrow" where everything else says dawn. STORY says Act IV is "the night after"; the script means the same night. | act2 #3, structure P5 |
| 6 | Where the night watch happens. The art is the main deck at night. | Keep marrow_deck:45. Fix crows_nest:24 and watch:3 to the deck ("Two ratlines… The sky's the same from down here, just further"). | act2 #2 |
| 7 | Compass shop. ansel4:16 says the compasses point at the Old Nail; the epilogue (acts:76) says they point at "home". | Use the Act IV reviewer's line, which is canon and has nothing supernatural: "…points at the Old Nail, and is useless anywhere else. He says that isn't a fault. It's how you find your way home." | act4 #2 |
| 8 | Pell knew Ansel's secret, but Vane says Ansel "never told a soul". | Vane: "Pell and Ansel Fenn drank the same bad rum every winter for twenty years. Of course Ansel told him." (vane:62) | structure P11, act2 #17 |
| 9 | Fenn has kept the ledgers for three years and never read his father's entry. | It's the Harbourmaster's book, and clerks keep the day-books (warehouse:17, bramwick:31). | act1 #2 |
| 10 | Quill: "I packed it for you" (combos:65). In Act III's opening line, Fenn packed the crowbar. | "You packed it, you carry it. That's the rule with crowbars." | act3 #3 |
| 11 | "Every boat that floats" was taken (ansel:34), then the crews "row in everything that floats" (signal:14). | "…which turns out to include salt rafts, two doors and a bathtub." | act3 #4 |
| 12 | "I don't know what the L is for" (reef_wreck:76). His mother was Lise. | "I know one L. I decide I'm not ready to know it yet." | act3 #5 |
| 13 | Small facts: "shillings" (the currency is crowns); "300 crowns" before the purse is opened; nine shirts vs ten men; Dorrit's stamp with his "pension" vs "never resigned"; Hobb's tattoo on his hand vs his forearm; "eleven minutes" after the bell has rung. | One-liners. | act1 #10, #17; structure list |
| 14 | Casebook spoilers. The Form 9 note gives away the "Persons" twist and says "signature" (it's a stamp). The Rook note names "Cray's seal" before the player can work it out. | Rewrite both notes. | act3 #11, act1 #5 |

## Tier 2: Put the story on the critical path

1. **Meet Cray in Act I.** Add a once-only arrival in the alley that opens `silas` at `root`. *(structure P3)*
2. **Plant "quarantine" as Act I's mystery word.**
   - The ledger fee becomes "Quarantine dues, Gullet Key station. Paid, Cray & Co." (warehouse:18/:22). Split it into two bubbles and give Use and Open the same action, including the casebook note.
   - That links Rook's yellow flag, Pike's "quarantine dues paid in full" and the Act IV boom.
   - Name the Needle in Vane's compass scene.
   - *(structure P4, act1 #3)*
3. **Bramwick's confession gets weight.**
   - Seed "I never once saw him go under" in `confess3`.
   - Give Fenn three replies that end the act differently: "You wrote him down, sir. Three days early." / "You told me to read it. Thank you for that." / "I won't, sir."
   - Branch bramwick:40 so it doesn't assume Fenn has met Rook.
   - *(act1 #6, #13; structure P3)*
4. **"Ansel's boy" gets a Fenn beat:** "Nobody has called me that in three years. I read it the way it was written, and my voice only goes once." *(act2 #6)*
5. **Make the log underline unmissable.**
   - Route Quill's `eyes` choice into `write`. Two later lines depend on Fenn writing "Quill, navigator".
   - Plant the "steady" helm call in the night watch, so "Me. Last night." pays off.
   - *(act2 #1, #4)*
6. **Fix the third-term clue.** Vane's "can't fetch from a sea-chest" points away from the answer, which is in a sea-chest. *(act2 #5)*
7. **Play the reunion as one scene.**
   - Chain kiss → `turn` → a new opening beat → "You're taller. Is that regulation?"
   - Ansel apologises for the wrong things, which is his bible gag: "I'm sorry about the beard… And the three years. I should have led with the three years."
   - Give Fenn one honest, unfunny line, answered with a joke: "Well. It was very neat handwriting."
   - *(act3 #1–2, A; characters P6)*
8. **Argue the theme in the climax.**
   - Charge four is about the quarantine ("Quarantine. I'm told it's catching."), and Rook answers "I'm ashore. I was the first."
   - Before the verdict, Cray says "I write it, you file it… and now you write it too." Fenn: "Yes. The difference is that mine were true."
   - Bramwick's refusal to enter the Marrow as lost moves into his greeting, so every player hears it.
   - *(structure P6, P7, P9)*
9. **Give the inquiry a stronger opening and a reaction to the slip.**
   - Cray: "I've taken the liberty of drafting the charges against me. Mine will be tidier."
   - After the purse slip: "It's a very good hand. I always did keep receipts. It's a weakness." Then Bramwick: "Three hundred. Same as me."
   - *(act4 #3–4)*

## Tier 3: Unfinished arcs and payoffs

| Thread | Proposal | Detail |
|---|---|---|
| **Hobb** finds his brother off screen | A new Keel hotspot in Act IV. HOME is tattooed under TAM, and Hobb has started on the other arm: "That one's for the ones that come back. There's room." Also the Act II line: "Then I had that one done early." | characters P1, act2 #10 |
| **Vane** vanishes after Act II | An Act IV scene about carrying "four hundred crates of fog" (in **crowns**, not shillings), plus Quill's "Vane found out what was in her crates." | characters P2, structure P12 |
| **Pike** is never recruited | Pike hands over the roll of all six crews (pike:117). The ledger then corrects **all six ships**, not only the Arcadia. Epilogue: he becomes a harbour clerk "who does the dating". | structure P8, characters P3, act4 #13 |
| **The ending choice** has no stated cost | Quill names it: "Your father's been home one night, and Bramwick needs somebody who reads the backs…" Bramwick and Ansel each pull Fenn a different way. Ansel also gets "Don't ask me where to point." | act4 #7, C; characters P7 |
| **The romance at low affection** erases the kiss, which every player sees | New ending lines: "filed it under heatstroke… close enough to amend the record." At high affection, Quill spends the second rationed "Fenn": "That's two. Don't get used to it." Fix "It's rationed, I told you", which is false on two of three paths. | characters P4–P5, act4 #8 |
| **Bramwick as Fenn's mentor** gets no closing beat | Fenn quotes regulation fourteen back at him. Epilogue: a PURSER stamp cut "before I'd decided", or the desk moved "six inches nearer the window". | characters P8 |
| **The compass** (the title object) gets no final beat | Desk ending: Fenn gives it to Quill. Pirate ending: it goes in the binnacle. | act4 A |
| **Marta, the story-trader**, is only stated as one in Act IV | Set it up in Act I ("Pay me in story"). Ending: "tells the whole story every night at nine… charges for the ending." | characters P12, act4 D |
| **Upper Town** can be skipped before the ending | Marta and Quill both send Fenn up the steps first. Add an epilogue line for Onn and Tam. | act4 #12, #14 |
| **Act IV** has no ticking clock | Dock arrival lines keyed to how much evidence Fenn holds. The bell-ringer climbs. | structure P10 |
| **Act I's hook** is thrown away by the outro card | "At dawn, the Marrow sails. / Somewhere past the reef, somebody has been paying to keep ships lost." This needs a HyperFrames re-render. | structure P12 |

## Tier 4: Voice and repetition

- **Fenn's Act I dialogue choices** are blander than his narration: "Thank you.", "Yes, sir.", "I see.", "Good to know." Give them his voice so his growth has somewhere to start. *(characters P11)*
- **Shared tics should belong to one character each.**
  - "Mind the step" belongs to Onn and the Hobbs.
  - "Don't X. Y." belongs to Hobb.
  - "cargo" belongs to Quill. Trim about a third of her uses in Act III, and switch her two stray "clerk"s to "cargo".
  - Tuesdays belong to Rook.
  - "Pike would want a form" appears about six times in Act III.
  - The "mother would have hated the colour" joke appears three times; name the colour: mustard.
  - *(act2 #13–14, act3 #13–14, characters P12)*
- **Lines over about 180 characters** (too long for one bubble): about 20 are listed in the act files, each with a split or a cut.
- **Fallback lines:** rewrite the flattest four. Add Act III–IV variants so Fenn's idle voice also changes from clerk to crew: "I give it a heave, like a sailor. It stays put, like a clerk." *(characters P15)*
- **Smaller fixes:** the "It's a date" anachronism, "Your feelings?", Marta's onions cliché ("Nobody write that down."), and a dead single "…" choice in Nib's conversation.

## Where reviewers disagreed (and the call made)

- **Compass shop:** the Act IV reviewer's Old Nail version, because it keeps "nothing supernatural" canon. The structure reviewer preferred the epilogue's wording.
- **Quill's "Good luck." reply** (quill:49): the characters version, "Navigators get written in the log. I'd know. I've filed a thousand." It sets up the log underline directly. The Act II version ("Is that written down anywhere?") is a fine alternative.
- **Night watch location:** the deck, because that's what the art shows. Fix the crow's-nest lines.
- **Ledger correction:** combine Pike's roll (structure) with "my hand doesn't shake until the sixth" (Act IV).

## Lines that set the bar

- "It was not a kindness. It was three hundred crowns." (bramwick:42)
- "Belief is what's left when the paperwork runs out." (onn:14)
- HOBB: "Yes." (asked "Is anyone else's heart doing this?") (bearings:26)
- "One captain, used. I'd argue with 'used'." (ansel:58)
- "Release of Detained Persons. Persons, sir. With an s." (pike:98)
- "Mr Cray, you're very punctual for a tragedy." (inquiry:70)
- "The tide doesn't care. I do. Don't tell the tide." (quill4:58)
- "I stamp her ARRIVED before she's even rounded the light." (acts:53)

## Suggested order of work

1. Tier 1: bugs and continuity. These are one-liners plus the Bramwick state order.
2. Tier 2: critical-path story beats.
3. Tier 3: arcs and payoffs. This is new content but no new art; the Hobb and Vane scenes reuse existing sprites.
4. Tier 4: a voice and length pass. Then run `npm run script:export` and re-read the affected scenes in FULL_SCRIPT.md.

After each tier, run `npm run test:fast` and `node tools/playthrough.mjs`. Several Tier 2 changes touch
critical-path conversations that the playthrough drives.
