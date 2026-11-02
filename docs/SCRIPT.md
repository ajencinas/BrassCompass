# The Brass Compass: the script

Scene by scene, as it plays. Canon and voices: [`STORY.md`](STORY.md). Mechanics are in
*italics*; ids in `code` are the content ids the game uses. Key conversations are written in
full; minor lines (looks at scenery) are left to the room files but must follow the voice sheets.

Affection (`aff`) is a hidden number. "+aff" marks a choice that raises it by one.

---

## ACT I: A Licence to Sail

*Built. Changes for the full game are marked NEW.*

**Opening narration (caption).** "Three years stamping other people's voyages. At dawn the
Marrow sails for the Straits, where my father's ship vanished. She only takes licensed hands."

### The customs house: Bramwick

As built: regulation fourteen, the clerk's "legal absence", the stamp in the drawer, the key lost
to Marta at cards, Cray's claim on the last berth.

NEW, the drawer. *Look at the IOU after opening the drawer (`drawer_open`):* "An IOU to Marta:
'one game of cards, unpaid'. And underneath, in writing so small it's practically a whisper:
'and everything else.'" *Sets `seen_iou`.*

### The Salty Keel: Marta, Rook, the regulars

NEW, Marta on the Marrow's crew (`marrow` node gains a choice "Who sails on her?"):
> **MARTA:** Vane, who could out-stare a gull. Hobb, the bosun, who has more names on his arms
> than I have on my slate. And a lookout who can spot a lie at two miles and a compliment at
> none. Mind her. She bites, and she's usually right.

NEW, if `seen_iou` and `marta_paid`, choice "Bramwick still owes you a game of cards.":
> **MARTA:** Thirty years he's owed me that game. He'll never pay it. Paying would mean it's
> over. *(beat)* Don't you dare tell him I said that.

NEW, the wager (optional; regulars): half the room is betting the Marrow won't come back. Fenn
bets his three years' wages that she will, by stamping the regulars' betting slate (stamp on
`crowd`). *Sets `wager`; pays off in the Act IV epilogue.*
> **REGULAR:** A clerk betting on pirates. Put it in the book, Marta, before he sobers up.
> **FENN:** I am entirely sober. It's the pirates you should worry about.

### Lane, chandler's, loft

As built.

### Bramwick's confession

As built (`confess` → `confess3`), ending: "Don't make me write you down as lost."

---

## ACT II: The Vela Straits

**Rooms:** `marrow_deck`, `marrow_quarterdeck`, `marrow_cabin`, NEW `below_decks`
(bg `bg_below_wide`), NEW `bow_fog` (bg `bg_bow_wide`), NEW `crows_nest` (deck art at night:
room `grade`, Act II after `quill_navigator`).
**Inventory at start:** compass, stamp, manifest, crowbar.
**New items:** `spyglass`, `sextant`, `pell_log`.
**New cast:** Dorrit (galley), Hobb (below decks, by Pell's sea-chest).

**Caption.** "Dawn, and the Marrow is mine to stand on. The crew have already decided what I
am: a clerk with a licence and no sea legs."

### 1. The deck: Quill

As built (she wants her spyglass; he finds it by the crates; she lets him aft). Rewrites:

> **QUILL:** You're the clerk. Licence and everything. Don't get comfortable.
> > I'm crew now. → **QUILL:** Crew is what the captain writes in the book. You're cargo with opinions.
> > You must be the lookout who spots lies at two miles. *(if Marta told him)* → **QUILL:** Marta.
> > Of course. Did she mention compliments? *(He says nothing.)* Good. You learn fast, for cargo. (+aff)

On getting the spyglass back:
> **QUILL:** There she is. Dented twice, still honest. *(She sights through it at him.)* You're
> blurrier up close. Go on, then. Captain's down the companionway at the stern.
> > Thank you, Quill. (+aff) → **QUILL:** Don't thank me. Thank the deck for not eating it.
> > I'll put in a good word with the captain. → **QUILL:** Put in a good word for yourself. You'll need it more.

### 2. The cabin: Vane's terms

Compass on chart → as built (Through the reef / My father found one / Ansel Fenn). Then NEW:

> **VANE:** Ansel Fenn ran the Straits in half the time of anyone alive and never told a soul
> how. *(She looks at the needle for a long moment.)* No. A dead man's compass and a clerk's word.
> I've buried one navigator this year; I won't drown a ship for another.
> > Then what would it take? → *`vane_terms`*
> > **VANE:** Three things. A navigator who'll swear to that line. A crew who'll sail it. And a
> > reason Pell would have. Pell never dared the south side, clerk. Give me a reason he would have.

*The lookout's whistle no longer fires here; the act now ends at the bow.*

### 3. Below decks: Hobb and Dorrit (branch A)

*Hobb (sprite at the sea-chest, left) blocks the chest. Dorrit at the stove (right).*

> **HOBB:** Pell's chest. Nobody opens it. *(beat)* Bosun's orders. I'm the bosun.
> > When does anyone move round here? → **HOBB:** Dinner. Dinner's when the gong goes. The gong goes when Dorrit says.
> > Those tattoos. → *(`seen:hobb.names`)* **HOBB:** Everyone I've lost. Pell's on the back of my hand. There's room.

> **DORRIT:** Ah. A colleague. *(He peers at Fenn's licence.)* Customs, twenty-two years. Then
> the sea, for my nerves. Nothing leaves this galley uninspected, clerk. Not a biscuit.
> > Then why isn't dinner served? → **DORRIT:** The stew has not been passed. I have no stamp. I
> > left it in Port Vela with my pension.

*Use stamp on `stew` → "PASSED FOR CONSUMPTION" in purple on a potato. Dorrit, moved:* "Beautiful.
Regulation ink." *He strikes the gong. Hobb's sprite moves to the mess table (`dinner`).*

*Open the chest → `sextant` and `pell_log`.* Narration: "A sextant, polished to a mirror, and
Pell's logbook. The last page is one sentence long and doesn't finish."

*Look at `pell_log`:* "Pell's last entry: 'If Ansel's boy ever comes aboard with the old man's
compass, tell the captain she should'. Then nothing. He died mid-sentence. Vane said so."

### 4. Quill becomes navigator

*Give sextant to Quill (needs `vane_terms`). Without terms:* "She turns it over. 'Pell's. What
am I meant to navigate, cargo? Your feelings?'"

> **QUILL:** Pell's sextant. *(She holds it like it might be taken back.)* You want me to swear
> to your line.
> > I want the captain to hear it from a navigator. → **QUILL:** I'm a lookout.
> > > Not in the log, you're not. *(He writes it.)* "Quill, navigator." (+aff)
> > > → **QUILL:** That's the stupidest thing I've ever heard. *(beat)* Underline it.
> > > You're the best eyes on this ship. → **QUILL:** I know. It's nice to hear it from somebody with handwriting.

*She takes a sight on the quarterdeck: `quill_navigator`. The crow's nest opens (`crows_nest`).*

### 5. Night watch in the crow's nest (optional, love)

*Climb the shrouds from the deck at night (`crows_nest`, after `quill_navigator`). Quill is
there. A conversation, no puzzle. +aff for sincere answers. Sets `night_watch`.*

> **QUILL:** Took you long enough. Most cargo is sick on the second ratline.
> > I was sick on the first. I'm efficient. → **QUILL:** *(laughs, despite herself)*
> **QUILL:** Three stars. The Hook, the Lantern, and the one Pell called the Liar because it
> moves. Learn those and you'll never be lost.
> > What do you see, when you look out? → **QUILL:** Everywhere I haven't been yet. *(beat)* What do you see?
> > > Ink. Every ship I ever stamped out of Vela. I used to wonder where they went. (+aff)
> > > Mostly the mast. It's very close. → **QUILL:** It does that.
> **QUILL:** Your father. You think he's alive.
> > I think someone keeps flying his flag. → **QUILL:** Then we'll find out who. *(beat)* We. Don't read into it.

### 6. Hobb and the crew (branch B)

*After `dinner`, Hobb at the mess table.*
> **HOBB:** Nobody goes south of the reef for money. *(beat)* Only for blood.

*Give manifest to Hobb (needs `dinner`):*
> **HOBB:** *(reads the names; stops.)* Tam Hobb. Able seaman. *(He rolls up his sleeve: TAM.)*
> My brother. Lost with the Arcadia, three years back. *(beat)* South it is. I'll tell the lads.

*`crew_agree`.*

### 7. Pell's reason

*Give `pell_log` to Vane (needs `vane_terms`, `quill_navigator`, `crew_agree`).*
> **FENN:** Pell's last entry. It doesn't finish.
> **VANE:** I know. I was there.
> **FENN:** "If Ansel's boy ever comes aboard with the old man's compass, tell the captain she
> should…" *(beat)* You told me you'd give a great deal to know how that sentence ended.
> **VANE:** *(long silence)* Trust the boy. That's how it ends. Pell always said I never trusted
> anyone. *(She stands.)* Fine. You old coward, you were going to say it. *(to Fenn)* Get to the
> bow, clerk. Quill takes the wheel. You call the bearings.

*`vane_convinced`.*

### 8. The fog run (comic set piece)

*At `bow_fog`, use compass on `fog` (needs `vane_convinced`) → tree `bearings`. Three calls.
Each node describes the needle; the right answer is the side it swings to. Wrong calls scrape
the reef and loop.*

> **NARRATOR:** The needle swings hard to the left of the bowsprit.
> > "Port!" → **QUILL** *(distant)*: Port! → next
> > "Starboard!" → **DORRIT** *(relaying)*: He says starboard! **HOBB:** He means port! **VANE:**
> > He means whatever doesn't sink us! *(scrape)* **QUILL:** That was a rock, cargo. → retry
> **NARRATOR:** Dead ahead. The needle is perfectly still, and so is everyone.
> > "Steady as she goes." → **QUILL:** Steady! **VANE:** Who taught him that? **QUILL:** Me. Last night.
> **NARRATOR:** Right, gently. The rocks are close enough to read.
> > "Starboard, a little." → **QUILL:** Good! *(beat)* That was "good", cargo. Write it down.

Then: "The fog tears open like a curtain. Inside the reef: a lagoon as flat as glass, and a ship
on the rocks, heeled over, masts up. At her masthead, a flag made of shirts." *→ act 2.*

**Outro video:** the fog thinning; the patched flag; "Inside the reef, a ship that should not
exist."

---

## ACT III: Tidy Weather

**Rooms (6):** `reef_wreck` (the Arcadia on the reef, lagoon, beached boat), `arcadia_cabin`
(tilted wrecked cabin), `key_gate` (beach, palisade gate, yellow flag, sentry hut),
`weather_works` (braziers, bellows, kelp bales), `salt_camp` (salt pans, tents, crews),
`lagoon_shore` (where the boat lands; Quill). **Inventory at start:** compass, stamp.
**New items:** `crowbar` (Quill packed it: "Of course you did."), `bill_blank`, `bill_smoked`,
`bill_ready`, `bucket`, `bucket_water`, `calendar_leaf`, `flag16`, `ansel_log`.
**New cast:** Ansel, Pike, Tam Hobb (camp).

**Caption.** "Quill rows. I hold the compass. Neither of us says that the flag on the wreck is
the first thing I've wanted to see since I was twenty."

### 1. The wreck

*Crowbar on the jammed hatch → `arcadia_cabin`.* Inside: Ansel's log, a blank Bill of Health
(`bill_blank`), Lise's portrait, a bucket.

*Look at the log (`ansel_log` taken): the trick explained (yellow flag, fog, "quarantine"), and
the last page.* Fenn reads, then stops. Quill reads it to him:
> **QUILL:** *(reading)* "Lise, number fifteen is the blue one. Our boy will have the compass by
> now. If I'm late, he'll know what to do with it. He won't. He'll do it anyway." *(beat)* Your
> mother. *(beat)* Your father's an idiot. *(beat)* I mean that warmly. (+aff if Fenn says "Thank you for reading it.")

### 2. The gate: Pike (comic set piece, the forms war)

> **PIKE:** Halt. Quarantine station. No admittance without a Bill of Health, fumigated,
> stamped, countersigned and dated. *(He beams.)* I love this job.

Chain, any order where sensible:
- *Use the bill on Pike's fumigation brazier beside the gate* (the Weather Works are behind the
  gate, so the bill is smoked outside it) → `bill_smoked` ("Fumigated. It smells of a bonfire that
  has opinions.").
- *Use stamp on the bill* (global combo, works smoked or not, keeps progress flags `bill_stamped`).
- *Countersign:* give the bill to Quill → she signs "Quill, navigator" and looks at it a long
  time (+aff). `bill_signed`.
- *Date:* Pike's calendar is in his hut; Pike reads the regulations aloud if you ask "What's
  regulation six?", during which you take a `calendar_leaf`. Use it on the bill → `bill_dated`.
- All four → `bill_ready`. Give to Pike → gate opens. Pike: "Fumigated, stamped, countersigned,
  dated. *(He wipes a tear.)* It's beautiful. Nobody ever does the dating."

### 3. The Weather Works and the halyard (love set piece)

*The main brazier keeps the fog up. Fill the bucket at the lagoon (`bucket_water`) and use it on
the great brazier → `fog_down`. The Weather notice.* Short scene: two Weather men corner them;
Quill grabs a halyard.
> **QUILL:** Hold on to me, cargo.
> **FENN:** I am holding on to you.
> **QUILL:** Good. Keep doing that.
*They swing across the braziers to the camp side. (Narration + a brief fade.)*

### 4. The cell and the kiss

*In `salt_camp`, Pike (now on camp duty) locks Quill in the store hut "pending inspection".*
Fenn gets her out with a **Form 9, Release of Detained Person Upon Inspection**, which he writes
out himself on the back of the Bill (the stamp makes it official). Pike: "That's... that's a real
form." *Quill released.*
> **QUILL:** You wrote a form.
> **FENN:** I wrote a very good form.
> *(She kisses him.)*
> **ANSEL** *(arriving)*: Ah. Good. I'll come back.

### 5. The reunion

> **ANSEL:** You're taller. Is that regulation?
> > Hello, Father. → **ANSEL:** Hello, son. *(beat)* I left it on the table because I knew you'd
> > bring it. I didn't know it'd take three years. I'm sorry I made you wait.
> > You left the compass on the hall table. → **ANSEL:** I did! On purpose! Cray wanted it, and I
> > thought, my son has a desk and a stamp, he can't possibly get into trouble. *(beat)* Look at you.
> **ANSEL** *(to Quill)*: And you are?
> **QUILL:** The navigator.
> **ANSEL:** *(delighted)* Of course you are.

Ansel won't leave without every crew. He gives Fenn flag sixteen (`flag16`, with an L in the
corner: "For your mother. She'd have hated the colour.").

Tam Hobb is in the camp. *Talk to him:* "Tell my brother I said his tattoos are terrible."

### 6. The signal

*Use `flag16` on the wreck's halyard (needs `fog_down`).* The Marrow comes in through the
Needle; the crews row out. Cray's cutter, watching from the far side, runs for Port Vela.
*→ act 3.* **Outro video:** boats on the lagoon; a cutter's sails heading for the horizon.

---

## ACT IV: All Hands Returned

**Rooms:** Act I's six rooms at night again (changed states and people) + NEW `counting_house`
(Cray & Co.), NEW `pier_end` (Cray's cutter). **Inventory at start:** compass, stamp, crowbar,
`ansel_log`. **New items:** `purse`, `requisition`, `claims_book`, `ledger`, `kelp_manifest`.
**Cast tonight:** Cray in Bramwick's chair (office); Bramwick and Rook drinking together and
Marta (tavern); Nib (counting house); Cray's men (pier end); Quill, Ansel (dock, aboard).

**Caption.** "Port Vela, the night after. Cray got home first. The harbour bell will ring at
dawn, and at the bell he will write us all down as lost."

### 1. The dock: the farewell

> **QUILL:** Quarantine flag on the harbour boom. Nobody lands. And if the Marrow's still at
> anchor at the bell, Cray writes her down as a plague ship. We sail at dawn either way.
> > Then I have until dawn. → **QUILL:** You have until dawn. *(beat)* Fenn. *(First time. He
> > notices. She notices him noticing.)* Don't be late.
*`farewell`. Quill and Ansel stay aboard (sprites on the Marrow's rail).*

### 2. The office: Acting Harbourmaster Cray

> **CRAY:** The clerk! Back from the dead, or at least from the sea, which in my experience is
> worse. I'm Acting Harbourmaster. Bramwick was suspended for, let's see, "conduct". Do sit.
> > You emptied six ships. → **CRAY:** I insured six ships. The weather emptied them. I have the
> > paperwork. *(He smiles.)* I always have the paperwork.
> > You'll never get the compass. → **CRAY:** I don't need it now. You've told me where it points.

### 3. The tavern: the disgraced and the drunk

> **BRAMWICK:** Regulation two, Fenn. A harbourmaster suspended by a party to fraud is
> reinstated on proof of the fraud. Proof. Before the bell.
> **ROOK:** Is he… *(He can't finish.)*
> > He's alive, Rook. He's on the Marrow. → **ROOK:** *(a long breath)* Then I've been drunk
> > three years for nothing. *(He takes out the purse.)* Here. Cray's seal. Never opened. I was
> > saving it for when I could look at it.
*`purse`.*

*If `wager`:* the regulars owe Fenn three years' wages, payable "when the Marrow lands, which
she won't, ha" (epilogue).

### 4. The counting house: Nib

> **NIB:** Cray and Company. Closed. I'm only here because nobody told me to go home.
> > What's in those books? → **NIB:** No idea. I don't read them. Nobody reads them. That's what they're for.

*Take a `requisition` form from Nib's tray; stamp it (global combo: "Requisition, one claims
book, insurance, all of it. Authorised: Harbour of Port Vela."); give it to Nib.*
> **NIB:** Stamped. *(He hands over the claims book without looking at it.)* Have a nice night.
*`claims_book`: six ships paid out "for weather", the same year Vane's claim was refused.*

### 5. The loft and the pier end

- *Crowbar on the ledger's chain (Act I callback) → `ledger`.*
- *Pier end (optional, extra proof):* Cray's men unloading kelp. *Pick up `kelp_manifest`
  ("QUARANTINE STN, G.K.: briquettes, kelp, 400; for fog") while they argue about whose turn it
  is to be menacing.* Sets `kelp_proof`.

### 6. The inquiry at the Salty Keel (climax and comic set piece)

*With the ledger, purse and claims book (and Ansel's log from the start), talk to Cray (now at
the tavern for his dawn toast) → tree `inquiry`. Marta presides: "Licensed premises. Regulation
forty. Bramwick, is there a regulation forty?" "There is now."*

Four charges. Each: Cray rebuts; Fenn picks evidence. Right evidence advances; wrong evidence
gets a withering line and a retry.

1. **"The Arcadia was lost at sea."** → Ansel's log. *Cray:* "A sailor's diary. Charming."
   *Marta:* "Written by a man waiting outside that window." (Ansel, at the window, waves.)
2. **"I paid harbour dues. Perfectly legal."** → the ledger. "Dues for a ship three days
   before she was late. Mr Cray, you're very punctual for a tragedy."
3. **"The insurers paid for weather."** → the claims book. "Six ships. Same year Captain Vane's
   real storm was refused." *Dorrit, from the back:* "Stamped and passed, that book. I'd
   know."
4. **"Nobody can say who was taken off those ships."** → Rook stands up, and Fenn gives him the
   purse to hold up. **ROOK:** "I can. I was the first."
(*If `kelp_proof`:* a fifth, optional: Fenn slaps down the kelp manifest. "For fog." The room
laughs at Cray for the first time.)

**CRAY:** *(standing, impeccably polite)* I collect things that point, clerk. I should have
known this one would point at me.

### 7. Ending the story

- Bramwick is reinstated; Fenn gives him back his stamp. He lifts the quarantine. The crews
  come ashore. **MARTA:** "Took you long enough." *(She's crying. She denies it.)*
- **Bramwick pays the IOU.** *(Talk to Bramwick after.)* He lays it on the bar. She reads the
  small writing, then shuffles: "One more hand. For the debt." "And everything else?" "Deal."
- **The ledger.** *Use the stamp on the `ledger` at the bar:* Fenn writes "ARCADIA: returned.
  All hands." and stamps it.

### 8. The choice at the dock, dawn

> **QUILL:** Well, cargo. Sea or desk?
> > Sign me on. Purser. I'll keep the books and you'll keep the stars. → *ending: pirate*
> > Someone has to keep the ledger honest. Come back every season? → *ending: desk*

**Endings** (lines vary with `aff` ≥ 5, `night_watch`, `wager`, `kelp_proof`):
- **Pirate:** dawn from the crow's nest. "QUILL: That's the Liar. It moves. FENN: I'll write it
  down. QUILL: You do that." Flag sixteen flies at the Marrow's masthead.
- **Desk:** the customs house window, a year later; a sail on the horizon; Fenn stamping "ARRIVED"
  before she's even docked.
- **Epilogue lines:** Quill named navigator; Vane's claim paid at last; Rook back at sea,
  "mostly"; Bramwick and Marta (married if `wager`, else still playing for it); Ansel's
  instrument shop sells compasses that point at home; Cray files an appeal "in triplicate, as is
  his right".
