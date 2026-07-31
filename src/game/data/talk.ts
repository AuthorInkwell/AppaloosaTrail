/** Chatter from other travellers at trail stops. */

import { Rng } from "../../engine/rng";
import { GameState, livingPonies } from "../state";
import { randomStrangerName } from "./names";

export interface TalkLine {
  text: string;
  when?: (g: GameState) => boolean;
}

const GENERAL: TalkLine[] = [
  { text: "My cousin went out with two in the team and swore it was plenty. She is still out there somewhere, I expect." },
  { text: "Rivers look shallower than they are. Always. Every time. Ask the marks, not your eyes." },
  { text: "If your team starts talking amongst themselves instead of to you, feed them better and feed them soon." },
  { text: "Everypony fusses about the desert. It is the cold on the far side of it that gets wagons." },
  { text: "There is nothing wrong with a slow day. There is a great deal wrong with a slow month." },
  { text: "I paid a pegasus team to fly my wagon over the Galloping Gorge and I would pay it again twice over." },
  { text: "A basket of food weighs nothing until you are carrying it three miles at dusk." },
  { text: "Buy the spare axle. I know it is dull. Buy the spare axle." },
  { text: "You can eat thin for a week. Your team cannot, and they have opinions and legs." },
  { text: "Somepony left a marker at the last crossing with a joke carved on it. I laughed. Then I checked my wheels." },
  { text: "The Everfree is not evil. It simply does not care whether you get through, and that is worse." },
  { text: "Those Bamboozle brothers charge whatever the road will bear, and the road bears a great deal." },
  { text: "Zebra herbalists ask a fair price and give fair value. The stallion with the moustache does neither." },
  { text: "Rest a day early rather than three days late. That is the whole trick of it." },
];

const SITUATIONAL: TalkLine[] = [
  {
    text: "You are travelling awfully light on food, friend. Forage while the country is still green.",
    when: (g) => g.food < 60,
  },
  {
    text: "Your team looks worn thin. Ease off the pace a day or two and they will remember it kindly.",
    when: (g) => g.teamMood < 45,
  },
  {
    text: "That is a small team for a big wagon. Hire another pair if you can spare the bits.",
    when: (g) => g.team > 0 && g.team <= 2,
  },
  {
    text: "You have ponies ailing. There is no medal for pressing on with a sick party.",
    when: (g) => livingPonies(g).some((p) => !!p.ailment),
  },
  {
    text: "Snow in the passes already. If you are going, go quickly.",
    when: (g) => g.date.month >= 10 || g.date.month <= 2,
  },
  {
    text: "Ponies pulling their own wagon! I have seen it before, but never on purpose.",
    when: (g) => g.team === 0,
  },
];

export function gatherTalk(g: GameState, r: Rng, count = 2): { speaker: string; text: string }[] {
  const pool = [...SITUATIONAL.filter((l) => !l.when || l.when(g)), ...r.shuffle([...GENERAL])];
  const out: { speaker: string; text: string }[] = [];
  const used = new Set<string>();
  for (const line of pool) {
    if (out.length >= count) break;
    if (used.has(line.text)) continue;
    used.add(line.text);
    out.push({ speaker: randomStrangerName(r), text: line.text });
  }
  return out;
}
