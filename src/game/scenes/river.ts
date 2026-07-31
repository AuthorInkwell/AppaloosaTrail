/**
 * Water crossings. Per the design doc these are the big inflection points, and
 * the options are Equestrian: ford it, caulk and float it "the Earth Pony way",
 * hire a pegasus airlift, levitate it, or pay the ferry.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, SCREEN_W, screen, spriteSize } from "../../engine/screen";
import { Menu, blink, footer, panel, screenFrame, wrapText } from "../../engine/ui";
import { WAGON_BODY } from "../../art/sprites";
import { drawRiverVista } from "../../art/vistas";
import { drawPony, drawRig, drawTeam, drawWagon } from "../../art/wagon";
import { Landmark, RiverInfo } from "../data/trail";
import { session } from "../session";
import { GameState, formatDate, livingPonies, log, master, spend } from "../state";
import {
  changeMood,
  damageParty,
  damagePony,
  inflictAilment,
  loseTeam,
  randomLivingPony,
  takeBits,
  takeFood,
  usePart,
} from "../systems/effects";
import { passDays } from "../systems/travel";
import { Page, showPages } from "./common";

type Method = "ford" | "float" | "pegasi" | "levitate" | "ferry" | "wait";

interface Attempt {
  method: Method;
  risk: number;
  days: number;
}

const VISTA_TOP = 12;
const VISTA_BOTTOM = 112;

export class RiverScene implements Scene {
  readonly name = "river";
  private river: RiverInfo;
  private depth: number;
  private frame = 0;
  private menu = new Menu([]);
  private stage: "menu" | "crossing" = "menu";
  private crossT = 0;
  private attempt: Attempt | null = null;
  private askedAround = false;

  constructor(
    private g: GameState,
    private landmark: Landmark,
    private onDone: () => void,
  ) {
    this.river = landmark.river!;
    this.depth = this.rollDepth();
  }

  private rollDepth(): number {
    const g = this.g;
    let d = this.river.depth * session.rng.float(0.7, 1.35);
    if (g.weather === "rain") d *= 1.15;
    if (g.weather === "storm") d *= 1.3;
    if (g.date.month <= 4) d *= 1.12; // snowmelt
    if (g.date.month >= 7 && g.date.month <= 9) d *= 0.88;
    return Math.max(0.4, Math.round(d * 10) / 10);
  }

  enter(): void {
    this.refresh();
    if (!this.g.flags[`arrived:${this.landmark.id}`]) {
      this.g.flags[`arrived:${this.landmark.id}`] = true;
      log(this.g, `Reached ${this.landmark.name}.`);
      showPages([
        { title: `You have come to ${this.landmark.name}`, text: this.landmark.blurb, sfx: "splash" },
        {
          title: "The crossing",
          text: `The water is ${this.river.width} feet across and about ${this.depth.toFixed(1)} feet deep at the ford. The current is ${this.currentLabel()}.`,
        },
      ]);
    }
  }

  private currentLabel(): string {
    const c = this.river.current;
    if (c < 0.5) return "slow and lazy";
    if (c < 0.9) return "steady";
    if (c < 1.2) return "quick";
    return "fast and loud";
  }

  private pegasusCost(): number {
    return Math.round(this.river.pegasusCost * (this.g.origin === "pegasus" ? 0.5 : 1));
  }

  private refresh(): void {
    const g = this.g;
    const items = [
      { label: "Attempt to ford the river", note: "Walk the wagon across. Fine in shallow water, ruinous in deep." },
      {
        label: "Caulk the wagon and float it across",
        note:
          g.origin === "earth"
            ? "The Earth Pony way, and you know it well. Best in deep water, risky where rocks lurk."
            : "The Earth Pony way: seal the seams and swim it over. Best in deep water.",
      },
      {
        label: `Hire a team of pegasi (${this.pegasusCost()} bits)`,
        note:
          g.origin === "pegasus"
            ? "Local flyers charge you half, one professional to another. Very safe."
            : "Four strong flyers lift the wagon clean over. Very safe, and not cheap.",
        disabled: g.bits < this.pegasusCost(),
      },
    ];
    if (g.origin === "unicorn") {
      items.push({
        label: "Levitate the wagon across",
        note: "Your horn, your problem. Safe if you are rested; tiring either way.",
      });
    }
    items.push({
      label: `Take the ferry (${this.river.ferryCost} bits)`,
      note: "Safe, but you may wait days for your turn.",
      disabled: g.bits < this.river.ferryCost,
    });
    items.push({ label: "Wait a few days for better conditions", note: "Water drops, food goes, calendar turns." });
    items.push({ label: "Ask other travellers about the crossing", note: "Somepony always knows." });
    this.menu.setItems(items);
  }

  private riskFor(method: Method): number {
    const g = this.g;
    const d = this.depth;
    const cur = this.river.current;
    switch (method) {
      case "ford": {
        let risk = Math.max(0, (d - 1.8) / 3.4) + cur * 0.1;
        if (this.river.swamp) risk += 0.12;
        if (g.origin === "earth") risk *= 0.85;
        return Math.min(0.94, risk);
      }
      case "float": {
        let risk = (d < 2 ? 0.34 : 0.12) + cur * 0.14;
        if (g.origin === "earth") risk *= 0.5;
        if (this.river.swamp) risk += 0.05;
        return Math.min(0.9, risk);
      }
      case "pegasi":
        return g.origin === "pegasus" ? 0.02 : 0.06;
      case "levitate": {
        const m = master(g);
        const health = m ? m.health / 100 : 0.5;
        return Math.min(0.5, 0.06 + (1 - health) * 0.35 + d * 0.015);
      }
      case "ferry":
        return 0.03;
      case "wait":
        return 0;
    }
  }

  private begin(method: Method): void {
    const g = this.g;
    if (method === "wait") {
      const days = session.rng.int(1, 3);
      const messages = passDays(g, days);
      this.depth = Math.max(0.4, Math.round(this.depth * 0.82 * 10) / 10);
      showPages([
        {
          title: "Waiting it out",
          text: `You camp on the near bank for ${days} ${days === 1 ? "day" : "days"}. The water drops to about ${this.depth.toFixed(1)} feet. It is now ${formatDate(g.date)}.`,
          sfx: "day",
        },
        ...messages.map((m) => ({ text: m, sfx: "bad" as const })),
      ]);
      this.refresh();
      return;
    }
    if (method === "pegasi") {
      const cost = this.pegasusCost();
      if (g.bits < cost) return;
      spend(g, cost);
    }
    if (method === "ferry") {
      if (g.bits < this.river.ferryCost) return;
      spend(g, this.river.ferryCost);
      const wait = session.rng.int(0, 3);
      if (wait > 0) {
        passDays(g, wait);
        showPages([
          {
            title: "Waiting for the ferry",
            text: `There are wagons ahead of you. You wait ${wait} ${wait === 1 ? "day" : "days"} for your turn.`,
            sfx: "day",
          },
        ]);
      }
    }
    this.attempt = { method, risk: this.riskFor(method), days: 0 };
    this.stage = "crossing";
    this.crossT = 0;
    audio.sfx(method === "pegasi" || method === "levitate" ? "select" : "splash");
  }

  private resolve(): void {
    const g = this.g;
    const attempt = this.attempt!;
    const r = session.rng;
    g.stats.riverCrossings++;
    const failed = r.chance(attempt.risk);
    const pages: Page[] = [];

    if (!failed) {
      const successText: Record<Method, string> = {
        ford: "The water comes up to the wagon bed and no higher. Everypony is across, wet to the knee and pleased with themselves.",
        float:
          "Sealed tight, the wagon rides like a fat duck. The team swims alongside, hats held high, and you are across in twenty minutes.",
        pegasi:
          "Four pegasi take the corners, count together, and lift. The wagon crosses forty feet above the water and lands like a feather.",
        levitate:
          "Your horn lights, the wagon rises, and the whole rig floats over the water in one long, careful, dazzling sweep.",
        ferry: "The ferry takes you over three wagons at a time. Dull, safe, and worth every bit.",
        wait: "",
      };
      pages.push({ title: "Across", text: successText[attempt.method], sfx: "fanfare" });
      if (attempt.method === "levitate") {
        const m = master(g);
        if (m) damagePony(g, m, 8);
        pages.push({ text: `${master(g)?.name ?? "Your wagon master"} sits down heavily afterwards and does not speak for an hour.` });
      }
      if (attempt.method === "float" && g.origin === "earth") changeMood(g, 5);
      log(g, `Crossed ${this.river.name} (${attempt.method}).`);
    } else {
      const severity = r.next();
      const lostFood = takeFood(g, r.int(6, 26));
      let text = "";
      switch (attempt.method) {
        case "ford":
          text = `Halfway over, the bed drops away. The wagon lurches, water pours in, and everypony hauls together to get it out the far side. ${
            lostFood ? `${lostFood} baskets of food are ruined.` : "Somehow the food survives."
          }`;
          break;
        case "float":
          text = `A hidden rock catches the wagon and spins it. You get across, eventually, sideways. ${
            lostFood ? `${lostFood} baskets go downstream.` : ""
          }`;
          break;
        case "pegasi":
          text = `One of the flyers loses their grip and the wagon dips into the water before they recover it. ${
            lostFood ? `${lostFood} baskets are soaked through.` : ""
          }`;
          break;
        case "levitate":
          text = `The spell wavers over open water and the wagon drops the last few feet with an enormous slap. ${
            lostFood ? `${lostFood} baskets are lost.` : ""
          }`;
          break;
        case "ferry":
          text = `The ferry lists badly in midstream and takes on water. Nopony is hurt, but ${
            lostFood ? `${lostFood} baskets go over the side.` : "the wagon is thoroughly soaked."
          }`;
          break;
        default:
          text = "Something goes wrong.";
      }
      pages.push({ title: "Trouble in the water", text, sfx: "splash" });
      damageParty(g, r.int(3, 8));

      if (severity > 0.55) {
        const part = r.pick(["wheel", "axle", "tongue"] as const);
        if (usePart(g, part)) {
          pages.push({ text: `A ${part} is wrecked against the rocks. You fit your spare on the far bank.`, sfx: "thud" });
        } else {
          const days = 2;
          passDays(g, days);
          pages.push({ text: `A ${part} is wrecked and you have no spare. Two days go into lashing it back together.`, sfx: "bad" });
        }
      }
      if (severity > 0.78) {
        const pony = randomLivingPony(g, r);
        if (pony) {
          damagePony(g, pony, 16);
          inflictAilment(g, r, { pony, ailmentId: r.chance(0.5) ? "twisted-hoof" : "bogwater-belly" });
          pages.push({
            text: `${pony.name} is swept a hundred yards downstream before the team drags them out. Shaken, soaked, and not at all well.`,
            sfx: "hurt",
          });
        }
      }
      if (severity > 0.9 && g.team > 0) {
        const lost = loseTeam(g, 1);
        if (lost) {
          changeMood(g, -10);
          pages.push({ text: "One of the team has had quite enough of rivers and leaves your party on the far bank.", sfx: "sad" });
        }
      }
      if (severity > 0.85) {
        const bits = takeBits(g, r.int(10, 40));
        if (bits) pages.push({ text: `${bits} bits go to the bottom of the river.`, sfx: "bad" });
      }
      log(g, `A bad crossing at ${this.river.name}.`);
    }

    scenes.pop();
    showPages(pages, this.onDone);
  }

  update(dt: number): void {
    this.frame += dt * 60;
    if (this.stage === "crossing") {
      this.crossT += dt;
      if (this.crossT > 3.4) this.resolve();
      return;
    }
    const picked = this.menu.update();
    if (picked === null) return;
    const label = this.menu.items[picked]?.label ?? "";
    if (label.startsWith("Attempt to ford")) this.begin("ford");
    else if (label.startsWith("Caulk")) this.begin("float");
    else if (label.startsWith("Hire a team")) this.begin("pegasi");
    else if (label.startsWith("Levitate")) this.begin("levitate");
    else if (label.startsWith("Take the ferry")) this.begin("ferry");
    else if (label.startsWith("Wait")) this.begin("wait");
    else if (label.startsWith("Ask other")) {
      this.askedAround = true;
      const hints: string[] = [];
      hints.push(
        this.depth < 2
          ? "\"Shallow as a puddle this week. I walked mine straight over.\""
          : this.depth < 3.2
            ? "\"It is deeper than it looks. I would float it, or pay somepony to fly it.\""
            : "\"Do not ford that. I watched a wagon try this morning and I am still thinking about it.\"",
      );
      if (this.river.current > 1)
        hints.push('"That current will take your wagon downstream faster than you can trot after it."');
      if (this.river.swamp) hints.push('"There is no bottom to speak of. Mud all the way down, and something living in it."');
      showPages(hints.map((h) => ({ title: "Ponies on the bank", text: h })));
    }
  }

  draw(): void {
    const g = this.g;
    screenFrame(this.landmark.name.toUpperCase());
    const banks = drawRiverVista(VISTA_TOP, VISTA_BOTTOM, this.frame, {
      swamp: this.river.swamp,
      width: this.river.width,
    });

    if (this.stage === "crossing" && this.attempt) {
      this.drawCrossing(banks);
    } else {
      drawRig(196, banks.nearBank + 14, g.team, this.frame * 0.2);
      drawPony(30, banks.nearBank + 16, 3, "plain");
    }

    // Readout
    screen.hline(0, VISTA_BOTTOM, SCREEN_W, C.GREY);
    if (this.stage === "crossing") {
      screen.textCentered(SCREEN_W / 2, VISTA_BOTTOM + 8, "crossing...", C.YELLOW);
      return;
    }

    panel(4, VISTA_BOTTOM + 4, 168, 80, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(9, VISTA_BOTTOM + 8, "THE CROSSING", C.YELLOW);
    screen.text(9, VISTA_BOTTOM + 19, `${this.river.width} feet across`, C.WHITE);
    screen.text(9, VISTA_BOTTOM + 28, `${this.depth.toFixed(1)} feet deep`, this.depth > 3 ? C.BRIGHTRED : C.WHITE);
    screen.text(9, VISTA_BOTTOM + 37, `current: ${this.currentLabel()}`, C.BRIGHTCYAN);
    screen.text(9, VISTA_BOTTOM + 46, `${Math.round(g.bits)} bits on hoof`, C.WHITE);
    screen.text(9, VISTA_BOTTOM + 55, `${Math.round(g.food)} baskets`, C.WHITE);
    screen.text(9, VISTA_BOTTOM + 64, `${livingPonies(g).length} ponies, team of ${g.team}`, C.WHITE);
    if (this.askedAround) screen.text(9, VISTA_BOTTOM + 73, "you have asked around", C.BROWN);

    panel(176, VISTA_BOTTOM + 4, SCREEN_W - 180, 80, { fill: C.BLACK, border: C.DARKGREY });
    screen.text(181, VISTA_BOTTOM + 8, "You may:", C.CYAN);
    this.menu.draw({ x: 186, y: VISTA_BOTTOM + 19, color: C.GREY, cursorColor: C.WHITE, lineHeight: 9, numbered: true });

    const note = this.menu.items[this.menu.index]?.note;
    if (note) {
      let y = 186;
      for (const line of wrapText(note, 52).slice(0, 2)) {
        screen.text(6, y, line, C.BRIGHTGREEN);
        y += 8;
      }
    }
    void blink;
    void footer;
    void input;
  }

  private drawCrossing(banks: { nearBank: number; farBank: number }): void {
    const t = Math.min(1, this.crossT / 3);
    const g = this.g;
    const method = this.attempt!.method;
    const startY = banks.nearBank + 12;
    const endY = banks.farBank - 6;
    const y = Math.round(startY + (endY - startY) * t);
    const x = 196 - Math.round(40 * t);
    const body = spriteSize(WAGON_BODY);

    switch (method) {
      case "pegasi": {
        const lift = Math.sin(t * Math.PI) * 26;
        drawWagon(x, y - lift, this.frame);
        for (let i = 0; i < 4; i++) {
          const flap = Math.floor(Math.sin(this.frame * 0.4 + i) * 2);
          const wx = x + (i % 2 === 0 ? -12 : body.w - 2);
          const wy = y - lift - 16 - (i < 2 ? 6 : 0) + flap;
          drawPony(wx, wy, i + 1, "winged", { flipX: i % 2 === 0 });
        }
        break;
      }
      case "levitate": {
        const lift = Math.sin(t * Math.PI) * 20;
        for (let i = 0; i < 12; i++) {
          const sx = x + Math.floor(Math.sin(this.frame * 0.2 + i) * 20) + body.w / 2;
          const sy = y - lift + Math.floor(Math.cos(this.frame * 0.17 + i) * 10);
          screen.px(sx, sy, i % 2 === 0 ? C.PINK : C.WHITE);
        }
        drawWagon(x, y - lift, this.frame);
        drawPony(x - 24, y + 6, 3, "horned", { bob: Math.floor(Math.sin(this.frame * 0.3) * 1.5) });
        break;
      }
      case "float": {
        const bob = Math.floor(Math.sin(this.frame * 0.3) * 2);
        drawWagon(x, y + bob, 0);
        screen.rect(x - 2, y + bob + 1, body.w + 4, 2, C.BRIGHTCYAN);
        if (g.team > 0) drawTeam(x - 4, y + bob + 2, Math.min(3, g.team), this.frame);
        break;
      }
      case "ferry": {
        screen.rect(x - 8, y + 2, body.w + 18, 4, C.BROWN);
        screen.rect(x - 8, y + 2, body.w + 18, 1, C.YELLOW);
        drawWagon(x, y, 0);
        break;
      }
      default: {
        drawRig(x, y, g.team, this.frame);
        screen.rect(x - 40, y - 2, body.w + 44, 3, C.BRIGHTCYAN);
        break;
      }
    }
  }
}