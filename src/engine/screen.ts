/**
 * The virtual display: a 320x200, 16-colour EGA-style framebuffer, which is the
 * mode the MS-DOS release of the original ran in. Everything is drawn at 1x and
 * the browser scales the canvas with nearest-neighbour filtering, so no drawing
 * code ever has to think about the window size.
 */

import { CELL_H, CELL_W, FONT, GLYPH_H, GLYPH_W, glyphRows } from "./font";

export const SCREEN_W = 320;
export const SCREEN_H = 200;

/** Standard EGA 16-colour palette. */
export const PALETTE = [
  "#000000", // 0 black
  "#0000aa", // 1 blue
  "#00aa00", // 2 green
  "#00aaaa", // 3 cyan
  "#aa0000", // 4 red
  "#aa00aa", // 5 magenta
  "#aa5500", // 6 brown
  "#aaaaaa", // 7 light grey
  "#555555", // 8 dark grey
  "#5555ff", // 9 bright blue
  "#55ff55", // a bright green
  "#55ffff", // b bright cyan
  "#ff5555", // c bright red
  "#ff55ff", // d bright magenta
  "#ffff55", // e yellow
  "#ffffff", // f white
] as const;

export const C = {
  BLACK: 0,
  BLUE: 1,
  GREEN: 2,
  CYAN: 3,
  RED: 4,
  MAGENTA: 5,
  BROWN: 6,
  GREY: 7,
  DARKGREY: 8,
  BRIGHTBLUE: 9,
  BRIGHTGREEN: 10,
  BRIGHTCYAN: 11,
  BRIGHTRED: 12,
  PINK: 13,
  YELLOW: 14,
  WHITE: 15,
} as const;

export type Color = number;

export interface Sprite {
  /** Rows of hex palette digits; "." and " " are transparent. */
  data: string[];
  /** Optional per-sprite default remap, applied before any call-site remap. */
  remap?: Record<string, Color>;
}

export interface DrawSpriteOpts {
  flipX?: boolean;
  remap?: Record<string, Color>;
  scale?: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas context unavailable");
  g.imageSmoothingEnabled = false;
  return g;
}

// ---------------------------------------------------------------------------
// Font atlases, one per ink colour, built on demand.
// ---------------------------------------------------------------------------

const CHARS = Object.keys(FONT);
const CHAR_INDEX = new Map<string, number>(CHARS.map((ch, i) => [ch, i]));
const atlases = new Map<Color, HTMLCanvasElement>();

function fontAtlas(color: Color): HTMLCanvasElement {
  const cached = atlases.get(color);
  if (cached) return cached;
  const atlas = makeCanvas(CHARS.length * GLYPH_W, GLYPH_H);
  const g = ctx2d(atlas);
  g.fillStyle = PALETTE[color] ?? PALETTE[15];
  CHARS.forEach((ch, i) => {
    const rows = glyphRows(ch);
    for (let y = 0; y < GLYPH_H; y++) {
      const row = rows[y] ?? "";
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] === "#") g.fillRect(i * GLYPH_W + x, y, 1, 1);
      }
    }
  });
  atlases.set(color, atlas);
  return atlas;
}

// ---------------------------------------------------------------------------
// Sprite cache
// ---------------------------------------------------------------------------

const spriteCache = new Map<string, HTMLCanvasElement>();
let spriteIds = new WeakMap<Sprite, number>();
let nextSpriteId = 1;

function spriteId(s: Sprite): number {
  let id = spriteIds.get(s);
  if (id === undefined) {
    id = nextSpriteId++;
    spriteIds.set(s, id);
  }
  return id;
}

function renderSprite(sprite: Sprite, remap: Record<string, Color> | undefined, flipX: boolean): HTMLCanvasElement {
  const key = `${spriteId(sprite)}|${flipX ? 1 : 0}|${remap ? JSON.stringify(remap) : ""}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const h = sprite.data.length;
  const w = sprite.data.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = makeCanvas(w, h);
  const g = ctx2d(canvas);
  const table: Record<string, Color> = { ...(sprite.remap ?? {}), ...(remap ?? {}) };

  for (let y = 0; y < h; y++) {
    const row = sprite.data[y] ?? "";
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === " ") continue;
      const mapped = table[ch];
      const idx = mapped !== undefined ? mapped : parseInt(ch, 16);
      if (Number.isNaN(idx)) continue;
      g.fillStyle = PALETTE[idx] ?? PALETTE[15];
      g.fillRect(flipX ? w - 1 - x : x, y, 1, 1);
    }
  }
  spriteCache.set(key, canvas);
  return canvas;
}

export function spriteSize(sprite: Sprite): { w: number; h: number } {
  return { w: sprite.data.reduce((m, r) => Math.max(m, r.length), 0), h: sprite.data.length };
}

/** Discard cached sprite renders (used when hot-reloading art during dev). */
export function clearSpriteCache(): void {
  spriteCache.clear();
  spriteIds = new WeakMap<Sprite, number>();
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface LayoutRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  inset: number;
  label: string;
}

class Screen {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  /** Set while drawing to constrain output; used by the scrolling minigames. */
  private clipDepth = 0;

  /**
   * Development aid: when enabled (append ?layout=1 to the URL) every string
   * drawn is checked against the screen edges and against any panel it sits
   * inside, and anything that escapes is reported once. This is how the text
   * overflow bugs get found rather than spotted by eye.
   */
  debugLayout = false;
  private regions: LayoutRegion[] = [];
  private drawnText: { x: number; y: number; w: number; h: number; str: string }[] = [];
  private overlapExempt = 0;
  private layoutWarnings = new Set<string>();

  private currentScene = "";

  /** Called before each scene draws, so a modal is only checked against its own boxes. */
  resetRegions(sceneName = ""): void {
    if (!this.debugLayout) return;
    this.regions.length = 0;
    this.drawnText.length = 0;
    this.currentScene = sceneName;
  }

  /**
   * Runs `fn` with overlap reporting suppressed, for the handful of places
   * that deliberately draw text on top of text: drop shadows and the
   * placeholder underscores behind a text field.
   */
  withOverlap<T>(fn: () => T): T {
    this.overlapExempt++;
    try {
      return fn();
    } finally {
      this.overlapExempt--;
    }
  }

  /** Reported by the truncate() helper in ui.ts when a string had to be cut. */
  reportTruncation(full: string, shown: string, where: string): void {
    if (!this.debugLayout) return;
    this.reportLayout(`"${full}" was truncated to "${shown}" (${where})`);
  }

  /** Registers a box that text drawn inside it must not escape. */
  noteRegion(x: number, y: number, w: number, h: number, inset: number, label: string): void {
    if (this.debugLayout) this.regions.push({ x, y, w, h, inset, label });
  }

  private reportLayout(message: string): void {
    const full = this.currentScene ? `[${this.currentScene}] ${message}` : message;
    if (this.layoutWarnings.has(full)) return;
    this.layoutWarnings.add(full);
    console.warn(`LAYOUT: ${full}`);
  }

  private checkText(x: number, y: number, w: number, h: number, str: string): void {
    if (!this.debugLayout || str.trim() === "") return;
    const right = x + w;
    const bottom = y + h;
    if (x < 1 || y < 0 || right > SCREEN_W - 1 || bottom > SCREEN_H) {
      this.reportLayout(`"${str}" runs off screen at ${x},${y} (${w}x${h})`);
      return;
    }
    // Text drawn on top of other text. Glyphs are 7 rows tall in an 8 row cell,
    // so rows only collide when they genuinely share ink.
    if (this.overlapExempt === 0) {
      for (const t of this.drawnText) {
        const horizontal = right > t.x && x < t.x + t.w;
        const vertical = y + h - 1 > t.y && y < t.y + t.h - 1;
        if (horizontal && vertical) {
          this.reportLayout(`"${str}" at ${x},${y} overlaps "${t.str}" at ${t.x},${t.y}`);
          break;
        }
      }
      this.drawnText.push({ x, y, w, h, str });
    }
    for (const r of this.regions) {
      const ix = r.x + r.inset;
      const iy = r.y + r.inset;
      const ir = r.x + r.w - r.inset;
      const ib = r.y + r.h - r.inset;
      const overlaps = right > r.x && x < r.x + r.w && bottom > r.y && y < r.y + r.h;
      if (!overlaps) continue;
      const contained = x >= ix && y >= iy && right <= ir && bottom <= ib;
      if (!contained) {
        this.reportLayout(
          `"${str}" escapes ${r.label} box (${r.x},${r.y} ${r.w}x${r.h}) at ${x},${y} (${w}x${h})`,
        );
      }
    }
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.ctx = ctx2d(canvas);
    this.fitToWindow();
    window.addEventListener("resize", () => this.fitToWindow());
  }

  fitToWindow(): void {
    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H)));
    this.canvas.style.width = `${SCREEN_W * scale}px`;
    this.canvas.style.height = `${SCREEN_H * scale}px`;
  }

  clear(color: Color = C.BLACK): void {
    this.rect(0, 0, SCREEN_W, SCREEN_H, color);
  }

  px(x: number, y: number, color: Color): void {
    this.ctx.fillStyle = PALETTE[color] ?? PALETTE[15];
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: Color): void {
    this.ctx.fillStyle = PALETTE[color] ?? PALETTE[15];
    this.ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
  }

  frame(x: number, y: number, w: number, h: number, color: Color): void {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  hline(x: number, y: number, w: number, color: Color): void {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: Color): void {
    this.rect(x, y, 1, h, color);
  }

  circle(cx: number, cy: number, r: number, color: Color): void {
    this.ellipse(cx, cy, r, r, color);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: Color): void {
    if (rx <= 0 || ry <= 0) return;
    this.ctx.fillStyle = PALETTE[color] ?? PALETTE[15];
    for (let dy = -ry; dy <= ry; dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t <= 0) continue;
      const half = Math.round(rx * Math.sqrt(t));
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }

  /** Filled triangle-ish peak, used for mountains and tents. */
  peak(cx: number, baseY: number, halfWidth: number, height: number, color: Color): void {
    for (let i = 0; i < height; i++) {
      const t = i / height;
      const half = Math.round(halfWidth * (1 - t));
      this.rect(cx - half, baseY - i, half * 2 + 1, 1, color);
    }
  }

  /** 50% checkerboard fill; the classic way to fake extra colours on EGA. */
  dither(x: number, y: number, w: number, h: number, a: Color, b: Color, density = 2): void {
    this.rect(x, y, w, h, a);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = (yy % density === 0 ? 0 : 1); xx < w; xx += density) {
        this.px(x + xx, y + yy, b);
      }
    }
  }

  /** Single character. Returns the advance width. */
  char(x: number, y: number, ch: string, color: Color, scale = 1): number {
    const idx = CHAR_INDEX.get(ch);
    if (idx === undefined) return this.char(x, y, "?", color, scale);
    const atlas = fontAtlas(color);
    this.ctx.drawImage(atlas, idx * GLYPH_W, 0, GLYPH_W, GLYPH_H, x | 0, y | 0, GLYPH_W * scale, GLYPH_H * scale);
    return CELL_W * scale;
  }

  text(x: number, y: number, str: string, color: Color = C.WHITE, scale = 1): number {
    let cx = x | 0;
    for (const ch of str) {
      cx += this.char(cx, y, ch, color, scale);
    }
    // The trailing letter-space is not ink, so exclude it from the extent.
    this.checkText(x | 0, y | 0, Math.max(0, cx - (x | 0) - scale), GLYPH_H * scale, str);
    return cx - x;
  }

  textCentered(cx: number, y: number, str: string, color: Color = C.WHITE, scale = 1): void {
    this.text(cx - Math.floor((str.length * CELL_W * scale) / 2), y, str, color, scale);
  }

  textRight(rx: number, y: number, str: string, color: Color = C.WHITE, scale = 1): void {
    this.text(rx - str.length * CELL_W * scale, y, str, color, scale);
  }

  /** Text with a 1px drop shadow; used for headings over busy artwork. */
  textShadow(x: number, y: number, str: string, color: Color, shadow: Color = C.BLACK, scale = 1): void {
    this.withOverlap(() => {
      this.text(x + scale, y + scale, str, shadow, scale);
      this.text(x, y, str, color, scale);
    });
  }

  textCenteredShadow(cx: number, y: number, str: string, color: Color, shadow: Color = C.BLACK, scale = 1): void {
    const x = cx - Math.floor((str.length * CELL_W * scale) / 2);
    this.textShadow(x, y, str, color, shadow, scale);
  }

  sprite(sprite: Sprite, x: number, y: number, opts: DrawSpriteOpts = {}): void {
    const canvas = renderSprite(sprite, opts.remap, opts.flipX ?? false);
    const s = opts.scale ?? 1;
    this.ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, x | 0, y | 0, canvas.width * s, canvas.height * s);
  }

  pushClip(x: number, y: number, w: number, h: number): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    this.clipDepth++;
  }

  popClip(): void {
    if (this.clipDepth > 0) {
      this.ctx.restore();
      this.clipDepth--;
    }
  }
}

export const screen = new Screen();
export { CELL_W, CELL_H };
