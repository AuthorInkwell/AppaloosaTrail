/**
 * The save-file shaped game state, plus the small helpers that mutate it.
 * Everything here is plain data so a run can be serialised to localStorage.
 */

import { Rng } from "../engine/rng";

export const SAVE_VERSION = 1;

export type Origin = "unicorn" | "pegasus" | "earth";
export type Pace = "steady" | "strenuous" | "grueling";
export type Rations = "filling" | "meager" | "bare";
export type Weather = "fair" | "warm" | "hot" | "cool" | "cold" | "rain" | "storm" | "snow" | "fog";

export interface PonyState {
  name: string;
  alive: boolean;
  /** 0..100, higher is healthier. */
  health: number;
  ailment: string | null;
  ailmentDays: number;
  /** Consecutive days spent at zero health, i.e. at death's door. */
  criticalDays: number;
  isMaster: boolean;
  causeOfDeath?: string;
  dayOfDeath?: number;
  dateOfDeath?: string;
}

export interface GameDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface LogEntry {
  day: number;
  date: string;
  text: string;
}

export interface GameState {
  version: number;
  seed: number;
  origin: Origin;
  ponies: PonyState[];
  bits: number;
  food: number; // basketfuls
  cloaks: number;
  wheels: number;
  axles: number;
  tongues: number;
  potions: number;
  team: number; // wagon team members
  teamMood: number; // 0..100
  date: GameDate;
  day: number; // days elapsed since departure
  miles: number;
  pace: Pace;
  rations: Rations;
  /** Index into TRAIL of the next landmark to reach. */
  landmarkIndex: number;
  weather: Weather;
  route: "toll" | "everfree" | null;
  log: LogEntry[];
  finished: boolean;
  outcome: "arrived" | "lost" | null;
  score: number;
  flags: Record<string, boolean>;
  stats: {
    forageTrips: number;
    basketsForaged: number;
    riverCrossings: number;
    bitsSpent: number;
    daysRested: number;
    eventsSeen: number;
    teamHired: number;
    teamLost: number;
    ponyDeaths: number;
    everfreeHits: number;
  };
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function formatDate(d: GameDate): string {
  return `${MONTH_NAMES[d.month - 1]} ${d.day}, ${d.year}`;
}

export function shortDate(d: GameDate): string {
  return `${MONTH_NAMES[d.month - 1]?.slice(0, 3)} ${d.day}`;
}

export function advanceDate(d: GameDate, days = 1): void {
  for (let i = 0; i < days; i++) {
    d.day++;
    const len = MONTH_DAYS[d.month - 1] ?? 30;
    if (d.day > len) {
      d.day = 1;
      d.month++;
      if (d.month > 12) {
        d.month = 1;
        d.year++;
      }
    }
  }
}

export type Season = "spring" | "summer" | "autumn" | "winter";

export function season(d: GameDate): Season {
  if (d.month <= 2 || d.month === 12) return "winter";
  if (d.month <= 5) return "spring";
  if (d.month <= 8) return "summer";
  return "autumn";
}

export interface OriginInfo {
  id: Origin;
  name: string;
  home: string;
  bits: number;
  scoreMultiplier: number;
  blurb: string;
  perks: string[];
}

export const ORIGINS: Record<Origin, OriginInfo> = {
  unicorn: {
    id: "unicorn",
    name: "Unicorn",
    home: "Canterlot",
    bits: 1600,
    scoreMultiplier: 1,
    blurb:
      "Canterlot unicorns set out with full saddlebags and a head full of spellwork. Bits are no object; hard labour is another matter.",
    perks: [
      "Most starting bits (1600)",
      "Can levitate the wagon across water",
      "Magic can mend a broken axle or wheel",
      "No score bonus at journey's end",
    ],
  },
  pegasus: {
    id: "pegasus",
    name: "Pegasus",
    home: "Cloudsdale",
    bits: 1150,
    scoreMultiplier: 1.4,
    blurb:
      "Cloudsdale pegasi know weather the way other ponies know their own hooves. Storms that would flatten a wagon are merely damp.",
    perks: [
      "Middling starting bits (1150)",
      "Weather calamities are far less severe",
      "Can scout ahead from the air",
      "Pegasus ferry teams charge you half price",
      "Modest score bonus at journey's end",
    ],
  },
  earth: {
    id: "earth",
    name: "Earth Pony",
    home: "Fillydelphia",
    bits: 800,
    scoreMultiplier: 2,
    blurb:
      "Fillydelphia earth ponies leave with little more than strong backs and a good eye for growing things. Everything else is earned on the trail.",
    perks: [
      "Fewest starting bits (800)",
      "Best foraging yields",
      "Caulk-and-float ('the Earth Pony way') is safer",
      "Repairs and hard pulls come easier",
      "Largest score bonus at journey's end",
    ],
  },
};

export const PACE_INFO: Record<Pace, { name: string; desc: string; speed: number; healthCost: number }> = {
  steady: {
    name: "a steady pace",
    desc: "Walk from sunup to sundown with proper breaks. Easiest on everypony.",
    speed: 1,
    healthCost: 0,
  },
  strenuous: {
    name: "a strenuous pace",
    desc: "Push hard, rest little. Faster miles, wearier ponies.",
    speed: 1.28,
    healthCost: 1.6,
  },
  grueling: {
    name: "a grueling pace",
    desc: "Walk until hooves ache and then walk further. Very hard on the party and the team.",
    speed: 1.55,
    healthCost: 3.4,
  },
};

export const RATION_INFO: Record<Rations, { name: string; desc: string; perPony: number; healthDelta: number }> = {
  filling: {
    name: "filling",
    desc: "Good hearty meals. Three squares and a slice of pie.",
    perPony: 1.0,
    healthDelta: 1.4,
  },
  meager: {
    name: "meager",
    desc: "Enough to keep going. Nopony asks for seconds.",
    perPony: 0.68,
    healthDelta: -0.5,
  },
  bare: {
    name: "bare bones",
    desc: "Barely a mouthful each. Stretches the baskets, wears down the ponies.",
    perPony: 0.42,
    healthDelta: -2.4,
  },
};

export const FOOD_PER_TEAM_MEMBER = 0.5;
export const MAX_TEAM = 8;
export const MIN_TEAM_TO_START = 2;

export function createGame(origin: Origin, names: string[], seed = Date.now() >>> 0): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    origin,
    ponies: names.map((name, i) => ({
      name: name.trim() || `Pony ${i + 1}`,
      alive: true,
      health: 100,
      ailment: null,
      ailmentDays: 0,
      criticalDays: 0,
      isMaster: i === 0,
    })),
    bits: ORIGINS[origin].bits,
    food: 0,
    cloaks: 0,
    wheels: 0,
    axles: 0,
    tongues: 0,
    potions: 0,
    team: 0,
    teamMood: 80,
    date: { year: 1002, month: 4, day: 1 },
    day: 0,
    miles: 0,
    pace: "steady",
    rations: "filling",
    landmarkIndex: 1,
    weather: "fair",
    route: null,
    log: [],
    finished: false,
    outcome: null,
    score: 0,
    flags: {},
    stats: {
      forageTrips: 0,
      basketsForaged: 0,
      riverCrossings: 0,
      bitsSpent: 0,
      daysRested: 0,
      eventsSeen: 0,
      teamHired: 0,
      teamLost: 0,
      ponyDeaths: 0,
      everfreeHits: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function livingPonies(g: GameState): PonyState[] {
  return g.ponies.filter((p) => p.alive);
}

export function master(g: GameState): PonyState | undefined {
  return g.ponies.find((p) => p.isMaster && p.alive) ?? livingPonies(g)[0];
}

export function partyHealth(g: GameState): number {
  const alive = livingPonies(g);
  if (alive.length === 0) return 0;
  return alive.reduce((s, p) => s + p.health, 0) / alive.length;
}

export function healthLabel(h: number): string {
  if (h >= 85) return "good";
  if (h >= 65) return "fair";
  if (h >= 45) return "poor";
  if (h >= 25) return "very poor";
  return "grave";
}

export function dailyFoodNeed(g: GameState): number {
  const ponies = livingPonies(g).length * RATION_INFO[g.rations].perPony;
  return ponies + g.team * FOOD_PER_TEAM_MEMBER;
}

export function milesPerDay(g: GameState): number {
  const pace = PACE_INFO[g.pace].speed;
  const pulling = g.team > 0 ? 7 + g.team * 2.3 : 4.5;
  const healthFactor = 0.55 + (partyHealth(g) / 100) * 0.45;
  const moodFactor = g.team > 0 ? 0.75 + (g.teamMood / 100) * 0.25 : 1;
  return Math.max(1, pace * pulling * healthFactor * moodFactor);
}

export function log(g: GameState, text: string): void {
  g.log.push({ day: g.day, date: formatDate(g.date), text });
  if (g.log.length > 160) g.log.shift();
}

export function rngFor(g: GameState): Rng {
  // Threaded through state so a reloaded save keeps rolling fresh numbers.
  const r = new Rng((g.seed + g.day * 7919 + g.miles * 31) >>> 0);
  return r;
}

export function spend(g: GameState, bits: number): void {
  g.bits = Math.max(0, g.bits - bits);
  g.stats.bitsSpent += bits;
}
