/**
 * Writes a small Standard MIDI File used to exercise the importer: two melodic
 * tracks, a drum part on channel 10, a tempo change part-way through, and
 * running status. Not shipped with the game.
 *
 *   node tools/make-test-midi.mjs public/music/title.mid
 */

import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/test.mid";

const varInt = (n) => {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
};

const chunk = (id, data) => {
  const len = data.length;
  return [...id.split("").map((c) => c.charCodeAt(0)), (len >> 24) & 255, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...data];
};

const TPQ = 480;

// Track 0: tempo map.
const tempoTrack = [
  ...varInt(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // 500000 us = 120bpm
  ...varInt(TPQ * 8), 0xff, 0x51, 0x03, 0x06, 0x1a, 0x80, // 400000 us = 150bpm
  ...varInt(0), 0xff, 0x2f, 0x00,
];

// Track 1: a melody on channel 0, using running status after the first event.
const melody = [];
const scale = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60, 67];
melody.push(...varInt(0), 0x90, scale[0], 90);
for (let i = 1; i < scale.length; i++) {
  melody.push(...varInt(TPQ / 2), scale[i - 1], 0); // note off via running status
  melody.push(...varInt(0), scale[i], 90);
}
melody.push(...varInt(TPQ / 2), scale[scale.length - 1], 0);
melody.push(...varInt(0), 0xff, 0x2f, 0x00);

// Track 2: bass on channel 1 and drums on channel 10 (index 9).
const rhythm = [];
for (let bar = 0; bar < 8; bar++) {
  rhythm.push(...varInt(bar === 0 ? 0 : 0), 0x91, 36 + (bar % 2) * 5, 80);
  rhythm.push(...varInt(TPQ), 0x81, 36 + (bar % 2) * 5, 0);
  for (let beat = 0; beat < 2; beat++) {
    rhythm.push(...varInt(0), 0x99, beat === 0 ? 36 : 38, 100);
    rhythm.push(...varInt(TPQ / 2), 0x89, beat === 0 ? 36 : 38, 0);
  }
}
rhythm.push(...varInt(0), 0xff, 0x2f, 0x00);

const header = chunk("MThd", [0, 1, 0, 3, (TPQ >> 8) & 255, TPQ & 255]);
const bytes = [...header, ...chunk("MTrk", tempoTrack), ...chunk("MTrk", melody), ...chunk("MTrk", rhythm)];

writeFileSync(out, Buffer.from(bytes));
console.log(`wrote ${out} (${bytes.length} bytes)`);
