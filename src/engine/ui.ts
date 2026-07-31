/**
 * Shared UI vocabulary: framed screens, numbered menus, text fields and the
 * "press SPACE BAR to continue" footer that the original leaned on constantly.
 */

import { audio } from "./audio";
import { input } from "./input";
import { C, CELL_H, CELL_W, Color, SCREEN_H, SCREEN_W, screen } from "./screen";

export const COLS = Math.floor(SCREEN_W / CELL_W); // 53
export const ROWS = Math.floor(SCREEN_H / CELL_H); // 25

export function textWidth(str: string, scale = 1): number {
  return str.length * CELL_W * scale;
}

/** Greedy word wrap, breaking over-long words. */
export function wrapText(str: string, cols: number): string[] {
  const out: string[] = [];
  for (const paragraph of str.split("\n")) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      let w = word;
      while (w.length > cols) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cols));
        w = w.slice(cols);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= cols) line += ` ${w}`;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export function blink(periodMs = 900, dutyFraction = 0.6): boolean {
  return (performance.now() % periodMs) / periodMs < dutyFraction;
}

export interface PanelOpts {
  fill?: Color;
  border?: Color;
  shadow?: boolean;
  double?: boolean;
}

export function panel(x: number, y: number, w: number, h: number, opts: PanelOpts = {}): void {
  const fill = opts.fill ?? C.BLACK;
  const border = opts.border ?? C.GREY;
  if (opts.shadow) screen.rect(x + 2, y + 2, w, h, C.BLACK);
  screen.rect(x, y, w, h, fill);
  screen.frame(x, y, w, h, border);
  if (opts.double) screen.frame(x + 2, y + 2, w - 4, h - 4, border);
}

/** The standard chrome: outer border plus a reverse-video title bar. */
export function screenFrame(title: string, opts: { bg?: Color; bar?: Color; ink?: Color; border?: Color } = {}): void {
  const bg = opts.bg ?? C.BLACK;
  screen.clear(bg);
  screen.frame(0, 0, SCREEN_W, SCREEN_H, opts.border ?? C.GREY);
  if (title) {
    screen.rect(1, 1, SCREEN_W - 2, 11, opts.bar ?? C.GREY);
    screen.textCentered(SCREEN_W / 2, 3, title, opts.ink ?? C.BLACK);
  }
}

export function footer(msg: string, color: Color = C.YELLOW, y = SCREEN_H - 11): void {
  if (blink()) screen.textCentered(SCREEN_W / 2, y, msg, color);
}

export function pressSpace(y = SCREEN_H - 11): boolean {
  footer("press SPACE BAR to continue", C.YELLOW, y);
  if (input.confirm() || input.pressed("Enter")) {
    audio.sfx("select");
    return true;
  }
  return false;
}

export interface MenuItem {
  label: string;
  detail?: string;
  disabled?: boolean;
  note?: string;
}

export interface MenuDrawOpts {
  x: number;
  y: number;
  lineHeight?: number;
  numbered?: boolean;
  color?: Color;
  cursorColor?: Color;
  disabledColor?: Color;
  detailColor?: Color;
  width?: number;
  /** Draw a highlight bar behind the selected row instead of a caret. */
  bar?: boolean;
}

export class Menu {
  index = 0;
  constructor(public items: MenuItem[]) {
    this.clampToEnabled(1);
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    if (this.index >= items.length) this.index = Math.max(0, items.length - 1);
    this.clampToEnabled(1);
  }

  private clampToEnabled(dir: number): void {
    if (this.items.length === 0) return;
    let guard = 0;
    while (this.items[this.index]?.disabled && guard++ < this.items.length) {
      this.index = (this.index + dir + this.items.length) % this.items.length;
    }
  }

  move(dir: number): void {
    if (this.items.length === 0) return;
    this.index = (this.index + dir + this.items.length) % this.items.length;
    this.clampToEnabled(dir);
    audio.sfx("move");
  }

  /** Returns the chosen index, or null if nothing was picked this frame. */
  update(opts: { numbered?: boolean; wrapDigits?: boolean } = {}): number | null {
    if (input.pressed("ArrowUp")) this.move(-1);
    if (input.pressed("ArrowDown")) this.move(1);
    if (opts.numbered !== false) {
      const d = input.digit();
      if (d !== null) {
        const target = d === 0 ? 9 : d - 1;
        if (target < this.items.length && !this.items[target]?.disabled) {
          this.index = target;
          audio.sfx("select");
          return target;
        }
        audio.sfx("back");
        return null;
      }
    }
    if (input.confirm()) {
      if (this.items[this.index]?.disabled) {
        audio.sfx("back");
        return null;
      }
      audio.sfx("select");
      return this.index;
    }
    return null;
  }

  draw(o: MenuDrawOpts): void {
    const lh = o.lineHeight ?? CELL_H + 2;
    const numbered = o.numbered !== false;
    this.items.forEach((item, i) => {
      const y = o.y + i * lh;
      const selected = i === this.index;
      const label = `${numbered ? `${i + 1}. ` : ""}${item.label}`;
      let ink = o.color ?? C.GREY;
      if (item.disabled) ink = o.disabledColor ?? C.DARKGREY;
      else if (selected) ink = o.cursorColor ?? C.WHITE;

      if (selected && o.bar && !item.disabled) {
        const w = o.width ?? textWidth(label) + 8;
        screen.rect(o.x - 3, y - 1, w, lh - 1, C.BLUE);
      }
      if (selected && !o.bar) screen.text(o.x - 8, y, blink(560, 0.65) ? ">" : " ", C.YELLOW);
      screen.text(o.x, y, label, ink);
      if (item.detail) {
        const dx = o.x + (o.width ?? 0) - textWidth(item.detail);
        screen.text(o.width ? dx : o.x + textWidth(label) + CELL_W, y, item.detail, o.detailColor ?? C.CYAN);
      }
    });
    const note = this.items[this.index]?.note;
    if (note) {
      const lines = wrapText(note, COLS - 6);
      lines.forEach((ln, i) => {
        screen.textCentered(SCREEN_W / 2, SCREEN_H - 30 + i * CELL_H, ln, C.BRIGHTGREEN);
      });
    }
  }
}

export class TextField {
  value = "";
  constructor(
    public maxLen = 12,
    initial = "",
  ) {
    this.value = initial;
  }

  /** Returns true when the field is submitted with RETURN. */
  update(opts: { allowEmpty?: boolean; charset?: RegExp } = {}): boolean {
    const charset = opts.charset ?? /[A-Za-z' .\-]/;
    for (const ch of input.text()) {
      if (ch === "\b") {
        if (this.value.length > 0) {
          this.value = this.value.slice(0, -1);
          audio.sfx("type");
        }
      } else if (charset.test(ch) && this.value.length < this.maxLen) {
        this.value += ch;
        audio.sfx("type");
      }
    }
    if (input.pressed("Enter", "NumpadEnter")) {
      if (this.value.trim().length > 0 || opts.allowEmpty) {
        audio.sfx("select");
        return true;
      }
      audio.sfx("back");
    }
    return false;
  }

  draw(x: number, y: number, width = this.maxLen, color: Color = C.WHITE, active = true): void {
    for (let i = 0; i < width; i++) screen.text(x + i * CELL_W, y + 1, "_", C.DARKGREY);
    screen.text(x, y, this.value, color);
    if (active && blink(620, 0.55)) {
      screen.rect(x + this.value.length * CELL_W, y, CELL_W - 1, CELL_H - 1, color);
    }
  }
}

/** Draws a labelled horizontal gauge, e.g. health or the foraging timer. */
export function gauge(
  x: number,
  y: number,
  w: number,
  fraction: number,
  fg: Color,
  bg: Color = C.DARKGREY,
  border: Color = C.GREY,
): void {
  screen.frame(x, y, w, 7, border);
  const inner = w - 4;
  screen.rect(x + 2, y + 2, inner, 3, bg);
  screen.rect(x + 2, y + 2, Math.max(0, Math.round(inner * Math.min(1, Math.max(0, fraction)))), 3, fg);
}
