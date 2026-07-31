/**
 * The day simulation. One call to `advanceDay` is one day on the trail:
 * weather, miles, food, health, ailments, team morale and one possible event.
 */

import { Rng } from "../../engine/rng";
import type { Terrain } from "../../art/scenery";
import { ailmentById, ailmentPool } from "../data/ailments";
import { EventContext, TrailEvent, eligibleEvents } from "../data/events";
import { Landmark, TRAIL, terrainAt } from "../data/trail";
import {
  GameState,
  PACE_INFO,
  PonyState,
  RATION_INFO,
  Weather,
  advanceDate,
  dailyFoodNeed,
  formatDate,
  livingPonies,
  log,
  milesPerDay,
  season,
} from "../state";
import { changeMood, killPony, loseTeam, usePotion, worstSlow } from "./effects";

export interface DayResult {
  /** Lines to show the player, in order. */
  messages: string[];
  milesTravelled: number;
  /** Landmark reached today, if any. */
  arrived: Landmark | null;
  event: TrailEvent | null;
  deaths: PonyState[];
  ranOutOfFood: boolean;
  gameOver: boolean;
}

const WEATHER_LABEL: Record<Weather, string> = {
  fair: "fair",
  warm: "warm",
  hot: "very hot",
  cool: "cool",
  cold: "cold",
  rain: "rainy",
  storm: "stormy",
  snow: "snowy",
  fog: "foggy",
};

export function weatherLabel(w: Weather): string {
  return WEATHER_LABEL[w];
}

const WEATHER_SPEED: Record<Weather, number> = {
  fair: 1,
  warm: 1,
  hot: 0.88,
  cool: 1,
  cold: 0.93,
  rain: 0.82,
  storm: 0.62,
  snow: 0.55,
  fog: 0.72,
};

const WEATHER_HEALTH: Record<Weather, number> = {
  fair: 0,
  warm: 0,
  hot: 2.2,
  cool: 0,
  cold: 1.6,
  rain: 1.2,
  storm: 3,
  snow: 3.6,
  fog: 0.4,
};

export function rollWeather(g: GameState, r: Rng, terrain: Terrain): Weather {
  const s = season(g.date);
  const desert = terrain === "desert";
  const swamp = terrain === "swamp";
  const table: { item: Weather; weight: number }[] = [];
  const add = (item: Weather, weight: number) => table.push({ item, weight });

  if (s === "winter") {
    add("snow", desert ? 8 : 30);
    add("cold", 32);
    add("fog", 10);
    add("fair", 18);
    add("storm", 8);
  } else if (s === "spring") {
    add("fair", 30);
    add("rain", swamp ? 30 : 22);
    add("warm", 16);
    add("cool", 14);
    add("storm", 9);
    add("fog", swamp ? 14 : 8);
  } else if (s === "summer") {
    add("hot", desert ? 44 : 26);
    add("warm", 26);
    add("fair", 22);
    add("storm", 12);
    add("rain", 10);
  } else {
    add("cool", 28);
    add("fair", 26);
    add("rain", 18);
    add("fog", 12);
    add("cold", 12);
    add("storm", 6);
  }
  return r.weighted(table);
}

function weatherSpeed(g: GameState, w: Weather): number {
  const base = WEATHER_SPEED[w];
  if (g.origin === "pegasus") return base + (1 - base) * 0.5;
  return base;
}

function weatherHealth(g: GameState, w: Weather): number {
  const base = WEATHER_HEALTH[w];
  const cold = w === "snow" || w === "cold";
  let penalty = base;
  if (cold) {
    const need = livingPonies(g).length;
    const covered = Math.min(need, g.cloaks);
    penalty *= 1 - (covered / Math.max(1, need)) * 0.75;
  }
  if (g.origin === "pegasus") penalty *= 0.5;
  return penalty;
}

/** Consumes food and moves the calendar without covering ground. */
export function passDays(g: GameState, days: number, opts: { resting?: boolean } = {}): string[] {
  const messages: string[] = [];
  for (let i = 0; i < days; i++) {
    const need = dailyFoodNeed(g);
    if (g.food >= need) {
      g.food -= need;
      if (opts.resting) {
        for (const p of livingPonies(g)) p.health = Math.min(100, p.health + 9);
        changeMood(g, 4);
      }
    } else {
      g.food = 0;
      for (const p of livingPonies(g)) p.health = Math.max(0, p.health - 7);
      changeMood(g, -9);
      if (i === 0) messages.push("You have no food. Everypony goes hungry.");
    }
    if (opts.resting) g.stats.daysRested++;
    g.day++;
    advanceDate(g.date, 1);
  }
  return messages;
}

function tickAilments(g: GameState, r: Rng, result: DayResult): void {
  for (const p of livingPonies(g)) {
    const ail = ailmentById(p.ailment);
    if (!ail) continue;
    p.ailmentDays++;
    p.health = Math.max(0, p.health - ail.severity);
    if (r.chance(ail.recovery + Math.min(0.2, p.ailmentDays * 0.015))) {
      p.ailment = null;
      p.ailmentDays = 0;
      p.health = Math.min(100, p.health + 6);
      result.messages.push(`${p.name} has recovered from ${ail.name}.`);
      log(g, `${p.name} recovered from ${ail.name}.`);
      continue;
    }
    if (ail.contagion && r.chance(ail.contagion * 0.5)) {
      const healthy = livingPonies(g).filter((o) => o !== p && !o.ailment);
      if (healthy.length) {
        const victim = r.pick(healthy);
        victim.ailment = ail.id;
        victim.ailmentDays = 0;
        g.flags[`had:${victim.name}:${ail.id}`] = true;
        result.messages.push(`${victim.name} has caught ${ail.name} as well.`);
      }
    }
  }
}

/**
 * Death is deliberately slow: a pony must sit at zero health for several days,
 * gets a recovery roll each day, and a potion is spent automatically first.
 */
function tickCritical(g: GameState, r: Rng, result: DayResult): void {
  for (const p of livingPonies(g)) {
    if (p.health > 0) {
      if (p.criticalDays > 0) {
        p.criticalDays = 0;
        result.messages.push(`${p.name} is out of danger.`);
      }
      if (p.health <= 15 && r.chance(0.5)) {
        result.messages.push(`${p.name} is in a bad way and needs rest.`);
      }
      continue;
    }
    if (g.potions > 0) {
      usePotion(g, p);
      p.health = Math.max(p.health, 26);
      p.criticalDays = 0;
      result.messages.push(`You use a healing potion on ${p.name}. It helps.`);
      continue;
    }
    p.criticalDays++;
    if (r.chance(0.34)) {
      p.health = 18;
      p.criticalDays = 0;
      result.messages.push(`Against the odds, ${p.name} rallies.`);
      continue;
    }
    if (p.criticalDays >= 3) {
      const cause = ailmentById(p.ailment)?.name ?? "exhaustion on the trail";
      killPony(g, p, cause, formatDate(g.date));
      result.deaths.push(p);
      result.messages.push(`${p.name} has passed on.`);
    } else {
      result.messages.push(`${p.name} is gravely ill. Rest, food or a potion may still save them.`);
    }
  }
}

function tickTeam(g: GameState, r: Rng, result: DayResult, starving: boolean): void {
  if (g.team <= 0) return;
  if (starving) changeMood(g, -11);
  else if (g.rations === "bare") changeMood(g, -3);
  else if (g.rations === "filling" && g.pace === "steady") changeMood(g, 1.5);
  if (g.pace === "grueling") changeMood(g, -3);
  else if (g.pace === "strenuous") changeMood(g, -1);

  const risk = (g.teamMood < 40 ? (40 - g.teamMood) / 220 : 0) + (starving ? 0.12 : 0);
  if (risk > 0 && r.chance(risk)) {
    const lost = loseTeam(g, 1);
    if (lost > 0) {
      changeMood(g, 6); // the remaining members feel heard, for now
      if (g.team === 0) {
        result.messages.push(
          "The last of your Wagon Team unbuckles and walks away. The ponies must pull the wagon themselves now.",
        );
        log(g, "The entire Wagon Team has deserted.");
      } else {
        result.messages.push("One of your Wagon Team has had enough and deserts the party.");
        log(g, "A Wagon Team member deserted.");
      }
    }
  }
}

export function advanceDay(g: GameState, r: Rng, opts: { allowEvents?: boolean } = {}): DayResult {
  const result: DayResult = {
    messages: [],
    milesTravelled: 0,
    arrived: null,
    event: null,
    deaths: [],
    ranOutOfFood: false,
    gameOver: false,
  };
  if (g.finished) return result;

  const terrain = terrainAt(g.miles);
  g.weather = rollWeather(g, r, terrain);

  // ---- miles ----------------------------------------------------------
  let miles = milesPerDay(g) * weatherSpeed(g, g.weather) * worstSlow(g) * r.float(0.92, 1.08);
  if (terrain === "mountains") miles *= 0.82;
  if (terrain === "desert") miles *= 0.92;
  if (terrain === "swamp") miles *= 0.85;
  miles = Math.max(1, Math.round(miles));

  const next = TRAIL[g.landmarkIndex];
  if (next && g.miles + miles >= next.mile) {
    miles = next.mile - g.miles;
    result.arrived = next;
    g.landmarkIndex++;
  }
  g.miles += miles;
  result.milesTravelled = miles;

  // ---- food -----------------------------------------------------------
  const need = dailyFoodNeed(g);
  let starving = false;
  if (g.food >= need) {
    g.food -= need;
  } else {
    g.food = 0;
    starving = true;
    result.ranOutOfFood = true;
    result.messages.push("You are out of food! Everypony goes hungry today.");
  }

  // ---- health ---------------------------------------------------------
  let delta = RATION_INFO[g.rations].healthDelta;
  delta -= PACE_INFO[g.pace].healthCost;
  delta -= weatherHealth(g, g.weather);
  if (starving) delta -= 7;
  if (g.team === 0) delta -= 2.5;
  if (g.flags["lucky"]) delta += 0.4;
  for (const p of livingPonies(g)) {
    p.health = Math.max(0, Math.min(100, p.health + delta));
  }

  tickAilments(g, r, result);

  // A fresh ailment now and then, more often when run down or in bad weather.
  const avg = livingPonies(g).reduce((s, p) => s + p.health, 0) / Math.max(1, livingPonies(g).length);
  let sicknessChance = 0.04 + (100 - avg) / 900;
  if (starving) sicknessChance += 0.08;
  if (g.weather === "snow" || g.weather === "storm") sicknessChance += 0.04;
  if (g.rations === "bare") sicknessChance += 0.04;
  if (r.chance(sicknessChance)) {
    const pool = ailmentPool({
      desert: terrain === "desert",
      swamp: terrain === "swamp",
      forest: terrain === "forest",
      cold: g.weather === "snow" || g.weather === "cold",
    });
    const candidates = livingPonies(g).filter((p) => !p.ailment);
    if (candidates.length) {
      const victim = r.pick(candidates);
      const options = pool.filter((a) => !g.flags[`had:${victim.name}:${a.id}`] || !a.onceOnly);
      if (options.length) {
        const ail = r.pick(options);
        victim.ailment = ail.id;
        victim.ailmentDays = 0;
        g.flags[`had:${victim.name}:${ail.id}`] = true;
        result.messages.push(`${victim.name} has come down with ${ail.name}.`);
        log(g, `${victim.name} has come down with ${ail.name}.`);
      }
    }
  }

  tickCritical(g, r, result);
  tickTeam(g, r, result, starving);

  // ---- calendar -------------------------------------------------------
  g.day++;
  advanceDate(g.date, 1);

  // ---- random event ---------------------------------------------------
  if (!result.arrived && (opts.allowEvents ?? true) && result.deaths.length === 0) {
    const chance = 0.26 + (g.flags["lucky"] ? -0.02 : 0);
    if (r.chance(chance)) {
      const ctx: EventContext = { g, r, terrain, season: season(g.date) };
      const pool = eligibleEvents(ctx);
      if (pool.length) result.event = r.weighted(pool);
    }
  }

  if (livingPonies(g).length === 0) {
    g.finished = true;
    g.outcome = "lost";
    result.gameOver = true;
  }
  return result;
}
