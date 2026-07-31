/**
 * The last stretch: the Parting of Ways, the Bamboozle Toll Road, the Everfree
 * shortcut minigame, and arrival at Appaloosa with scoring.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, Color, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { Menu, blink, footer, gauge, panel, screenFrame, wrapText } from "../../engine/ui";
import { TIMBERWOLF } from "../../art/sprites";
import { drawBush, drawPine, drawRock, hash01 } from "../../art/scenery";
import { drawVista } from "../../art/vistas";
import { drawPony, drawRig } from "../../art/wagon";
import { EVERFREE_THEME, VICTORY_THEME } from "../data/music";
import { EVERFREE_SHORTCUT_MILES, Landmark, TOLL_ROAD_COST, TOTAL_MILES } from "../data/trail";
import { session } from "../session";
import { GameState, ORIGINS, formatDate, healthLabel, livingPonies, log, partyHealth, spend } from "../state";
import { changeMood, damageParty, loseTeam, takeFood } from "../systems/effects";
import { passDays } from "../systems/travel";
import { ScoreReport, scoreRun, submitScore } from "../systems/score";
import { HofEntry } from "../systems/score";
import { showPages } from "./common";
import { returnToTitle } from "./eventrunner";
import { SizeUpScene } from "./menus";

// ---------------------------------------------------------------------------
// The Parting of Ways
// ---------------------------------------------------------------------------

export class ForkScene implements Scene {
  readonly name = "fork";
  private frame = 0;
  private menu = new Menu([]);

  constructor(
    private g: GameState,
    private landmark: Landmark,
    private onDone: () => void,
  ) {}

  enter(): void {
    this.refresh();
    if (!this.g.flags[`arrived:${this.landmark.id}`]) {
      this.g.flags[`arrived:${this.landmark.id}`] = true;
      log(this.g, "Reached the Parting of Ways.");
      showPages([
        { title: "The Parting of Ways", text: this.landmark.blurb, sfx: "day" },
        {
          title: "Two roads",
          text: `Appaloosa is ${Math.round(TOTAL_MILES - this.g.miles)} miles away. The Bamboozle Toll Road runs smooth and safe for ${TOLL_ROAD_COST} bits. The Everfree track saves ${EVERFREE_SHORTCUT_MILES} miles and costs nothing but nerve.`,
        },
      ]);
    }
  }

  private refresh(): void {
    const g = this.g;
    const items = [
      {
        label: `Take the Bamboozle Toll Road (${TOLL_ROAD_COST} bits)`,
        note: "Graded, drained, and patrolled. Orders of magnitude safer, and a little slower.",
        disabled: g.bits < TOLL_ROAD_COST,
      },
      {
        label: "Cut through the Everfree Forest",
        note: `Saves ${EVERFREE_SHORTCUT_MILES} miles and every bit in your purse. You will have to drive it yourself.`,
      },
      { label: "Haggle with the toll keepers", note: "They are Flim-Flam blood. Haggling is practically a greeting." },
      { label: "Size up the situation", note: "Check the party before you decide." },
    ];
    this.menu.setItems(items);
  }

  private takeToll(discount = 0): void {
    const g = this.g;
    const cost = Math.max(0, TOLL_ROAD_COST - discount);
    spend(g, cost);
    g.route = "toll";
    g.flags["toll-road"] = true;
    log(g, `Paid ${cost} bits for the Bamboozle Toll Road.`);
    const messages = passDays(g, 1);
    scenes.pop();
    showPages(
      [
        {
          title: "The Bamboozle Toll Road",
          text: `Two identical stallions in identical straw boaters take your ${cost} bits, raise the gate, and wish you a pleasant journey in perfect unison.`,
          sfx: "coin",
        },
        {
          title: "A smooth road",
          text: "The road is genuinely excellent. Graded, drained, gravelled and dull. You make good time and nothing at all happens, which is the entire point.",
        },
        ...messages.map((m) => ({ text: m, sfx: "bad" as const })),
      ],
      this.onDone,
    );
  }

  update(dt: number): void {
    this.frame += dt * 60;
    const picked = this.menu.update();
    if (picked === null) return;
    const g = this.g;
    switch (picked) {
      case 0:
        this.takeToll();
        break;
      case 1:
        scenes.pop();
        scenes.push(new EverfreeScene(g, this.onDone));
        break;
      case 2: {
        const r = session.rng;
        if (r.chance(0.4)) {
          const discount = r.int(25, 60);
          showPages([
            {
              title: "Haggling",
              text: `After ten minutes of extremely enthusiastic salesmanship in two-part harmony, the brothers knock ${discount} bits off "for a friend of the family".`,
              sfx: "coin",
            },
          ]);
          this.menu.setItems([
            {
              label: `Take the Toll Road (${Math.max(0, TOLL_ROAD_COST - discount)} bits)`,
              note: "The haggled price. Take it before they change their minds.",
              disabled: g.bits < TOLL_ROAD_COST - discount,
            },
            ...this.menu.items.slice(1),
          ]);
          this.menu.items[2] = { label: "You have already haggled", disabled: true };
          this.haggleDiscount = discount;
        } else {
          showPages([
            {
              title: "Haggling",
              text: '"The price is the price, friend! You will find no fairer road in Equestria, nor any road at all for forty miles!" They are, annoyingly, correct.',
              sfx: "back",
            },
          ]);
          this.menu.items[2] = { label: "You have already haggled", disabled: true };
        }
        break;
      }
      case 3:
        scenes.push(new SizeUpScene());
        break;
    }
    if (picked === 0 && this.haggleDiscount > 0) this.haggleDiscount = 0;
  }

  private haggleDiscount = 0;

  draw(): void {
    const g = this.g;
    screenFrame("THE PARTING OF WAYS");
    drawVista(this.landmark.id, this.landmark.terrain, { top: 12, bottom: 104, frame: this.frame, rig: g.team });
    screen.hline(0, 104, SCREEN_W, C.GREY);

    panel(4, 108, SCREEN_W - 8, 60, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(10, 112, "You may:", C.CYAN);
    this.menu.draw({
      x: 16,
      y: 124,
      color: C.GREY,
      cursorColor: C.WHITE,
      lineHeight: 10,
      width: SCREEN_W - 40,
      noteY: 174,
      noteWidth: 312,
    });
    screen.textRight(SCREEN_W - 8, 112, `${Math.round(g.bits)} bits`, C.YELLOW);
    void wrapText;
    void blink;
    void footer;
    void input;
  }
}

// ---------------------------------------------------------------------------
// The Everfree Forest
// ---------------------------------------------------------------------------

interface Hazard {
  kind: "trunk" | "rock" | "wolf" | "vine";
  x: number;
  lane: number;
  hit: boolean;
}

const LANES = 4;
const ROAD_TOP = 104;
const ROAD_BOTTOM = 156;
const EVERFREE_SECONDS = 42;

export class EverfreeScene implements Scene {
  readonly name = "everfree";
  private stage: "brief" | "run" | "out" = "brief";
  private progress = 0;
  private speed = 1;
  private lane = 1.5;
  private hazards: Hazard[] = [];
  private frame = 0;
  private hits = 0;
  private invuln = 0;
  private spawnTimer = 0;
  private scroll = 0;

  constructor(
    private g: GameState,
    private onDone: () => void,
  ) {}

  enter(): void {
    audio.playSong(EVERFREE_THEME);
    showPages(
      [
        {
          title: "The Everfree Forest",
          text: "The trees close over the track within a hundred yards. The light goes green, then grey. Something large shifts its weight somewhere off to the left.",
          sfx: "bad",
        },
        {
          title: "Driving the Everfree",
          text: "UP and DOWN steer the wagon across the track. RIGHT drives harder and faster; LEFT eases off. Keep the wagon off the trunks, rocks, vines and timberwolves.",
        },
      ],
      () => {
        this.stage = "run";
      },
    );
  }

  exit(): void {
    audio.stopMusic();
  }

  private laneY(lane: number): number {
    const t = lane / (LANES - 1);
    return ROAD_TOP + 10 + t * (ROAD_BOTTOM - ROAD_TOP - 14);
  }

  private spawn(): void {
    const r = session.rng;
    const kind = r.weighted([
      { item: "trunk" as const, weight: 30 },
      { item: "rock" as const, weight: 26 },
      { item: "wolf" as const, weight: 22 },
      { item: "vine" as const, weight: 22 },
    ]);
    const lane = r.int(0, LANES - 1);
    this.hazards.push({ kind, x: SCREEN_W + 20, lane, hit: false });
    // Occasionally a paired hazard, leaving a gap to thread.
    if (r.chance(0.35)) {
      const other = (lane + r.int(1, LANES - 1)) % LANES;
      this.hazards.push({ kind: r.chance(0.5) ? "rock" : "vine", x: SCREEN_W + 20 + r.int(6, 26), lane: other, hit: false });
    }
  }

  private hit(h: Hazard): void {
    const g = this.g;
    const r = session.rng;
    h.hit = true;
    this.hits++;
    this.invuln = 1.1;
    g.stats.everfreeHits++;
    audio.sfx("hurt");
    switch (h.kind) {
      case "trunk":
        damageParty(g, r.int(3, 7));
        takeFood(g, r.int(3, 9));
        break;
      case "rock":
        damageParty(g, r.int(2, 5));
        break;
      case "wolf":
        damageParty(g, r.int(4, 9));
        changeMood(g, -8);
        break;
      case "vine":
        takeFood(g, r.int(4, 12));
        break;
    }
    this.speed = Math.max(0.6, this.speed - 0.35);
  }

  private finish(): void {
    const g = this.g;
    g.route = "everfree";
    g.miles = Math.min(TOTAL_MILES, g.miles + EVERFREE_SHORTCUT_MILES);
    const clean = this.hits === 0;
    if (clean) g.flags["everfree-clean"] = true;
    const messages = passDays(g, 1);
    log(g, `Drove through the Everfree Forest with ${this.hits} mishaps.`);

    const pages: { title?: string; text: string; sfx?: "fanfare" | "bad" | "day" }[] = [
      {
        title: "Out the other side",
        text: clean
          ? "The trees thin, the light comes back yellow and ordinary, and the wagon rolls out onto open ground without a scratch on it. Everypony is very quiet, and then everypony talks at once."
          : this.hits <= 2
            ? "You come out the far side scratched, shaken and short a few baskets, but you come out, and you come out early."
            : "You come out the far side in a state. The bonnet is torn, the food is short, and everypony has a story they will tell for years. But you saved the miles.",
        sfx: clean ? "fanfare" : "day",
      },
      {
        title: "The shortcut",
        text: `Cutting the corner of the Everfree saved you ${EVERFREE_SHORTCUT_MILES} miles and the whole of the toll. Appaloosa is ${Math.round(TOTAL_MILES - g.miles)} miles ahead.`,
      },
    ];
    for (const m of messages) pages.push({ text: m, sfx: "bad" });

    if (this.hits >= 4 && g.team > 0 && session.rng.chance(0.4)) {
      const lost = loseTeam(g, 1);
      if (lost) pages.push({ text: "One of the team walks out of the trees, hands you the harness, and keeps walking.", sfx: "bad" });
    }

    scenes.pop();
    showPages(pages, this.onDone);
  }

  update(dt: number): void {
    this.frame += dt * 60;
    if (this.stage !== "run") return;

    const steer = input.axisY();
    this.lane = Math.max(0, Math.min(LANES - 1, this.lane + steer * dt * 4.2));
    const throttle = input.axisX();
    this.speed = Math.max(0.55, Math.min(1.85, this.speed + throttle * dt * 1.4));
    if (throttle === 0) this.speed += (1.05 - this.speed) * dt * 0.6;

    this.progress += (dt / EVERFREE_SECONDS) * this.speed;
    this.scroll += dt * 120 * this.speed;
    if (this.invuln > 0) this.invuln -= dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.35, session.rng.float(0.55, 1.15) / this.speed);
      this.spawn();
    }

    const wagonX = 60;
    for (const h of this.hazards) {
      h.x -= dt * 150 * this.speed;
      if (h.hit) continue;
      const dy = Math.abs(this.laneY(h.lane) - this.laneY(this.lane));
      if (this.invuln <= 0 && dy < 9 && h.x < wagonX + 26 && h.x > wagonX - 18) this.hit(h);
    }
    this.hazards = this.hazards.filter((h) => h.x > -40);

    if (this.progress >= 1) {
      this.stage = "out";
      this.finish();
    }
  }

  draw(): void {
    const g = this.g;
    screen.clear(C.BLACK);

    // Layered canopy, darkest and largest nearest the camera.
    const layers: { base: number; scale: number; color: Color; speed: number; step: number }[] = [
      { base: 52, scale: 0.8, color: C.BLUE, speed: 0.14, step: 22 },
      { base: 76, scale: 1.15, color: C.GREEN, speed: 0.3, step: 30 },
      { base: ROAD_TOP + 2, scale: 1.6, color: C.DARKGREY, speed: 0.6, step: 40 },
    ];
    layers.forEach((layer, li) => {
      const span = layer.step * 16;
      for (let i = 0; i < 16; i++) {
        const jitter = hash01(i, 80 + li);
        const x = Math.floor(((i * layer.step - this.scroll * layer.speed) % span + span) % span) - 20;
        drawPine(
          x + Math.floor(jitter * layer.step * 0.6),
          layer.base + Math.floor(hash01(i, 90 + li) * 6),
          layer.scale * (0.8 + jitter * 0.45),
          layer.color,
        );
      }
    });
    // Hanging growth along the top of the frame.
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(((i * 13 - this.scroll * 0.6) % 340 + 340) % 340) - 10;
      const len = 4 + Math.floor(hash01(i, 63) * 14);
      screen.rect(x, 0, 1, len, C.GREEN);
      screen.px(x, len, C.BRIGHTGREEN);
    }
    // Eyes in the dark.
    for (let i = 0; i < 8; i++) {
      if (Math.floor(this.frame / 30 + i) % 6 !== 0) continue;
      const x = Math.floor(hash01(i, 61) * SCREEN_W);
      const y = 20 + Math.floor(hash01(i, 62) * 60);
      screen.px(x, y, C.BRIGHTRED);
      screen.px(x + 3, y, C.BRIGHTRED);
    }

    // The track, with a rut down each of the four lanes.
    screen.rect(0, ROAD_TOP, SCREEN_W, ROAD_BOTTOM - ROAD_TOP + 1, C.BROWN);
    screen.hline(0, ROAD_TOP, SCREEN_W, C.DARKGREY);
    screen.hline(0, ROAD_BOTTOM, SCREEN_W, C.DARKGREY);
    for (let lane = 0; lane < LANES; lane++) {
      const ly = Math.round(this.laneY(lane)) + 3;
      for (let x = Math.floor(-this.scroll % 16); x < SCREEN_W; x += 16) {
        screen.rect(x, ly, 9, 1, C.DARKGREY);
      }
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(((i * 17 - this.scroll * 1.2) % 510 + 510) % 510) - 40;
      screen.px(x, ROAD_TOP + 3 + ((i * 11) % (ROAD_BOTTOM - ROAD_TOP - 6)), C.YELLOW);
    }

    // Hazards
    for (const h of this.hazards) {
      const y = this.laneY(h.lane);
      if (h.hit) {
        if (Math.floor(this.frame / 3) % 2 === 0) screen.text(h.x, y - 16, "!", C.YELLOW);
        continue;
      }
      switch (h.kind) {
        case "trunk":
          screen.rect(h.x, y - 12, 9, 14, C.BROWN);
          screen.rect(h.x, y - 12, 9, 2, C.DARKGREY);
          drawBush(h.x + 4, y + 3, 0.6, C.GREEN);
          break;
        case "rock":
          drawRock(h.x + 5, y + 2, 1.3, C.GREY);
          break;
        case "wolf":
          screen.sprite(TIMBERWOLF, h.x, y - 12, { remap: { "6": C.GREEN, C: C.BRIGHTRED, "8": C.BLACK } });
          break;
        case "vine":
          for (let i = 0; i < 12; i++) {
            screen.px(h.x + i, y - 6 + Math.floor(Math.sin(i * 0.9 + this.frame * 0.15) * 4), C.BRIGHTGREEN);
            screen.px(h.x + i, y - 5 + Math.floor(Math.sin(i * 0.9 + this.frame * 0.15) * 4), C.GREEN);
          }
          break;
      }
    }

    // The rig
    const y = this.laneY(this.lane);
    const flash = this.invuln > 0 && Math.floor(this.frame / 3) % 2 === 0;
    screen.ellipse(78, y + 3, 22, 2, C.DARKGREY);
    if (!flash) drawRig(60, y + 2, Math.min(3, g.team), this.frame * this.speed);

    // HUD
    panel(0, ROAD_BOTTOM + 2, SCREEN_W, SCREEN_H - ROAD_BOTTOM - 2, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(6, ROAD_BOTTOM + 6, "THROUGH THE EVERFREE", C.BRIGHTGREEN);
    gauge(6, ROAD_BOTTOM + 16, 180, this.progress, C.BRIGHTGREEN);
    screen.text(6, ROAD_BOTTOM + 26, `mishaps: ${this.hits}`, this.hits > 0 ? C.BRIGHTRED : C.GREY);
    screen.textRight(SCREEN_W - 6, ROAD_BOTTOM + 6, `speed ${this.speed.toFixed(1)}x`, C.YELLOW);
    screen.textRight(SCREEN_W - 6, ROAD_BOTTOM + 16, "\u0001\u0002 steer", C.GREY);
    screen.textRight(SCREEN_W - 6, ROAD_BOTTOM + 26, "\u0003\u0004 slow / drive on", C.GREY);
  }
}

// ---------------------------------------------------------------------------
// Arrival
// ---------------------------------------------------------------------------

export class ArrivalScene implements Scene {
  readonly name = "arrival";
  private frame = 0;
  private stage: "vista" | "score" | "hof" = "vista";
  private report: ScoreReport;
  private table: HofEntry[] = [];
  private placed = -1;
  private revealed = 0;
  private revealTimer = 0;

  constructor(
    private g: GameState,
    private landmark: Landmark,
  ) {
    this.report = scoreRun(g);
  }

  enter(): void {
    const g = this.g;
    g.finished = true;
    g.outcome = "arrived";
    g.score = this.report.total;
    log(g, "Arrived in Appaloosa!");
    audio.playSong(VICTORY_THEME);
    const survivors = livingPonies(g);
    showPages([
      {
        title: "Appaloosa!",
        text: `${formatDate(g.date)}. After ${g.day} days and ${Math.round(g.miles)} miles, your wagon rolls into Appaloosa.`,
        sfx: "fanfare",
      },
      { title: "Appaloosa", text: this.landmark.blurb },
      {
        title: "Journey's end",
        text: `${survivors.length === 1 ? `${survivors[0]!.name} arrives alone` : `${survivors.map((p) => p.name).join(", ")} arrive`} in ${healthLabel(partyHealth(g))} health, with ${Math.round(g.food)} baskets and ${Math.round(g.bits)} bits. There is a great deal of digging to do, and rather a lot of apple trees to plant.`,
      },
    ]);
  }

  exit(): void {
    audio.stopMusic();
  }

  update(dt: number): void {
    this.frame += dt * 60;
    if (this.stage === "vista") {
      if (input.confirm() || input.pressed("Enter")) {
        audio.sfx("select");
        this.stage = "score";
      }
      return;
    }
    if (this.stage === "score") {
      this.revealTimer += dt;
      if (this.revealTimer > 0.18 && this.revealed < this.report.lines.length) {
        this.revealTimer = 0;
        this.revealed++;
        audio.sfx("coin");
      }
      if (input.confirm() || input.pressed("Enter")) {
        if (this.revealed < this.report.lines.length) {
          this.revealed = this.report.lines.length;
          audio.sfx("select");
          return;
        }
        audio.sfx("fanfare");
        const result = submitScore(this.g, this.report);
        this.table = result.table;
        this.placed = result.placed;
        this.stage = "hof";
      }
      return;
    }
    if (input.confirm() || input.pressed("Enter")) {
      audio.sfx("select");
      returnToTitle();
    }
  }

  draw(): void {
    if (this.stage === "vista") this.drawVista();
    else if (this.stage === "score") this.drawScore();
    else this.drawHof();
  }

  private drawVista(): void {
    const g = this.g;
    screenFrame("APPALOOSA");
    drawVista("appaloosa", "desert", { top: 12, bottom: 120, frame: this.frame, rig: g.team });
    for (let i = 0; i < Math.min(4, livingPonies(g).length); i++) {
      drawPony(40 + i * 26, 124, i, i === 0 ? (g.origin === "unicorn" ? "horned" : g.origin === "pegasus" ? "winged" : "plain") : "plain", {
        bob: Math.floor(Math.sin(this.frame * 0.14 + i) * 1.6),
      });
    }
    screen.textCentered(SCREEN_W / 2, 132, "YOU HAVE REACHED APPALOOSA!", C.YELLOW);
    screen.textCentered(SCREEN_W / 2, 144, `${g.day} days on the trail`, C.WHITE);
    screen.textCentered(SCREEN_W / 2, 154, `${livingPonies(g).length} of ${g.ponies.length} ponies arrived`, C.BRIGHTCYAN);
    footer("press SPACE BAR to see your score");
  }

  private drawScore(): void {
    screenFrame("YOUR SCORE");
    let y = 20;
    const shown = this.report.lines.slice(0, this.revealed);
    for (const line of shown) {
      screen.text(20, y, line.label.slice(0, 18), C.WHITE);
      screen.text(140, y, line.detail.slice(0, 20), C.CYAN);
      screen.textRight(SCREEN_W - 20, y, String(line.points), C.YELLOW);
      y += 10;
    }
    if (this.revealed >= this.report.lines.length) {
      y += 4;
      screen.hline(20, y, SCREEN_W - 40, C.DARKGREY);
      y += 5;
      screen.text(20, y, "Subtotal", C.WHITE);
      screen.textRight(SCREEN_W - 20, y, String(this.report.subtotal), C.WHITE);
      y += 10;
      screen.text(20, y, `${ORIGINS[this.g.origin].name} bonus`, C.BRIGHTGREEN);
      screen.textRight(SCREEN_W - 20, y, `x${this.report.multiplier}`, C.BRIGHTGREEN);
      y += 12;
      screen.rect(16, y - 2, SCREEN_W - 32, 12, C.BLUE);
      screen.text(20, y, "TOTAL SCORE", C.YELLOW);
      screen.textRight(SCREEN_W - 20, y, String(this.report.total), C.YELLOW);
      footer("press SPACE BAR for the Hall of Fame");
    } else {
      footer("press SPACE BAR to total it up");
    }
  }

  private drawHof(): void {
    screenFrame("THE APPALOOSA HALL OF FAME");
    screen.text(14, 26, "RANK  WAGON MASTER      ORIGIN      DAYS  SCORE", C.BROWN);
    screen.hline(14, 34, SCREEN_W - 28, C.DARKGREY);
    this.table.forEach((e, i) => {
      const y = 40 + i * 13;
      const mine = i === this.placed;
      if (mine && blink(420, 0.7)) screen.rect(10, y - 2, SCREEN_W - 20, 12, C.BLUE);
      screen.text(20, y, `${i + 1}.`, C.GREY);
      screen.text(50, y, e.name.slice(0, 16), mine ? C.YELLOW : C.WHITE);
      screen.text(158, y, e.origin.slice(0, 11), C.BRIGHTCYAN);
      screen.textRight(258, y, String(e.days), C.GREY);
      screen.textRight(SCREEN_W - 22, y, String(e.score), mine ? C.YELLOW : C.WHITE);
    });
    if (this.placed < 0) {
      screen.textCentered(SCREEN_W / 2, SCREEN_H - 26, "not quite the Hall of Fame this time", C.BROWN);
    }
    footer("press SPACE BAR to return to the title");
  }
}
