/**
 * Trail markers left by previous runs. The original let you carve a message on
 * a tombstone and showed it to later players; this keeps that idea locally.
 */

const KEY = "appaloosa.markers.v1";
const MAX = 24;

export interface TrailMarker {
  name: string;
  message: string;
  mile: number;
}

export function loadMarkers(): TrailMarker[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrailMarker[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addMarker(marker: TrailMarker): void {
  try {
    const all = loadMarkers();
    all.unshift(marker);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

/** A marker left near this stretch of trail, if there is one. */
export function markerNear(mile: number, pick: number): TrailMarker | null {
  const all = loadMarkers().filter((m) => Math.abs(m.mile - mile) < 220);
  if (all.length === 0) return null;
  return all[Math.floor(pick * all.length) % all.length] ?? null;
}
