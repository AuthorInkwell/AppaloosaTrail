/**
 * Procedural backdrop painting. Landscapes are generated from a positional hash
 * rather than stored as art, so the trail can scroll forever while staying
 * deterministic (the same mile always looks the same).
 */

import { C, Color, SCREEN_W, screen } from "../engine/screen";

export type Terrain = "plains" | "forest" | "hills" | "desert" | "mountains" | "swamp" | "town";

/** Cheap deterministic hash -> 0..1 */
export function hash01(n: number, salt = 0): number {
  let h = (n | 0) * 374761393 + salt * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

export interface SkyPalette {
  sky: Color;
  skyAlt: Color;
  haze: Color;
  ground: Color;
  groundAlt: Color;
  detail: Color;
}

export function skyPalette(terrain: Terrain, night = false): SkyPalette {
  if (night) {
    return {
      sky: C.BLACK,
      skyAlt: C.BLUE,
      haze: C.BLUE,
      ground: C.DARKGREY,
      groundAlt: C.BLACK,
      detail: C.BLUE,
    };
  }
  switch (terrain) {
    case "desert":
      return { sky: C.BRIGHTCYAN, skyAlt: C.CYAN, haze: C.BROWN, ground: C.YELLOW, groundAlt: C.BROWN, detail: C.GREEN };
    case "forest":
      return { sky: C.CYAN, skyAlt: C.BRIGHTCYAN, haze: C.GREEN, ground: C.GREEN, groundAlt: C.BROWN, detail: C.BRIGHTGREEN };
    case "mountains":
      return { sky: C.BRIGHTCYAN, skyAlt: C.CYAN, haze: C.GREY, ground: C.GREY, groundAlt: C.DARKGREY, detail: C.WHITE };
    case "hills":
      return { sky: C.CYAN, skyAlt: C.BRIGHTCYAN, haze: C.GREY, ground: C.GREEN, groundAlt: C.BROWN, detail: C.BRIGHTGREEN };
    case "swamp":
      return { sky: C.GREY, skyAlt: C.CYAN, haze: C.DARKGREY, ground: C.GREEN, groundAlt: C.DARKGREY, detail: C.BRIGHTGREEN };
    case "town":
      return { sky: C.BRIGHTCYAN, skyAlt: C.CYAN, haze: C.BROWN, ground: C.BROWN, groundAlt: C.DARKGREY, detail: C.YELLOW };
    case "plains":
    default:
      return { sky: C.BRIGHTCYAN, skyAlt: C.CYAN, haze: C.GREEN, ground: C.BRIGHTGREEN, groundAlt: C.GREEN, detail: C.YELLOW };
  }
}

export function drawSky(y: number, h: number, pal: SkyPalette): void {
  screen.rect(0, y, SCREEN_W, h, pal.sky);
  // A couple of dithered bands imply a gradient without leaving the palette.
  screen.dither(0, y + h - 14, SCREEN_W, 7, pal.sky, pal.skyAlt, 2);
  screen.dither(0, y + h - 7, SCREEN_W, 7, pal.skyAlt, pal.sky, 3);
}

export function drawSun(x: number, y: number, r = 7): void {
  screen.circle(x, y, r, C.YELLOW);
  screen.circle(x, y, r - 2, C.WHITE);
}

export function drawMoon(x: number, y: number, r = 6): void {
  screen.circle(x, y, r, C.GREY);
  screen.circle(x + 3, y - 2, r - 1, C.BLACK);
}

export function drawStars(x: number, y: number, w: number, h: number, scroll: number): void {
  for (let i = 0; i < 40; i++) {
    const sx = Math.floor((hash01(i, 11) * w * 3 - scroll * 0.15) % w + w) % w;
    const sy = y + Math.floor(hash01(i, 12) * h);
    screen.px(x + sx, sy, hash01(i, 13) > 0.7 ? C.WHITE : C.GREY);
  }
}

export function drawCloud(x: number, y: number, w: number, color: Color = C.WHITE, shade: Color = C.GREY): void {
  const h = Math.max(4, Math.floor(w * 0.32));
  screen.ellipse(x, y, Math.floor(w / 2), Math.floor(h / 2), color);
  screen.ellipse(x - Math.floor(w * 0.28), y + 1, Math.floor(w / 4), Math.floor(h / 2) - 1, color);
  screen.ellipse(x + Math.floor(w * 0.3), y + 1, Math.floor(w / 3.4), Math.floor(h / 2) - 1, color);
  screen.rect(x - Math.floor(w * 0.42), y + Math.floor(h / 2) - 1, Math.floor(w * 0.85), 1, shade);
}

/** Distant range; `scroll` is in pixels and parallaxed by the caller. */
export function drawMountains(
  baseY: number,
  scroll: number,
  color: Color,
  snow: Color | null = null,
  spacing = 46,
  height = 34,
): void {
  const first = Math.floor(scroll / spacing) - 1;
  for (let i = first; i < first + Math.ceil(SCREEN_W / spacing) + 3; i++) {
    const x = i * spacing - scroll;
    const hh = Math.floor(height * (0.6 + hash01(i, 3) * 0.7));
    const half = Math.floor(hh * (0.7 + hash01(i, 4) * 0.5));
    screen.peak(x, baseY, half, hh, color);
    if (snow !== null && hh > height * 0.8) screen.peak(x, baseY - hh + 7, Math.floor(half * 0.22), 7, snow);
  }
}

export function drawHillBand(baseY: number, scroll: number, color: Color, spacing = 70, height = 16): void {
  const first = Math.floor(scroll / spacing) - 1;
  for (let i = first; i < first + Math.ceil(SCREEN_W / spacing) + 3; i++) {
    const x = i * spacing - scroll;
    const hh = Math.floor(height * (0.5 + hash01(i, 7) * 1.1));
    screen.ellipse(x, baseY + hh, Math.floor(spacing * 0.62), hh, color);
  }
}

export function drawTree(x: number, baseY: number, scale = 1, leaf: Color = C.GREEN, shade: Color = C.BRIGHTGREEN): void {
  const trunkH = Math.round(9 * scale);
  const trunkW = Math.max(2, Math.round(4 * scale));
  const r = Math.round(9 * scale);
  screen.rect(x - Math.floor(trunkW / 2), baseY - trunkH, trunkW, trunkH, C.BROWN);
  screen.circle(x, baseY - trunkH - r + 2, r, leaf);
  screen.circle(x - Math.round(r * 0.6), baseY - trunkH - r + Math.round(r * 0.5), Math.round(r * 0.62), leaf);
  screen.circle(x + Math.round(r * 0.62), baseY - trunkH - r + Math.round(r * 0.45), Math.round(r * 0.6), leaf);
  screen.circle(x - Math.round(r * 0.35), baseY - trunkH - r - Math.round(r * 0.2), Math.round(r * 0.42), shade);
}

export function drawPine(x: number, baseY: number, scale = 1, leaf: Color = C.GREEN): void {
  const h = Math.round(22 * scale);
  screen.rect(x - 1, baseY - 4, 3, 4, C.BROWN);
  for (let i = 0; i < 3; i++) {
    const layerBase = baseY - 3 - Math.round((i * h) / 4);
    screen.peak(x, layerBase, Math.round((8 - i * 2) * scale), Math.round((h / 2.4) * (1 - i * 0.12)), leaf);
  }
}

export function drawCactus(x: number, baseY: number, scale = 1): void {
  const h = Math.round(18 * scale);
  screen.rect(x - 1, baseY - h, 4, h, C.GREEN);
  screen.rect(x - 5, baseY - h + 6, 3, 7, C.GREEN);
  screen.rect(x - 5, baseY - h + 4, 3, 3, C.GREEN);
  screen.rect(x + 3, baseY - h + 9, 3, 6, C.GREEN);
  screen.rect(x + 3, baseY - h + 6, 3, 4, C.GREEN);
  screen.px(x, baseY - h, C.BRIGHTGREEN);
}

export function drawBush(x: number, baseY: number, scale = 1, color: Color = C.GREEN): void {
  const r = Math.round(5 * scale);
  screen.ellipse(x, baseY - r, r + 2, r, color);
  screen.ellipse(x - r, baseY - Math.round(r * 0.6), r - 1, Math.round(r * 0.7), color);
  screen.ellipse(x + r, baseY - Math.round(r * 0.6), r - 1, Math.round(r * 0.7), color);
}

export function drawRock(x: number, baseY: number, scale = 1, color: Color = C.GREY): void {
  const r = Math.round(4 * scale);
  screen.ellipse(x, baseY - Math.round(r * 0.6), r, Math.round(r * 0.75), color);
  screen.ellipse(x - r, baseY - 1, Math.round(r * 0.6), Math.round(r * 0.4), C.DARKGREY);
}

/** Animated water band. `phase` should advance a fraction of a pixel per frame. */
export function drawWater(
  x: number,
  y: number,
  w: number,
  h: number,
  phase: number,
  deep: Color = C.BLUE,
  foam: Color = C.BRIGHTBLUE,
): void {
  screen.rect(x, y, w, h, deep);
  for (let row = 0; row < h; row += 2) {
    const off = Math.floor(Math.sin(phase * 0.08 + row * 0.7) * 4);
    for (let i = 0; i < w; i += 8) {
      const wx = x + ((i + off + row * 3 + w) % w);
      screen.rect(wx, y + row, 3, 1, foam);
    }
  }
  screen.hline(x, y, w, C.BRIGHTCYAN);
}

export interface BuildingStyle {
  wall: Color;
  roof: Color;
  trim: Color;
}

/** Western false-front building with door, windows and a porch awning. */
export function drawBuilding(
  x: number,
  baseY: number,
  w: number,
  h: number,
  style: BuildingStyle,
  variant = 0,
): void {
  screen.rect(x, baseY - h, w, h, style.wall);
  screen.frame(x, baseY - h, w, h, C.DARKGREY);
  if (variant % 3 === 0) {
    screen.rect(x - 2, baseY - h - 4, w + 4, 4, style.roof);
    screen.frame(x - 2, baseY - h - 4, w + 4, 4, C.DARKGREY);
  } else if (variant % 3 === 1) {
    screen.peak(x + Math.floor(w / 2), baseY - h, Math.floor(w / 2) + 3, 8, style.roof);
  } else {
    screen.rect(x - 1, baseY - h - 3, w + 2, 3, style.roof);
    screen.rect(x + 2, baseY - h - 7, w - 4, 4, style.wall);
    screen.frame(x + 2, baseY - h - 7, w - 4, 4, C.DARKGREY);
  }
  // Door
  const dx = x + Math.floor(w / 2) - 3;
  screen.rect(dx, baseY - 11, 7, 11, C.BROWN);
  screen.frame(dx, baseY - 11, 7, 11, C.DARKGREY);
  screen.px(dx + 5, baseY - 6, style.trim);
  // Windows
  for (let i = 0; i < Math.max(1, Math.floor(w / 16)); i++) {
    const wx = x + 3 + i * 16;
    if (wx + 6 > dx && wx < dx + 8) continue;
    screen.rect(wx, baseY - h + 5, 7, 6, C.BRIGHTCYAN);
    screen.frame(wx, baseY - h + 5, 7, 6, C.DARKGREY);
    screen.vline(wx + 3, baseY - h + 5, 6, C.DARKGREY);
  }
  // Porch
  screen.rect(x - 3, baseY - 13, w + 6, 2, style.trim);
  screen.vline(x - 2, baseY - 13, 13, C.BROWN);
  screen.vline(x + w + 1, baseY - 13, 13, C.BROWN);
}

export function drawFence(x: number, baseY: number, w: number, color: Color = C.BROWN): void {
  for (let i = 0; i < w; i += 9) screen.rect(x + i, baseY - 9, 2, 9, color);
  screen.rect(x, baseY - 7, w, 1, color);
  screen.rect(x, baseY - 3, w, 1, color);
}

/** Scatter of ground speckles that sells motion when the world scrolls. */
export function drawGroundDetail(y: number, h: number, scroll: number, pal: SkyPalette, density = 26): void {
  for (let i = 0; i < density; i++) {
    const spanX = SCREEN_W + 40;
    const sx = Math.floor(((hash01(i, 21) * spanX * 4 - scroll) % spanX + spanX) % spanX) - 20;
    const sy = y + Math.floor(hash01(i, 22) * h);
    const len = 1 + Math.floor(hash01(i, 23) * 3);
    screen.rect(sx, sy, len, 1, hash01(i, 24) > 0.5 ? pal.groundAlt : pal.detail);
  }
}
