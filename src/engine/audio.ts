/**
 * Tiny chiptune engine: square/triangle/noise voices driven by step patterns,
 * plus a handful of one-shot sound effects. Deliberately lo-fi, per the design
 * doc's "very simplistic chiptune music".
 */

export type Wave = "square" | "triangle" | "sawtooth" | "sine" | "noise";

export interface Channel {
  wave: Wave;
  /** Space-separated steps: note names ("C4", "F#3"), "." rest, "=" hold. */
  pattern: string;
  gain?: number;
  /** Note length as a fraction of the step, 0..1. */
  duty?: number;
  detune?: number;
}

export interface Song {
  name: string;
  bpm: number;
  stepsPerBeat: number;
  loop: boolean;
  channels: Channel[];
}

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function noteFreq(note: string): number | null {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!m) return null;
  const semis = NOTE_OFFSETS[m[1]!];
  if (semis === undefined) return null;
  const octave = parseInt(m[2]!, 10);
  const midi = (octave + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ScheduledNote {
  freq: number | null; // null = noise hit
  start: number;
  dur: number;
  gain: number;
  wave: Wave;
  detune: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private currentSong: Song | null = null;
  private loopTimer: number | null = null;
  private generation = 0;
  private liveNodes: AudioScheduledSourceNode[] = [];
  muted = false;

  /** Must be called from inside a user gesture. */
  init(): void {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.75;
    this.sfxGain.connect(this.master);

    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private voice(n: ScheduledNote, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const env = ctx.createGain();
    const attack = 0.005;
    const release = Math.min(0.09, n.dur * 0.5);
    env.gain.setValueAtTime(0, n.start);
    env.gain.linearRampToValueAtTime(n.gain, n.start + attack);
    env.gain.setValueAtTime(n.gain, Math.max(n.start + attack, n.start + n.dur - release));
    env.gain.linearRampToValueAtTime(0.0001, n.start + n.dur);
    env.connect(dest);

    let src: AudioScheduledSourceNode;
    if (n.wave === "noise" || n.freq === null) {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer;
      s.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = n.freq ?? 1400;
      filter.Q.value = 1.2;
      s.connect(filter);
      filter.connect(env);
      src = s;
    } else {
      const o = ctx.createOscillator();
      o.type = n.wave;
      o.frequency.value = n.freq;
      o.detune.value = n.detune;
      o.connect(env);
      src = o;
    }
    src.start(n.start);
    src.stop(n.start + n.dur + 0.02);
    this.liveNodes.push(src);
    src.onended = () => {
      const i = this.liveNodes.indexOf(src);
      if (i >= 0) this.liveNodes.splice(i, 1);
      try {
        src.disconnect();
      } catch {
        /* already gone */
      }
      env.disconnect();
    };
  }

  playSong(song: Song): void {
    if (this.currentSong?.name === song.name) return;
    this.init();
    this.stopMusic();
    if (!this.ctx || !this.musicGain) {
      this.currentSong = song;
      return;
    }
    this.currentSong = song;
    const gen = ++this.generation;
    this.scheduleSong(song, gen);
  }

  private scheduleSong(song: Song, gen: number): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || gen !== this.generation) return;
    if (ctx.state === "suspended") void ctx.resume();

    const stepDur = 60 / song.bpm / song.stepsPerBeat;
    const t0 = ctx.currentTime + 0.08;
    let steps = 0;

    for (const ch of song.channels) {
      const tokens = ch.pattern.trim().split(/\s+/);
      steps = Math.max(steps, tokens.length);
      let i = 0;
      while (i < tokens.length) {
        const tok = tokens[i]!;
        if (tok === "." || tok === "=") {
          i++;
          continue;
        }
        let held = 1;
        while (i + held < tokens.length && tokens[i + held] === "=") held++;
        const freq = tok === "x" ? null : noteFreq(tok);
        if (freq !== null || tok === "x") {
          this.voice(
            {
              freq,
              start: t0 + i * stepDur,
              dur: stepDur * held * (ch.duty ?? 0.92),
              gain: ch.gain ?? 0.22,
              wave: ch.wave,
              detune: ch.detune ?? 0,
            },
            dest,
          );
        }
        i += held;
      }
    }

    const total = steps * stepDur;
    if (song.loop) {
      this.loopTimer = window.setTimeout(
        () => {
          if (gen === this.generation) this.scheduleSong(song, gen);
        },
        Math.max(120, total * 1000 - 90),
      );
    }
  }

  stopMusic(): void {
    this.generation++;
    this.currentSong = null;
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    for (const n of this.liveNodes.slice()) {
      try {
        n.stop();
      } catch {
        /* not started */
      }
    }
    this.liveNodes = [];
  }

  private blip(freq: number, dur: number, wave: Wave, gain = 0.3, slideTo?: number): void {
    this.init();
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime + 0.001;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0005, start + dur);
    env.connect(dest);
    if (wave === "noise") {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(freq, start);
      if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      f.Q.value = 0.9;
      s.connect(f);
      f.connect(env);
      s.start(start);
      s.stop(start + dur + 0.02);
    } else {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(freq, start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      o.connect(env);
      o.start(start);
      o.stop(start + dur + 0.02);
    }
  }

  private arp(freqs: number[], step: number, wave: Wave, gain = 0.25): void {
    this.init();
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    if (ctx.state === "suspended") void ctx.resume();
    const base = ctx.currentTime + 0.001;
    freqs.forEach((f, i) => {
      this.voice({ freq: f, start: base + i * step, dur: step * 1.4, gain, wave, detune: 0 }, dest);
    });
  }

  sfx(name: SfxName): void {
    switch (name) {
      case "move":
        this.blip(560, 0.035, "square", 0.13);
        break;
      case "select":
        this.blip(880, 0.06, "square", 0.2, 1180);
        break;
      case "back":
        this.blip(420, 0.07, "square", 0.16, 260);
        break;
      case "type":
        this.blip(1200, 0.02, "square", 0.09);
        break;
      case "pickup":
        this.arp([784, 1046], 0.045, "square", 0.2);
        break;
      case "bad":
        this.blip(220, 0.28, "sawtooth", 0.22, 90);
        break;
      case "hurt":
        this.blip(1200, 0.18, "noise", 0.3, 200);
        break;
      case "splash":
        this.blip(900, 0.4, "noise", 0.24, 160);
        break;
      case "coin":
        this.arp([1046, 1318, 1568], 0.05, "square", 0.18);
        break;
      case "fanfare":
        this.arp([523, 659, 784, 1046, 1318], 0.085, "square", 0.2);
        break;
      case "sad":
        this.arp([392, 349, 311, 262], 0.16, "triangle", 0.22);
        break;
      case "thud":
        this.blip(160, 0.14, "triangle", 0.3, 60);
        break;
      case "day":
        this.blip(660, 0.05, "triangle", 0.12);
        break;
    }
  }
}

export type SfxName =
  | "move"
  | "select"
  | "back"
  | "type"
  | "pickup"
  | "bad"
  | "hurt"
  | "splash"
  | "coin"
  | "fanfare"
  | "sad"
  | "thud"
  | "day";

export const audio = new AudioEngine();
