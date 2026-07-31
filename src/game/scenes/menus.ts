/** "Size up the situation" and everything hanging off it. */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, CELL_H, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { Menu, blink, footer, gauge, panel, screenFrame, wrapText } from "../../engine/ui";
import { BASKET, CLOAK, COIN, POTION, WHEEL_ICON } from "../../art/sprites";
import { drawPony } from "../../art/wagon";
import { TOTAL_MILES, TRAIL } from "../data/trail";
import { ailmentById } from "../data/ailments";
import { session } from "../session";
import {
  GameState,
  PACE_INFO,
  Pace,
  PonyState,
  RATION_INFO,
  Rations,
  dailyFoodNeed,
  formatDate,
  healthLabel,
  livingPonies,
  milesPerDay,
  partyHealth,
} from "../state";
import { SAVE_SLOTS, saveGame, summarise } from "../systems/save";
import { usePotion } from "../systems/effects";
import { passDays } from "../systems/travel";
import { ForageScene } from "./forage";
import { askChoice, drawSupplyStrip, healthColor, nextLandmarkInfo, showPages } from "./common";
import { returnToTitle } from "./eventrunner";

export class SizeUpScene implements Scene {
  readonly name = "sizeup";
  transparent = true;
  private menu = new Menu([]);

  enter(): void {
    this.refresh();
  }

  private refresh(): void {
    const g = session.current;
    this.menu.setItems([
      { label: "Continue on the trail" },
      { label: "Check supplies" },
      { label: "Look at the map" },
      { label: "Change pace", detail: PACE_INFO[g.pace].name },
      { label: "Change food rations", detail: RATION_INFO[g.rations].name },
      { label: "See the party" },
      { label: "Rest a while" },
      { label: "Forage for food" },
      {
        label: "Use a healing potion",
        detail: `${g.potions} left`,
        disabled: g.potions <= 0 || livingPonies(g).length === 0,
      },
      { label: "Save or quit" },
    ]);
  }

  update(): void {
    const picked = this.menu.update();
    if (picked === null) {
      if (input.cancel()) {
        audio.sfx("back");
        scenes.pop();
      }
      return;
    }
    const g = session.current;
    switch (picked) {
      case 0:
        scenes.pop();
        break;
      case 1:
        scenes.push(new SuppliesScene());
        break;
      case 2:
        scenes.push(new MapScene());
        break;
      case 3:
        scenes.push(new PaceScene(() => this.refresh()));
        break;
      case 4:
        scenes.push(new RationsScene(() => this.refresh()));
        break;
      case 5:
        scenes.push(new PartyScene(() => this.refresh()));
        break;
      case 6:
        scenes.push(new RestScene());
        break;
      case 7:
        scenes.push(new ForageScene(g, () => this.refresh()));
        break;
      case 8:
        scenes.push(new PotionScene(() => this.refresh()));
        break;
      case 9:
        scenes.push(new SaveScene());
        break;
    }
  }

  draw(): void {
    const g = session.current;
    panel(20, 16, SCREEN_W - 40, SCREEN_H - 30, { fill: C.BLACK, border: C.GREY, shadow: true, double: true });
    screen.textCentered(SCREEN_W / 2, 22, "SIZING UP THE SITUATION", C.YELLOW);
    screen.hline(30, 31, SCREEN_W - 60, C.DARKGREY);
    const next = nextLandmarkInfo(g);
    screen.textCentered(
      SCREEN_W / 2,
      35,
      `${formatDate(g.date)}  \u0006  ${next.milesAway} mi to ${next.name}`.slice(0, 44),
      C.BRIGHTCYAN,
    );
    screen.textCentered(SCREEN_W / 2, 44, "You may:", C.CYAN);
    this.menu.draw({
      x: 46,
      y: 54,
      color: C.GREY,
      cursorColor: C.WHITE,
      lineHeight: 10,
      width: SCREEN_W - 96,
      detailColor: C.BROWN,
    });
    drawSupplyStrip(g, 28, SCREEN_H - 42, SCREEN_W - 56);
    if (blink()) screen.textCentered(SCREEN_W / 2, SCREEN_H - 26, "1 or SPACE BAR to keep travelling", C.BRIGHTGREEN);
  }
}

// ---------------------------------------------------------------------------

export class SuppliesScene implements Scene {
  readonly name = "supplies";

  update(): void {
    if (input.confirm() || input.pressed("Enter") || input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  draw(): void {
    const g = session.current;
    screenFrame("YOUR SUPPLIES");
    const rows: { icon: typeof BASKET | null; label: string; value: string; color?: number }[] = [
      { icon: BASKET, label: "Food", value: `${Math.round(g.food)} baskets` },
      { icon: null, label: "Wagon Team", value: `${g.team} in harness` },
      { icon: CLOAK, label: "Warm cloaks", value: `${g.cloaks}` },
      { icon: WHEEL_ICON, label: "Spare wheels", value: `${g.wheels}` },
      { icon: WHEEL_ICON, label: "Spare axles", value: `${g.axles}` },
      { icon: WHEEL_ICON, label: "Spare tongues", value: `${g.tongues}` },
      { icon: POTION, label: "Healing potions", value: `${g.potions}` },
      { icon: COIN, label: "Bits", value: `${Math.round(g.bits)}` },
    ];
    let y = 22;
    for (const row of rows) {
      if (row.icon) screen.sprite(row.icon, 30, y - 1);
      screen.text(46, y, row.label, C.CYAN);
      screen.textRight(SCREEN_W - 30, y, row.value, C.WHITE);
      y += 12;
    }
    y += 4;
    screen.hline(28, y, SCREEN_W - 56, C.DARKGREY);
    y += 6;
    const need = dailyFoodNeed(g);
    const daysLeft = need > 0 ? Math.floor(g.food / need) : 99;
    screen.text(46, y, "Eaten each day", C.CYAN);
    screen.textRight(SCREEN_W - 30, y, `${need.toFixed(1)} baskets`, C.WHITE);
    y += 11;
    screen.text(46, y, "Food will last", C.CYAN);
    screen.textRight(SCREEN_W - 30, y, `${daysLeft} days`, daysLeft < 8 ? C.BRIGHTRED : C.WHITE);
    y += 11;
    screen.text(46, y, "Travelling about", C.CYAN);
    screen.textRight(SCREEN_W - 30, y, `${Math.round(milesPerDay(g))} miles a day`, C.WHITE);
    y += 11;
    screen.text(46, y, "Team spirits", C.CYAN);
    screen.textRight(SCREEN_W - 30, y, moodLabel(g.teamMood), moodColor(g.teamMood));
    footer("press SPACE BAR to go back");
  }
}

export function moodLabel(mood: number): string {
  if (mood >= 80) return "cheerful";
  if (mood >= 60) return "content";
  if (mood >= 40) return "grumbling";
  if (mood >= 20) return "resentful";
  return "ready to quit";
}

export function moodColor(mood: number): number {
  if (mood >= 60) return C.BRIGHTGREEN;
  if (mood >= 40) return C.YELLOW;
  if (mood >= 20) return C.BROWN;
  return C.BRIGHTRED;
}

// ---------------------------------------------------------------------------

export class MapScene implements Scene {
  readonly name = "map";
  private frame = 0;

  update(dt: number): void {
    this.frame += dt * 60;
    if (input.confirm() || input.pressed("Enter") || input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  /**
   * A vertical strip map: the trail runs top to bottom with names on the left
   * and mile markers on the right, which is the only way sixteen landmarks fit
   * legibly in fifty-three columns.
   */
  draw(): void {
    const g = session.current;
    screenFrame("THE TRAIL WEST");
    const next = nextLandmarkInfo(g);
    screen.textCentered(SCREEN_W / 2, 15, `${Math.round(g.miles)} of ${TOTAL_MILES} miles travelled`, C.WHITE);
    gauge(70, 24, 180, g.miles / TOTAL_MILES, C.BRIGHTGREEN);

    const railX = 196;
    const top = 34;
    const rowH = 9;
    screen.vline(railX, top - 3, TRAIL.length * rowH + 4, C.BROWN);
    screen.vline(railX + 1, top - 3, TRAIL.length * rowH + 4, C.DARKGREY);

    TRAIL.forEach((l, i) => {
      const y = top + i * rowH;
      const passed = g.miles >= l.mile;
      const isNext = TRAIL[g.landmarkIndex]?.id === l.id;
      const color =
        l.kind === "river" ? C.BRIGHTCYAN : l.kind === "town" ? C.YELLOW : l.kind === "end" ? C.BRIGHTGREEN : C.WHITE;
      const ink = passed ? color : isNext ? C.WHITE : C.DARKGREY;
      screen.textRight(railX - 6, y, l.name.slice(0, 22), ink);
      screen.rect(railX - 2, y + 2, 6, 3, passed ? color : C.DARKGREY);
      screen.text(railX + 10, y, `${l.mile} mi`, passed ? C.GREY : C.DARKGREY);
      const tag =
        l.kind === "river" ? "crossing" : l.kind === "town" ? "supplies" : l.kind === "fork" ? "a choice" : "";
      if (tag) screen.text(railX + 56, y, tag, passed ? C.DARKGREY : C.BROWN);
      if (isNext && blink(600, 0.6)) screen.text(railX - 2 - 14, y, "\u0004", C.BRIGHTRED);
    });

    // The wagon sits between the ticks according to how far along it is.
    const prev = TRAIL.filter((l) => l.mile <= g.miles).length - 1;
    const from = TRAIL[Math.max(0, prev)]!;
    const to = TRAIL[Math.min(TRAIL.length - 1, prev + 1)]!;
    const t = to.mile > from.mile ? (g.miles - from.mile) / (to.mile - from.mile) : 0;
    const wy = Math.round(top + (Math.max(0, prev) + t) * rowH);
    screen.rect(railX - 5, wy - 3, 11, 6, C.BLACK);
    screen.rect(railX - 4, wy - 3, 9, 4, C.WHITE);
    screen.rect(railX - 4, wy + 1, 9, 2, C.BROWN);

    screen.textCentered(SCREEN_W / 2, SCREEN_H - 20, `${next.milesAway} miles to ${next.name}`.slice(0, 50), C.YELLOW);
    footer("press SPACE BAR to go back", C.YELLOW, SCREEN_H - 9);
    void this.frame;
  }
}

// ---------------------------------------------------------------------------

export class PaceScene implements Scene {
  readonly name = "pace";
  private order: Pace[] = ["steady", "strenuous", "grueling"];
  private menu: Menu;

  constructor(private onChange: () => void) {
    this.menu = new Menu(this.order.map((p) => ({ label: PACE_INFO[p].name, note: PACE_INFO[p].desc })));
    this.menu.index = this.order.indexOf(session.current.pace);
  }

  update(): void {
    const picked = this.menu.update();
    if (picked !== null) {
      session.current.pace = this.order[picked]!;
      this.onChange();
      scenes.pop();
      return;
    }
    if (input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  draw(): void {
    const g = session.current;
    screenFrame("CHANGE PACE");
    let y = 22;
    for (const line of wrapText(
      "The pace sets how hard you push the team and the party each day. Faster miles cost health, and the team notices.",
      46,
    )) {
      screen.text(20, y, line, C.WHITE);
      y += CELL_H;
    }
    screen.text(20, 54, `You are currently travelling at ${PACE_INFO[g.pace].name}.`, C.BRIGHTCYAN);
    this.menu.draw({ x: 40, y: 76, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 14, noteY: 122, noteWidth: 280 });
    screen.textCentered(SCREEN_W / 2, 156, `about ${Math.round(milesPerDay(g))} miles a day at present`, C.BROWN);
    footer("choose a pace");
  }
}

export class RationsScene implements Scene {
  readonly name = "rations";
  private order: Rations[] = ["filling", "meager", "bare"];
  private menu: Menu;

  constructor(private onChange: () => void) {
    this.menu = new Menu(this.order.map((rr) => ({ label: RATION_INFO[rr].name, note: RATION_INFO[rr].desc })));
    this.menu.index = this.order.indexOf(session.current.rations);
  }

  update(): void {
    const picked = this.menu.update();
    if (picked !== null) {
      session.current.rations = this.order[picked]!;
      this.onChange();
      scenes.pop();
      return;
    }
    if (input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  draw(): void {
    const g = session.current;
    screenFrame("CHANGE FOOD RATIONS");
    let y = 22;
    for (const line of wrapText(
      "Rations decide how much food each pony eats a day. Thin rations stretch the baskets and wear everypony down.",
      46,
    )) {
      screen.text(20, y, line, C.WHITE);
      y += CELL_H;
    }
    this.menu.draw({ x: 40, y: 62, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 14, noteY: 108, noteWidth: 280 });
    const need = dailyFoodNeed(g);
    screen.textCentered(SCREEN_W / 2, 142, `at present the party eats ${need.toFixed(1)} baskets a day`, C.BROWN);
    screen.textCentered(
      SCREEN_W / 2,
      152,
      `${g.team} in the team eat ${(g.team * 0.5).toFixed(1)} of that`,
      C.DARKGREY,
    );
    footer("choose your rations");
  }
}

// ---------------------------------------------------------------------------

export class PartyScene implements Scene {
  readonly name = "party";
  private frame = 0;
  private index = 0;

  constructor(private onChange: () => void) {}

  update(dt: number): void {
    this.frame += dt * 60;
    const g = session.current;
    if (input.pressed("ArrowDown")) {
      this.index = Math.min(g.ponies.length - 1, this.index + 1);
      audio.sfx("move");
    }
    if (input.pressed("ArrowUp")) {
      this.index = Math.max(0, this.index - 1);
      audio.sfx("move");
    }
    if (input.pressed("p")) {
      const pony = g.ponies[this.index];
      if (pony?.alive && g.potions > 0) {
        usePotion(g, pony);
        audio.sfx("fanfare");
        this.onChange();
      } else {
        audio.sfx("back");
      }
    }
    if (input.confirm() || input.pressed("Enter") || input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  draw(): void {
    const g = session.current;
    screenFrame("YOUR PARTY");
    screen.textCentered(
      SCREEN_W / 2,
      17,
      `the party is in ${healthLabel(partyHealth(g))} health`,
      healthColor(partyHealth(g)),
    );
    g.ponies.forEach((p, i) => {
      const y = 30 + i * 30;
      const selected = i === this.index;
      panel(14, y, SCREEN_W - 28, 27, { fill: selected ? C.BLUE : C.BLACK, border: selected ? C.WHITE : C.DARKGREY });
      const kind = p.isMaster
        ? g.origin === "unicorn"
          ? "horned"
          : g.origin === "pegasus"
            ? "winged"
            : "plain"
        : "plain";
      if (p.alive) drawPony(20, y + 24, i, kind, { bob: selected ? Math.floor(Math.sin(this.frame * 0.15) * 1.2) : 0 });
      else screen.text(24, y + 10, "\u0006", C.DARKGREY);
      screen.text(46, y + 4, p.name, p.alive ? C.WHITE : C.DARKGREY);
      if (p.isMaster) screen.text(46 + p.name.length * 6 + 6, y + 4, "(wagon master)", C.BROWN);
      if (!p.alive) {
        screen.text(46, y + 15, `passed on: ${p.causeOfDeath ?? "the trail"}`, C.DARKGREY);
      } else {
        gauge(46, y + 15, 90, p.health / 100, healthColor(p.health));
        screen.text(144, y + 15, healthLabel(p.health), healthColor(p.health));
        const ail = ailmentById(p.ailment);
        if (ail) screen.textRight(SCREEN_W - 20, y + 15, ail.name, C.BRIGHTRED);
        else screen.textRight(SCREEN_W - 20, y + 15, "well", C.BRIGHTGREEN);
      }
    });
    footer(g.potions > 0 ? "P for a potion  \u0006  SPACE BAR to go back" : "press SPACE BAR to go back");
  }
}

export class PotionScene implements Scene {
  readonly name = "potion";
  transparent = true;

  constructor(private onChange: () => void) {}

  enter(): void {
    const g = session.current;
    const targets = livingPonies(g);
    if (g.potions <= 0 || targets.length === 0) {
      scenes.pop();
      return;
    }
    const labels = targets.map((p) => {
      const ail = ailmentById(p.ailment);
      return `${p.name} - ${ail ? ail.name : `${healthLabel(p.health)} health`}`;
    });
    labels.push("Never mind");
    askChoice("Use a healing potion", `You have ${g.potions}. Who needs it?`, labels, (i) => {
      scenes.pop();
      if (i < targets.length) {
        const pony = targets[i]!;
        usePotion(g, pony);
        this.onChange();
        showPages([{ title: "Healing potion", text: `${pony.name} drinks it down and looks a great deal better.`, sfx: "fanfare" }]);
      }
    });
  }

  update(): void {
    /* the choice dialog does the work */
  }

  draw(): void {
    /* nothing of its own */
  }
}

// ---------------------------------------------------------------------------

export class RestScene implements Scene {
  readonly name = "rest";
  private menu = new Menu([
    { label: "Rest 1 day" },
    { label: "Rest 2 days" },
    { label: "Rest 3 days" },
    { label: "Rest 5 days" },
    { label: "Rest until somepony is well" },
    { label: "Never mind" },
  ]);

  update(): void {
    const picked = this.menu.update();
    if (picked === null) {
      if (input.cancel()) {
        audio.sfx("back");
        scenes.pop();
      }
      return;
    }
    const g = session.current;
    const days = [1, 2, 3, 5][picked];
    if (picked === 5) {
      scenes.pop();
      return;
    }
    let rested = 0;
    const messages: string[] = [];
    if (days !== undefined) {
      messages.push(...passDays(g, days, { resting: true }));
      rested = days;
    } else {
      // Rest until the party is healthy or two weeks pass.
      while (rested < 14) {
        messages.push(...passDays(g, 1, { resting: true }));
        rested++;
        if (g.food <= 0) break;
        if (livingPonies(g).every((p) => !p.ailment && p.health > 78)) break;
      }
    }
    scenes.pop();
    showPages([
      {
        title: "Resting",
        text: `You make camp for ${rested} ${rested === 1 ? "day" : "days"}. It is now ${formatDate(g.date)}, and the party is in ${healthLabel(partyHealth(g))} health.`,
        sfx: "day",
      },
      ...messages.map((m) => ({ text: m, sfx: "bad" as const })),
    ]);
  }

  draw(): void {
    const g = session.current;
    screenFrame("REST A WHILE");
    let y = 22;
    for (const line of wrapText(
      "Resting mends ponies and settles the team, but the calendar keeps turning and the food keeps going.",
      46,
    )) {
      screen.text(20, y, line, C.WHITE);
      y += CELL_H;
    }
    screen.text(20, 48, `Food: ${Math.round(g.food)} baskets (${dailyFoodNeed(g).toFixed(1)} a day)`, C.BRIGHTCYAN);
    screen.text(20, 58, `Party health: ${healthLabel(partyHealth(g))}`, healthColor(partyHealth(g)));
    const sick = livingPonies(g).filter((p) => p.ailment);
    if (sick.length) {
      screen.text(20, 68, `Ailing: ${sick.map((p) => p.name).join(", ")}`.slice(0, 50), C.BRIGHTRED);
    }
    this.menu.draw({ x: 46, y: 86, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 12 });
    footer("how long will you rest?");
  }
}

// ---------------------------------------------------------------------------

export class SaveScene implements Scene {
  readonly name = "save";
  private menu = new Menu([]);

  enter(): void {
    this.refresh();
  }

  private refresh(): void {
    const items = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const s = summarise(i);
      items.push({
        label: `Save to slot ${i}`,
        detail: s.empty ? "empty" : `${s.master}, ${s.miles} mi`,
      });
    }
    items.push({ label: "Quit to the title screen" });
    items.push({ label: "Never mind" });
    this.menu.setItems(items);
  }

  update(): void {
    const picked = this.menu.update();
    if (picked === null) {
      if (input.cancel()) {
        audio.sfx("back");
        scenes.pop();
      }
      return;
    }
    if (picked < SAVE_SLOTS) {
      const ok = saveGame(picked + 1, session.current);
      this.refresh();
      showPages([
        {
          title: ok ? "Journey saved" : "Could not save",
          text: ok
            ? `Your journey is written down in slot ${picked + 1}. You can pick it up from the title screen.`
            : "Something went wrong writing the save. Your browser may be blocking storage.",
          sfx: ok ? "coin" : "bad",
        },
      ]);
      return;
    }
    if (picked === SAVE_SLOTS) {
      askChoice(
        "Quit to title",
        "Leave this journey? Anything since your last save will be lost.",
        ["Quit to the title screen", "Keep travelling"],
        (i) => {
          if (i === 0) returnToTitle();
        },
      );
      return;
    }
    scenes.pop();
  }

  draw(): void {
    const g = session.current;
    screenFrame("SAVE OR QUIT");
    screen.textCentered(SCREEN_W / 2, 20, `${formatDate(g.date)} - ${Math.round(g.miles)} miles from Pioneer's Bluff`, C.BRIGHTCYAN);
    this.menu.draw({ x: 40, y: 44, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 14, width: 230, detailColor: C.BROWN });
    let y = 122;
    for (const line of wrapText(
      "Saving keeps everything: your party, your supplies, the day and the mile. The trail is long; there is no shame in stopping for the night.",
      46,
    )) {
      screen.text(20, y, line, C.GREY);
      y += CELL_H;
    }
    footer("choose an option");
  }
}

/** Used by the party screen and elsewhere to describe a pony in one line. */
export function ponySummary(p: PonyState): string {
  if (!p.alive) return `${p.name} - passed on`;
  const ail = ailmentById(p.ailment);
  return `${p.name} - ${ail ? ail.name : healthLabel(p.health)}`;
}

export function partyNeedsAttention(g: GameState): boolean {
  return livingPonies(g).some((p) => p.health < 30 || p.ailment);
}
