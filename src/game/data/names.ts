/** Pony-appropriate name generator for players who would rather not think. */

import { Rng, rng as globalRng } from "../../engine/rng";

const FIRST = [
  "Apple", "Amber", "Autumn", "Barley", "Berry", "Bramble", "Buckle", "Buttercup", "Cactus", "Canyon",
  "Cider", "Cinnamon", "Clover", "Comet", "Copper", "Cricket", "Daisy", "Dandelion", "Dapple", "Dewdrop",
  "Dusty", "Ember", "Feather", "Fiddle", "Flint", "Frost", "Ginger", "Golden", "Harvest", "Hayseed",
  "Hazel", "Hickory", "Honey", "Ivory", "Juniper", "Lark", "Lemon", "Lucky", "Maple", "Marigold",
  "Meadow", "Mesa", "Misty", "Nutmeg", "Oakley", "Peach", "Pebble", "Pepper", "Pinto", "Plum",
  "Poppy", "Prairie", "Quartz", "Quill", "Ribbon", "Rosin", "Ruddy", "Rusty", "Saddle", "Sage",
  "Sandy", "Shale", "Silver", "Sorrel", "Sugar", "Sunbeam", "Sunny", "Tansy", "Thistle", "Velvet",
  "Wheat", "Willow", "Windy", "Wisp",
];

const SECOND = [
  "Apples", "Bells", "Blossom", "Bloom", "Britches", "Brush", "Chaser", "Cider", "Dancer", "Dash",
  "Doodle", "Drop", "Dust", "Fields", "Fritter", "Furrow", "Gale", "Gallop", "Glimmer", "Grass",
  "Harvest", "Heart", "Hooves", "Jubilee", "Kettle", "Leaf", "Light", "Mane", "Meadows", "Pie",
  "Plow", "Prance", "Quill", "Reins", "Ridge", "Rose", "Seed", "Shine", "Sky", "Song",
  "Sparkle", "Spoon", "Sprout", "Star", "Stitch", "Storm", "Sunrise", "Trot", "Twist", "Wheel",
  "Whinny", "Wind", "Wishes",
];

const SINGLE = [
  "Cobbler", "Dustdevil", "Hayride", "Jubilee", "Lasso", "Mudslide", "Pathfinder", "Rambler",
  "Sundown", "Tumbleweed", "Wagonwheel", "Whistler",
];

export function randomPonyName(r: Rng = globalRng): string {
  if (r.chance(0.08)) return r.pick(SINGLE);
  return `${r.pick(FIRST)} ${r.pick(SECOND)}`;
}

/** Distinct names, first-come-first-served. */
export function randomPartyNames(count: number, r: Rng = globalRng): string[] {
  const out: string[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    const n = randomPonyName(r);
    if (!out.includes(n)) out.push(n);
  }
  while (out.length < count) out.push(`Pony ${out.length + 1}`);
  return out;
}

/** Names for the anonymous folk you meet on the trail. */
export function randomStrangerName(r: Rng = globalRng): string {
  return randomPonyName(r);
}
