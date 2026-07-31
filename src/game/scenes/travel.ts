/**
 * The travel screen: the wagon rolls, the days tick over, and anything that
 * needs the player's attention is pushed on top as a modal.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { blink } from "../../engine/ui";
import {
  Terrain,
  drawBush,
  drawCactus,
  drawCloud,
  drawGroundDetail,
  drawHillBand,
  drawMountains,
  drawPine,
  drawRock,
  drawSky,
  drawSun,
  drawTree,
  hash01,
  skyPalette,
} from "../../art/scenery";
import { PonyKind, drawPony, drawRig } from "../../art/wagon";
import { TRAIL, terrainAt } from "../data/trail";
import { session } from "../session";
import { PACE_INFO, Weather, livingPonies } from "../state";
import { advanceDay } from "../systems/travel";
import { drawStatusPanel } from "./common";
import { runDayResult } from "./eventrunner";
import { SizeUpScene } from "./menus";

const HORIZON = 96;
const GROUND_Y = 138;
const PANEL_Y = 146;
const DAY_SECONDS = 1.15;

export function drawWeatherOverlay(weather: Weather, frame: number, top = 0, bottom = PANEL_Y): void {
  const h = bottom - top;
  switch (weather) {
    case "rain":
    case "storm": {
      const count = weather === "storm" ? 90 : 50;
      for (let i = 0; i < count; i++) {
        const x = Math.floor((hash01(i, 31) * SCREEN_W + frame * 3.5) % SCREEN_W);
        const y = top + Math.floor((hash01(i, 32) * h + frame * 9) % h);
        screen.rect(x, y, 1, 3, C.BRIGHTCYAN);
      }
      if (weather === "storm" && Math.floor(frame / 6) % 37 === 0) {
        screen.rect(0, top, SCREEN_W, h, C.WHITE);
      }
      break;
    }
    case "snow":
      for (let i = 0; i < 60; i++) {
        const drift = Math.sin((frame * 0.03 + i) % (Math.PI * 2)) * 6;
        const x = Math.floor((hash01(i, 41) * SCREEN_W + frame * 0.6 + drift + SCREEN_W) % SCREEN_W);
        const y = top + Math.floor((hash01(i, 42) * h + frame * 1.3) % h);
        screen.px(x, y, C.WHITE);
      }
      break;
    case "fog":
      for (let y = top; y < bottom; y += 2) {
        const off = Math.floor(Math.sin(frame * 0.02 + y * 0.2) * 8);
        for (let x = (y + off) % 4; x < SCREEN_W; x += 4) screen.px(x, y, C.GREY);
      }
      break;
    case "hot":
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(hash01(i, 51) * SCREEN_W);
        const y = bottom - 24 - Math.floor(hash01(i, 52) * 10);
        if (Math.floor(frame / 8 + i) % 3 === 0) screen.rect(x, y, 4, 1, C.WHITE);
      }
      break;
    default:
      break;
  }
}

/** Paints the parallax landscape for a stretch of trail. */
export function drawTrailBackdrop(terrain: Terrain, scroll: number, frame: number): void {
  const pal = skyPalette(terrain);
  drawSky(0, HORIZON, pal);
  drawSun(272, 22, terrain === "desert" ? 9 : 7);

  for (let i = 0; i < 5; i++) {
    const x = Math.floor(((i * 90 - scroll * 0.05) % 420 + 420) % 420) - 50;
    drawCloud(x, 14 + ((i * 13) % 18), 26 + ((i * 7) % 20), terrain === "swamp" ? C.GREY : C.WHITE, C.GREY);
  }

  switch (terrain) {
    case "mountains":
      drawMountains(HORIZON, scroll * 0.14, C.BLUE, C.WHITE, 44, 58);
      drawMountains(HORIZON + 4, scroll * 0.24, C.DARKGREY, C.GREY, 62, 40);
      break;
    case "hills":
      drawMountains(HORIZON - 4, scroll * 0.1, C.BLUE, null, 68, 26);
      drawHillBand(HORIZON - 6, scroll * 0.2, C.GREEN, 74, 18);
      break;
    case "desert":
      drawMountains(HORIZON - 2, scroll * 0.08, C.BROWN, null, 78, 22);
      break;
    case "forest":
      drawHillBand(HORIZON - 8, scroll * 0.12, C.GREEN, 90, 14);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(((i * 26 - scroll * 0.35) % 380 + 380) % 380) - 30;
        drawPine(x, HORIZON + 2, 0.7 + hash01(i, 61) * 0.3, C.GREEN);
      }
      break;
    case "swamp":
      drawHillBand(HORIZON - 4, scroll * 0.1, C.DARKGREY, 96, 10);
      break;
    default:
      drawHillBand(HORIZON - 2, scroll * 0.12, C.GREEN, 84, 12);
      break;
  }

  // Ground
  screen.rect(0, HORIZON, SCREEN_W, PANEL_Y - HORIZON, pal.ground);
  screen.hline(0, HORIZON, SCREEN_W, pal.groundAlt);
  if (terrain === "swamp") {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(((i * 60 - scroll * 0.7) % 400 + 400) % 400) - 40;
      screen.ellipse(x, GROUND_Y - 2, 26, 4, C.BLUE);
    }
  }
  drawGroundDetail(HORIZON + 4, PANEL_Y - HORIZON - 6, scroll, pal, 40);

  // The trail itself, a lighter band the rig rides along.
  screen.rect(0, GROUND_Y - 2, SCREEN_W, 6, pal.groundAlt);
  for (let x = 0; x < SCREEN_W; x += 6) {
    const wob = Math.floor(Math.sin((x + scroll) * 0.05) * 1.5);
    screen.rect(x, GROUND_Y + 1 + wob, 3, 1, C.BROWN);
  }

  // Foreground props
  const spacing = 74;
  const first = Math.floor(scroll / spacing) - 1;
  for (let i = first; i < first + 8; i++) {
    const x = Math.round(i * spacing - scroll);
    if (x < -40 || x > SCREEN_W + 40) continue;
    const pick = hash01(i, 71);
    const baseY = GROUND_Y - 6 + Math.floor(hash01(i, 72) * 4);
    switch (terrain) {
      case "desert":
        if (pick < 0.55) drawCactus(x, baseY, 0.8 + hash01(i, 73) * 0.5);
        else if (pick < 0.8) drawRock(x, baseY, 1 + hash01(i, 74), C.BROWN);
        else drawBush(x, baseY, 0.7, C.BROWN);
        break;
      case "forest":
        if (pick < 0.6) drawPine(x, baseY, 1.1 + hash01(i, 75) * 0.5);
        else drawTree(x, baseY, 0.9 + hash01(i, 76) * 0.4);
        break;
      case "mountains":
        if (pick < 0.7) drawRock(x, baseY, 1.2 + hash01(i, 77) * 1.4);
        else drawPine(x, baseY, 0.8);
        break;
      case "swamp":
        if (pick < 0.5) drawBush(x, baseY, 1.1, C.GREEN);
        else drawTree(x, baseY, 0.8, C.GREEN, C.DARKGREY);
        break;
      case "hills":
        if (pick < 0.4) drawTree(x, baseY, 1, C.GREEN);
        else if (pick < 0.7) drawRock(x, baseY, 1, C.GREY);
        else drawBush(x, baseY, 1, C.GREEN);
        break;
      default:
        if (pick < 0.35) drawTree(x, baseY, 1 + hash01(i, 78) * 0.4);
        else if (pick < 0.6) drawBush(x, baseY, 1, C.GREEN);
        else if (pick < 0.75) drawRock(x, baseY, 0.8, C.GREY);
        break;
    }
  }
  void frame;
}

export class TravelScene implements Scene {
  readonly name = "travel";
  private frame = 0;
  private scroll = 0;
  private dayTimer = 0;
  private busy = false;

  enter(): void {
    audio.stopMusic();
    const g = session.game;
    if (g) this.scroll = g.miles * 6;
  }

  private step(): void {
    const g = session.current;
    if (g.finished) return;
    this.busy = true;
    const result = advanceDay(g, session.rng);
    audio.sfx("day");
    runDayResult(g, result, () => {
      this.busy = false;
    });
  }

  update(dt: number): void {
    const g = session.current;
    this.frame += dt * 60;
    this.scroll += dt * 26 * PACE_INFO[g.pace].speed * (g.team > 0 ? 1 : 0.5);

    if (input.confirm() || input.pressed("Enter")) {
      audio.sfx("select");
      scenes.push(new SizeUpScene());
      return;
    }
    if (this.busy) return;
    this.dayTimer += dt;
    if (this.dayTimer >= DAY_SECONDS) {
      this.dayTimer = 0;
      this.step();
    }
  }

  draw(): void {
    const g = session.game;
    if (!g) return;
    const terrain = terrainAt(g.miles);
    drawTrailBackdrop(terrain, this.scroll, this.frame);

    const jolt = Math.floor(Math.sin(this.frame * 0.5) * 1.2) > 0 ? 1 : 0;
    drawRig(184, GROUND_Y, g.team, this.frame, jolt);

    // Walking party trailing the wagon.
    const walkers = Math.max(0, livingPonies(g).length - (g.team === 0 ? 2 : 0));
    for (let i = 0; i < Math.min(3, walkers); i++) {
      const bob = Math.floor(Math.sin(this.frame * 0.28 + i * 1.3) * 1.3);
      const kind: PonyKind =
        i === 0 && g.origin === "pegasus" ? "winged" : i === 0 && g.origin === "unicorn" ? "horned" : "plain";
      drawPony(232 + i * 18, GROUND_Y, i + 2, kind, { bob });
    }

    drawWeatherOverlay(g.weather, this.frame);

    // Landmark ahead marker
    const next = TRAIL[g.landmarkIndex];
    if (next) {
      const away = next.mile - g.miles;
      if (away < 30) {
        const x = 300 - Math.round((30 - away) * 6);
        screen.text(Math.max(6, x - next.name.length * 3), HORIZON - 12, next.name, C.WHITE);
        screen.text(Math.max(6, x), HORIZON - 4, "\u0004", C.YELLOW);
      }
    }

    drawStatusPanel(g, PANEL_Y);
    if (blink(1000, 0.55)) {
      screen.textCentered(SCREEN_W / 2, SCREEN_H - 9, "press SPACE BAR to size up the situation", C.BRIGHTGREEN);
    }
  }
}
