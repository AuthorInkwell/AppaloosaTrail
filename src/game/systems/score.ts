/** End-of-run scoring and the Hall of Fame, in the spirit of the original. */

import { GameState, ORIGINS, healthLabel, livingPonies, master } from "../state";

export interface ScoreLine {
  label: string;
  detail: string;
  points: number;
}

export interface ScoreReport {
  lines: ScoreLine[];
  subtotal: number;
  multiplier: number;
  total: number;
  days: number;
}

function ponyPoints(health: number): number {
  if (health >= 85) return 350;
  if (health >= 65) return 280;
  if (health >= 45) return 200;
  if (health >= 25) return 130;
  return 80;
}

export function scoreRun(g: GameState): ScoreReport {
  const lines: ScoreLine[] = [];
  const alive = livingPonies(g);

  for (const p of alive) {
    lines.push({
      label: p.name,
      detail: `in ${healthLabel(p.health)} health`,
      points: ponyPoints(p.health),
    });
  }
  if (g.team > 0) {
    lines.push({ label: "Wagon Team", detail: `${g.team} still in harness`, points: g.team * 40 });
  }
  if (g.food > 0) {
    lines.push({ label: "Food", detail: `${Math.round(g.food)} baskets`, points: Math.round(g.food * 0.5) });
  }
  const parts = g.wheels + g.axles + g.tongues;
  if (parts > 0) lines.push({ label: "Spare parts", detail: `${parts} unused`, points: parts * 20 });
  if (g.cloaks > 0) lines.push({ label: "Warm cloaks", detail: `${g.cloaks}`, points: g.cloaks * 12 });
  if (g.potions > 0) lines.push({ label: "Healing potions", detail: `${g.potions}`, points: g.potions * 25 });
  if (g.bits > 0) lines.push({ label: "Bits", detail: `${Math.round(g.bits)} left over`, points: Math.round(g.bits / 4) });

  const speedBonus = Math.max(0, Math.round((150 - g.day) * 6));
  if (speedBonus > 0) {
    lines.push({
      label: "Arrived early",
      detail: `${g.day} ${g.day === 1 ? "day" : "days"} on the trail`,
      points: speedBonus,
    });
  }

  if (g.route === "everfree" && g.flags["everfree-clean"]) {
    lines.push({ label: "Everfree crossing", detail: "not a scratch", points: 250 });
  }
  if (g.flags["good-deed"]) lines.push({ label: "Kindness on the trail", detail: "you helped a stranger", points: 100 });

  const subtotal = lines.reduce((s, l) => s + l.points, 0);
  const multiplier = ORIGINS[g.origin].scoreMultiplier;
  return {
    lines,
    subtotal,
    multiplier,
    total: Math.round(subtotal * multiplier),
    days: g.day,
  };
}

// ---------------------------------------------------------------------------
// Hall of Fame
// ---------------------------------------------------------------------------

const HOF_KEY = "appaloosa.hof.v1";
export const HOF_SIZE = 8;

export interface HofEntry {
  name: string;
  origin: string;
  score: number;
  days: number;
  survivors: number;
  when: string;
}

export function loadHallOfFame(): HofEntry[] {
  try {
    const raw = localStorage.getItem(HOF_KEY);
    if (!raw) return defaultHallOfFame();
    const parsed = JSON.parse(raw) as HofEntry[];
    if (!Array.isArray(parsed)) return defaultHallOfFame();
    return parsed.slice(0, HOF_SIZE);
  } catch {
    return defaultHallOfFame();
  }
}

export function saveHallOfFame(entries: HofEntry[]): void {
  try {
    localStorage.setItem(HOF_KEY, JSON.stringify(entries.slice(0, HOF_SIZE)));
  } catch {
    /* storage unavailable; scores simply will not persist */
  }
}

/** Returns the new table and the index of the inserted row (-1 if it missed). */
export function submitScore(g: GameState, report: ScoreReport): { table: HofEntry[]; placed: number } {
  const entry: HofEntry = {
    name: master(g)?.name ?? g.ponies[0]?.name ?? "Somepony",
    origin: ORIGINS[g.origin].name,
    score: report.total,
    days: report.days,
    survivors: livingPonies(g).length,
    when: `${g.date.year}`,
  };
  const table = loadHallOfFame();
  table.push(entry);
  table.sort((a, b) => b.score - a.score);
  const trimmed = table.slice(0, HOF_SIZE);
  saveHallOfFame(trimmed);
  return { table: trimmed, placed: trimmed.indexOf(entry) };
}

/** Seed names so the board is never empty on a fresh install. */
function defaultHallOfFame(): HofEntry[] {
  return [
    { name: "Braeburn", origin: "Earth Pony", score: 4200, days: 82, survivors: 5, when: "0996" },
    { name: "Silver Spade", origin: "Earth Pony", score: 3350, days: 94, survivors: 4, when: "0998" },
    { name: "Cloudchaser", origin: "Pegasus", score: 2810, days: 88, survivors: 4, when: "0999" },
    { name: "Marmalade", origin: "Earth Pony", score: 2240, days: 101, survivors: 3, when: "1000" },
    { name: "Ledger Line", origin: "Unicorn", score: 1900, days: 96, survivors: 4, when: "1000" },
    { name: "Dusty Trails", origin: "Pegasus", score: 1450, days: 118, survivors: 2, when: "1001" },
    { name: "Quill Point", origin: "Unicorn", score: 980, days: 127, survivors: 2, when: "1001" },
    { name: "Hayseed", origin: "Earth Pony", score: 520, days: 141, survivors: 1, when: "1001" },
  ];
}
