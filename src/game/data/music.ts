/** Chiptune loops. Four steps per beat; "." rests and "=" holds the last note. */

import type { Song } from "../../engine/audio";

const p = (...bars: string[]) => bars.join(" ");

export const TITLE_THEME: Song = {
  name: "title",
  bpm: 128,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.19,
      duty: 0.8,
      pattern: p(
        "G3 . C4 . E4 . G4 .",
        "E4 . C4 . D4 = = .",
        "F4 . E4 . D4 . E4 .",
        "C4 = = = = = = .",
        "G4 . E4 . C5 . G4 .",
        "A4 . F4 . G4 = = .",
        "E4 . D4 . C4 . B3 .",
        "C4 = = = = = = .",
      ),
    },
    {
      wave: "triangle",
      gain: 0.22,
      pattern: p(
        "C2 . . . G2 . . .",
        "C2 . . . G2 . . .",
        "F2 . . . C2 . . .",
        "G2 . . . G2 . . .",
        "C2 . . . E2 . . .",
        "F2 . . . C2 . . .",
        "G2 . . . G2 . . .",
        "C2 . . . C2 . . .",
      ),
    },
    {
      wave: "noise",
      gain: 0.06,
      duty: 0.35,
      pattern: p(
        "x . . . x . x .",
        "x . . . x . x .",
        "x . . . x . x .",
        "x . x . x . x .",
        "x . . . x . x .",
        "x . . . x . x .",
        "x . . . x . x .",
        "x . x . x . x .",
      ),
    },
  ],
};

export const LANDMARK_THEME: Song = {
  name: "landmark",
  bpm: 112,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.17,
      pattern: p(
        "C4 . E4 . G4 = = .",
        "A4 . G4 . E4 = = .",
        "F4 . A4 . C5 = = .",
        "G4 = = = = = = .",
        "E4 . G4 . A4 = = .",
        "G4 . F4 . D4 = = .",
        "C4 . D4 . E4 = = .",
        "C4 = = = = = = .",
      ),
    },
    {
      wave: "triangle",
      gain: 0.2,
      pattern: p(
        "C3 . . . G2 . . .",
        "A2 . . . E2 . . .",
        "F2 . . . C3 . . .",
        "G2 . . . G2 . . .",
        "C3 . . . G2 . . .",
        "F2 . . . D3 . . .",
        "G2 . . . G2 . . .",
        "C3 . . . C3 . . .",
      ),
    },
  ],
};

export const FORAGE_THEME: Song = {
  name: "forage",
  bpm: 150,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.15,
      duty: 0.6,
      pattern: p(
        "E4 . G4 . A4 . G4 .",
        "E4 . D4 . E4 . . .",
        "C4 . E4 . G4 . E4 .",
        "D4 . . . D4 . . .",
        "E4 . G4 . A4 . B4 .",
        "C5 . A4 . G4 . . .",
        "A4 . G4 . E4 . D4 .",
        "E4 . . . E4 . . .",
      ),
    },
    {
      wave: "triangle",
      gain: 0.18,
      pattern: p(
        "A2 . A2 . E2 . E2 .",
        "A2 . A2 . E2 . E2 .",
        "C3 . C3 . G2 . G2 .",
        "D3 . D3 . D3 . D3 .",
        "A2 . A2 . E2 . E2 .",
        "F2 . F2 . C3 . C3 .",
        "G2 . G2 . D3 . D3 .",
        "A2 . A2 . A2 . A2 .",
      ),
    },
    {
      wave: "noise",
      gain: 0.05,
      duty: 0.3,
      pattern: p(
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
        "x . x . x . x .",
      ),
    },
  ],
};

export const EVERFREE_THEME: Song = {
  name: "everfree",
  bpm: 138,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.14,
      duty: 0.55,
      detune: -8,
      pattern: p(
        "D4 . . . F4 . . .",
        "A4 . . . G4 . . .",
        "D4 . . . E4 . . .",
        "F4 . . . E4 . . .",
        "D4 . . . A3 . . .",
        "Bb3 . . . C4 . . .",
        "D4 . . . C4 . . .",
        "Bb3 . . . A3 . . .",
      ),
    },
    {
      wave: "triangle",
      gain: 0.22,
      pattern: p(
        "D2 . D2 . D2 . D2 .",
        "D2 . D2 . D2 . D2 .",
        "Bb1 . Bb1 . Bb1 . Bb1 .",
        "A1 . A1 . A1 . A1 .",
        "D2 . D2 . D2 . D2 .",
        "D2 . D2 . D2 . D2 .",
        "Bb1 . Bb1 . Bb1 . Bb1 .",
        "A1 . A1 . A1 . A1 .",
      ),
    },
    {
      wave: "noise",
      gain: 0.07,
      duty: 0.25,
      pattern: p(
        "x . x x x . x .",
        "x . x x x . x .",
        "x . x x x . x .",
        "x . x x x . x .",
        "x . x x x . x .",
        "x . x x x . x .",
        "x . x x x . x .",
        "x x x x x x x x",
      ),
    },
  ],
};

export const VICTORY_THEME: Song = {
  name: "victory",
  bpm: 120,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.2,
      pattern: p(
        "C4 . E4 . G4 . C5 .",
        "G4 = = . E4 . G4 .",
        "F4 . A4 . C5 . F5 .",
        "C5 = = = = = = .",
        "E5 . D5 . C5 . B4 .",
        "A4 . G4 . F4 . E4 .",
        "D4 . E4 . F4 . G4 .",
        "C5 = = = = = = .",
      ),
    },
    {
      wave: "triangle",
      gain: 0.2,
      pattern: p(
        "C3 . G2 . C3 . G2 .",
        "C3 . G2 . C3 . G2 .",
        "F2 . C3 . F2 . C3 .",
        "C3 . G2 . C3 . G2 .",
        "A2 . E3 . A2 . E3 .",
        "F2 . C3 . F2 . C3 .",
        "G2 . D3 . G2 . D3 .",
        "C3 . G2 . C3 . C3 .",
      ),
    },
  ],
};

export const MEMORIAL_THEME: Song = {
  name: "memorial",
  bpm: 76,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "triangle",
      gain: 0.2,
      pattern: p(
        "A3 = = = C4 = = =",
        "E4 = = = D4 = = =",
        "C4 = = = A3 = = =",
        "G3 = = = = = = =",
        "F3 = = = A3 = = =",
        "C4 = = = B3 = = =",
        "A3 = = = G3 = = =",
        "A3 = = = = = = =",
      ),
    },
    {
      wave: "sine",
      gain: 0.14,
      pattern: p(
        "A2 = = = = = = =",
        "A2 = = = = = = =",
        "F2 = = = = = = =",
        "G2 = = = = = = =",
        "F2 = = = = = = =",
        "C3 = = = = = = =",
        "E2 = = = = = = =",
        "A2 = = = = = = =",
      ),
    },
  ],
};
