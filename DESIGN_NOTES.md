# Design notes

Where the code interprets the design document, where it fills gaps, and what needs your input next.
Everything below is easy to change; the numbers all live in one or two files.

## Decisions that needed interpreting

**Party size.** The overview says "a team of four ponies", but the Flow of Play says the player
names "their Wagon Master and the other four members of their party". I went with five total —
Wagon Master plus four — because that matches the original's party of five and the naming screen
reads better. One constant, `PARTY_SIZE` in `src/game/scenes/setup.ts`, changes it.

**Health.** Each pony carries a 0-100 health value rather than the original's single party
condition, so the party screen can show who is actually suffering. The status bar still shows one
word for the party as a whole ("good", "fair", "poor", "very poor", "grave").

**How death works.** Per the brief that ponies "will have more chances to live", a pony must reach
zero health, then survive three further days; each of those days is a fresh recovery roll, and a
healing potion is spent automatically before the game will let anypony die. In practice a player who
rests and feeds the party will not lose anypony.

**Score multipliers.** The document gives the Earth Pony a score bonus for finishing and says the
Unicorn starts richest. I mapped that onto the original's occupation multipliers: Unicorn x1,
Pegasus x1.4, Earth Pony x2, with starting purses of 1600 / 1150 / 800 bits.

**Distance and pace.** 1,712 miles total. A team of six at a steady pace covers roughly 20 miles a
day, so a well-run journey takes 85-95 days and a badly-run one can take 130. Speed is
`7 + 2.3 x team` miles a day, scaled by pace, weather, terrain, party health and team morale, and a
team of zero drops you to about 4.5 miles a day.

**Food.** Measured in basketfuls, as specified. A pony on filling rations eats one basket a day and
each team member eats half of one, so five ponies and six in the team eat eight baskets a day. Food
costs 4 bits per 10 baskets at Pioneer's Bluff, and the shopkeeper's grandmother now recommends four
hundred baskets, which is roughly half a journey's worth — the rest is meant to come from foraging.

**Foraging trade-off.** The design document's rule is that more gathering time means less time to
carry the load back. Four durations are offered, from half an hour (gather 18 seconds, carry up to
40 baskets) to three hours (48 seconds, carry only 14). The sweet spot is one or two hours, and an
earth pony carries a third again as much. A foraging trip always costs one day.

**The Everfree minigame.** Nothing in the document describes the obstacles, so it is a driving
sequence: the track is four lanes wide, you steer up and down and control your speed, and trunks,
rocks, vines and timberwolves come at you. Hits cost food and health but never end the run, and
getting through cleanly is worth 250 points. Completing it skips 58 miles and the 175-bit toll.

**Everfree geography.** In the show the Everfree is next to Ponyville, in the east. The document
puts its southern tip just before Appaloosa, so that is where it is.

## Invented to fill gaps

- The trail itself: sixteen landmarks, their mile markers, their blurbs and their prices.
- The ailment roster, the thirty-odd random events, and the traveller chatter at stops.
- Pioneer's Bluff, Marezy Doats Meadow, Whitetail Way Station, Rambling Rock Ridge, Serpent's Bend,
  Sun-Kissed Springs and the Parting of Ways are non-canon inventions in the spirit of the brief.
- The year is 1002, and the Bamboozle brothers are two identical stallions in straw boaters.
- Trail markers: when a pony dies you may carve a message, which is stored locally and can be found
  by later runs. This mirrors the original's tombstones.

## Placeholder art

Everything is drawn in code, so nothing is missing exactly, but these would benefit most from proper
pixel art if you want to supply it:

1. **The title screen.** Currently a scrolling landscape with the wagon crossing it and a two-times
   scaled type treatment. A drawn logo and a proper title illustration would lift it a lot.
2. **The ponies.** They are 16x14 side-view silhouettes with remappable coat and mane colours, plus
   winged and horned variants. They read as ponies at a glance but have no faces to speak of, no
   cutie marks, and only one pose. Per-character portraits for the five party members would be the
   single biggest visual upgrade.
3. **The Wagon Team.** 20x16 ox-adjacent creatures with hats and kerchiefs, recoloured per member.
   The brief asks for accessories that suggest they are more than pack animals; right now that is a
   hat and a neckerchief and not much else.
4. **Landmark vistas.** Painted procedurally from primitives (buildings, hills, cacti, springs,
   canyon walls). They are distinct from one another but generic. Ponyville, Dodge Junction and
   Appaloosa in particular deserve recognisable skylines.
5. **The wagon.** A 34x16 body with two animated wheels. Fine, but plain.

Sprites live in `src/art/sprites.ts` as rows of hex palette digits, with `.` for transparent and
letters (`C` coat, `M` mane, `H` hoof, `E` eye, `A` accessory) for remappable slots. Dropping in
replacement art is a matter of editing those strings — no pipeline, no files to import.

## Music

Six short loops (title, landmark, foraging, Everfree, victory, memorial) written as step patterns in
`src/game/data/music.ts`, played on square, triangle and noise voices. They are deliberately simple.
If you want a specific melody, the notation is one token per sixteenth note: note names like `C4`
and `F#3`, `.` for a rest, `=` to hold the previous note, and `x` for a noise hit.

## Known gaps and likely next steps

- No swamp-specific crossing flavour beyond Froggy Bottom Bogg's reduced options.
- Trading with other travellers is limited to the events; the trading posts use the same store screen
  as Pioneer's Bluff rather than a barter interface.
- The talk-to-ponies option gives advice but never quests or trades.
- There is no difficulty setting; the original's "level" choice could map to starting bits.
- Weather is rolled per day and shown, but there is no multi-day storm system.
- Ailment contagion is implemented but deliberately gentle; it may want tuning after real play.
- Nothing is balanced against a human player yet. The scripted playthrough in `tools/smoketest.mjs`
  proves it runs end to end, not that it is fun. Pace, food costs and event weights are the first
  things to adjust once you have played it.
