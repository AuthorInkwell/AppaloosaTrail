/** The general store at Pioneer's Bluff and every trading post after it. */

import { GameState, MAX_TEAM } from "../state";

export type StoreItemId = "team" | "food" | "cloaks" | "wheels" | "axles" | "tongues" | "potions";

export interface StoreItem {
  id: StoreItemId;
  name: string;
  /** Singular unit label, e.g. "basket". */
  unit: string;
  unitPlural: string;
  /** Bits per unit before the landmark price multiplier. */
  price: number;
  /** Purchase increment. */
  step: number;
  desc: string;
  max?: (g: GameState) => number;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: "team",
    name: "Wagon Team",
    unit: "member",
    unitPlural: "members",
    price: 45,
    step: 1,
    desc: "Strong, hatted, opinionated. More members pull faster but eat more.",
    max: (g) => MAX_TEAM - g.team,
  },
  {
    id: "food",
    name: "Food",
    unit: "basket",
    unitPlural: "baskets",
    price: 0.4,
    step: 10,
    desc: "Oats, dried apples and hard biscuit, measured in basketfuls.",
  },
  {
    id: "cloaks",
    name: "Warm Cloaks",
    unit: "cloak",
    unitPlural: "cloaks",
    price: 12,
    step: 1,
    desc: "One per pony keeps the cold snaps from turning nasty.",
  },
  {
    id: "wheels",
    name: "Spare Wheels",
    unit: "wheel",
    unitPlural: "wheels",
    price: 15,
    step: 1,
    desc: "Wheels break. Yours will. Twice, probably.",
  },
  {
    id: "axles",
    name: "Spare Axles",
    unit: "axle",
    unitPlural: "axles",
    price: 14,
    step: 1,
    desc: "A broken axle without a spare costs days you cannot spare.",
  },
  {
    id: "tongues",
    name: "Spare Tongues",
    unit: "tongue",
    unitPlural: "tongues",
    price: 12,
    step: 1,
    desc: "The timber that yokes the team to the wagon.",
  },
  {
    id: "potions",
    name: "Healing Potions",
    unit: "potion",
    unitPlural: "potions",
    price: 28,
    step: 1,
    desc: "Cures one ailment outright. Used automatically if a pony is at death's door.",
  },
];

export function unitPrice(item: StoreItem, priceMult = 1): number {
  return item.price * priceMult;
}

/** Cost of `qty` units, rounded the way a shopkeeper would round it. */
export function lineCost(item: StoreItem, qty: number, priceMult = 1): number {
  return Math.ceil(unitPrice(item, priceMult) * qty);
}

export function stateQty(g: GameState, id: StoreItemId): number {
  switch (id) {
    case "team":
      return g.team;
    case "food":
      return Math.round(g.food);
    case "cloaks":
      return g.cloaks;
    case "wheels":
      return g.wheels;
    case "axles":
      return g.axles;
    case "tongues":
      return g.tongues;
    case "potions":
      return g.potions;
  }
}

export function grantItem(g: GameState, id: StoreItemId, qty: number): void {
  switch (id) {
    case "team":
      g.team += qty;
      g.stats.teamHired += Math.max(0, qty);
      break;
    case "food":
      g.food += qty;
      break;
    case "cloaks":
      g.cloaks += qty;
      break;
    case "wheels":
      g.wheels += qty;
      break;
    case "axles":
      g.axles += qty;
      break;
    case "tongues":
      g.tongues += qty;
      break;
    case "potions":
      g.potions += qty;
      break;
  }
}

/** Bits refunded when dismissing a team member mid-trail. */
export const TEAM_DISMISS_REFUND = 18;
