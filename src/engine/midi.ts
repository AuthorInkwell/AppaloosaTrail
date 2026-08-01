/**
 * A small Standard MIDI File reader. It turns a .mid into a flat, time-sorted
 * list of notes in seconds, which the chiptune synth can then play on its
 * square/triangle/noise voices — so imported music still sounds like the rest
 * of the game rather than like a General MIDI soundfont.
 *
 * Supports SMF format 0, 1 and 2, running status, tempo changes and both
 * ticks-per-quarter and SMPTE time division.
 */

import type { Wave } from "./audio";

export interface MidiNote {
  /** Seconds from the start of the song. */
  time: number;
  duration: number;
  /** MIDI note number. */
  pitch: number;
  freq: number;
  velocity: number;
  channel: number;
  wave: Wave;
}

export interface MidiSong {
  name: string;
  notes: MidiNote[];
  /** Seconds, including a little tail so loops do not clip. */
  duration: number;
  channels: number[];
}

const DRUM_CHANNEL = 9;

class Reader {
  pos = 0;
  constructor(readonly view: DataView) {}

  get done(): boolean {
    return this.pos >= this.view.byteLength;
  }

  u8(): number {
    return this.view.getUint8(this.pos++);
  }

  u16(): number {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  u32(): number {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  str(n: number): string {
    let out = "";
    for (let i = 0; i < n; i++) out += String.fromCharCode(this.view.getUint8(this.pos + i));
    this.pos += n;
    return out;
  }

  /** MIDI variable-length quantity. */
  varInt(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return value;
  }

  skip(n: number): void {
    this.pos += n;
  }
}

interface RawEvent {
  tick: number;
  /** Insertion order, so simultaneous events stay stable when sorted. */
  order: number;
  kind: "on" | "off" | "tempo";
  channel: number;
  pitch: number;
  velocity: number;
  /** Microseconds per quarter note, for tempo events. */
  tempo: number;
}

export function midiNoteToFreq(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function parseMidi(buffer: ArrayBuffer, name: string): MidiSong {
  const r = new Reader(new DataView(buffer));
  if (r.str(4) !== "MThd") throw new Error(`${name}: not a MIDI file`);
  const headerLength = r.u32();
  r.u16(); // format; tracks are merged either way
  const trackCount = r.u16();
  const division = r.u16();
  r.skip(Math.max(0, headerLength - 6));

  const events: RawEvent[] = [];
  let order = 0;

  for (let t = 0; t < trackCount && !r.done; t++) {
    const id = r.str(4);
    const length = r.u32();
    if (id !== "MTrk") {
      r.skip(length);
      continue;
    }
    const end = r.pos + length;
    let tick = 0;
    let runningStatus = 0;

    while (r.pos < end) {
      tick += r.varInt();
      let status = r.u8();
      if (status < 0x80) {
        // Running status: reuse the previous status byte.
        r.pos--;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }
      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (status === 0xff) {
        const metaType = r.u8();
        const len = r.varInt();
        if (metaType === 0x51 && len === 3) {
          const tempo = (r.u8() << 16) | (r.u8() << 8) | r.u8();
          events.push({ tick, order: order++, kind: "tempo", channel: 0, pitch: 0, velocity: 0, tempo });
        } else {
          r.skip(len);
        }
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        r.skip(r.varInt());
        continue;
      }

      switch (type) {
        case 0x90: {
          const pitch = r.u8();
          const velocity = r.u8();
          events.push({
            tick,
            order: order++,
            kind: velocity > 0 ? "on" : "off",
            channel,
            pitch,
            velocity,
            tempo: 0,
          });
          break;
        }
        case 0x80: {
          const pitch = r.u8();
          r.u8();
          events.push({ tick, order: order++, kind: "off", channel, pitch, velocity: 0, tempo: 0 });
          break;
        }
        case 0xa0:
        case 0xb0:
        case 0xe0:
          r.skip(2);
          break;
        case 0xc0:
        case 0xd0:
          r.skip(1);
          break;
        default:
          // Unknown status; bail out of this track rather than desynchronise.
          r.pos = end;
          break;
      }
    }
    r.pos = end;
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  // ---- ticks to seconds ------------------------------------------------
  const smpte = (division & 0x8000) !== 0;
  const ticksPerSecond = smpte ? -(division >> 8 || -1) * (division & 0xff) : 0;
  const ticksPerQuarter = smpte ? 0 : division || 480;

  let secondsPerTick = smpte ? 1 / (ticksPerSecond || 1) : 0.5 / ticksPerQuarter; // 120bpm default
  let lastTick = 0;
  let elapsed = 0;
  const timeAt = (tick: number): number => elapsed + (tick - lastTick) * secondsPerTick;

  interface Open {
    time: number;
    velocity: number;
  }
  const open = new Map<number, Open[]>();
  const notes: MidiNote[] = [];
  const channels = new Set<number>();

  for (const e of events) {
    const time = timeAt(e.tick);
    if (e.kind === "tempo") {
      if (!smpte) {
        elapsed = time;
        lastTick = e.tick;
        secondsPerTick = e.tempo / 1000000 / ticksPerQuarter;
      }
      continue;
    }
    const key = e.channel * 128 + e.pitch;
    if (e.kind === "on") {
      const list = open.get(key) ?? [];
      list.push({ time, velocity: e.velocity });
      open.set(key, list);
      channels.add(e.channel);
    } else {
      const list = open.get(key);
      const started = list?.shift();
      if (!started) continue;
      const duration = Math.max(0.03, time - started.time);
      notes.push({
        time: started.time,
        duration,
        pitch: e.pitch,
        freq: midiNoteToFreq(e.pitch),
        velocity: started.velocity / 127,
        channel: e.channel,
        wave: "square",
      });
    }
  }

  // Anything still held when the file ends gets a short tail.
  for (const [key, list] of open) {
    const channel = Math.floor(key / 128);
    const pitch = key % 128;
    for (const started of list) {
      notes.push({
        time: started.time,
        duration: 0.4,
        pitch,
        freq: midiNoteToFreq(pitch),
        velocity: started.velocity / 127,
        channel,
        wave: "square",
      });
    }
  }

  notes.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
  assignWaves(notes, channels);

  const last = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  return {
    name,
    notes,
    duration: Math.max(1, last + 0.25),
    channels: [...channels].sort((a, b) => a - b),
  };
}

/**
 * Picks a chip voice per MIDI channel: percussion becomes noise, the channel
 * sitting lowest becomes the triangle bass, and everything else is a square
 * lead with a little detune so stacked parts stay distinguishable.
 */
function assignWaves(notes: MidiNote[], channels: Set<number>): void {
  const averages = new Map<number, { sum: number; count: number }>();
  for (const n of notes) {
    const a = averages.get(n.channel) ?? { sum: 0, count: 0 };
    a.sum += n.pitch;
    a.count++;
    averages.set(n.channel, a);
  }
  const melodic = [...channels].filter((c) => c !== DRUM_CHANNEL);
  melodic.sort((a, b) => {
    const av = averages.get(a);
    const bv = averages.get(b);
    return (av ? av.sum / av.count : 99) - (bv ? bv.sum / bv.count : 99);
  });
  const waveFor = new Map<number, Wave>();
  melodic.forEach((channel, i) => {
    // Lowest average pitch is the bass line.
    waveFor.set(channel, i === 0 && melodic.length > 1 ? "triangle" : "square");
  });
  waveFor.set(DRUM_CHANNEL, "noise");
  for (const n of notes) n.wave = waveFor.get(n.channel) ?? "square";
}

/**
 * Drops notes from dense chords so the mix stays chip-like and does not clip.
 * Keeps the highest and lowest voices, which is what a tracker arrangement of
 * the same piece would do by hand.
 */
export function limitPolyphony(song: MidiSong, maxVoices = 4): MidiSong {
  if (maxVoices <= 0) return song;
  const kept: MidiNote[] = [];
  let i = 0;
  while (i < song.notes.length) {
    let j = i;
    const t = song.notes[i]!.time;
    while (j < song.notes.length && song.notes[j]!.time - t < 0.02) j++;
    const chord = song.notes.slice(i, j);
    if (chord.length <= maxVoices) {
      kept.push(...chord);
    } else {
      const byChannel = new Map<number, MidiNote[]>();
      for (const n of chord) {
        const list = byChannel.get(n.channel) ?? [];
        list.push(n);
        byChannel.set(n.channel, list);
      }
      const picks: MidiNote[] = [];
      for (const list of byChannel.values()) {
        list.sort((a, b) => b.pitch - a.pitch);
        picks.push(list[0]!);
        if (list.length > 1 && picks.length < maxVoices) picks.push(list[list.length - 1]!);
      }
      kept.push(...picks.slice(0, maxVoices));
    }
    i = j;
  }
  return { ...song, notes: kept };
}
