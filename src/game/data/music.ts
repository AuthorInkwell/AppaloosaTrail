/**
 * Built-in chiptune. Four steps to the beat; a token is a note name, "." a
 * rest, "=" a hold of the previous note and "x" a noise hit.
 *
 * Each tune is written as four-line sections (eight beats each) and then
 * arranged, so the loops run twenty to thirty seconds and actually go
 * somewhere instead of repeating a single phrase. Anything here is replaced
 * outright by a matching file in public/music.
 */

import type { Song } from "../../engine/audio";

type Section = string[];

const S = (...lines: string[]): Section => lines;
const arrange = (...sections: Section[]): string => sections.flat().join(" ");
const REST = S(". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . .");

// ---------------------------------------------------------------------------
// Title: a bright trail tune in C, verse / bridge / verse.
// ---------------------------------------------------------------------------

const TITLE_A1 = S("G3 . C4 . E4 . G4 .", "E4 . C4 . D4 = = .", "F4 . E4 . D4 . E4 .", "C4 = = = = = = .");
const TITLE_A2 = S("G4 . E4 . C5 . G4 .", "A4 . F4 . G4 = = .", "E4 . D4 . C4 . B3 .", "C4 = = = = = = .");
const TITLE_B1 = S("A4 . A4 . G4 . F4 .", "G4 = = . E4 . F4 .", "D4 . F4 . A4 . C5 .", "A4 = = = = = = .");
const TITLE_B2 = S("G4 . B4 . D5 . B4 .", "G4 . F4 . E4 . D4 .", "C4 . E4 . G4 . E4 .", "D4 = = = G3 . B3 .");
const TITLE_C1 = S("A3 . C4 . E4 . A4 .", "G4 . E4 . C4 = = .", "F4 . A4 . C5 . A4 .", "G4 = = = = = = .");
const TITLE_C2 = S("E4 . G4 . C5 . B4 .", "A4 . G4 . F4 . E4 .", "D4 . E4 . F4 . G4 .", "C5 = = = = = = .");

const TITLE_BASS_A1 = S("C2 . . . G2 . . .", "C2 . . . G2 . . .", "F2 . . . C2 . . .", "G2 . . . G2 . . .");
const TITLE_BASS_A2 = S("C2 . . . E2 . . .", "F2 . . . C2 . . .", "G2 . . . G2 . . .", "C2 . . . C2 . . .");
const TITLE_BASS_B1 = S("F2 . . . C3 . . .", "C2 . . . G2 . . .", "D2 . . . A2 . . .", "F2 . . . F2 . . .");
const TITLE_BASS_B2 = S("G2 . . . D3 . . .", "G2 . . . C3 . . .", "C2 . . . E2 . . .", "G2 . . . G2 . . .");
const TITLE_BASS_C1 = S("A2 . . . E2 . . .", "C3 . . . G2 . . .", "F2 . . . C3 . . .", "G2 . . . G2 . . .");
const TITLE_BASS_C2 = S("C3 . . . G2 . . .", "A2 . . . E2 . . .", "D2 . . . G2 . . .", "C3 . . . C3 . . .");

const TITLE_HARM_B1 = S("F4 = = = = = = .", "E4 = = = = = = .", "D4 = = = = = = .", "F4 = = = = = = .");
const TITLE_HARM_B2 = S("B3 = = = = = = .", "C4 = = = = = = .", "E4 = = = = = = .", "D4 = = = = = = .");
const TITLE_HARM_C1 = S("E4 = = = = = = .", "C4 = = = = = = .", "A4 = = = = = = .", "B3 = = = = = = .");
const TITLE_HARM_C2 = S("G4 = = = = = = .", "E4 = = = = = = .", "B3 = = = = = = .", "E4 = = = = = = .");

const BEAT = S("x . . . x . x .", "x . . . x . x .", "x . . . x . x .", "x . x . x . x .");
const BEAT_FILL = S("x . . . x . x .", "x . . . x . x .", "x . x . x . x .", "x x x x x x x x");

export const TITLE_THEME: Song = {
  name: "title",
  bpm: 130,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.19,
      duty: 0.8,
      pattern: arrange(TITLE_A1, TITLE_A2, TITLE_B1, TITLE_B2, TITLE_C1, TITLE_C2, TITLE_A1, TITLE_A2),
    },
    {
      wave: "square",
      gain: 0.09,
      duty: 0.7,
      detune: 7,
      pattern: arrange(REST, REST, TITLE_HARM_B1, TITLE_HARM_B2, TITLE_HARM_C1, TITLE_HARM_C2, REST, REST),
    },
    {
      wave: "triangle",
      gain: 0.22,
      pattern: arrange(
        TITLE_BASS_A1,
        TITLE_BASS_A2,
        TITLE_BASS_B1,
        TITLE_BASS_B2,
        TITLE_BASS_C1,
        TITLE_BASS_C2,
        TITLE_BASS_A1,
        TITLE_BASS_A2,
      ),
    },
    {
      wave: "noise",
      gain: 0.055,
      duty: 0.35,
      pattern: arrange(BEAT, BEAT_FILL, BEAT, BEAT_FILL, BEAT, BEAT_FILL, BEAT, BEAT_FILL),
    },
  ],
};

// ---------------------------------------------------------------------------
// Landmark: warm and unhurried, for arriving somewhere.
// ---------------------------------------------------------------------------

const LAND_A = S("C4 . E4 . G4 = = .", "A4 . G4 . E4 = = .", "F4 . A4 . C5 = = .", "G4 = = = = = = .");
const LAND_B = S("E4 . G4 . A4 = = .", "G4 . F4 . D4 = = .", "C4 . D4 . E4 = = .", "C4 = = = = = = .");
const LAND_C = S("A4 . C5 . B4 = = .", "G4 . E4 . F4 = = .", "D4 . F4 . A4 = = .", "G4 = = = E4 . D4 .");
const LAND_D = S("C5 . B4 . A4 = = .", "G4 . A4 . G4 = = .", "E4 . D4 . C4 = = .", "C4 = = = = = = .");
const LAND_E = S("G3 . C4 . E4 = = .", "F4 . E4 . D4 = = .", "E4 . G4 . C5 = = .", "G4 = = = = = = .");
const LAND_F = S("E4 . D4 . C4 = = .", "D4 . E4 . F4 = = .", "E4 . D4 . B3 = = .", "C4 = = = = = = .");

const LAND_BASS_A = S("C3 . . . G2 . . .", "A2 . . . E2 . . .", "F2 . . . C3 . . .", "G2 . . . G2 . . .");
const LAND_BASS_B = S("C3 . . . G2 . . .", "F2 . . . D3 . . .", "G2 . . . G2 . . .", "C3 . . . C3 . . .");
const LAND_BASS_C = S("F2 . . . C3 . . .", "C3 . . . G2 . . .", "D3 . . . A2 . . .", "G2 . . . G2 . . .");
const LAND_BASS_D = S("C3 . . . E3 . . .", "G2 . . . C3 . . .", "A2 . . . F2 . . .", "C3 . . . C3 . . .");
const LAND_BASS_E = S("C3 . . . G2 . . .", "F2 . . . C3 . . .", "C3 . . . E3 . . .", "G2 . . . G2 . . .");
const LAND_BASS_F = S("A2 . . . E2 . . .", "F2 . . . D3 . . .", "G2 . . . G2 . . .", "C3 . . . C3 . . .");

export const LANDMARK_THEME: Song = {
  name: "landmark",
  bpm: 116,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    { wave: "square", gain: 0.17, duty: 0.85, pattern: arrange(LAND_A, LAND_B, LAND_C, LAND_D, LAND_E, LAND_F) },
    {
      wave: "triangle",
      gain: 0.2,
      pattern: arrange(LAND_BASS_A, LAND_BASS_B, LAND_BASS_C, LAND_BASS_D, LAND_BASS_E, LAND_BASS_F),
    },
    {
      wave: "square",
      gain: 0.07,
      duty: 0.5,
      detune: -6,
      pattern: arrange(REST, REST, LAND_A, LAND_B, REST, LAND_D),
    },
  ],
};

// ---------------------------------------------------------------------------
// Store: a busy little shop tune.
// ---------------------------------------------------------------------------

const STORE_A = S("C4 . C4 . E4 . G4 .", "E4 . G4 . C5 . G4 .", "F4 . F4 . A4 . C5 .", "A4 . G4 . E4 . C4 .");
const STORE_B = S("D4 . D4 . F4 . A4 .", "F4 . A4 . D5 . A4 .", "G4 . G4 . B4 . D5 .", "B4 . A4 . G4 . D4 .");
const STORE_C = S("E4 . G4 . C5 . E5 .", "D5 . C5 . B4 . G4 .", "A4 . C5 . E5 . C5 .", "G4 . E4 . C4 . G3 .");

const STORE_BASS_A = S("C2 . C2 . G2 . G2 .", "C2 . C2 . G2 . G2 .", "F2 . F2 . C3 . C3 .", "G2 . G2 . G2 . G2 .");
const STORE_BASS_B = S("D2 . D2 . A2 . A2 .", "D2 . D2 . A2 . A2 .", "G2 . G2 . D3 . D3 .", "G2 . G2 . G2 . G2 .");
const STORE_BASS_C = S("C2 . C2 . E2 . E2 .", "G2 . G2 . B2 . B2 .", "A2 . A2 . C3 . C3 .", "G2 . G2 . C2 . C2 .");

export const STORE_THEME: Song = {
  name: "store",
  bpm: 138,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    { wave: "square", gain: 0.15, duty: 0.55, pattern: arrange(STORE_A, STORE_B, STORE_C, STORE_A, STORE_C, STORE_B) },
    {
      wave: "triangle",
      gain: 0.19,
      pattern: arrange(
        STORE_BASS_A,
        STORE_BASS_B,
        STORE_BASS_C,
        STORE_BASS_A,
        STORE_BASS_C,
        STORE_BASS_B,
      ),
    },
    { wave: "noise", gain: 0.04, duty: 0.3, pattern: arrange(BEAT, BEAT, BEAT_FILL, BEAT, BEAT, BEAT_FILL) },
  ],
};

// ---------------------------------------------------------------------------
// Foraging: light and quick, with a bit of a scamper to it.
// ---------------------------------------------------------------------------

const FORAGE_A = S("E4 . G4 . A4 . G4 .", "E4 . D4 . E4 . . .", "C4 . E4 . G4 . E4 .", "D4 . . . D4 . . .");
const FORAGE_B = S("E4 . G4 . A4 . B4 .", "C5 . A4 . G4 . . .", "A4 . G4 . E4 . D4 .", "E4 . . . E4 . . .");
const FORAGE_C = S("G4 . A4 . C5 . A4 .", "G4 . E4 . D4 . . .", "F4 . A4 . C5 . A4 .", "G4 . . . E4 . . .");
const FORAGE_D = S("A4 . B4 . C5 . D5 .", "E5 . C5 . A4 . . .", "G4 . E4 . C4 . E4 .", "A4 . . . A4 . . .");
const FORAGE_E = S("C5 . B4 . A4 . G4 .", "A4 . G4 . E4 . . .", "D4 . E4 . G4 . A4 .", "E4 . . . E4 . . .");
const FORAGE_F = S("E4 . D4 . C4 . D4 .", "E4 . G4 . A4 . . .", "G4 . E4 . D4 . C4 .", "A3 . . . A3 . . .");

const FORAGE_BASS_A = S("A2 . A2 . E2 . E2 .", "A2 . A2 . E2 . E2 .", "C3 . C3 . G2 . G2 .", "D3 . D3 . D3 . D3 .");
const FORAGE_BASS_B = S("A2 . A2 . E2 . E2 .", "F2 . F2 . C3 . C3 .", "G2 . G2 . D3 . D3 .", "A2 . A2 . A2 . A2 .");
const FORAGE_BASS_C = S("C3 . C3 . G2 . G2 .", "C3 . C3 . E2 . E2 .", "F2 . F2 . C3 . C3 .", "G2 . G2 . G2 . G2 .");
const FORAGE_BASS_D = S("F2 . F2 . C3 . C3 .", "A2 . A2 . E2 . E2 .", "C3 . C3 . G2 . G2 .", "A2 . A2 . A2 . A2 .");
const FORAGE_BASS_E = S("A2 . A2 . E2 . E2 .", "C3 . C3 . G2 . G2 .", "G2 . G2 . D3 . D3 .", "A2 . A2 . A2 . A2 .");
const FORAGE_BASS_F = S("A2 . A2 . E2 . E2 .", "C3 . C3 . G2 . G2 .", "F2 . F2 . D3 . D3 .", "A2 . A2 . A2 . A2 .");

const SCAMPER = S("x . x . x . x .", "x . x . x . x .", "x . x . x . x .", "x . x . x x x .");

export const FORAGE_THEME: Song = {
  name: "forage",
  bpm: 152,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.15,
      duty: 0.6,
      pattern: arrange(FORAGE_A, FORAGE_B, FORAGE_C, FORAGE_D, FORAGE_E, FORAGE_F),
    },
    {
      wave: "triangle",
      gain: 0.18,
      pattern: arrange(
        FORAGE_BASS_A,
        FORAGE_BASS_B,
        FORAGE_BASS_C,
        FORAGE_BASS_D,
        FORAGE_BASS_E,
        FORAGE_BASS_F,
      ),
    },
    {
      wave: "noise",
      gain: 0.045,
      duty: 0.3,
      pattern: arrange(SCAMPER, SCAMPER, SCAMPER, SCAMPER, SCAMPER, SCAMPER),
    },
  ],
};

// ---------------------------------------------------------------------------
// Everfree: uneasy, in D minor, building as it goes.
// ---------------------------------------------------------------------------

const EVER_A = S("D4 . . . F4 . . .", "A4 . . . G4 . . .", "D4 . . . E4 . . .", "F4 . . . E4 . . .");
const EVER_B = S("D4 . . . A3 . . .", "Bb3 . . . C4 . . .", "D4 . . . C4 . . .", "Bb3 . . . A3 . . .");
const EVER_C = S("F4 . E4 . D4 . C4 .", "D4 = = . A3 . . .", "Bb3 . C4 . D4 . F4 .", "E4 = = . E4 . . .");
const EVER_D = S("A4 . . . A4 . G4 .", "F4 . . . E4 . D4 .", "C4 . . . D4 . E4 .", "D4 = = = = = = .");
const EVER_E = S("D5 . . . C5 . . .", "Bb4 . . . A4 . . .", "G4 . . . F4 . . .", "E4 . . . D4 . . .");
const EVER_F = S("D4 . D4 . D4 . D4 .", "F4 . F4 . E4 . E4 .", "D4 . D4 . C4 . C4 .", "D4 = = = = = = .");

const EVER_BASS = S("D2 . D2 . D2 . D2 .", "D2 . D2 . D2 . D2 .", "Bb1 . Bb1 . Bb1 . Bb1 .", "A1 . A1 . A1 . A1 .");
const EVER_BASS_2 = S("D2 . D2 . D2 . D2 .", "F2 . F2 . F2 . F2 .", "C2 . C2 . C2 . C2 .", "A1 . A1 . A1 . A1 .");
const EVER_BASS_3 = S("Bb1 . Bb1 . Bb1 . Bb1 .", "F2 . F2 . F2 . F2 .", "G1 . G1 . G1 . G1 .", "A1 . A1 . A1 . A1 .");

const EVER_DRUMS = S("x . x x x . x .", "x . x x x . x .", "x . x x x . x .", "x . x x x . x .");
const EVER_DRUMS_2 = S("x . x x x . x .", "x . x x x . x .", "x . x x x . x .", "x x x x x x x x");

export const EVERFREE_THEME: Song = {
  name: "everfree",
  bpm: 140,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    {
      wave: "square",
      gain: 0.14,
      duty: 0.55,
      detune: -8,
      pattern: arrange(EVER_A, EVER_B, EVER_C, EVER_D, EVER_E, EVER_F),
    },
    {
      wave: "triangle",
      gain: 0.22,
      pattern: arrange(EVER_BASS, EVER_BASS_2, EVER_BASS_3, EVER_BASS, EVER_BASS_2, EVER_BASS_3),
    },
    {
      wave: "noise",
      gain: 0.07,
      duty: 0.25,
      pattern: arrange(EVER_DRUMS, EVER_DRUMS, EVER_DRUMS_2, EVER_DRUMS, EVER_DRUMS, EVER_DRUMS_2),
    },
  ],
};

// ---------------------------------------------------------------------------
// Victory: the arrival at Appaloosa.
// ---------------------------------------------------------------------------

const WIN_A = S("C4 . E4 . G4 . C5 .", "G4 = = . E4 . G4 .", "F4 . A4 . C5 . F5 .", "C5 = = = = = = .");
const WIN_B = S("E5 . D5 . C5 . B4 .", "A4 . G4 . F4 . E4 .", "D4 . E4 . F4 . G4 .", "C5 = = = = = = .");
const WIN_C = S("A4 . C5 . E5 . C5 .", "G4 . B4 . D5 . B4 .", "F4 . A4 . C5 . A4 .", "G4 = = = G4 . B4 .");
const WIN_D = S("C5 . B4 . A4 . G4 .", "F4 . E4 . D4 . C4 .", "D4 . F4 . A4 . C5 .", "C5 = = = = = = .");

const WIN_BASS_A = S("C3 . G2 . C3 . G2 .", "C3 . G2 . C3 . G2 .", "F2 . C3 . F2 . C3 .", "C3 . G2 . C3 . G2 .");
const WIN_BASS_B = S("A2 . E3 . A2 . E3 .", "F2 . C3 . F2 . C3 .", "G2 . D3 . G2 . D3 .", "C3 . G2 . C3 . C3 .");
const WIN_BASS_C = S("F2 . C3 . F2 . C3 .", "G2 . D3 . G2 . D3 .", "F2 . C3 . F2 . C3 .", "G2 . G2 . G2 . G2 .");
const WIN_BASS_D = S("C3 . G2 . C3 . G2 .", "F2 . C3 . F2 . C3 .", "D2 . A2 . D2 . A2 .", "C3 . G2 . C3 . C3 .");

export const VICTORY_THEME: Song = {
  name: "victory",
  bpm: 124,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    { wave: "square", gain: 0.2, pattern: arrange(WIN_A, WIN_B, WIN_C, WIN_D, WIN_A, WIN_B) },
    {
      wave: "triangle",
      gain: 0.2,
      pattern: arrange(WIN_BASS_A, WIN_BASS_B, WIN_BASS_C, WIN_BASS_D, WIN_BASS_A, WIN_BASS_B),
    },
    { wave: "noise", gain: 0.05, duty: 0.3, pattern: arrange(BEAT, BEAT_FILL, BEAT, BEAT_FILL, BEAT, BEAT_FILL) },
  ],
};

// ---------------------------------------------------------------------------
// Memorial: slow, sparse, and over reasonably quickly.
// ---------------------------------------------------------------------------

const SAD_A = S("A3 = = = C4 = = =", "E4 = = = D4 = = =", "C4 = = = A3 = = =", "G3 = = = = = = =");
const SAD_B = S("F3 = = = A3 = = =", "C4 = = = B3 = = =", "A3 = = = G3 = = =", "A3 = = = = = = =");
const SAD_C = S("C4 = = = E4 = = =", "G4 = = = F4 = = =", "E4 = = = D4 = = =", "C4 = = = = = = =");
const SAD_D = S("D4 = = = F4 = = =", "E4 = = = C4 = = =", "B3 = = = A3 = = =", "A3 = = = = = = =");

const SAD_BASS_A = S("A2 = = = = = = =", "A2 = = = = = = =", "F2 = = = = = = =", "G2 = = = = = = =");
const SAD_BASS_B = S("F2 = = = = = = =", "C3 = = = = = = =", "E2 = = = = = = =", "A2 = = = = = = =");
const SAD_BASS_C = S("C3 = = = = = = =", "C3 = = = = = = =", "A2 = = = = = = =", "F2 = = = = = = =");
const SAD_BASS_D = S("D3 = = = = = = =", "A2 = = = = = = =", "E2 = = = = = = =", "A2 = = = = = = =");

export const MEMORIAL_THEME: Song = {
  name: "memorial",
  bpm: 78,
  stepsPerBeat: 4,
  loop: true,
  channels: [
    { wave: "triangle", gain: 0.2, pattern: arrange(SAD_A, SAD_B, SAD_C, SAD_D) },
    { wave: "sine", gain: 0.14, pattern: arrange(SAD_BASS_A, SAD_BASS_B, SAD_BASS_C, SAD_BASS_D) },
  ],
};
