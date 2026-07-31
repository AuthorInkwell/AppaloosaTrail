/**
 * Ponified afflictions. Per the design doc these stand in for the original's
 * roster of real diseases: whimsical names, gentler consequences, and a real
 * chance to shake them off without a potion.
 */

export interface Ailment {
  id: string;
  /** Shown as "<Name> has come down with <name>." */
  name: string;
  /** Health lost per day while suffering. */
  severity: number;
  /** Chance per day of recovering on its own. */
  recovery: number;
  /** Multiplier on the party's travel speed while anypony has it. */
  slow: number;
  /** Flavour shown when it strikes. */
  blurb: string;
  /** Chance per day of spreading to another pony. */
  contagion?: number;
  /** Cannot be caught twice. */
  onceOnly?: boolean;
}

export const AILMENTS: Ailment[] = [
  {
    id: "hoof-sniffles",
    name: "the hoof-sniffles",
    severity: 1.4,
    recovery: 0.3,
    slow: 0.97,
    blurb: "A stuffy nose, a soggy hoofkerchief, and a great deal of dramatic sighing.",
    contagion: 0.14,
  },
  {
    id: "sugarcube-fever",
    name: "sugarcube fever",
    severity: 3.1,
    recovery: 0.16,
    slow: 0.9,
    blurb: "Pink spots, a sweet tooth, and a fever that comes in waves. It passes, usually.",
    contagion: 0.18,
    onceOnly: true,
  },
  {
    id: "griffon-pox",
    name: "griffon pox",
    severity: 3.4,
    recovery: 0.14,
    slow: 0.9,
    blurb: "Itchy feathery bumps. Caught from griffons, or from blaming griffons.",
    contagion: 0.2,
    onceOnly: true,
  },
  {
    id: "bogwater-belly",
    name: "bogwater belly",
    severity: 4.2,
    recovery: 0.18,
    slow: 0.86,
    blurb: "Somepony drank from the wrong puddle. Now everypony knows about it.",
    contagion: 0.12,
  },
  {
    id: "saddle-sores",
    name: "saddle sores",
    severity: 1.8,
    recovery: 0.26,
    slow: 0.93,
    blurb: "Rubbed raw under the harness. Every step is a small complaint.",
  },
  {
    id: "bramble-fever",
    name: "bramble scratch fever",
    severity: 4.6,
    recovery: 0.13,
    slow: 0.84,
    blurb: "A scratch gone hot and angry. This one wants rest and a proper potion.",
  },
  {
    id: "cloud-cough",
    name: "cloud cough",
    severity: 2.6,
    recovery: 0.2,
    slow: 0.92,
    blurb: "A rattling cough that whistles like wind through a chimney.",
    contagion: 0.16,
  },
  {
    id: "dizzy-spells",
    name: "the dizzy spells",
    severity: 2.2,
    recovery: 0.32,
    slow: 0.9,
    blurb: "Too many miles on too little sleep. The horizon keeps tilting.",
  },
  {
    id: "twisted-hoof",
    name: "a twisted hoof",
    severity: 2.4,
    recovery: 0.19,
    slow: 0.8,
    blurb: "One bad step in a gopher hole and the whole day changes.",
  },
  {
    id: "sunstroke-shivers",
    name: "the sunstroke shivers",
    severity: 3.6,
    recovery: 0.22,
    slow: 0.88,
    blurb: "Baked all day, shivering all night. The desert does this.",
  },
  {
    id: "poison-joke",
    name: "poison joke",
    severity: 0.8,
    recovery: 0.24,
    slow: 0.74,
    blurb: "Not poisonous. Just a joke. A very inconvenient, very blue joke.",
  },
  {
    id: "the-mopes",
    name: "the mopes",
    severity: 1.6,
    recovery: 0.28,
    slow: 0.94,
    blurb: "Homesick, footsore, and thoroughly tired of scenery.",
    contagion: 0.22,
  },
  {
    id: "timberwolf-nip",
    name: "a timberwolf nip",
    severity: 3.8,
    recovery: 0.17,
    slow: 0.87,
    blurb: "More splinters than teeth marks, but it stings all the same.",
  },
];

const BY_ID = new Map(AILMENTS.map((a) => [a.id, a]));

export function ailmentById(id: string | null): Ailment | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function ailmentName(id: string | null): string {
  return ailmentById(id)?.name ?? "something unpleasant";
}

/** Ailments that fit the current situation, used when nothing specific applies. */
export function ailmentPool(opts: { desert?: boolean; swamp?: boolean; cold?: boolean; forest?: boolean }): Ailment[] {
  return AILMENTS.filter((a) => {
    if (a.id === "sunstroke-shivers") return !!opts.desert;
    if (a.id === "bogwater-belly") return !!opts.swamp || !!opts.forest || !opts.desert;
    if (a.id === "poison-joke") return !!opts.forest;
    if (a.id === "timberwolf-nip") return false; // only from specific events
    return true;
  });
}
