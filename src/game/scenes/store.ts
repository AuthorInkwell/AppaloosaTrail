/**
 * The general store, used both for outfitting at Pioneer's Bluff and for
 * trading at stops along the trail. Quantities are adjusted in place and paid
 * for in one go, which is the one place this game is friendlier than 1990.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, CELL_H, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { Menu, blink, footer, panel, screenFrame, wrapText } from "../../engine/ui";
import { BASKET, CLOAK, COIN, POTION, WHEEL_ICON } from "../../art/sprites";
import { TEAM_MEMBER } from "../../art/sprites";
import { Landmark } from "../data/trail";
import { STORE_ITEMS, StoreItem, TEAM_DISMISS_REFUND, grantItem, lineCost, stateQty, unitPrice } from "../data/store";
import { GameState, MAX_TEAM, MIN_TEAM_TO_START, livingPonies, log, spend } from "../state";
import { askChoice, drawSupplyStrip, showPages } from "./common";
import { currentMusicSlot, setMusic } from "../systems/music";

const ICONS: Partial<Record<string, typeof BASKET>> = {
  food: BASKET,
  cloaks: CLOAK,
  wheels: WHEEL_ICON,
  axles: WHEEL_ICON,
  tongues: WHEEL_ICON,
  potions: POTION,
};

export interface StoreOpts {
  intro?: boolean;
  onDone: () => void;
  /** Shown under the title, e.g. the shopkeeper's greeting. */
  greeting?: string;
}

export class StoreScene implements Scene {
  readonly name = "store";
  private qty: number[] = [];
  private index = 0;
  private priceMult: number;

  constructor(
    private g: GameState,
    private landmark: Landmark,
    private opts: StoreOpts,
  ) {
    this.priceMult = landmark.priceMult ?? 1;
    this.qty = STORE_ITEMS.map(() => 0);
  }

  enter(): void {
    setMusic("store");
    if (this.opts.intro && !this.g.flags["seen-outfitting"]) {
      this.g.flags["seen-outfitting"] = true;
      showPages([
        {
          title: "Outfitting the wagon",
          text:
            "Hire your Wagon Team, lay in food by the basketful, and buy spares for what the trail will break. Arrow keys pick a line; LEFT and RIGHT change the amount; RETURN buys the lot.",
        },
        {
          title: "Grandmotherly advice",
          text:
            "An old mare outside the store is telling everypony the same thing: four hundred baskets of food, six in the team, a cloak each, and one spare of everything. Nopony has ever regretted listening to her.",
        },
      ]);
    }
  }

  private total(): number {
    let sum = 0;
    STORE_ITEMS.forEach((item, i) => {
      const q = this.qty[i]!;
      if (q > 0) sum += lineCost(item, q, this.priceMult);
      else if (item.id === "team" && q < 0) sum -= -q * TEAM_DISMISS_REFUND;
    });
    return sum;
  }

  private maxFor(item: StoreItem, i: number): number {
    const cap = item.max ? item.max(this.g) : Infinity;
    void i;
    return cap;
  }

  private adjust(delta: number): void {
    const item = STORE_ITEMS[this.index]!;
    const step = item.step * (input.down("ShiftLeft") || input.down("ShiftRight") ? 5 : 1);
    const before = this.qty[this.index]!;
    let next = before + delta * step;
    const floor = item.id === "team" ? -this.g.team : 0;
    next = Math.max(floor, Math.min(this.maxFor(item, this.index), next));
    this.qty[this.index] = next;
    if (next !== before) {
      // Never let the cart exceed the purse.
      let guard = 0;
      while (this.total() > this.g.bits && this.qty[this.index]! > floor && guard++ < 999) {
        this.qty[this.index] = this.qty[this.index]! - item.step;
      }
      audio.sfx(this.qty[this.index] === before ? "back" : "move");
    } else {
      audio.sfx("back");
    }
  }

  private buy(): void {
    const cost = this.total();
    if (cost > this.g.bits) {
      audio.sfx("back");
      return;
    }
    const bought: string[] = [];
    STORE_ITEMS.forEach((item, i) => {
      const q = this.qty[i]!;
      if (q === 0) return;
      grantItem(this.g, item.id, q);
      if (q > 0) bought.push(`${q} ${q === 1 ? item.unit : item.unitPlural}`);
      else bought.push(`dismissed ${-q} of the team`);
    });
    if (bought.length === 0) {
      audio.sfx("back");
      return;
    }
    if (cost > 0) spend(this.g, cost);
    else this.g.bits += -cost;
    audio.sfx("coin");
    log(this.g, `At ${this.landmark.name}: ${bought.join(", ")}.`);
    this.qty = STORE_ITEMS.map(() => 0);
    showPages([
      {
        title: "Sold",
        text: `${bought.join(", ")}.${cost > 0 ? ` That will be ${cost} bits.` : ""} You have ${Math.round(this.g.bits)} bits left.`,
        sfx: "coin",
      },
    ]);
  }

  private tryLeave(): void {
    const g = this.g;
    if (this.opts.intro) {
      const problems: string[] = [];
      if (g.team < MIN_TEAM_TO_START) problems.push(`hire at least ${MIN_TEAM_TO_START} of the Wagon Team`);
      if (g.food < 40) problems.push("buy a good deal more food");
      if (problems.length) {
        showPages([
          {
            title: "Not yet, friend",
            text: `The storekeeper stops you at the door. You should ${problems.join(" and ")} before you set out.`,
            sfx: "back",
          },
        ]);
        return;
      }
      const cloakShort = livingPonies(g).length - g.cloaks;
      const noSpares = g.wheels + g.axles + g.tongues === 0;
      if (cloakShort > 0 || noSpares || g.food < 120) {
        const warnings: string[] = [];
        if (g.food < 120) warnings.push("food is thin for a journey this long");
        if (cloakShort > 0) warnings.push(`${cloakShort} ${cloakShort === 1 ? "pony has" : "ponies have"} no warm cloak`);
        if (noSpares) warnings.push("you have no spare parts at all");
        askChoice(
          "Are you sure?",
          `Before you go: ${warnings.join(", ")}. Set out anyway?`,
          ["Set out for Appaloosa", "Keep shopping"],
          (i) => {
            if (i === 0) this.finish();
          },
        );
        return;
      }
    }
    this.finish();
  }

  private finish(): void {
    scenes.pop();
    this.opts.onDone();
  }

  update(): void {
    if (currentMusicSlot() !== "store") setMusic("store");
    if (input.pressed("ArrowUp")) {
      this.index = (this.index - 1 + STORE_ITEMS.length) % STORE_ITEMS.length;
      audio.sfx("move");
    }
    if (input.pressed("ArrowDown")) {
      this.index = (this.index + 1) % STORE_ITEMS.length;
      audio.sfx("move");
    }
    if (input.pressed("ArrowLeft")) this.adjust(-1);
    if (input.pressed("ArrowRight")) this.adjust(1);
    if (input.pressed("PageUp")) this.adjust(5);
    if (input.pressed("PageDown")) this.adjust(-5);
    const d = input.digit();
    if (d !== null && d >= 1 && d <= STORE_ITEMS.length) {
      this.index = d - 1;
      audio.sfx("move");
    }
    if (input.pressed("Enter", "NumpadEnter")) this.buy();
    if (input.pressed("Space", " ") || input.cancel() || input.pressed("0")) this.tryLeave();
  }

  draw(): void {
    const g = this.g;
    const title = this.landmark.id === "pioneers-bluff" ? "THE PIONEER'S BLUFF GENERAL STORE" : `${this.landmark.name.toUpperCase()} TRADING POST`;
    screenFrame(title);

    const greeting =
      this.opts.greeting ??
      (this.priceMult > 1.4
        ? "Everything out here comes in by wagon, friend, and the wagons are not cheap."
        : "Take your time. Everything you need for the trail is on the board.");
    let gy = 15;
    for (const line of wrapText(greeting, 50)) {
      screen.text(12, gy, line, C.BRIGHTCYAN);
      gy += CELL_H;
    }

    // Table header
    const top = gy + 3;
    screen.rect(8, top, SCREEN_W - 16, 9, C.BLUE);
    screen.text(12, top + 1, "ITEM", C.YELLOW);
    screen.textRight(184, top + 1, "PRICE", C.YELLOW);
    screen.textRight(224, top + 1, "HAVE", C.YELLOW);
    screen.textRight(262, top + 1, "BUY", C.YELLOW);
    screen.textRight(SCREEN_W - 12, top + 1, "COST", C.YELLOW);

    STORE_ITEMS.forEach((item, i) => {
      const y = top + 12 + i * 13;
      const selected = i === this.index;
      if (selected) screen.rect(8, y - 2, SCREEN_W - 16, 12, C.BLUE);
      const ink = selected ? C.WHITE : C.GREY;
      const icon = ICONS[item.id];
      if (icon) screen.sprite(icon, 11, y - 1);
      else if (item.id === "team") {
        screen.sprite(TEAM_MEMBER, 6, y - 5, {
          remap: { C: C.BROWN, A: C.YELLOW, K: C.RED, H: C.DARKGREY, "0": C.BLACK },
        });
      }
      screen.text(28, y, `${i + 1}. ${item.name}`, ink);
      const price = unitPrice(item, this.priceMult);
      const priceLabel = price < 1 ? `${Math.ceil(price * 10)} / 10` : `${Math.ceil(price)}`;
      screen.textRight(184, y, `${priceLabel} bits`, C.CYAN);
      screen.textRight(224, y, String(stateQty(g, item.id)), C.WHITE);
      const q = this.qty[i]!;
      const qtyLabel = q === 0 ? "-" : q > 0 ? `+${q}` : `${q}`;
      screen.textRight(262, y, qtyLabel, q === 0 ? C.DARKGREY : q > 0 ? C.BRIGHTGREEN : C.BRIGHTRED);
      if (q !== 0) {
        const cost = q > 0 ? lineCost(item, q, this.priceMult) : -(-q * TEAM_DISMISS_REFUND);
        screen.textRight(SCREEN_W - 12, y, cost >= 0 ? String(cost) : `+${-cost}`, cost >= 0 ? C.WHITE : C.BRIGHTGREEN);
      }
    });

    // Selected item description
    const item = STORE_ITEMS[this.index]!;
    const descY = top + 12 + STORE_ITEMS.length * 13 + 2;
    panel(8, descY, SCREEN_W - 16, 30, { fill: C.BLACK, border: C.DARKGREY });
    let dy = descY + 4;
    for (const line of wrapText(item.desc, 50).slice(0, 2)) {
      screen.text(12, dy, line, C.BRIGHTGREEN);
      dy += CELL_H;
    }
    if (item.id === "team") {
      const hint =
        g.team > 0 ? `at most ${MAX_TEAM}; dismiss for ${TEAM_DISMISS_REFUND} bits each` : `at most ${MAX_TEAM} in the team`;
      screen.text(12, descY + 20, hint, C.BROWN);
    }

    // Totals
    const totY = descY + 32;
    const total = this.total();
    screen.rect(8, totY, SCREEN_W - 16, 11, total > g.bits ? C.RED : C.GREEN);
    screen.frame(8, totY, SCREEN_W - 16, 11, C.GREY);
    screen.text(12, totY + 2, `TOTAL ${total}`, C.WHITE);
    screen.sprite(COIN, 118, totY + 1);
    screen.text(130, totY + 2, `purse ${Math.round(g.bits)}`, C.WHITE);
    screen.textRight(SCREEN_W - 12, totY + 2, `left over ${Math.round(g.bits - total)}`, C.WHITE);

    drawSupplyStrip(g, 8, totY + 13, SCREEN_W - 16);

    if (blink(900, 0.7)) {
      screen.textCentered(
        SCREEN_W / 2,
        SCREEN_H - 10,
        total !== 0 ? "RETURN to buy   \u0003\u0004 change amount   SPACE to leave" : "\u0003\u0004 change amount   SPACE BAR to leave the store",
        C.YELLOW,
      );
    }
    void footer;
    void Menu;
  }
}
