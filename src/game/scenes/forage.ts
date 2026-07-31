/**
 * The foraging minigame, which stands in for the original's hunting screen.
 * You pick how long to stay out; longer gathering means less daylight left to
 * carry anything back, so the sweet spot is somewhere in the middle.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { rng } from "../../engine/rng";
import { Scene, scenes } from "../../engine/scene";
import { C, SCREEN_H, SCREEN_W, Sprite, screen, spriteSize } from "../../engine/screen";
import { Menu, blink, footer, gauge, panel, screenFrame, wrapText } from "../../engine/ui";
import { APPLE, BERRIES, BIRD_A, BIRD_B, DEER, GRASSES, NUTS } from "../../art/sprites";
import { drawBush, drawGroundDetail, drawSky, drawTree, hash01, skyPalette } from "../../art/scenery";
import { drawPony, drawWagon } from "../../art/wagon";
import { FORAGE_THEME } from "../data/music";
import { terrainAt } from "../data/trail";
import { GameState, log } from "../state";
import { passDays } from "../systems/travel";
import { Page, showPages } from "./common";

interface ForageOption {
  label: string;
  seconds: number;
  /** Maximum baskets that can be carried back before nightfall. */
  carry: number;
  note: string;
}

const OPTIONS: ForageOption[] = [
  { label: "Half an hour", seconds: 18, carry: 40, note: "Barely a detour. Plenty of daylight left for hauling." },
  { label: "One hour", seconds: 26, carry: 32, note: "A decent look around, and time enough to carry a good load." },
  { label: "Two hours", seconds: 36, carry: 22, note: "You will find far more than you can carry back before dark." },
  { label: "Three hours", seconds: 48, carry: 14, note: "A thorough sweep, and a long walk home in the failing light." },
];

const FIELD_TOP = 44;
const FIELD_BOTTOM = 158;
const PLAYER_SPEED = 64;

type ItemKind = "berries" | "nuts" | "grasses" | "apple";

const ITEM_SPRITE: Record<ItemKind, Sprite> = {
  berries: BERRIES,
  nuts: NUTS,
  grasses: GRASSES,
  apple: APPLE,
};

const ITEM_VALUE: Record<ItemKind, number> = { berries: 2, nuts: 2, grasses: 1, apple: 3 };

interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** "flying" items cannot be picked up yet. */
  state: "flying" | "ground";
  life: number;
  pop: number;
}

interface Critter {
  kind: "bird" | "deer";
  x: number;
  y: number;
  target: Item | null;
  speed: number;
  scared: number;
  frame: number;
}

export class ForageScene implements Scene {
  readonly name = "forage";
  private stage: "choose" | "play" | "done" = "choose";
  private menu = new Menu([...OPTIONS.map((o) => ({ label: o.label, detail: `carry up to ${o.carry}`, note: o.note })), { label: "Never mind" }]);
  private option: ForageOption = OPTIONS[1]!;
  private timeLeft = 0;
  private gathered = 0;
  private items: Item[] = [];
  private critters: Critter[] = [];
  private px = 150;
  private py = 120;
  private facing = 1;
  private frame = 0;
  private spawnTimer = 0;
  private critterTimer = 2;
  private stolen = 0;
  private carryBonus: number;

  constructor(
    private g: GameState,
    private onDone: () => void,
  ) {
    this.carryBonus = g.origin === "earth" ? 1.3 : 1;
  }

  private treeX = 250;

  enter(): void {
    this.treeX = 60 + Math.floor(rng.next() * 200);
  }

  exit(): void {
    audio.stopMusic();
  }

  private begin(option: ForageOption): void {
    this.option = option;
    this.timeLeft = option.seconds;
    this.stage = "play";
    this.items = [];
    this.critters = [];
    this.gathered = 0;
    this.stolen = 0;
    this.px = 150;
    this.py = 120;
    audio.playSong(FORAGE_THEME);
  }

  private carryLimit(): number {
    return Math.round(this.option.carry * this.carryBonus);
  }

  private spawnItem(): void {
    if (this.items.length >= 9) return;
    const kind: ItemKind = rng.weighted([
      { item: "berries" as ItemKind, weight: 34 },
      { item: "nuts" as ItemKind, weight: 26 },
      { item: "grasses" as ItemKind, weight: 30 },
      { item: "apple" as ItemKind, weight: 12 },
    ]);
    const style = rng.next();
    if (style < 0.34) {
      // Blown in from off screen.
      const fromLeft = rng.chance(0.5);
      this.items.push({
        kind,
        x: fromLeft ? -8 : SCREEN_W + 8,
        y: FIELD_TOP + rng.float(6, FIELD_BOTTOM - FIELD_TOP - 12),
        vx: (fromLeft ? 1 : -1) * rng.float(40, 80),
        vy: rng.float(-6, 6),
        state: "flying",
        life: 11,
        pop: 0,
      });
    } else if (style < 0.7) {
      // Popped up out of the ground.
      this.items.push({
        kind,
        x: rng.float(16, SCREEN_W - 24),
        y: FIELD_TOP + rng.float(8, FIELD_BOTTOM - FIELD_TOP - 12),
        vx: 0,
        vy: 0,
        state: "ground",
        life: 9,
        pop: 0.35,
      });
    } else {
      // Dropped from the tree.
      this.items.push({
        kind,
        x: this.treeX + rng.float(-14, 14),
        y: FIELD_TOP + 2,
        vx: rng.float(-10, 10),
        vy: rng.float(40, 70),
        state: "flying",
        life: 10,
        pop: 0,
      });
    }
  }

  private spawnCritter(): void {
    if (this.critters.length >= 3) return;
    const bird = rng.chance(0.65);
    const fromLeft = rng.chance(0.5);
    this.critters.push({
      kind: bird ? "bird" : "deer",
      x: fromLeft ? -14 : SCREEN_W + 14,
      y: bird ? FIELD_TOP + rng.float(0, 30) : FIELD_BOTTOM - 24,
      target: null,
      speed: bird ? 58 : 40,
      scared: 0,
      frame: 0,
    });
  }

  private nearestItem(x: number, y: number): Item | null {
    let best: Item | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (it.state !== "ground") continue;
      const d = (it.x - x) ** 2 + (it.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private finish(early: boolean): void {
    this.stage = "done";
    audio.stopMusic();
    const g = this.g;
    const limit = this.carryLimit();
    const carried = Math.min(this.gathered, limit);
    const dropped = this.gathered - carried;
    g.food += carried;
    g.stats.forageTrips++;
    g.stats.basketsForaged += carried;
    const messages = passDays(g, 1);
    log(g, `Foraged ${carried} baskets near mile ${Math.round(g.miles)}.`);

    const pages: Page[] = [
      {
        title: "Back at the wagon",
        text:
          this.gathered === 0
            ? "You come back empty-hoofed. It happens."
            : `You gathered ${this.gathered} ${this.gathered === 1 ? "basketful" : "basketfuls"} and could carry ${carried} back before dark.${
                dropped > 0 ? ` ${dropped} had to be left behind.` : ""
              }`,
        sfx: carried > 0 ? ("pickup" as const) : ("back" as const),
      },
    ];
    if (this.stolen > 0) {
      pages.push({
        title: "Back at the wagon",
        text: `Birds and deer got to ${this.stolen} ${this.stolen === 1 ? "find" : "finds"} before you did.`,
        sfx: "back" as const,
      });
    }
    if (early) {
      pages.push({ title: "Back at the wagon", text: "You headed back early.", sfx: "day" as const });
    }
    for (const m of messages) pages.push({ title: "Back at the wagon", text: m, sfx: "bad" as const });

    scenes.pop();
    showPages(pages, this.onDone);
  }

  update(dt: number): void {
    this.frame += dt * 60;
    if (this.stage === "choose") {
      const picked = this.menu.update();
      if (picked !== null) {
        if (picked >= OPTIONS.length) {
          scenes.pop();
          return;
        }
        this.begin(OPTIONS[picked]!);
      }
      if (input.cancel()) {
        audio.sfx("back");
        scenes.pop();
      }
      return;
    }
    if (this.stage !== "play") return;

    if (input.cancel()) {
      this.finish(true);
      return;
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.finish(false);
      return;
    }

    // Player
    const speed = PLAYER_SPEED * (this.g.origin === "earth" ? 1.14 : 1);
    const ax = input.axisX();
    const ay = input.axisY();
    if (ax !== 0) this.facing = ax;
    const norm = ax !== 0 && ay !== 0 ? 0.7071 : 1;
    this.px = Math.max(4, Math.min(SCREEN_W - 20, this.px + ax * speed * dt * norm));
    this.py = Math.max(FIELD_TOP + 4, Math.min(FIELD_BOTTOM - 4, this.py + ay * speed * dt * norm));

    // Items
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rng.float(0.45, 0.95);
      this.spawnItem();
    }
    for (const it of this.items) {
      if (it.state === "flying") {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 1 - dt * 1.6;
        it.vy += 26 * dt;
        if (Math.abs(it.vx) < 12 || it.y > FIELD_BOTTOM - 8) {
          it.state = "ground";
          it.pop = 0.2;
          it.y = Math.min(it.y, FIELD_BOTTOM - 8);
        }
      } else {
        it.life -= dt;
        if (it.pop > 0) it.pop -= dt;
      }
      // Collection
      const dx = Math.abs(it.x - (this.px + 7));
      const dy = Math.abs(it.y - (this.py - 4));
      if (it.state === "ground" && dx < 9 && dy < 9) {
        this.gathered += ITEM_VALUE[it.kind];
        it.life = -1;
        audio.sfx("pickup");
      }
    }
    this.items = this.items.filter((it) => it.life > 0 && it.x > -20 && it.x < SCREEN_W + 20);

    // Critters
    this.critterTimer -= dt;
    if (this.critterTimer <= 0) {
      this.critterTimer = rng.float(2.2, 4.2);
      this.spawnCritter();
    }
    for (const c of this.critters) {
      c.frame += dt * 60;
      if (c.scared > 0) {
        c.scared -= dt;
        c.x += (c.x < this.px ? -1 : 1) * c.speed * 1.6 * dt;
        continue;
      }
      if (!c.target || !this.items.includes(c.target) || c.target.state !== "ground") {
        c.target = this.nearestItem(c.x, c.y);
      }
      const t = c.target;
      if (t) {
        const dx = t.x - c.x;
        const dy = t.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        c.x += (dx / d) * c.speed * dt;
        c.y += (dy / d) * c.speed * dt;
        if (d < 6) {
          t.life = -1;
          this.stolen += 1;
          c.target = null;
          c.scared = 1.2;
          audio.sfx("bad");
        }
      } else {
        c.x += (c.kind === "bird" ? 1 : -1) * c.speed * 0.5 * dt;
      }
      // Chased off by a pony getting too close.
      if (Math.hypot(c.x - this.px, c.y - this.py) < 18) {
        c.scared = 1.4;
        c.target = null;
        audio.sfx("move");
      }
    }
    this.critters = this.critters.filter((c) => c.x > -40 && c.x < SCREEN_W + 40 && (c.scared <= 0 || c.scared > 0.01));
    if (this.critters.length > 4) this.critters.shift();
  }

  draw(): void {
    if (this.stage === "choose") {
      this.drawChoose();
      return;
    }
    this.drawField();
  }

  private drawChoose(): void {
    screenFrame("FORAGING");
    let y = 20;
    for (const line of wrapText(
      "You can spend part of the day gathering berries, nuts, seeds and windfall apples. The longer you stay out, the more you will find - and the less daylight you will have to carry it back to the wagon.",
      46,
    )) {
      screen.text(20, y, line, C.WHITE);
      y += 8;
    }
    screen.text(20, y + 4, "Food is measured in basketfuls.", C.BRIGHTCYAN);
    this.menu.draw({ x: 40, y: 72, color: C.GREY, cursorColor: C.YELLOW, lineHeight: 12, width: 230, detailColor: C.BROWN });
    if (this.g.origin === "earth") {
      screen.textCentered(SCREEN_W / 2, 132, "as an earth pony you can carry a third again as much", C.BRIGHTGREEN);
    }
    footer("how long will you forage?");
  }

  private drawField(): void {
    const terrain = terrainAt(this.g.miles);
    const pal = skyPalette(terrain === "town" ? "plains" : terrain);
    drawSky(0, FIELD_TOP + 8, pal);
    screen.rect(0, FIELD_TOP + 8, SCREEN_W, FIELD_BOTTOM - FIELD_TOP + 6, pal.ground);
    drawGroundDetail(FIELD_TOP + 10, FIELD_BOTTOM - FIELD_TOP, this.frame * 0, pal, 44);
    for (let i = 0; i < 5; i++) {
      drawBush(20 + i * 62, FIELD_BOTTOM + 4 + ((i % 2) * 3), 0.8 + hash01(i, 91) * 0.4, C.GREEN);
    }
    drawTree(this.treeX, FIELD_TOP + 26, 1.15);
    drawWagon(SCREEN_W - 44, FIELD_BOTTOM + 8, 0);

    // Items
    for (const it of this.items) {
      const spr = ITEM_SPRITE[it.kind];
      const size = spriteSize(spr);
      const wob = it.state === "flying" ? Math.floor(Math.sin(this.frame * 0.4 + it.x * 0.1) * 2) : 0;
      const scale = it.pop > 0 ? 2 : 1;
      screen.sprite(spr, it.x - size.w / 2, it.y - size.h / 2 + wob, { scale });
      if (it.state === "ground" && it.life < 2.5 && blink(280, 0.5)) {
        screen.px(it.x, it.y - 6, C.WHITE);
      }
    }

    // Critters
    for (const c of this.critters) {
      if (c.kind === "bird") {
        const spr = Math.floor(c.frame / 6) % 2 === 0 ? BIRD_A : BIRD_B;
        screen.sprite(spr, c.x - 5, c.y - 2, { flipX: c.x > this.px });
      } else {
        screen.sprite(DEER, c.x - 8, c.y - 14, { flipX: c.x > this.px });
      }
    }

    // Player
    drawPony(this.px, this.py + 6, 0, "pack", { flipX: this.facing < 0, bob: Math.floor(Math.sin(this.frame * 0.4) * 1.2) });

    // HUD
    screen.rect(0, 0, SCREEN_W, FIELD_TOP - 8, C.BLACK);
    screen.hline(0, FIELD_TOP - 8, SCREEN_W, C.DARKGREY);
    screen.text(8, 4, "FORAGING", C.YELLOW);
    screen.text(8, 14, `gathered: ${this.gathered}`, C.WHITE);
    const limit = this.carryLimit();
    const over = this.gathered > limit;
    screen.text(8, 24, `can carry back: ${limit}`, over ? C.BRIGHTRED : C.BRIGHTGREEN);
    if (over && blink(400, 0.5)) screen.text(150, 24, "you have more than you can carry!", C.BRIGHTRED);
    gauge(196, 6, 116, Math.max(0, this.timeLeft / this.option.seconds), C.YELLOW);
    screen.textRight(SCREEN_W - 8, 16, `${Math.ceil(this.timeLeft)}s of daylight`, C.CYAN);

    const panelY = FIELD_BOTTOM + 20;
    panel(0, panelY, SCREEN_W, SCREEN_H - panelY, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(8, panelY + 5, "arrow keys to move  \u0006  walk over food to gather it", C.GREY);
    screen.text(8, panelY + 14, "get close to scare off birds and deer  \u0006  ESC to head back", C.GREY);
  }
}
