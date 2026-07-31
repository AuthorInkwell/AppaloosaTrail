/** Shared scene furniture: modal pages, choice dialogs and the status bar. */

import { SfxName, audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, CELL_H, CELL_W, Color, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { COLS, Menu, blink, footer, panel, wrapText } from "../../engine/ui";
import { TRAIL } from "../data/trail";
import {
  GameState,
  RATION_INFO,
  PACE_INFO,
  formatDate,
  healthLabel,
  livingPonies,
  partyHealth,
} from "../state";
import { weatherLabel } from "../systems/travel";

export type Painter = (x: number, y: number, w: number, h: number) => void;

export interface Page {
  title?: string;
  text: string;
  color?: Color;
  sfx?: SfxName;
  art?: Painter;
  artHeight?: number;
}

const PANEL_W = 268;

/**
 * A stack of modal panels shown one at a time. Used for event results, daily
 * news, warnings and anything else the player must acknowledge.
 */
export class Pages implements Scene {
  readonly name = "pages";
  transparent: boolean;
  private index = 0;
  private lines: string[] = [];

  constructor(
    private pages: Page[],
    private onDone?: () => void,
    opts: { transparent?: boolean } = {},
  ) {
    this.transparent = opts.transparent ?? true;
    if (this.pages.length === 0) this.pages = [{ text: "" }];
  }

  enter(): void {
    this.prepare();
  }

  private prepare(): void {
    const page = this.pages[this.index]!;
    this.lines = wrapText(page.text, Math.floor((PANEL_W - 16) / CELL_W));
    if (page.sfx) audio.sfx(page.sfx);
  }

  update(): void {
    // ESC skips the rest of a long message sequence.
    if (input.cancel()) {
      audio.sfx("back");
      scenes.pop();
      this.onDone?.();
      return;
    }
    if (input.confirm() || input.pressed("Enter")) {
      audio.sfx("select");
      this.index++;
      if (this.index >= this.pages.length) {
        scenes.pop();
        this.onDone?.();
      } else {
        this.prepare();
      }
    }
  }

  draw(): void {
    const page = this.pages[this.index]!;
    const artH = page.art ? (page.artHeight ?? 42) : 0;
    const bodyH = this.lines.length * CELL_H;
    const titleH = page.title ? CELL_H + 6 : 0;
    const h = Math.max(52, 20 + titleH + artH + bodyH);
    const x = (SCREEN_W - PANEL_W) / 2;
    const y = Math.max(14, (SCREEN_H - h) / 2 - 8);

    panel(x, y, PANEL_W, h, { fill: C.BLACK, border: C.GREY, shadow: true, double: true });
    let cy = y + 9;
    if (page.title) {
      screen.textCentered(SCREEN_W / 2, cy, page.title.toUpperCase(), C.YELLOW);
      screen.hline(x + 10, cy + CELL_H, PANEL_W - 20, C.DARKGREY);
      cy += CELL_H + 6;
    }
    if (page.art) {
      page.art(x + 8, cy, PANEL_W - 16, artH);
      cy += artH;
    }
    for (const line of this.lines) {
      screen.text(x + 9, cy, line, page.color ?? C.WHITE);
      cy += CELL_H;
    }
    if (blink(700, 0.6)) {
      const label = this.index < this.pages.length - 1 ? "more \u0004" : "press SPACE BAR";
      screen.textRight(x + PANEL_W - 8, y + h - CELL_H - 3, label, C.CYAN);
    }
  }
}

export function showPages(pages: Page[], onDone?: () => void): void {
  scenes.push(new Pages(pages, onDone));
}

export function showMessages(messages: string[], title: string | undefined, onDone?: () => void): void {
  if (messages.length === 0) {
    onDone?.();
    return;
  }
  showPages(
    messages.map((text) => ({ title, text })),
    onDone,
  );
}

/** Modal menu over the current scene. */
export class ChoiceScene implements Scene {
  readonly name = "choice";
  transparent = true;
  private menu: Menu;
  private lines: string[];

  constructor(
    private title: string,
    prompt: string,
    labels: string[],
    private onPick: (index: number) => void,
    private opts: { art?: Painter; artHeight?: number; width?: number } = {},
  ) {
    this.menu = new Menu(labels.map((label) => ({ label })));
    this.lines = wrapText(prompt, Math.floor(((opts.width ?? PANEL_W) - 16) / CELL_W));
  }

  update(): void {
    const picked = this.menu.update();
    if (picked !== null) {
      scenes.pop();
      this.onPick(picked);
    }
  }

  draw(): void {
    const w = this.opts.width ?? PANEL_W;
    const artH = this.opts.art ? (this.opts.artHeight ?? 40) : 0;
    const h = 30 + artH + this.lines.length * CELL_H + this.menu.items.length * (CELL_H + 2);
    const x = (SCREEN_W - w) / 2;
    const y = Math.max(10, (SCREEN_H - h) / 2 - 6);
    panel(x, y, w, h, { fill: C.BLACK, border: C.GREY, shadow: true, double: true });
    let cy = y + 8;
    screen.textCentered(SCREEN_W / 2, cy, this.title.toUpperCase(), C.YELLOW);
    screen.hline(x + 10, cy + CELL_H, w - 20, C.DARKGREY);
    cy += CELL_H + 5;
    if (this.opts.art) {
      this.opts.art(x + 8, cy, w - 16, artH);
      cy += artH;
    }
    for (const line of this.lines) {
      screen.text(x + 9, cy, line, C.WHITE);
      cy += CELL_H;
    }
    cy += 3;
    this.menu.draw({ x: x + 16, y: cy, cursorColor: C.BRIGHTGREEN, color: C.GREY, width: w - 32, bar: true });
  }
}

export function askChoice(
  title: string,
  prompt: string,
  labels: string[],
  onPick: (index: number) => void,
  opts: { art?: Painter; artHeight?: number; width?: number } = {},
): void {
  scenes.push(new ChoiceScene(title, prompt, labels, onPick, opts));
}

export function askYesNo(title: string, prompt: string, onPick: (yes: boolean) => void): void {
  askChoice(title, prompt, ["Yes", "No"], (i) => onPick(i === 0));
}

// ---------------------------------------------------------------------------
// Status readouts
// ---------------------------------------------------------------------------

export function nextLandmarkInfo(g: GameState): { name: string; milesAway: number } {
  const next = TRAIL[g.landmarkIndex];
  if (!next) return { name: "Appaloosa", milesAway: 0 };
  return { name: next.name, milesAway: Math.max(0, Math.round(next.mile - g.miles)) };
}

/** The bottom-of-screen readout used on the travel screen. */
export function drawStatusPanel(g: GameState, y: number): void {
  const h = SCREEN_H - y;
  screen.rect(0, y, SCREEN_W, h, C.BLACK);
  screen.hline(0, y, SCREEN_W, C.GREY);
  const next = nextLandmarkInfo(g);
  const col1 = 5;
  const col2 = 166;
  let row = y + 4;
  const line = (x: number, label: string, value: string, valueColor: Color = C.WHITE) => {
    screen.text(x, row, label, C.CYAN);
    screen.text(x + (label.length + 1) * CELL_W, row, value, valueColor);
  };
  line(col1, "Date:", formatDate(g.date));
  line(col2, "Weather:", weatherLabel(g.weather), C.BRIGHTCYAN);
  row += CELL_H + 1;
  line(col1, "Health:", healthLabel(partyHealth(g)), healthColor(partyHealth(g)));
  line(col2, "Food:", `${Math.round(g.food)} baskets`, g.food < 20 ? C.BRIGHTRED : C.WHITE);
  row += CELL_H + 1;
  line(col1, "Team:", `${g.team} in harness`, g.team === 0 ? C.BRIGHTRED : C.WHITE);
  line(col2, "Bits:", `${Math.round(g.bits)}`);
  row += CELL_H + 1;
  line(col1, "Gone:", `${Math.round(g.miles)} mi`);
  screen.text(96, row, "Next:", C.CYAN);
  screen.text(132, row, `${next.name.slice(0, 20)}, ${next.milesAway} mi`, C.YELLOW);
  row += CELL_H + 3;
  screen.text(col1, row, `${PACE_INFO[g.pace].name}, ${RATION_INFO[g.rations].name} rations`, C.DARKGREY);
}

export function healthColor(h: number): Color {
  if (h >= 85) return C.BRIGHTGREEN;
  if (h >= 65) return C.YELLOW;
  if (h >= 45) return C.BROWN;
  if (h >= 25) return C.BRIGHTRED;
  return C.RED;
}

/** Compact supplies readout used by landmark and store screens. */
export function drawSupplyStrip(g: GameState, x: number, y: number, w: number): void {
  screen.rect(x, y, w, 11, C.BLUE);
  screen.frame(x, y, w, 11, C.GREY);
  const right = `health: ${healthLabel(partyHealth(g))}`;
  const parts = [
    `${Math.round(g.bits)} bits`,
    `${Math.round(g.food)} baskets`,
    `team ${g.team}`,
    `${g.potions} potions`,
  ];
  // Drop trailing entries until the line clears the right-hand readout.
  const budget = Math.floor((w - 12) / CELL_W) - right.length;
  while (parts.length > 1 && parts.join(" \u0006 ").length > budget) parts.pop();
  screen.text(x + 4, y + 2, parts.join(" \u0006 "), C.WHITE);
  screen.textRight(x + w - 4, y + 2, right, healthColor(partyHealth(g)));
}

export function ponyList(g: GameState): string[] {
  return livingPonies(g).map((p) => p.name);
}

/** "press SPACE BAR to continue" with a standard position. */
export function continuePrompt(y = SCREEN_H - 12, label = "press SPACE BAR to continue"): boolean {
  footer(label, C.YELLOW, y);
  if (input.confirm() || input.pressed("Enter")) {
    audio.sfx("select");
    return true;
  }
  return false;
}

export function wrapForPanel(text: string, panelWidth: number): string[] {
  return wrapText(text, Math.floor((panelWidth - 16) / CELL_W));
}

export const FULL_COLS = COLS;
