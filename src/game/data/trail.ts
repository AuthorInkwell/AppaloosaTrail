/** The trail itself: every landmark from Pioneer's Bluff to Appaloosa. */

import type { Terrain } from "../../art/scenery";

export type LandmarkKind = "town" | "landmark" | "river" | "fork" | "end";

export interface RiverInfo {
  name: string;
  /** Feet across, for flavour. */
  width: number;
  /** Typical depth in feet; the actual depth is rolled around this. */
  depth: number;
  /** Bits charged by the ferry operator. */
  ferryCost: number;
  /** Bits charged by the local pegasus airlift. */
  pegasusCost: number;
  /** Higher means fording is more dangerous. */
  current: number;
  swamp?: boolean;
}

export interface Landmark {
  id: string;
  name: string;
  /** Miles from Pioneer's Bluff. */
  mile: number;
  kind: LandmarkKind;
  terrain: Terrain;
  blurb: string;
  /** Multiplier on store prices this far down the trail. */
  priceMult?: number;
  store?: boolean;
  rest?: boolean;
  talk?: boolean;
  river?: RiverInfo;
}

export const TRAIL: Landmark[] = [
  {
    id: "pioneers-bluff",
    name: "Pioneer's Bluff",
    mile: 0,
    kind: "town",
    terrain: "town",
    priceMult: 1,
    store: true,
    rest: true,
    talk: true,
    blurb:
      "The last proper town before the western trail. Wagons crowd the square, hawkers shout prices, and somepony is always tuning a fiddle.",
  },
  {
    id: "marezy-meadow",
    name: "Marezy Doats Meadow",
    mile: 96,
    kind: "landmark",
    terrain: "plains",
    rest: true,
    talk: true,
    blurb:
      "A wide sweet-grass meadow, hoof-high and humming with bees. Wagon teams love it here, and every party that passes says so.",
  },
  {
    id: "hoofprint-river",
    name: "Hoofprint River",
    mile: 178,
    kind: "river",
    terrain: "plains",
    blurb:
      "A broad, slow river named for the thousands of prints pressed into its banks. Somepony has scratched depth marks into a rock.",
    river: { name: "Hoofprint River", width: 480, depth: 2.4, ferryCost: 55, pegasusCost: 70, current: 0.7 },
  },
  {
    id: "ponyville",
    name: "Ponyville",
    mile: 286,
    kind: "town",
    terrain: "town",
    priceMult: 1.2,
    store: true,
    rest: true,
    talk: true,
    blurb:
      "A tidy little town of thatched roofs and apple carts. The locals are alarmingly friendly and everypony wants to know where you're headed.",
  },
  {
    id: "froggy-bottom",
    name: "Froggy Bottom Bogg",
    mile: 392,
    kind: "river",
    terrain: "swamp",
    blurb:
      "Not a river so much as a rumour of one, spread thin across ten miles of mud. Something enormous snores somewhere out in the reeds.",
    river: { name: "Froggy Bottom Bogg", width: 260, depth: 3.1, ferryCost: 40, pegasusCost: 85, current: 0.35, swamp: true },
  },
  {
    id: "whitetail-station",
    name: "Whitetail Way Station",
    mile: 487,
    kind: "town",
    terrain: "forest",
    priceMult: 1.45,
    store: true,
    rest: true,
    talk: true,
    blurb:
      "A trading post at the edge of Whitetail Wood: one long building, one longer porch, and a deer family who run the whole operation.",
  },
  {
    id: "rambling-rock",
    name: "Rambling Rock Ridge",
    mile: 596,
    kind: "landmark",
    terrain: "hills",
    rest: true,
    blurb:
      "A ridge of loose grey stone that rambles for miles. Wheels hate it. Axles hate it more. Go carefully or don't go at all.",
  },
  {
    id: "galloping-gorge",
    name: "Galloping Gorge",
    mile: 704,
    kind: "river",
    terrain: "hills",
    blurb:
      "The gorge is narrow but the water in it gallops, white and loud. An old rope ferry sags overhead, tended by a very bored stallion.",
    river: { name: "the Galloping Gorge crossing", width: 120, depth: 4.2, ferryCost: 90, pegasusCost: 110, current: 1.35 },
  },
  {
    id: "dodge-junction",
    name: "Dodge Junction",
    mile: 838,
    kind: "town",
    terrain: "town",
    priceMult: 1.7,
    store: true,
    rest: true,
    talk: true,
    blurb:
      "A cherry town with a train station and dust in everything. Prices are steep, but it is the last real town on the western stretch.",
  },
  {
    id: "macintosh-hills",
    name: "The Macintosh Hills",
    mile: 964,
    kind: "landmark",
    terrain: "mountains",
    rest: true,
    blurb:
      "Round red hills, one after another, like a giant left apples out to bake. The trail winds between them and the wind never stops.",
  },
  {
    id: "serpents-bend",
    name: "Serpent's Bend",
    mile: 1082,
    kind: "river",
    terrain: "hills",
    blurb:
      "The river coils back on itself so often that the crossing looks easy from three different wrong angles. A sea serpent watches, unimpressed.",
    river: { name: "Serpent's Bend", width: 620, depth: 3.6, ferryCost: 110, pegasusCost: 120, current: 1.05 },
  },
  {
    id: "san-palomino",
    name: "San Palomino Desert",
    mile: 1218,
    kind: "landmark",
    terrain: "desert",
    rest: true,
    blurb:
      "Flat, bright, and utterly without shade. Water goes fast here and so does everypony's patience. Keep the team moving.",
  },
  {
    id: "ghastly-gorge",
    name: "Ghastly Gorge",
    mile: 1352,
    kind: "landmark",
    terrain: "mountains",
    blurb:
      "A crooked slot canyon full of loose scree and quarray eel holes. The wagon fits. Barely. Everypony holds their breath.",
  },
  {
    id: "sunkissed-springs",
    name: "Sun-Kissed Springs",
    mile: 1452,
    kind: "town",
    terrain: "desert",
    priceMult: 2.1,
    store: true,
    rest: true,
    talk: true,
    blurb:
      "Warm springs bubbling out of red rock, a handful of tents, and a mare selling lemonade at frankly criminal prices. Worth it.",
  },
  {
    id: "the-parting",
    name: "The Parting of Ways",
    mile: 1566,
    kind: "fork",
    terrain: "hills",
    blurb:
      "Two signs, two roads. One promises a smooth toll road. The other simply says EVERFREE and has claw marks in it.",
  },
  {
    id: "appaloosa",
    name: "Appaloosa",
    mile: 1712,
    kind: "end",
    terrain: "desert",
    blurb:
      "Appaloosa at last: raw timber, fresh-dug irrigation ditches, and row upon row of hopeful little apple trees.",
  },
];

export const TOTAL_MILES = TRAIL[TRAIL.length - 1]!.mile;

export function landmarkById(id: string): Landmark | undefined {
  return TRAIL.find((l) => l.id === id);
}

export function nextLandmark(index: number): Landmark | undefined {
  return TRAIL[index];
}

/** Terrain for a given mile marker, used by the travel backdrop. */
export function terrainAt(mile: number): Terrain {
  let current: Terrain = "plains";
  for (const l of TRAIL) {
    if (l.mile > mile) break;
    if (l.kind !== "town" || l.terrain !== "town") current = l.terrain;
    else current = "plains";
  }
  return current;
}

/** Distance in miles that the Everfree shortcut saves versus the toll road. */
export const EVERFREE_SHORTCUT_MILES = 58;
export const TOLL_ROAD_COST = 175;
