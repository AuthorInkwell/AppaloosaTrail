/** Title screen and everything before the wagon rolls: origin, names, month. */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { rng } from "../../engine/rng";
import { Scene, scenes } from "../../engine/scene";
import { C, CELL_H, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { COLS, Menu, TextField, blink, footer, panel, screenFrame, wrapText } from "../../engine/ui";
import {
  drawCloud,
  drawGroundDetail,
  drawHillBand,
  drawMountains,
  drawSky,
  drawSun,
  drawTree,
  skyPalette,
} from "../../art/scenery";
import { drawPony, drawRig } from "../../art/wagon";
import { TITLE_THEME } from "../data/music";
import { randomPartyNames, randomPonyName } from "../data/names";
import { TOTAL_MILES, TRAIL } from "../data/trail";
import { session } from "../session";
import { GameState, MONTH_NAMES, ORIGINS, Origin, createGame } from "../state";
import { HofEntry, loadHallOfFame } from "../systems/score";
import { SAVE_SLOTS, SaveSummary, loadGame, summarise } from "../systems/save";
import { StoreScene } from "./store";
import { TravelScene } from "./travel";
import { showPages } from "./common";

export const PARTY_SIZE = 5;

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export class TitleScene implements Scene {
  readonly name = "title";
  private frame = 0;
  private menu = new Menu([
    { label: "Travel the trail" },
    { label: "Continue a saved journey" },
    { label: "Learn about the trail" },
    { label: "See the Appaloosa Hall of Fame" },
    { label: "Turn sound off" },
    { label: "About this game" },
  ]);

  enter(): void {
    audio.playSong(TITLE_THEME);
    this.refreshSoundLabel();
  }

  private refreshSoundLabel(): void {
    this.menu.items[4] = { label: audio.muted ? "Turn sound on" : "Turn sound off" };
  }

  update(dt: number): void {
    this.frame += dt * 60;
    const picked = this.menu.update();
    if (picked === null) return;
    switch (picked) {
      case 0:
        scenes.push(new OriginScene());
        break;
      case 1:
        scenes.push(new LoadScene());
        break;
      case 2:
        scenes.push(new InstructionsScene());
        break;
      case 3:
        scenes.push(new HallOfFameScene());
        break;
      case 4:
        audio.toggleMute();
        this.refreshSoundLabel();
        break;
      case 5:
        scenes.push(new AboutScene());
        break;
    }
  }

  draw(): void {
    const pal = skyPalette("plains");
    screen.clear(C.BLACK);
    drawSky(0, 82, pal);
    drawSun(268, 24);
    drawCloud(60, 22, 40);
    drawCloud(160, 14, 28);
    drawMountains(80, this.frame * 0.06, C.BLUE, C.WHITE, 52, 40);
    drawHillBand(74, this.frame * 0.12, C.GREEN, 78, 14);
    screen.rect(0, 82, SCREEN_W, 20, pal.ground);
    screen.hline(0, 82, SCREEN_W, C.GREEN);
    drawGroundDetail(86, 14, this.frame * 0.5, pal, 30);

    const rigX = SCREEN_W - 40 - ((this.frame * 0.35) % (SCREEN_W + 180));
    drawRig(rigX, 98, 4, this.frame);
    drawTree(Math.floor(300 - ((this.frame * 0.5) % 420)), 100, 0.8);

    // Title
    screen.rect(0, 8, SCREEN_W, 30, C.BLACK);
    screen.hline(0, 8, SCREEN_W, C.BROWN);
    screen.hline(0, 37, SCREEN_W, C.BROWN);
    screen.textCenteredShadow(SCREEN_W / 2, 12, "THE APPALOOSA TRAIL", C.YELLOW, C.BROWN, 2);
    screen.textCentered(SCREEN_W / 2, 29, "an Equestrian homage to The Oregon Trail", C.BRIGHTCYAN);

    // Menu
    panel(28, 104, SCREEN_W - 56, 74, { fill: C.BLACK, border: C.GREY, double: true });
    screen.textCentered(SCREEN_W / 2, 108, "You may:", C.CYAN);
    this.menu.draw({ x: 48, y: 120, cursorColor: C.WHITE, color: C.GREY, lineHeight: 9 });

    screen.textCentered(SCREEN_W / 2, SCREEN_H - 16, "A fan tribute. My Little Pony is the property of Hasbro.", C.DARKGREY);
    if (blink(1100, 0.5)) {
      screen.textCentered(SCREEN_W / 2, SCREEN_H - 8, "press a number, or arrow keys and RETURN", C.BROWN);
    }
  }
}

// ---------------------------------------------------------------------------
// Paged text screens
// ---------------------------------------------------------------------------

export class TextScreen implements Scene {
  readonly name = "text";
  private page = 0;

  constructor(
    private title: string,
    private pages: string[],
    private onDone?: () => void,
  ) {}

  update(): void {
    if (input.confirm() || input.pressed("Enter")) {
      audio.sfx("select");
      this.page++;
      if (this.page >= this.pages.length) {
        scenes.pop();
        this.onDone?.();
      }
    } else if (input.cancel()) {
      audio.sfx("back");
      scenes.pop();
      this.onDone?.();
    }
  }

  draw(): void {
    screenFrame(this.title);
    const lines = wrapText(this.pages[Math.min(this.page, this.pages.length - 1)] ?? "", COLS - 6);
    let y = 22;
    for (const line of lines) {
      screen.text(14, y, line, line.startsWith("  ") ? C.BRIGHTCYAN : C.WHITE);
      y += CELL_H + 1;
    }
    if (this.pages.length > 1) {
      screen.textRight(SCREEN_W - 12, SCREEN_H - 20, `page ${this.page + 1} of ${this.pages.length}`, C.DARKGREY);
    }
    footer(this.page < this.pages.length - 1 ? "press SPACE BAR for more" : "press SPACE BAR to go back");
  }
}

export class InstructionsScene extends TextScreen {
  constructor() {
    super("LEARN ABOUT THE TRAIL", [
      [
        "In the spring of 1002, ponies gathered at Pioneer's Bluff to make the long haul west to Appaloosa: a raw new town with good soil and room for a great many apple trees.",
        "",
        "You are the Wagon Master. Four other ponies travel with you. Between you and Appaloosa lie 1,712 miles of trail, several rivers, one very old forest, and a great deal of weather.",
        "",
        "  Your job is to get at least one pony there alive.",
      ].join("\n"),
      [
        "THE WAGON TEAM",
        "",
        "Your wagon is pulled by a hired team of strong, hatted, opinionated draft folk. The bigger the team, the faster you travel, and the more mouths you feed.",
        "",
        "Treat them badly, run out of food, or push a grueling pace for weeks, and members will quit and walk home. If every one of them leaves, your ponies must pull the wagon themselves, at a crawl.",
      ].join("\n"),
      [
        "ON THE TRAIL",
        "",
        "  \u0004 Press SPACE BAR while travelling to size up the situation. Nothing moves while you think.",
        "  \u0004 Set your pace and your rations to suit the season and the state of the party.",
        "  \u0004 Forage for food rather than buying it, when bits are short.",
        "  \u0004 Rest when ponies are ailing. Potions cure outright, and one is used automatically if a pony is at death's door.",
        "  \u0004 Save your journey from the same menu.",
      ].join("\n"),
      [
        "WATER AND WOODS",
        "",
        "Rivers can be forded, floated, ferried, flown across by hired pegasi, or - if your wagon master is a unicorn - simply lifted over. Choose by depth, by current, and by what you can afford.",
        "",
        "Before Appaloosa the trail forks: the Bamboozle Toll Road, safe and expensive, or the southern tip of the Everfree Forest, fast and frightening.",
        "",
        "  Good luck. Watch your food.",
      ].join("\n"),
    ]);
  }
}

export class AboutScene extends TextScreen {
  constructor() {
    super("ABOUT THIS GAME", [
      [
        "THE APPALOOSA TRAIL",
        "",
        "A fan-made tribute to MECC's The Oregon Trail, retold in the world of My Little Pony: Friendship is Magic.",
        "",
        "Everything on screen is drawn at 320x200 in sixteen colours, with a hand-built 5x7 font and square-wave music, in the spirit of the 1990 original.",
        "",
        "My Little Pony is the property of Hasbro. The Oregon Trail is the property of its rights holders. This is an unofficial, non-commercial fan work.",
      ].join("\n"),
      [
        "CONTROLS",
        "",
        "  \u0004 Number keys pick menu items.",
        "  \u0004 Arrow keys and RETURN also work.",
        "  \u0004 SPACE BAR continues, and sizes up the situation while travelling.",
        "  \u0004 In the store: arrows to choose, left/right to change amounts, RETURN to buy.",
        "  \u0004 M toggles sound. F toggles fullscreen.",
        "  \u0004 ESC backs out of most screens.",
      ].join("\n"),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Hall of Fame
// ---------------------------------------------------------------------------

export class HallOfFameScene implements Scene {
  readonly name = "hof";
  private entries: HofEntry[] = [];

  constructor(private highlight = -1) {}

  enter(): void {
    this.entries = loadHallOfFame();
  }

  update(): void {
    if (input.confirm() || input.pressed("Enter") || input.cancel()) {
      audio.sfx("select");
      scenes.pop();
    }
  }

  draw(): void {
    screenFrame("THE APPALOOSA HALL OF FAME");
    screen.textCentered(SCREEN_W / 2, 18, "Wagon Masters who made it west", C.CYAN);
    screen.text(14, 32, "RANK  WAGON MASTER      ORIGIN      DAYS  SCORE", C.BROWN);
    screen.hline(14, 40, SCREEN_W - 28, C.DARKGREY);
    this.entries.forEach((e, i) => {
      const y = 44 + i * 12;
      const ink = i === this.highlight ? C.YELLOW : C.WHITE;
      if (i === this.highlight && blink(500, 0.7)) screen.rect(10, y - 2, SCREEN_W - 20, 11, C.BLUE);
      screen.text(20, y, `${i + 1}.`, C.GREY);
      screen.text(50, y, e.name.slice(0, 16), ink);
      screen.text(158, y, e.origin.slice(0, 11), C.BRIGHTCYAN);
      screen.textRight(258, y, String(e.days), C.GREY);
      screen.textRight(SCREEN_W - 22, y, String(e.score), ink);
    });
    footer("press SPACE BAR to go back");
  }
}

// ---------------------------------------------------------------------------
// Load a saved journey
// ---------------------------------------------------------------------------

export class LoadScene implements Scene {
  readonly name = "load";
  private menu = new Menu([]);
  private summaries: SaveSummary[] = [];

  enter(): void {
    this.summaries = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) this.summaries.push(summarise(i));
    this.menu.setItems([
      ...this.summaries.map((s) => ({
        label: s.empty ? `Slot ${s.slot}: - empty -` : `Slot ${s.slot}: ${s.master}`,
        detail: s.empty ? "" : `${Math.round(s.miles)} mi`,
        disabled: s.empty,
      })),
      { label: "Never mind" },
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
    if (picked >= SAVE_SLOTS) {
      scenes.pop();
      return;
    }
    const g = loadGame(picked + 1);
    if (!g) {
      audio.sfx("back");
      return;
    }
    session.start(g);
    audio.stopMusic();
    scenes.reset(new TravelScene());
  }

  draw(): void {
    screenFrame("CONTINUE A SAVED JOURNEY");
    let y = 26;
    this.summaries.forEach((s) => {
      panel(20, y, SCREEN_W - 40, 34, { fill: s.empty ? C.BLACK : C.BLUE, border: C.GREY });
      screen.text(28, y + 5, `SLOT ${s.slot}`, C.YELLOW);
      if (s.empty) {
        screen.text(76, y + 5, "- empty -", C.DARKGREY);
      } else {
        screen.text(76, y + 5, s.master, C.WHITE);
        const info = ORIGINS[s.origin as Origin];
        screen.text(28, y + 16, info ? `${info.name} of ${info.home}` : s.origin, C.BRIGHTCYAN);
        screen.textRight(SCREEN_W - 28, y + 5, s.date, C.WHITE);
        screen.textRight(SCREEN_W - 28, y + 16, `${s.miles} of ${TOTAL_MILES} miles`, C.GREY);
        screen.text(28, y + 25, `${s.survivors} ponies still travelling`, C.GREY);
        if (s.savedAt) screen.textRight(SCREEN_W - 28, y + 25, `saved ${s.savedAt}`, C.DARKGREY);
      }
      y += 38;
    });
    this.menu.draw({ x: 30, y: 148, color: C.GREY, cursorColor: C.WHITE, lineHeight: 10 });
    footer("choose a slot, or ESC to go back");
  }
}

// ---------------------------------------------------------------------------
// Origin
// ---------------------------------------------------------------------------

const ORIGIN_ORDER: Origin[] = ["unicorn", "pegasus", "earth"];

export class OriginScene implements Scene {
  readonly name = "origin";
  private frame = 0;
  private menu = new Menu(
    ORIGIN_ORDER.map((id) => ({
      label: `${ORIGINS[id].name} from ${ORIGINS[id].home}`,
    })),
  );

  update(dt: number): void {
    this.frame += dt * 60;
    const picked = this.menu.update();
    if (picked !== null) {
      scenes.swap(new NamingScene(ORIGIN_ORDER[picked]!));
      return;
    }
    if (input.cancel()) {
      audio.sfx("back");
      scenes.pop();
    }
  }

  draw(): void {
    screenFrame("WHO IS YOUR WAGON MASTER?");
    const lines = wrapText(
      "Many kinds of pony came to Pioneer's Bluff to head west. What your wagon master brings with them shapes the whole journey.",
      COLS - 8,
    );
    let y = 18;
    for (const l of lines) {
      screen.text(16, y, l, C.WHITE);
      y += CELL_H;
    }

    this.menu.draw({ x: 26, y: 46, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 11 });

    const id = ORIGIN_ORDER[this.menu.index]!;
    const info = ORIGINS[id];
    panel(16, 86, SCREEN_W - 32, 92, { fill: C.BLACK, border: C.GREY, double: true });
    const kind = id === "unicorn" ? "horned" : id === "pegasus" ? "winged" : "plain";
    drawPony(24, 132, id === "earth" ? 5 : id === "pegasus" ? 1 : 3, kind, {
      bob: Math.floor(Math.sin(this.frame * 0.1) * 1.5),
    });
    screen.text(72, 92, `${info.name.toUpperCase()} OF ${info.home.toUpperCase()}`, C.YELLOW);
    const blurb = wrapText(info.blurb, 38);
    let by = 102;
    for (const l of blurb) {
      screen.text(72, by, l, C.WHITE);
      by += CELL_H;
    }
    by += 2;
    for (const perk of info.perks) {
      screen.text(24, by, `\u0004 ${perk}`, C.BRIGHTGREEN);
      by += CELL_H;
    }
    footer("choose a wagon master");
  }
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

export class NamingScene implements Scene {
  readonly name = "naming";
  capturesText = true;
  private fields: TextField[] = [];
  private index = 0;
  private frame = 0;

  constructor(private origin: Origin) {
    for (let i = 0; i < PARTY_SIZE; i++) this.fields.push(new TextField(14));
  }

  private randomise(): void {
    const names = randomPartyNames(PARTY_SIZE, rng);
    this.fields.forEach((f, i) => (f.value = names[i] ?? randomPonyName(rng)));
    audio.sfx("pickup");
  }

  private done(): void {
    const names = this.fields.map((f) => f.value.trim()).filter((n) => n.length > 0);
    while (names.length < PARTY_SIZE) names.push(randomPonyName(rng));
    const g = createGame(this.origin, names, rng.int(1, 0x7fffffff));
    session.start(g);
    scenes.swap(new DepartureScene(g));
  }

  update(dt: number): void {
    this.frame += dt * 60;
    if (input.pressed("Tab")) {
      this.index = (this.index + 1) % this.fields.length;
      audio.sfx("move");
      return;
    }
    if (input.pressed("ArrowDown")) {
      this.index = Math.min(this.fields.length - 1, this.index + 1);
      audio.sfx("move");
      return;
    }
    if (input.pressed("ArrowUp")) {
      this.index = Math.max(0, this.index - 1);
      audio.sfx("move");
      return;
    }
    if (input.pressed("F2")) {
      this.randomise();
      return;
    }
    if (input.cancel()) {
      audio.sfx("back");
      scenes.swap(new OriginScene());
      return;
    }
    const field = this.fields[this.index]!;
    const submitted = field.update({ allowEmpty: true });
    if (submitted) {
      // An empty field gets a name of its own rather than blocking the player.
      if (field.value.trim().length === 0) field.value = randomPonyName(rng);
      if (this.index < this.fields.length - 1) this.index++;
      else if (this.fields.every((f) => f.value.trim().length > 0)) this.done();
    }
    if (input.pressed("F3") && this.fields.every((f) => f.value.trim().length > 0)) this.done();
  }

  draw(): void {
    screenFrame("NAME YOUR PARTY");
    screen.textCentered(SCREEN_W / 2, 17, `${ORIGINS[this.origin].name} of ${ORIGINS[this.origin].home}`, C.BRIGHTCYAN);
    screen.textCentered(SCREEN_W / 2, 27, "Type a name and press RETURN. F2 rolls new names.", C.GREY);

    this.fields.forEach((f, i) => {
      const y = 44 + i * 20;
      const active = i === this.index;
      const label = i === 0 ? "Wagon Master" : `Party member ${i}`;
      screen.text(24, y, label, active ? C.YELLOW : C.CYAN);
      f.draw(118, y, 14, active ? C.WHITE : C.GREY, active);
      const kind = i === 0 ? (this.origin === "unicorn" ? "horned" : this.origin === "pegasus" ? "winged" : "plain") : "plain";
      drawPony(
        SCREEN_W - 46,
        y + 15,
        i,
        kind,
        { bob: active ? Math.floor(Math.sin(this.frame * 0.16) * 1.5) : 0 },
      );
    });

    const ready = this.fields.every((f) => f.value.trim().length > 0);
    footer(ready ? "F3 or RETURN on the last name to set out" : "every pony needs a name");
  }
}

// ---------------------------------------------------------------------------
// Departure month
// ---------------------------------------------------------------------------

interface MonthOption {
  month: number;
  hint: string;
  detail: string;
}

const MONTH_OPTIONS: MonthOption[] = [
  {
    month: 3,
    hint: "cold and muddy, but a long season ahead",
    detail: "Rivers run high with snowmelt and the grass is thin, but you will be well clear of winter at the far end.",
  },
  {
    month: 4,
    hint: "the usual choice",
    detail: "Mud is drying, grass is coming in, and there is time enough to reach Appaloosa before the cold.",
  },
  {
    month: 5,
    hint: "good grass, gentle weather",
    detail: "The best travelling weather of the year, and plenty of grazing for the team.",
  },
  {
    month: 6,
    hint: "hot going, less time in hand",
    detail: "You will cross the desert stretch at its worst, and any delay pushes your arrival toward winter.",
  },
  {
    month: 7,
    hint: "late, hot, and risky",
    detail: "A late start means desert heat now and a real chance of snow in the mountains before you arrive.",
  },
];

export class DepartureScene implements Scene {
  readonly name = "departure";
  private menu = new Menu(
    MONTH_OPTIONS.map((o) => ({ label: MONTH_NAMES[o.month - 1]!, detail: o.hint })),
  );

  constructor(private g: GameState) {}

  update(): void {
    const picked = this.menu.update();
    if (picked !== null) {
      const opt = MONTH_OPTIONS[picked]!;
      this.g.date = { year: 1002, month: opt.month, day: 1 };
      const first = TRAIL[0]!;
      scenes.swap(
        new StoreScene(this.g, first, {
          intro: true,
          onDone: () => scenes.reset(new TravelScene()),
        }),
      );
    }
  }

  draw(): void {
    screenFrame("WHEN WILL YOU SET OUT?");
    const lines = wrapText(
      "It is 1002. Wagons are leaving Pioneer's Bluff from March onward. Leave too early and the grass has not come in; leave too late and winter will be waiting for you in the western mountains.",
      COLS - 8,
    );
    let y = 18;
    for (const l of lines) {
      screen.text(16, y, l, C.WHITE);
      y += CELL_H;
    }
    this.menu.draw({ x: 40, y: 62, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 13, width: 230 });

    const opt = MONTH_OPTIONS[this.menu.index]!;
    panel(16, 132, SCREEN_W - 32, 44, { fill: C.BLUE, border: C.GREY });
    screen.text(24, 137, `LEAVING IN ${MONTH_NAMES[opt.month - 1]!.toUpperCase()}`, C.YELLOW);
    let dy = 149;
    for (const l of wrapText(opt.detail, 48)) {
      screen.text(24, dy, l, C.WHITE);
      dy += CELL_H;
    }
    footer("choose a month");
  }
}

/** Shown once, right before the first store visit. */
export function showOutfittingIntro(onDone: () => void): void {
  showPages(
    [
      {
        title: "Pioneer's Bluff",
        text:
          "Before you set out, you will need to outfit your wagon. Hire your Wagon Team, buy food by the basketful, and lay in spares for what the trail will break.",
      },
      {
        title: "A word of advice",
        text:
          "Somepony's grandmother is standing outside the store telling everypony the same thing: four hundred baskets of food, six in the team, and one spare of everything. Nopony has ever regretted listening to her.",
      },
    ],
    onDone,
  );
}
