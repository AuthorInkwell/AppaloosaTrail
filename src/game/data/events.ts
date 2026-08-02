/**
 * Random trail events. Per the design doc, choices can hurt but must never end
 * a run on their own: the worst outcomes here cost time, supplies or health.
 */

import type { SfxName } from "../../engine/audio";
import type { Rng } from "../../engine/rng";
import type { Terrain } from "../../art/scenery";
import { ORIGINS, GameState, Season, livingPonies, log, master } from "../state";
import { randomStrangerName } from "./names";
import {
  addBits,
  addFood,
  addPart,
  changeMood,
  damageParty,
  damagePony,
  healParty,
  inflictAilment,
  loseTeam,
  randomLivingPony,
  takeBits,
  takeFood,
  usePart,
  WagonPart,
  PART_LABEL,
} from "../systems/effects";
import { ailmentPool } from "./ailments";

export interface EventContext {
  g: GameState;
  r: Rng;
  terrain: Terrain;
  season: Season;
}

export interface EventOutcome {
  text: string;
  /** Extra days lost to the event. */
  days?: number;
  sfx?: SfxName;
}

export interface EventChoice {
  label: string;
  /** Hidden entirely when this returns false. */
  available?: (ctx: EventContext) => boolean;
  resolve: (ctx: EventContext) => EventOutcome;
}

export interface TrailEvent {
  id: string;
  weight: number;
  tone: "good" | "bad" | "neutral";
  title: string;
  text: string | ((ctx: EventContext) => string);
  when?: (ctx: EventContext) => boolean;
  /** Fire at most once per run. */
  once?: boolean;
  choices?: EventChoice[];
  resolve?: (ctx: EventContext) => EventOutcome;
}

const isEarth = (ctx: EventContext) => ctx.g.origin === "earth";
const isPegasus = (ctx: EventContext) => ctx.g.origin === "pegasus";
const isUnicorn = (ctx: EventContext) => ctx.g.origin === "unicorn";

function partBreak(ctx: EventContext, part: WagonPart): EventOutcome {
  const { g, r } = ctx;
  if (usePart(g, part)) {
    return {
      text: `Luckily you packed a spare. Fitting it costs you the better part of a day.`,
      days: 1,
      sfx: "thud",
    };
  }
  if (isUnicorn(ctx) && r.chance(0.55)) {
    return {
      text: `${master(g)?.name ?? "Your wagon master"} splints the break with a levitation charm. It will hold. Probably.`,
      days: 1,
      sfx: "select",
    };
  }
  if (isEarth(ctx) && r.chance(0.5)) {
    return {
      text: `You cut and shape a replacement from a stand of hickory. Slow work, but honest work.`,
      days: 2,
      sfx: "select",
    };
  }
  const lost = takeFood(g, 8);
  damageParty(g, 5);
  changeMood(g, -8);
  return {
    text: `With no spare ${PART_LABEL[part]}, you limp along while repairs are botched and re-botched. You lose three days${
      lost > 0 ? ` and ${lost} baskets of food spoil in the delay` : ""
    }.`,
    days: 3,
    sfx: "bad",
  };
}

export const EVENTS: TrailEvent[] = [
  // ------------------------------------------------------------------ boons
  {
    id: "wild-apples",
    weight: 10,
    tone: "good",
    title: "Wild Apple Trees",
    text: "A stand of scraggly wild apple trees leans over the trail, branches heavy and nopony around to claim them.",
    resolve: ({ g, r }) => {
      const n = r.int(9, 22) + (g.origin === "earth" ? 6 : 0);
      addFood(g, n);
      changeMood(g, 4);
      return { text: `You gather ${n} baskets of apples. The team is delighted.`, sfx: "pickup" };
    },
  },
  {
    id: "abandoned-wagon",
    weight: 8,
    tone: "good",
    title: "An Abandoned Wagon",
    text: "A wagon sits tipped in the grass, bonnet torn, no tracks leading away. Whoever owned it left in a hurry.",
    resolve: ({ g, r }) => {
      const roll = r.next();
      if (roll < 0.3) {
        addPart(g, "wheel");
        return { text: "One wheel is still sound. You strap it to your own wagon.", sfx: "pickup" };
      }
      if (roll < 0.5) {
        addPart(g, "axle");
        return { text: "The rear axle is undamaged. Into the wagon it goes.", sfx: "pickup" };
      }
      if (roll < 0.75) {
        const n = r.int(8, 18);
        addFood(g, n);
        return { text: `${n} baskets of dried fruit are still good. You take them, guiltily.`, sfx: "pickup" };
      }
      const n = r.int(20, 70);
      addBits(g, n);
      return { text: `A purse under the seat holds ${n} bits. You leave a note, just in case.`, sfx: "coin" };
    },
  },
  {
    id: "lucky-horseshoe",
    weight: 5,
    tone: "good",
    title: "A Lucky Horseshoe",
    text: "Half-buried in the ruts, a horseshoe worn smooth by a thousand miles of somepony else's luck.",
    once: true,
    resolve: ({ g }) => {
      g.flags["lucky"] = true;
      changeMood(g, 10);
      healParty(g, 4);
      return { text: "You nail it above the wagon door. Everypony walks a little taller.", sfx: "pickup" };
    },
  },
  {
    id: "mail-pegasus",
    weight: 8,
    tone: "good",
    title: "The Mail Comes Through",
    text: () =>
      `A pegasus mail carrier drops out of the clouds, circles twice, and lands in a flurry of envelopes and apologies.`,
    resolve: ({ g }) => {
      changeMood(g, 9);
      healParty(g, 3);
      g.flags["scouted"] = true;
      return {
        text: "Letters from home, and news of the trail ahead. Morale climbs and you learn what the next crossing looks like.",
        sfx: "fanfare",
      };
    },
  },
  {
    id: "hot-spring",
    weight: 6,
    tone: "good",
    title: "A Warm Spring",
    text: "Steam curls out of a rock basin just off the trail. The water is hot, clean, and deeply tempting.",
    choices: [
      {
        label: "Stop and soak for half a day",
        resolve: ({ g }) => {
          healParty(g, 10);
          changeMood(g, 8);
          return { text: "Sore muscles unknot. Everypony climbs out pink and cheerful.", days: 1, sfx: "fanfare" };
        },
      },
      {
        label: "Water the team and press on",
        resolve: ({ g }) => {
          healParty(g, 3);
          changeMood(g, 3);
          return { text: "A quick drink for everypony and you are on your way." };
        },
      },
    ],
  },
  {
    id: "buffalo-herd",
    weight: 7,
    tone: "neutral",
    title: "A Buffalo Herd",
    text: "The horizon goes dark and dusty. A buffalo herd is crossing the trail, and they are in no hurry whatsoever.",
    choices: [
      {
        label: "Wait respectfully for them to pass",
        resolve: ({ g, r }) => {
          const gift = r.chance(0.55);
          if (gift) {
            const n = r.int(10, 24);
            addFood(g, n);
            changeMood(g, 6);
            return {
              text: `An elder stops beside your wagon, studies your patience, and leaves ${n} baskets of dried corn and squash as thanks.`,
              days: 1,
              sfx: "pickup",
            };
          }
          return { text: "It takes most of a day, but they pass without incident.", days: 1 };
        },
      },
      {
        label: "Thread the wagon through the herd",
        resolve: ({ g, r }) => {
          if (r.chance(0.45)) {
            return { text: "You slip through a gap and gain most of a day on the crossing.", sfx: "select" };
          }
          const lost = loseTeam(g, r.chance(0.3) ? 1 : 0);
          damageParty(g, 6);
          changeMood(g, -12);
          return {
            text: `The herd closes around you. Nothing is trampled, but everypony is badly shaken${
              lost ? ` and one of the team quits on the spot` : ""
            }.`,
            days: 1,
            sfx: "bad",
          };
        },
      },
    ],
  },
  {
    id: "wandering-musician",
    weight: 6,
    tone: "good",
    title: "A Travelling Musician",
    text: () =>
      `${randomStrangerName()} is walking west with a fiddle and no particular plan, and asks to keep pace with your wagon for a day.`,
    choices: [
      {
        label: "Welcome them along",
        resolve: ({ g }) => {
          changeMood(g, 14);
          healParty(g, 5);
          takeFood(g, 3);
          return { text: "There is music at the fire until late. Worth the three baskets it cost to feed them.", sfx: "fanfare" };
        },
      },
      {
        label: "Politely decline",
        resolve: () => ({ text: "They wave you off and keep walking, playing something a little sadder." }),
      },
    ],
  },
  {
    id: "found-bits",
    weight: 6,
    tone: "good",
    title: "A Forgotten Saddlebag",
    text: "A weathered saddlebag hangs from a fencepost, exactly where somepony meant to come back for it.",
    resolve: ({ g, r }) => {
      const n = r.int(15, 55);
      addBits(g, n);
      return { text: `Inside: ${n} bits and a very old sandwich. You take the bits.`, sfx: "coin" };
    },
  },
  {
    id: "shortcut",
    weight: 5,
    tone: "good",
    title: "The Team Knows a Way",
    text: "The lead member of your Wagon Team stops, sniffs the air, and points a hoof at a game trail cutting through the scrub.",
    when: ({ g }) => g.team > 0 && g.teamMood > 55,
    choices: [
      {
        label: "Trust the team",
        resolve: ({ g, r }) => {
          if (r.chance(0.7)) {
            g.miles += r.int(14, 32);
            changeMood(g, 6);
            return { text: "The cut-off rejoins the trail miles ahead. Well done, team.", sfx: "select" };
          }
          changeMood(g, -6);
          return { text: "The trail peters out in a thicket. You backtrack, embarrassed.", days: 1, sfx: "back" };
        },
      },
      {
        label: "Stay on the main trail",
        resolve: () => ({ text: "Better the ruts you know." }),
      },
    ],
  },
  {
    id: "wildflowers",
    weight: 5,
    tone: "good",
    title: "A Field of Wildflowers",
    text: "The trail opens onto acres of blue and gold flowers, nodding all the way to the hills.",
    resolve: ({ g }) => {
      changeMood(g, 7);
      healParty(g, 4);
      return { text: "Nopony says much. Everypony feels better.", sfx: "day" };
    },
  },

  // --------------------------------------------------------------- setbacks
  {
    id: "wheel-breaks",
    weight: 9,
    tone: "bad",
    title: "A Wheel Splits",
    text: "A wheel drops into a rut with a crack like a gunshot, and the wagon lists hard to one side.",
    resolve: (ctx) => partBreak(ctx, "wheel"),
  },
  {
    id: "axle-breaks",
    weight: 7,
    tone: "bad",
    title: "A Broken Axle",
    text: "Something under the wagon gives way with a groan, and the whole rig settles into the dust.",
    resolve: (ctx) => partBreak(ctx, "axle"),
  },
  {
    id: "tongue-breaks",
    weight: 6,
    tone: "bad",
    title: "The Wagon Tongue Splinters",
    text: "The long timber that yokes the team to the wagon splits down its length.",
    resolve: (ctx) => partBreak(ctx, "tongue"),
  },
  {
    id: "thunderstorm",
    weight: 9,
    tone: "bad",
    title: "Thunderstorm",
    text: "The sky goes green-grey and opens up. Rain comes sideways and the trail turns to soup.",
    resolve: (ctx) => {
      const { g, r } = ctx;
      if (isPegasus(ctx)) {
        return {
          text: "You read the cloud bank an hour out and steer the wagon around the worst of it. Barely a soaking.",
          sfx: "select",
        };
      }
      const lost = takeFood(g, r.int(4, 12));
      damageParty(g, r.int(3, 7));
      changeMood(g, -6);
      return {
        text: `Everypony is soaked through${lost ? ` and ${lost} baskets are ruined` : ""}. You lose a day waiting out the worst of it.`,
        days: 1,
        sfx: "bad",
      };
    },
  },
  {
    id: "hailstorm",
    weight: 6,
    tone: "bad",
    title: "Hailstorm",
    text: "Hail the size of gumballs drums on the wagon bonnet. Everypony crowds underneath and hopes.",
    resolve: (ctx) => {
      const { g, r } = ctx;
      const severity = isPegasus(ctx) ? 0.4 : 1;
      const lost = takeFood(g, Math.round(r.int(5, 14) * severity));
      damageParty(g, Math.round(r.int(2, 6) * severity));
      return {
        text: `The bonnet is shredded in two places${lost ? ` and ${lost} baskets are lost` : ""}.`,
        days: 1,
        sfx: "hurt",
      };
    },
  },
  {
    id: "cold-snap",
    weight: 8,
    tone: "bad",
    title: "A Bitter Cold Snap",
    text: "Frost on the water barrel before dawn. The wind has teeth today.",
    when: ({ season, g }) => season === "winter" || (season === "autumn" && g.miles > 900),
    resolve: (ctx) => {
      const { g, r } = ctx;
      const need = livingPonies(g).length;
      if (g.cloaks >= need) {
        healParty(g, -2);
        return { text: "Everypony has a proper cloak. You huddle up and keep moving.", sfx: "day" };
      }
      const short = need - g.cloaks;
      damageParty(g, r.int(5, 11));
      changeMood(g, -8);
      const strike = inflictAilment(g, r, { pool: ailmentPool({ cold: true }) });
      return {
        text: `${short} ${short === 1 ? "pony has" : "ponies have"} no cloak. It is a long, shivering night.${
          strike ? ` ${strike.pony.name} has come down with ${strike.ailment.name}.` : ""
        }`,
        sfx: "bad",
      };
    },
  },
  {
    id: "bad-water",
    weight: 8,
    tone: "bad",
    title: "Bad Water",
    text: "The creek you camped by looks fine, smells fine, and is not fine.",
    resolve: ({ g, r, terrain }) => {
      const strike = inflictAilment(g, r, {
        pool: ailmentPool({ swamp: terrain === "swamp", desert: terrain === "desert" }),
      });
      damageParty(g, 3);
      if (!strike) return { text: "Everypony has an unpleasant night, but it passes by morning.", sfx: "bad" };
      return { text: `${strike.pony.name} has come down with ${strike.ailment.name}. ${strike.ailment.blurb}`, sfx: "bad" };
    },
  },
  {
    id: "lost-in-fog",
    weight: 7,
    tone: "bad",
    title: "Lost in the Fog",
    text: "Fog rolls in thick as cake batter. Two hours later, nopony is sure which way the ruts were going.",
    resolve: (ctx) => {
      const { g } = ctx;
      if (isPegasus(ctx)) {
        return { text: "Your wagon master climbs above the fog, finds the trail, and calls the wagon along beneath.", sfx: "select" };
      }
      changeMood(g, -5);
      damageParty(g, 2);
      return { text: "You lose two days working your way back to the trail.", days: 2, sfx: "back" };
    },
  },
  {
    id: "parasprites",
    weight: 7,
    tone: "bad",
    title: "Parasprites!",
    text: "A shimmering cloud of parasprites settles over the wagon, and they have found the food stores.",
    choices: [
      {
        label: "Drive them off with everypony",
        resolve: ({ g, r }) => {
          const lost = takeFood(g, r.int(6, 16));
          damageParty(g, 4);
          return {
            text: `An hour of frantic flapping and shouting saves most of the stores. Only ${lost} baskets are lost.`,
            sfx: "hurt",
          };
        },
      },
      {
        label: "Let them eat and hope they move on",
        resolve: ({ g, r }) => {
          const lost = takeFood(g, r.int(20, 45));
          changeMood(g, -6);
          return { text: `They eat ${lost} baskets' worth and multiply enthusiastically before drifting off.`, sfx: "bad" };
        },
      },
      {
        label: "Play them a tune to lead them away",
        available: ({ g }) => !!g.flags["lucky"] || g.teamMood > 60,
        resolve: ({ g, r }) => {
          if (r.chance(0.6)) {
            changeMood(g, 8);
            return { text: "Somepony hums, then everypony hums. The swarm follows the tune over the ridge and away.", sfx: "fanfare" };
          }
          const lost = takeFood(g, r.int(10, 24));
          return { text: `They are unmoved by your musicianship, and ${lost} baskets go with them.`, sfx: "bad" };
        },
      },
    ],
  },
  {
    id: "team-lame",
    weight: 7,
    tone: "bad",
    title: "A Team Member Goes Lame",
    text: "One of the Wagon Team is favouring a hoof and trying very hard to hide it.",
    when: ({ g }) => g.team > 0,
    resolve: (ctx) => {
      const { g, r } = ctx;
      if (isEarth(ctx) && r.chance(0.65)) {
        changeMood(g, 5);
        return { text: "You know this injury. A poultice, a wrap, and a slow morning sets it right.", days: 1, sfx: "select" };
      }
      if (r.chance(0.4)) {
        changeMood(g, -4);
        return { text: "A day of rest and it walks sound again.", days: 1 };
      }
      loseTeam(g, 1);
      changeMood(g, -8);
      return {
        text: "It cannot pull any longer. You settle up honestly and leave it at the next homestead, and the wagon feels heavier.",
        sfx: "sad",
      };
    },
  },
  {
    id: "team-wanders",
    weight: 6,
    tone: "bad",
    title: "One of the Team Wanders Off",
    text: "In the morning there is a gap in the harness line and a trail of hoofprints heading for greener country.",
    when: ({ g }) => g.team > 0,
    choices: [
      {
        label: "Send everypony out to search",
        resolve: ({ g, r }) => {
          if (r.chance(0.55 + g.teamMood / 300)) {
            changeMood(g, 4);
            return { text: "Found, sheepish, knee-deep in clover. Back in harness by noon.", days: 1, sfx: "select" };
          }
          loseTeam(g, 1);
          return { text: "You search all day and find nothing but clover and hoofprints.", days: 1, sfx: "sad" };
        },
      },
      {
        label: "Let them go and move on",
        resolve: ({ g }) => {
          loseTeam(g, 1);
          changeMood(g, -10);
          return { text: "The rest of the team watches you decide that, and remembers it.", sfx: "sad" };
        },
      },
    ],
  },
  {
    id: "timberwolves",
    weight: 6,
    tone: "bad",
    title: "Timberwolves in the Dark",
    text: "Something is circling the camp, and it creaks when it walks.",
    choices: [
      {
        label: "Stand watch in shifts all night",
        resolve: ({ g }) => {
          damageParty(g, 5);
          return { text: "Nothing comes close, but nopony sleeps. You start the day tired.", sfx: "day" };
        },
      },
      {
        label: "Build the fire high and sleep in",
        resolve: ({ g, r }) => {
          if (r.chance(0.6)) {
            return { text: "The fire keeps them off. By dawn there is nothing but scattered bark." };
          }
          const pony = randomLivingPony(g, r);
          const lost = takeFood(g, r.int(5, 12));
          if (pony) {
            inflictAilment(g, r, { pony, ailmentId: "timberwolf-nip" });
            damagePony(g, pony, 8);
          }
          return {
            text: `They get into the stores and take ${lost} baskets${pony ? `, and ${pony.name} is nipped chasing them off` : ""}.`,
            sfx: "hurt",
          };
        },
      },
      {
        label: "Have the team ring the wagon",
        available: ({ g }) => g.team >= 3,
        resolve: ({ g, r }) => {
          if (r.chance(0.75 + g.teamMood / 500)) {
            changeMood(g, 6);
            return { text: "Six hundred pounds of hatted draft animal is its own argument. The wolves leave.", sfx: "select" };
          }
          changeMood(g, -10);
          loseTeam(g, r.chance(0.25) ? 1 : 0);
          return { text: "The ring holds, but not happily. Somepony in the team has had enough of this trail.", sfx: "bad" };
        },
      },
    ],
  },
  {
    id: "mud",
    weight: 7,
    tone: "bad",
    title: "Mired to the Axles",
    text: "The wagon sinks to its axles in black mud and stops arguing about it.",
    when: ({ terrain, g }) => terrain === "swamp" || g.weather === "rain" || g.weather === "storm",
    choices: [
      {
        label: "Unload and carry everything clear",
        resolve: ({ g, r }) => {
          damageParty(g, 4);
          const lost = takeFood(g, r.int(0, 5));
          return {
            text: `Slow, filthy, effective. You lose a day${lost ? ` and ${lost} baskets in the muck` : ""}.`,
            days: 1,
          };
        },
      },
      {
        label: "Put every shoulder to it and heave",
        resolve: (ctx) => {
          const { g, r } = ctx;
          const odds = isEarth(ctx) ? 0.8 : 0.5;
          if (r.chance(odds)) {
            changeMood(g, 4);
            return { text: "It comes free with a sound like a cork leaving a bottle. Onward.", sfx: "select" };
          }
          damageParty(g, 9);
          changeMood(g, -6);
          return { text: "The wagon does not move. Everypony strains something. You lose the day anyway.", days: 1, sfx: "bad" };
        },
      },
      {
        label: "Levitate it out",
        available: (ctx) => isUnicorn(ctx),
        resolve: ({ g, r }) => {
          if (r.chance(0.85)) {
            return { text: "The wagon rises, drips, and sets down on firm ground. Show-off.", sfx: "select" };
          }
          damageParty(g, 6);
          return { text: "The spell slips. The wagon lands hard and everypony gets a faceful of bog.", days: 1, sfx: "bad" };
        },
      },
    ],
  },
  {
    id: "rockslide",
    weight: 6,
    tone: "bad",
    title: "Rockslide",
    text: "Stones come down the slope ahead of you, first a few, then a great grinding many.",
    when: ({ terrain }) => terrain === "mountains" || terrain === "hills",
    resolve: ({ g, r }) => {
      damageParty(g, r.int(3, 8));
      if (r.chance(0.45)) {
        const part: WagonPart = r.pick(["wheel", "axle", "tongue"] as WagonPart[]);
        if (usePart(g, part)) {
          return { text: `A stone stoves in your ${PART_LABEL[part]}. The spare goes on and you clear the slope.`, days: 1, sfx: "thud" };
        }
        addPart(g, part, 0);
        damageParty(g, 4);
        return { text: `A stone stoves in your ${PART_LABEL[part]} and you have no spare. Two days of lashing and prayer.`, days: 2, sfx: "bad" };
      }
      return { text: "The wagon is untouched, but clearing the trail costs you a day.", days: 1, sfx: "thud" };
    },
  },
  {
    id: "sandstorm",
    weight: 7,
    tone: "bad",
    title: "Sandstorm",
    text: "A brown wall comes across the flats faster than anypony can walk.",
    when: ({ terrain }) => terrain === "desert",
    resolve: (ctx) => {
      const { g, r } = ctx;
      const soft = isPegasus(ctx) ? 0.45 : 1;
      damageParty(g, Math.round(r.int(4, 9) * soft));
      const lost = takeFood(g, Math.round(r.int(3, 10) * soft));
      changeMood(g, -6);
      const strike = r.chance(0.3 * soft) ? inflictAilment(g, r, { ailmentId: "sunstroke-shivers" }) : null;
      return {
        text: `You circle the wagon and wait it out with cloth over every muzzle.${lost ? ` ${lost} baskets are grit-ruined.` : ""}${
          strike ? ` ${strike.pony.name} takes ${strike.ailment.name}.` : ""
        }`,
        days: 1,
        sfx: "bad",
      };
    },
  },
  {
    id: "wagon-fire",
    weight: 4,
    tone: "bad",
    title: "Fire in the Wagon",
    text: "A lantern goes over in the night and the bonnet catches.",
    resolve: ({ g, r }) => {
      const lost = takeFood(g, r.int(10, 26));
      const bits = takeBits(g, r.int(0, 30));
      damageParty(g, r.int(4, 9));
      changeMood(g, -6);
      return {
        text: `You beat it out with blankets. ${lost} baskets are ash${bits ? ` and ${bits} bits went with them` : ""}.`,
        days: 1,
        sfx: "bad",
      };
    },
  },
  {
    id: "snake-scare",
    weight: 6,
    tone: "bad",
    title: "Something in the Rocks",
    text: "A dry rattle from under a flat stone, and one of your ponies goes straight up in the air.",
    resolve: ({ g, r }) => {
      const pony = randomLivingPony(g, r);
      if (!pony) return { text: "Whatever it was, it has moved on." };
      if (r.chance(0.55)) {
        damagePony(g, pony, 4);
        return { text: `${pony.name} lands badly but is otherwise fine. Everypony walks in the middle of the trail for a while.`, sfx: "hurt" };
      }
      damagePony(g, pony, 12);
      inflictAilment(g, r, { pony, ailmentId: "twisted-hoof" });
      return { text: `${pony.name} twists a hoof scrambling clear of it.`, days: 1, sfx: "hurt" };
    },
  },
  {
    id: "bridge-out",
    weight: 5,
    tone: "bad",
    title: "The Bridge Is Out",
    text: "The little plank bridge over the wash is in the wash.",
    resolve: ({ g, r }) => {
      if (r.chance(0.4)) {
        changeMood(g, -3);
        return { text: "You find a shallow ford a mile upstream. Only half a day lost.", days: 1 };
      }
      damageParty(g, 3);
      return { text: "You rebuild enough of it to cross. Two days.", days: 2, sfx: "thud" };
    },
  },
  {
    id: "dragon-overhead",
    weight: 4,
    tone: "neutral",
    title: "A Shadow Passes Over",
    text: "Something very large goes over, high up, and does not look down. The team stops dead.",
    resolve: (ctx) => {
      const { g } = ctx;
      if (isPegasus(ctx)) {
        changeMood(g, 4);
        return { text: "Your wagon master waves. It waves back. Everypony relaxes considerably.", sfx: "select" };
      }
      changeMood(g, -8);
      damageParty(g, 2);
      return { text: "It is gone in a minute, but the team will not settle until well after dark.", sfx: "bad" };
    },
  },

  // ---------------------------------------------------------------- choices
  {
    id: "trader",
    weight: 10,
    tone: "neutral",
    title: "A Trader on the Trail",
    text: () => `${randomStrangerName()} is heading east with a cart of odds and ends, and would rather trade than carry them.`,
    choices: [
      {
        label: "Trade 40 bits for 30 baskets of food",
        available: ({ g }) => g.bits >= 40,
        resolve: ({ g }) => {
          takeBits(g, 40);
          addFood(g, 30);
          return { text: "Dried apples, oats and hard biscuit. A fair deal, honestly struck.", sfx: "coin" };
        },
      },
      {
        label: "Trade 25 baskets for a spare wheel",
        available: ({ g }) => g.food >= 25,
        resolve: ({ g }) => {
          takeFood(g, 25);
          addPart(g, "wheel");
          return { text: "They are hungrier than they are sentimental about wheels.", sfx: "coin" };
        },
      },
      {
        label: "Trade 60 bits for a healing potion",
        available: ({ g }) => g.bits >= 60,
        resolve: ({ g }) => {
          takeBits(g, 60);
          g.potions++;
          return { text: "It glows faintly and smells of mint. Good enough.", sfx: "coin" };
        },
      },
      {
        label: "Thank them and move along",
        resolve: () => ({ text: "You part with a nod and a wave." }),
      },
    ],
  },
  {
    id: "zebra-herbalist",
    weight: 7,
    tone: "good",
    title: "A Zebra Herbalist",
    text: "A striped mare in a cloak of clinking charms watches you approach. Her cart smells of a hundred green things.",
    when: ({ g }) => livingPonies(g).some((p) => !!p.ailment) || g.potions < 2,
    choices: [
      {
        label: "Ask her to treat the sick (70 bits)",
        available: ({ g }) => g.bits >= 70 && livingPonies(g).some((p) => !!p.ailment),
        resolve: ({ g }) => {
          takeBits(g, 70);
          let count = 0;
          for (const p of livingPonies(g)) {
            if (p.ailment) {
              p.ailment = null;
              p.ailmentDays = 0;
              p.health = Math.min(100, p.health + 14);
              count++;
            }
          }
          log(g, "A zebra herbalist treated the party.");
          return { text: `She works until dusk. ${count} ${count === 1 ? "pony is" : "ponies are"} on the mend.`, days: 1, sfx: "fanfare" };
        },
      },
      {
        label: "Buy two potions (90 bits)",
        available: ({ g }) => g.bits >= 90,
        resolve: ({ g }) => {
          takeBits(g, 90);
          g.potions += 2;
          return { text: "Two stoppered bottles, wrapped in leaves and stern instructions.", sfx: "coin" };
        },
      },
      {
        label: "Trade 20 baskets for a potion",
        available: ({ g }) => g.food >= 20,
        resolve: ({ g }) => {
          takeFood(g, 20);
          g.potions++;
          return { text: "She takes the food gladly. Roots are easier to find than oats out here.", sfx: "coin" };
        },
      },
      { label: "Nod and carry on", resolve: () => ({ text: "She is still watching when you look back." }) },
    ],
  },
  {
    id: "flim-flam-cousin",
    weight: 6,
    tone: "neutral",
    title: "A Very Good Deal",
    text: "A pinstriped stallion with an enormous moustache and a folding table has, he says, exactly what you need.",
    choices: [
      {
        label: "Buy his 'miracle tonic' (50 bits)",
        available: ({ g }) => g.bits >= 50,
        resolve: ({ g, r }) => {
          takeBits(g, 50);
          if (r.chance(0.35)) {
            g.potions++;
            return { text: "Astonishingly, it is a real healing potion. He seems as surprised as you are.", sfx: "coin" };
          }
          changeMood(g, -4);
          return { text: "It is sugar water with a sprig of mint in it. He is over the hill before you finish tasting.", sfx: "bad" };
        },
      },
      {
        label: "Haggle hard",
        resolve: ({ g, r }) => {
          if (r.chance(0.5)) {
            addFood(g, 12);
            return { text: "You talk him down to twelve baskets of food in exchange for nothing at all. A moral victory.", sfx: "coin" };
          }
          takeBits(g, Math.min(g.bits, 15));
          return { text: "Somehow you end up fifteen bits lighter and holding a commemorative spoon.", sfx: "back" };
        },
      },
      { label: "Keep walking", resolve: () => ({ text: "He calls after you about a limited-time offer." }) },
    ],
  },
  {
    id: "lost-foal",
    weight: 6,
    tone: "good",
    title: "A Lost Foal",
    text: "A small, filthy, extremely determined foal is sitting in the middle of the trail. Her family's wagon is somewhere ahead.",
    once: true,
    choices: [
      {
        label: "Take a day to find her family",
        resolve: ({ g, r }) => {
          const reward = r.int(40, 90);
          addBits(g, reward);
          changeMood(g, 12);
          healParty(g, 5);
          g.flags["good-deed"] = true;
          return {
            text: `Her mother presses ${reward} bits on you and will not hear otherwise. The team is proud of you.`,
            days: 1,
            sfx: "fanfare",
          };
        },
      },
      {
        label: "Point her up the trail and carry on",
        resolve: ({ g }) => {
          changeMood(g, -12);
          return { text: "She will probably be fine. The team walks quietly for a long while.", sfx: "sad" };
        },
      },
    ],
  },
  {
    id: "crusaders",
    weight: 5,
    tone: "neutral",
    title: "Three Helpful Fillies",
    text: "Three fillies with a hoof-painted banner offer to help with absolutely anything, for the experience.",
    choices: [
      {
        label: "Let them help load the wagon",
        resolve: ({ g, r }) => {
          if (r.chance(0.5)) {
            changeMood(g, 8);
            healParty(g, 4);
            return { text: "They are astonishingly good at it. The wagon has never been packed so well.", sfx: "fanfare" };
          }
          const lost = takeFood(g, r.int(3, 9));
          changeMood(g, 4);
          return { text: `Enthusiasm outruns technique and ${lost} baskets end up in a creek. Nopony can stay cross at them.`, sfx: "back" };
        },
      },
      {
        label: "Thank them and decline",
        resolve: () => ({ text: "They move on to the next wagon, undeterred." }),
      },
    ],
  },
  {
    id: "grave-marker",
    weight: 5,
    tone: "neutral",
    title: "A Marker by the Trail",
    text: "A stone stands in the grass with a name and a date scratched into it, and a bundle of dried flowers at its foot.",
    resolve: ({ g }) => {
      changeMood(g, -2);
      return { text: "You add a stone to the pile, the way it is done out here, and go on." };
    },
  },
  {
    id: "spring-water",
    weight: 6,
    tone: "good",
    title: "A Clear Spring",
    text: "Cold water straight out of a rock face, sweet enough to make everypony laugh.",
    resolve: ({ g }) => {
      healParty(g, 7);
      changeMood(g, 5);
      return { text: "Barrels filled, canteens filled, spirits filled.", sfx: "day" };
    },
  },
  {
    id: "apple-cart",
    weight: 6,
    tone: "good",
    title: "A Roadside Apple Cart",
    text: "An old stallion is selling apples out of a cart at prices he describes as 'frankly generous'.",
    choices: [
      {
        label: "Buy 45 baskets (30 bits)",
        available: ({ g }) => g.bits >= 30,
        resolve: ({ g }) => {
          takeBits(g, 30);
          addFood(g, 45);
          return { text: "He was not lying. He even throws in a pie.", sfx: "coin" };
        },
      },
      {
        label: "Buy 15 baskets (12 bits)",
        available: ({ g }) => g.bits >= 12,
        resolve: ({ g }) => {
          takeBits(g, 12);
          addFood(g, 15);
          return { text: "Crisp, tart, and welcome.", sfx: "coin" };
        },
      },
      { label: "Just admire the apples", resolve: () => ({ text: "He offers you one for free anyway." }) },
    ],
  },
  {
    id: "team-grumbling",
    weight: 7,
    tone: "bad",
    title: "Grumbling in the Harness",
    text: "The Wagon Team has stopped talking to you and started talking to each other.",
    when: ({ g }) => g.team > 0 && g.teamMood < 45,
    choices: [
      {
        label: "Halt for half a day and feed them",
        available: ({ g }) => g.food >= 12,
        resolve: ({ g }) => {
          takeFood(g, 12);
          changeMood(g, 22);
          return { text: "Full baskets and an afternoon in the shade. The mood turns around.", days: 1, sfx: "fanfare" };
        },
      },
      {
        label: "Promise a bonus at the next town",
        resolve: ({ g, r }) => {
          if (r.chance(0.6)) {
            changeMood(g, 12);
            g.flags["owes-bonus"] = true;
            return { text: "They accept, on the record, with witnesses.", sfx: "select" };
          }
          changeMood(g, -5);
          return { text: "They have heard promises before.", sfx: "back" };
        },
      },
      {
        label: "Tell them to get back in harness",
        resolve: ({ g, r }) => {
          changeMood(g, -14);
          const lost = r.chance(0.4) ? loseTeam(g, 1) : 0;
          return {
            text: lost
              ? "One of them unbuckles, hands you the harness, and walks east without a word."
              : "They pull. They are not happy about it.",
            sfx: "bad",
          };
        },
      },
    ],
  },
  {
    id: "traveller-advice",
    weight: 8,
    tone: "good",
    title: "Ponies Coming the Other Way",
    text: () =>
      `A family heading back east stops to talk. They have seen everything ahead of you and are keen to say so.`,
    resolve: ({ g, r }) => {
      g.flags["scouted"] = true;
      changeMood(g, 4);
      const tips = [
        "The next crossing is running lower than the marks suggest.",
        "There is good grazing a day west of here, if you push.",
        "Somepony is charging a fortune for potions at the next stop. Buy nothing.",
        "Keep to the northern ruts through the rocks. The southern ones eat wheels.",
        "The toll road ahead is smooth, and the toll is worse than you have heard.",
      ];
      return { text: `"${r.pick(tips)}" You thank them and note it down.`, sfx: "day" };
    },
  },
  {
    id: "sizeable-donation",
    weight: 4,
    tone: "good",
    title: "Repaid Kindness",
    text: "A wagon you helped days ago catches up to you, and its driver has been carrying something for you since.",
    when: ({ g }) => !!g.flags["good-deed"] && !g.flags["repaid"],
    resolve: ({ g, r }) => {
      g.flags["repaid"] = true;
      const food = r.int(15, 30);
      const bits = r.int(20, 50);
      addFood(g, food);
      addBits(g, bits);
      changeMood(g, 8);
      return { text: `${food} baskets and ${bits} bits, pressed on you with great insistence.`, sfx: "fanfare" };
    },
  },
  {
    id: "heat-wave",
    weight: 7,
    tone: "bad",
    title: "A Blazing Week",
    text: "The heat sits on the trail like a blanket and will not get off.",
    when: ({ season }) => season === "summer",
    resolve: (ctx) => {
      const { g, r } = ctx;
      const soft = isPegasus(ctx) ? 0.5 : 1;
      damageParty(g, Math.round(r.int(3, 8) * soft));
      changeMood(g, -5);
      const lost = takeFood(g, Math.round(r.int(2, 8) * soft));
      return {
        text: `Everypony wilts${lost ? ` and ${lost} baskets spoil in the heat` : ""}. You travel at dawn and dusk and doze through the middle.`,
        sfx: "bad",
      };
    },
  },
];

/** Events eligible right now, with their weights. */
export function eligibleEvents(ctx: EventContext): { item: TrailEvent; weight: number }[] {
  return EVENTS.filter((e) => {
    if (e.once && ctx.g.flags[`event:${e.id}`]) return false;
    if (e.when && !e.when(ctx)) return false;
    if (e.choices && e.choices.filter((c) => !c.available || c.available(ctx)).length === 0) return false;
    return true;
  }).map((e) => ({ item: e, weight: e.weight }));
}

export function eventText(e: TrailEvent, ctx: EventContext): string {
  return typeof e.text === "function" ? e.text(ctx) : e.text;
}

export function availableChoices(e: TrailEvent, ctx: EventContext): EventChoice[] {
  return (e.choices ?? []).filter((c) => !c.available || c.available(ctx));
}

export function markEventSeen(g: GameState, e: TrailEvent): void {
  g.flags[`event:${e.id}`] = true;
  g.stats.eventsSeen++;
  void ORIGINS;
}
