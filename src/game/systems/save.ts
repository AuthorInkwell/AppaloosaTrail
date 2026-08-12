/**
 * Menu-based saving, the one modern convenience the design doc asks for by
 * name. Three slots in localStorage; the state object is already plain data.
 */

import { GameState, SAVE_VERSION, formatDate, livingPonies, master } from "../state";
import { COATS } from "../../art/wagon";
import { TRAIL } from "../data/trail";

const KEY = (slot: number) => `appaloosa.save.${slot}`;
export const SAVE_SLOTS = 3;

export interface SaveSummary {
  slot: number;
  empty: boolean;
  master: string;
  origin: string;
  date: string;
  miles: number;
  survivors: number;
  savedAt: string;
}

interface SaveRecord {
  version: number;
  savedAt: string;
  state: GameState;
}

export function saveGame(slot: number, g: GameState): boolean {
  try {
    const record: SaveRecord = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state: g,
    };
    localStorage.setItem(KEY(slot), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const record = JSON.parse(raw) as SaveRecord;
    if (!record?.state) return null;
    if (record.version !== SAVE_VERSION && record.version !== 1) return null;
    const g = record.state;
    // Guard against saves written by an older build.
    g.flags ??= {};
    g.log ??= [];
    g.landmarkIndex = Math.min(Math.max(1, g.landmarkIndex), TRAIL.length - 1);
    for (const [i, p] of g.ponies.entries()) {
      p.criticalDays ??= 0;
      p.coatIndex ??= i % COATS.length;
      p.maneIndex ??= i % COATS.length;
      p.appearance ??= p.isMaster ? g.origin : "earth";
    }
    g.version = SAVE_VERSION;
    return g;
  } catch {
    return null;
  }
}

export function deleteSave(slot: number): void {
  try {
    localStorage.removeItem(KEY(slot));
  } catch {
    /* nothing to do */
  }
}

export function summarise(slot: number): SaveSummary {
  const g = loadGame(slot);
  if (!g) {
    return {
      slot,
      empty: true,
      master: "- empty -",
      origin: "",
      date: "",
      miles: 0,
      survivors: 0,
      savedAt: "",
    };
  }
  let savedAt = "";
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (raw) savedAt = (JSON.parse(raw) as SaveRecord).savedAt ?? "";
  } catch {
    /* ignore */
  }
  return {
    slot,
    empty: false,
    master: master(g)?.name ?? g.ponies[0]?.name ?? "Somepony",
    origin: g.origin,
    date: formatDate(g.date),
    miles: Math.round(g.miles),
    survivors: livingPonies(g).length,
    savedAt: savedAt ? savedAt.slice(0, 10) : "",
  };
}

export function anySaveExists(): boolean {
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    if (localStorage.getItem(KEY(i))) return true;
  }
  return false;
}
