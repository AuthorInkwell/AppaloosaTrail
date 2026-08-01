/**
 * Music routing. Each slot plays an imported file from public/music if one is
 * present, and otherwise falls back to the built-in chiptune. Imported .mid
 * files are played through the same square/triangle/noise voices as everything
 * else; .ogg/.mp3/.wav files are played as-is.
 */

import { Song, audio } from "../../engine/audio";
import { MidiSong, limitPolyphony, parseMidi } from "../../engine/midi";
import {
  EVERFREE_THEME,
  FORAGE_THEME,
  LANDMARK_THEME,
  MEMORIAL_THEME,
  STORE_THEME,
  TITLE_THEME,
  VICTORY_THEME,
} from "../data/music";

export type MusicSlot =
  | "title"
  | "store"
  | "travel"
  | "landmark"
  | "forage"
  | "river"
  | "everfree"
  | "victory"
  | "memorial";

/** Slots with no built-in track stay silent unless a file is supplied. */
const BUILT_IN: Partial<Record<MusicSlot, Song>> = {
  title: TITLE_THEME,
  store: STORE_THEME,
  landmark: LANDMARK_THEME,
  forage: FORAGE_THEME,
  everfree: EVERFREE_THEME,
  victory: VICTORY_THEME,
  memorial: MEMORIAL_THEME,
};

export const MUSIC_SLOTS: MusicSlot[] = [
  "title",
  "store",
  "travel",
  "landmark",
  "forage",
  "river",
  "everfree",
  "victory",
  "memorial",
];

type Imported =
  | { kind: "midi"; song: MidiSong }
  | { kind: "sample"; data: ArrayBuffer; buffer: AudioBuffer | null; name: string };

const imported = new Map<MusicSlot, Imported>();
const MIDI_EXT = [".mid", ".midi"];
const SAMPLE_EXT = [".ogg", ".mp3", ".wav", ".m4a"];

function slotFromFilename(file: string): MusicSlot | null {
  const base = file.replace(/\.[^.]+$/, "").toLowerCase();
  return (MUSIC_SLOTS as string[]).includes(base) ? (base as MusicSlot) : null;
}

function musicUrl(file: string): string {
  return new URL(`music/${file}`, document.baseURI).toString();
}

/**
 * Reads the manifest produced by the Vite plugin and loads whatever is there.
 * Missing manifest or unreadable files are not an error: the built-ins stand in.
 */
export async function loadImportedMusic(): Promise<string[]> {
  const loaded: string[] = [];
  let files: string[] = [];
  try {
    const res = await fetch(new URL("music/manifest.json", document.baseURI).toString(), { cache: "no-cache" });
    if (!res.ok) return loaded;
    const body = (await res.json()) as { files?: string[] };
    files = Array.isArray(body.files) ? body.files : [];
  } catch {
    return loaded;
  }

  for (const file of files) {
    const slot = slotFromFilename(file);
    if (!slot) continue;
    const lower = file.toLowerCase();
    try {
      const res = await fetch(musicUrl(file));
      if (!res.ok) continue;
      const data = await res.arrayBuffer();
      if (MIDI_EXT.some((e) => lower.endsWith(e))) {
        const song = limitPolyphony(parseMidi(data, `midi:${slot}`), 4);
        if (song.notes.length === 0) continue;
        imported.set(slot, { kind: "midi", song });
        loaded.push(`${file} (${song.notes.length} notes, ${song.duration.toFixed(0)}s)`);
      } else if (SAMPLE_EXT.some((e) => lower.endsWith(e))) {
        imported.set(slot, { kind: "sample", data, buffer: null, name: `sample:${slot}` });
        loaded.push(file);
      }
    } catch (err) {
      console.warn(`music: could not load ${file}`, err);
    }
  }
  return loaded;
}

export function hasImported(slot: MusicSlot): boolean {
  return imported.has(slot);
}

export function importedSlots(): MusicSlot[] {
  return [...imported.keys()];
}

export function playMusic(slot: MusicSlot): void {
  const custom = imported.get(slot);
  if (custom) {
    if (custom.kind === "midi") {
      audio.playMidi(custom.song, { loop: true });
      return;
    }
    if (custom.buffer) {
      audio.playSample(custom.buffer, custom.name, { loop: true });
      return;
    }
    // Decode on first use, then start; the built-in covers the gap.
    void audio.decode(custom.data).then((buffer) => {
      if (!buffer) return;
      custom.buffer = buffer;
      if (currentSlot === slot) audio.playSample(buffer, custom.name, { loop: true });
    });
  }
  const builtIn = BUILT_IN[slot];
  if (builtIn) audio.playSong(builtIn);
  else audio.stopMusic();
}

let currentSlot: MusicSlot | null = null;

/** Plays a slot, remembering it so a later decode can take over seamlessly. */
export function setMusic(slot: MusicSlot | null): void {
  if (currentSlot === slot) return;
  currentSlot = slot;
  if (slot === null) {
    audio.stopMusic();
    return;
  }
  playMusic(slot);
}

export function currentMusicSlot(): MusicSlot | null {
  return currentSlot;
}

/** Restarts the current slot, e.g. after music is switched back on. */
export function refreshMusic(): void {
  const slot = currentSlot;
  currentSlot = null;
  setMusic(slot);
}

audio.onMusicResume = refreshMusic;
