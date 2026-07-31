/** Small mutators shared by the day simulation, events and minigames. */

import { Rng } from "../../engine/rng";
import { Ailment, AILMENTS, ailmentById, ailmentName } from "../data/ailments";
import { GameState, PonyState, livingPonies, log } from "../state";

export type WagonPart = "wheel" | "axle" | "tongue";

export const PART_LABEL: Record<WagonPart, string> = {
  wheel: "wagon wheel",
  axle: "wagon axle",
  tongue: "wagon tongue",
};

export function addFood(g: GameState, n: number): void {
  g.food = Math.max(0, g.food + n);
}

/** Removes up to `n` baskets, returning how many were actually lost. */
export function takeFood(g: GameState, n: number): number {
  const taken = Math.min(g.food, Math.max(0, n));
  g.food -= taken;
  return Math.round(taken);
}

export function addBits(g: GameState, n: number): void {
  g.bits = Math.max(0, g.bits + n);
}

export function takeBits(g: GameState, n: number): number {
  const taken = Math.min(g.bits, Math.max(0, n));
  g.bits -= taken;
  return Math.round(taken);
}

export function randomLivingPony(g: GameState, r: Rng): PonyState | null {
  const alive = livingPonies(g);
  return alive.length ? r.pick(alive) : null;
}

export function damagePony(g: GameState, pony: PonyState, amount: number): void {
  pony.health = Math.max(0, pony.health - amount);
  void g;
}

export function damageParty(g: GameState, amount: number): void {
  for (const p of livingPonies(g)) p.health = Math.max(0, p.health - amount);
}

export function healParty(g: GameState, amount: number): void {
  for (const p of livingPonies(g)) p.health = Math.min(100, p.health + amount);
}

export function changeMood(g: GameState, delta: number): void {
  g.teamMood = Math.max(0, Math.min(100, g.teamMood + delta));
}

export function hireTeam(g: GameState, n: number): void {
  g.team = Math.min(99, g.team + n);
  g.stats.teamHired += n;
}

/** Removes up to `n` team members, returning how many actually left. */
export function loseTeam(g: GameState, n: number): number {
  const lost = Math.min(g.team, Math.max(0, n));
  g.team -= lost;
  g.stats.teamLost += lost;
  return lost;
}

export function partCount(g: GameState, part: WagonPart): number {
  return part === "wheel" ? g.wheels : part === "axle" ? g.axles : g.tongues;
}

export function usePart(g: GameState, part: WagonPart): boolean {
  if (part === "wheel" && g.wheels > 0) {
    g.wheels--;
    return true;
  }
  if (part === "axle" && g.axles > 0) {
    g.axles--;
    return true;
  }
  if (part === "tongue" && g.tongues > 0) {
    g.tongues--;
    return true;
  }
  return false;
}

export function addPart(g: GameState, part: WagonPart, n = 1): void {
  if (part === "wheel") g.wheels += n;
  else if (part === "axle") g.axles += n;
  else g.tongues += n;
}

export interface AilmentStrike {
  pony: PonyState;
  ailment: Ailment;
}

export function ponyHasHadAilment(g: GameState, pony: PonyState, id: string): boolean {
  return !!g.flags[`had:${pony.name}:${id}`];
}

/** Gives an ailment to a specific or random pony. Returns null if nothing stuck. */
export function inflictAilment(
  g: GameState,
  r: Rng,
  opts: { pony?: PonyState; ailmentId?: string; pool?: Ailment[] } = {},
): AilmentStrike | null {
  const candidates = livingPonies(g).filter((p) => !p.ailment);
  const pony = opts.pony ?? (candidates.length ? r.pick(candidates) : randomLivingPony(g, r));
  if (!pony) return null;
  if (pony.ailment) return null;

  let ailment: Ailment | undefined;
  if (opts.ailmentId) ailment = ailmentById(opts.ailmentId);
  if (!ailment) {
    const pool = (opts.pool ?? AILMENTS).filter((a) => !(a.onceOnly && ponyHasHadAilment(g, pony, a.id)));
    if (pool.length === 0) return null;
    ailment = r.pick(pool);
  }
  if (ailment.onceOnly && ponyHasHadAilment(g, pony, ailment.id)) return null;

  pony.ailment = ailment.id;
  pony.ailmentDays = 0;
  g.flags[`had:${pony.name}:${ailment.id}`] = true;
  log(g, `${pony.name} has come down with ${ailment.name}.`);
  return { pony, ailment };
}

export function curePony(g: GameState, pony: PonyState, viaPotion: boolean): void {
  if (!pony.ailment) return;
  const name = ailmentName(pony.ailment);
  pony.ailment = null;
  pony.ailmentDays = 0;
  pony.health = Math.min(100, pony.health + (viaPotion ? 18 : 6));
  log(g, `${pony.name} has recovered from ${name}.`);
}

export function usePotion(g: GameState, pony: PonyState): boolean {
  if (g.potions <= 0) return false;
  g.potions--;
  if (pony.ailment) curePony(g, pony, true);
  else pony.health = Math.min(100, pony.health + 22);
  return true;
}

export function killPony(g: GameState, pony: PonyState, cause: string, dateStr: string): void {
  pony.alive = false;
  pony.health = 0;
  pony.causeOfDeath = cause;
  pony.dayOfDeath = g.day;
  pony.dateOfDeath = dateStr;
  g.stats.ponyDeaths++;
  log(g, `${pony.name} has passed on. (${cause})`);
}

/** Ailment id whose slow factor is worst among the living party. */
export function worstSlow(g: GameState): number {
  let slow = 1;
  for (const p of livingPonies(g)) {
    const a = ailmentById(p.ailment);
    if (a) slow = Math.min(slow, a.slow);
  }
  return slow;
}
