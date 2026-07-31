# The Appaloosa Trail

A fan-made tribute to MECC's *The Oregon Trail*, retold in the world of *My Little Pony: Friendship
is Magic*. Five ponies leave Pioneer's Bluff with a wagon, a hired team of hatted draft folk, and a
great many baskets of food, and try to reach the new western town of Appaloosa alive.

Everything is rendered at **320x200 in the sixteen EGA colours** — the display mode the 1990 MS-DOS
release ran in — with a hand-built 5x7 bitmap font and square-wave chiptune music.

## Running it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

```bash
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

There are no runtime dependencies. The whole game is a static page.

## Controls

| Key | Does |
| --- | --- |
| number keys | pick a menu item |
| arrow keys + RETURN | pick a menu item the slow way |
| SPACE BAR | continue; sizes up the situation while travelling |
| arrow keys | move / steer in the minigames |
| ESC | back out of a screen, or end a foraging trip early |
| M | sound on/off |
| F | fullscreen |

## What is in the vertical slice

- **Three origins** — Unicorn of Canterlot, Pegasus of Cloudsdale, Earth Pony of Fillydelphia —
  with different purses, different problem-solving options and different score multipliers.
- **Naming** for the Wagon Master and four companions, with a pony-appropriate name generator
  (F2 rolls a fresh set; RETURN on an empty field names that pony for you).
- **A departure month** to choose, from March to July, with the summer/winter squeeze the design
  document asks for.
- **The general store** at Pioneer's Bluff and at every trading post on the trail, with prices that
  climb the further west you get.
- **The Wagon Team**: hired, hatted, and opinionated. More members means faster travel and more
  mouths to feed. Starve them, work them at a grueling pace or treat them badly and they desert. If
  every one of them leaves, the ponies pull the wagon themselves at a crawl.
- **Day-by-day travel** with weather, terrain, pace, rations, ailments and morale, plus a full
  "size up the situation" menu (supplies, map, party, pace, rations, rest, forage, potions, save).
- **Thirty-odd random events**, roughly a third of which are choices. None of them can end a run on
  their own — the worst outcomes cost time, supplies or health.
- **Ponified ailments** instead of real diseases: the hoof-sniffles, sugarcube fever, griffon pox,
  bogwater belly, bramble scratch fever, poison joke, the mopes and more.
- **Gentle death**: a pony has to sit at zero health for three days, gets a recovery roll every one
  of them, and a healing potion is spent automatically before they are allowed to die.
- **Water crossings** with five approaches — ford it, caulk and float it ("the Earth Pony way"),
  hire a team of pegasi to fly it over, levitate it if your wagon master is a unicorn, or pay the
  ferry — plus waiting for the water to drop and asking the locals what they think.
- **The foraging minigame** in place of hunting: food blows in from off screen, pops out of the
  ground and drops from the tree, while birds and deer race you for it. You choose how long to stay
  out, and the longer you gather the less daylight is left to carry anything back.
- **The last decision**: the Bamboozle Toll Road (safe, expensive, hagglable) or the southern tip of
  the Everfree Forest (a driving minigame that saves 58 miles and the whole toll).
- **Arrival, scoring and a Hall of Fame**, and a memorial screen where you can carve a message on a
  trail marker that later runs will find.
- **Menu-based saving** into three slots, the one modern convenience the design document asks for
  by name.

## The trail

1,712 miles from Pioneer's Bluff to Appaloosa, through Marezy Doats Meadow, Hoofprint River,
Ponyville, Froggy Bottom Bogg, Whitetail Way Station, Rambling Rock Ridge, Galloping Gorge, Dodge
Junction, the Macintosh Hills, Serpent's Bend, the San Palomino Desert, Ghastly Gorge, Sun-Kissed
Springs and the Parting of Ways.

## Layout

```
src/
  engine/     screen (EGA framebuffer), font, input, audio, scenes, ui, rng
  art/        sprites, procedural scenery, landmark vistas, the wagon rig
  game/
    data/     trail, store, events, ailments, names, talk, music
    systems/  travel simulation, effects, scoring, saves, trail markers
    scenes/   title/setup, store, travel, menus, landmarks, rivers,
              foraging, the finale, shared modal furniture
tools/
  smoketest.mjs   scripted playthrough that drives the real game in Chrome
```

`node tools/smoketest.mjs` plays the game against a running dev server, screenshots every stage and
fails on any console error. `--skip-ahead 1540` jumps to the late trail to exercise the endgame.

## Art and audio

All of it is generated in code: sprites are authored as strings of palette digits in
`src/art/sprites.ts`, landscapes and landmark vistas are painted procedurally in `src/art/scenery.ts`
and `src/art/vistas.ts`, and the music is step patterns fed to square, triangle and noise voices in
`src/engine/audio.ts`. Nothing is loaded from disk, so there are no assets to lose track of.

See [DESIGN_NOTES.md](DESIGN_NOTES.md) for what was interpreted, what was invented to fill gaps, and
what would most benefit from proper artwork.

## Legal

Unofficial, non-commercial fan work. *My Little Pony* is the property of Hasbro. *The Oregon Trail*
is the property of its rights holders.
