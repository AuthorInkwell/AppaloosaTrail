# Dropping your own music in

Put a file in this folder, named after the slot it should play in, and reload
the game. Nothing else to configure — the file is picked up automatically.

| Filename    | Plays during                                        |
| ----------- | --------------------------------------------------- |
| `title`     | the title screen                                     |
| `store`     | the general store and trading posts                  |
| `travel`    | travelling the trail (silent by default, as in 1990) |
| `landmark`  | arriving at a town or landmark                       |
| `forage`    | the foraging minigame                                |
| `river`     | water crossings (silent by default)                  |
| `everfree`  | driving through the Everfree Forest                  |
| `victory`   | arriving at Appaloosa                                |
| `memorial`  | a pony's memorial, and the losing ending             |

## Formats

**`.mid` / `.midi` — recommended.** MIDI is played back through the game's own
square, triangle and noise voices, so imported music still sounds like the rest
of the game rather than like a General MIDI soundfont. It is also small,
editable, and easy to tweak later.

How the channels are mapped:

- Channel 10 (the General MIDI drum channel) becomes noise percussion, using
  the standard drum map for kick, snare, hats, toms and cymbals.
- Of the remaining channels, the one with the lowest average pitch becomes the
  triangle-wave bass. The rest become square-wave leads.
- Dense chords are thinned to four simultaneous voices, keeping the top and
  bottom of each part, which is what a hand-made chip arrangement would do.
- Tempo changes are honoured. Pitch bend, velocity curves, program changes and
  controllers are ignored.

Aim for two to four parts and a couple of minutes of material. Anything written
for an NES, Game Boy or Apple II soundtrack will translate well.

**`.ogg` / `.mp3` / `.wav` / `.m4a`** are played exactly as supplied, looping
seamlessly if the file is trimmed to loop. Use these if you have a finished
chiptune render and want it heard verbatim.

## Examples

```
public/music/title.mid       -> title theme
public/music/everfree.mid    -> the Everfree minigame
public/music/victory.ogg     -> a rendered arrival fanfare
```

Files whose names do not match a slot are ignored.

## A note on builds

`npm run dev` picks up new files on the next page reload. A production build
(`npm run build`) takes a snapshot of this folder, so rebuild after adding music.

The **Sound and music** screen on the title menu lists everything that loaded,
which is the quickest way to confirm a file was found.
