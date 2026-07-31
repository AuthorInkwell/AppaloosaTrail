/**
 * Landmark artwork. Each stop gets a distinctive painted-in-code vista, in the
 * spirit of the original's landmark screens.
 */

import { C, SCREEN_W, screen } from "../engine/screen";
import { SIGNPOST } from "./sprites";
import {
  drawBuilding,
  drawBush,
  drawCactus,
  drawCloud,
  drawFence,
  drawGroundDetail,
  drawHillBand,
  drawMountains,
  drawPine,
  drawRock,
  drawSky,
  drawSun,
  drawTree,
  drawWater,
  hash01,
  skyPalette,
} from "./scenery";
import { drawPony, drawRig } from "./wagon";

export interface VistaOpts {
  top: number;
  bottom: number;
  frame: number;
  /** Draw the party's wagon parked in the scene. */
  rig?: number | null;
}

const TOWN_STYLES = [
  { wall: C.BROWN, roof: C.RED, trim: C.YELLOW },
  { wall: C.YELLOW, roof: C.BROWN, trim: C.RED },
  { wall: C.GREY, roof: C.BLUE, trim: C.WHITE },
  { wall: C.BROWN, roof: C.GREEN, trim: C.BRIGHTGREEN },
];

export function drawVista(id: string, terrain: string, opts: VistaOpts): void {
  const { top, bottom, frame } = opts;
  const h = bottom - top;
  const pal = skyPalette(terrain as never);
  const horizon = top + Math.floor(h * 0.52);
  const groundY = bottom - 6;

  screen.pushClip(0, top, SCREEN_W, h);
  drawSky(top, horizon - top, pal);
  drawSun(272, top + 16, terrain === "desert" ? 9 : 7);
  drawCloud(54, top + 12, 36);
  drawCloud(170, top + 8, 26);
  screen.rect(0, horizon, SCREEN_W, bottom - horizon, pal.ground);
  screen.hline(0, horizon, SCREEN_W, pal.groundAlt);
  drawGroundDetail(horizon + 3, bottom - horizon - 4, 0, pal, 46);

  switch (id) {
    case "pioneers-bluff":
      drawMountains(horizon, 0, C.BLUE, null, 70, 22);
      townRow(horizon, groundY, 4, 0);
      drawFence(6, groundY, 60);
      drawPony(120, groundY, 2);
      drawPony(200, groundY, 4, "plain", { flipX: true });
      break;
    case "marezy-meadow":
      drawHillBand(horizon - 2, 0, C.BRIGHTGREEN, 70, 16);
      for (let i = 0; i < 7; i++) drawTree(18 + i * 46, groundY - Math.floor(hash01(i, 3) * 5), 0.8 + hash01(i, 4) * 0.5);
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(hash01(i, 5) * SCREEN_W);
        const y = horizon + 6 + Math.floor(hash01(i, 6) * (bottom - horizon - 10));
        screen.px(x, y, hash01(i, 7) > 0.5 ? C.YELLOW : C.WHITE);
        screen.px(x, y - 1, C.BRIGHTGREEN);
      }
      break;
    case "ponyville":
      drawHillBand(horizon - 4, 0, C.GREEN, 80, 18);
      townRow(horizon, groundY, 5, 1);
      drawTree(26, groundY, 1.1);
      drawTree(292, groundY, 1);
      drawPony(150, groundY, 0);
      drawPony(178, groundY, 3, "plain", { flipX: true });
      break;
    case "whitetail-station":
      for (let i = 0; i < 12; i++) drawPine(10 + i * 28, horizon + 8, 1 + hash01(i, 9) * 0.4);
      drawBuilding(96, groundY, 128, 40, TOWN_STYLES[0]!, 0);
      screen.text(120, groundY - 46, "WHITETAIL WAY STATION", C.YELLOW);
      drawFence(6, groundY, 80);
      break;
    case "dodge-junction":
      drawMountains(horizon, 0, C.BROWN, null, 90, 18);
      townRow(horizon, groundY, 4, 2);
      // Rails
      screen.rect(0, groundY - 2, SCREEN_W, 2, C.DARKGREY);
      for (let x = 0; x < SCREEN_W; x += 8) screen.rect(x, groundY - 4, 3, 5, C.BROWN);
      break;
    case "sunkissed-springs":
      drawMountains(horizon, 0, C.BROWN, null, 74, 26);
      for (let i = 0; i < 3; i++) {
        screen.ellipse(60 + i * 90, groundY - 6, 26, 8, C.BRIGHTCYAN);
        screen.ellipse(60 + i * 90, groundY - 7, 20, 5, C.CYAN);
        for (let s = 0; s < 4; s++) {
          const sy = groundY - 12 - ((Math.floor(frame / 6) + s * 3 + i) % 14);
          screen.px(60 + i * 90 - 6 + s * 4, sy, C.WHITE);
        }
      }
      drawCactus(280, groundY, 1);
      break;
    case "rambling-rock":
      drawMountains(horizon, 0, C.GREY, null, 50, 34);
      for (let i = 0; i < 18; i++) {
        drawRock(8 + i * 18 + Math.floor(hash01(i, 11) * 6), groundY - Math.floor(hash01(i, 12) * 8), 0.9 + hash01(i, 13) * 1.6);
      }
      break;
    case "macintosh-hills":
      for (let i = 0; i < 6; i++) {
        const cx = 20 + i * 58;
        screen.ellipse(cx, horizon + 18, 40, 26, i % 2 === 0 ? C.RED : C.BROWN);
      }
      drawHillBand(horizon + 6, 0, C.BROWN, 60, 14);
      break;
    case "san-palomino":
      drawMountains(horizon, 0, C.BROWN, null, 96, 14);
      for (let i = 0; i < 6; i++) drawCactus(24 + i * 52, groundY - Math.floor(hash01(i, 15) * 4), 0.9 + hash01(i, 16) * 0.7);
      for (let i = 0; i < 3; i++) screen.ellipse(40 + i * 110, groundY + 2, 30, 3, C.YELLOW);
      break;
    case "ghastly-gorge":
      // Canyon walls closing in from both sides.
      for (let y = top; y < bottom; y += 1) {
        const t = (y - top) / h;
        const inset = Math.floor(70 * (1 - t) + 18);
        screen.rect(0, y, inset, 1, C.BROWN);
        screen.rect(SCREEN_W - inset, y, inset, 1, C.BROWN);
        if (y % 7 === 0) {
          screen.rect(inset - 4, y, 4, 1, C.DARKGREY);
          screen.rect(SCREEN_W - inset, y, 4, 1, C.DARKGREY);
        }
      }
      screen.rect(0, groundY, SCREEN_W, bottom - groundY, C.BROWN);
      break;
    case "the-parting":
      drawHillBand(horizon - 2, 0, C.GREEN, 84, 14);
      screen.sprite(SIGNPOST, 84, groundY - 30, { scale: 2 });
      screen.sprite(SIGNPOST, 196, groundY - 30, { scale: 2 });
      screen.text(78, groundY - 40, "TOLL ROAD", C.YELLOW);
      screen.text(196, groundY - 40, "EVERFREE", C.BRIGHTGREEN);
      for (let i = 0; i < 5; i++) drawPine(228 + i * 20, groundY, 1.3, C.GREEN);
      break;
    case "appaloosa":
      drawMountains(horizon, 0, C.BROWN, null, 80, 20);
      townRow(horizon, groundY, 5, 3);
      for (let i = 0; i < 9; i++) drawTree(14 + i * 36, groundY + 2, 0.42, C.BRIGHTGREEN, C.GREEN);
      drawFence(4, groundY, SCREEN_W - 8);
      break;
    default:
      // Generic countryside for anything unspecified.
      drawHillBand(horizon - 2, 0, C.GREEN, 78, 14);
      for (let i = 0; i < 5; i++) drawTree(30 + i * 62, groundY, 0.9);
      for (let i = 0; i < 4; i++) drawBush(20 + i * 84, groundY + 2, 1);
      break;
  }

  if (opts.rig !== null && opts.rig !== undefined) {
    drawRig(Math.floor(SCREEN_W * 0.62), groundY + 4, opts.rig, frame);
  }
  screen.popClip();
}

function townRow(horizon: number, groundY: number, count: number, styleOffset: number): void {
  let x = 8;
  for (let i = 0; i < count; i++) {
    const style = TOWN_STYLES[(i + styleOffset) % TOWN_STYLES.length]!;
    const w = 42 + Math.floor(hash01(i + styleOffset, 21) * 26);
    const bh = 26 + Math.floor(hash01(i + styleOffset, 22) * 16);
    drawBuilding(x, groundY, w, bh, style, i + styleOffset);
    x += w + 12;
    if (x > SCREEN_W - 40) break;
  }
  void horizon;
}

/** A river scene for crossing screens. */
export function drawRiverVista(
  top: number,
  bottom: number,
  frame: number,
  opts: { swamp?: boolean; width: number },
): { nearBank: number; farBank: number } {
  const h = bottom - top;
  const pal = skyPalette(opts.swamp ? "swamp" : "plains");
  const horizon = top + Math.floor(h * 0.34);
  screen.pushClip(0, top, SCREEN_W, h);
  drawSky(top, horizon - top, pal);
  drawCloud(70, top + 10, 32);
  drawHillBand(horizon, 0, opts.swamp ? C.DARKGREY : C.GREEN, 90, 12);
  screen.rect(0, horizon, SCREEN_W, bottom - horizon, pal.ground);

  const farBank = horizon + 8;
  const waterH = Math.max(18, Math.min(56, Math.round(opts.width / 14)));
  const nearBank = farBank + waterH;
  drawWater(0, farBank, SCREEN_W, waterH, frame, opts.swamp ? C.GREEN : C.BLUE, opts.swamp ? C.BRIGHTGREEN : C.BRIGHTBLUE);
  screen.hline(0, nearBank, SCREEN_W, pal.groundAlt);
  drawGroundDetail(nearBank + 2, bottom - nearBank - 2, 0, pal, 30);
  if (opts.swamp) {
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash01(i, 31) * SCREEN_W);
      const y = farBank + Math.floor(hash01(i, 32) * waterH);
      screen.rect(x, y - 5, 1, 6, C.GREEN);
      screen.px(x, y - 6, C.BROWN);
    }
  }
  for (let i = 0; i < 4; i++) drawBush(20 + i * 90, nearBank + 10, 0.9, opts.swamp ? C.GREEN : C.GREEN);
  screen.popClip();
  return { nearBank, farBank };
}
