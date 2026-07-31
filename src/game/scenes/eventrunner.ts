/**
 * Glue between the day simulation and the modal scenes: plays out a day's
 * results in order, runs random events, and handles memorials.
 */

import { audio } from "../../engine/audio";
import { input } from "../../engine/input";
import { Scene, scenes } from "../../engine/scene";
import { C, CELL_H, SCREEN_H, SCREEN_W, screen } from "../../engine/screen";
import { TextField, blink, footer, panel, screenFrame, wrapText } from "../../engine/ui";
import { GRAVE } from "../../art/sprites";
import { MEMORIAL_THEME } from "../data/music";
import { EventContext, TrailEvent, availableChoices, eventText, markEventSeen } from "../data/events";
import { Landmark } from "../data/trail";
import { session } from "../session";
import { GameState, PonyState, formatDate, season } from "../state";
import { terrainAt } from "../data/trail";
import { DayResult, passDays } from "../systems/travel";
import { addMarker } from "../systems/epitaphs";
import { askChoice, showMessages, showPages } from "./common";

export type Step = (next: () => void) => void;

/** Runs a list of steps in order; each step calls `next` when it is finished. */
export function runSteps(steps: Step[]): void {
  let i = 0;
  const next = (): void => {
    if (i < steps.length) {
      const step = steps[i++]!;
      step(next);
    }
  };
  next();
}

function contextFor(g: GameState): EventContext {
  return { g, r: session.rng, terrain: terrainAt(g.miles), season: season(g.date) };
}

export function runEvent(g: GameState, event: TrailEvent, onDone: () => void): void {
  const ctx = contextFor(g);
  markEventSeen(g, event);
  const choices = availableChoices(event, ctx);

  const resolveWith = (outcome: { text: string; days?: number; sfx?: import("../../engine/audio").SfxName }): void => {
    const extra = outcome.days ? passDays(g, outcome.days) : [];
    const pages = [{ title: event.title, text: outcome.text, sfx: outcome.sfx }];
    if (outcome.days) {
      pages.push({
        title: undefined as unknown as string,
        text: `You lose ${outcome.days} ${outcome.days === 1 ? "day" : "days"}. It is now ${formatDate(g.date)}.`,
        sfx: undefined,
      });
    }
    for (const m of extra) pages.push({ title: undefined as unknown as string, text: m, sfx: "bad" });
    showPages(pages, onDone);
  };

  showPages([{ title: event.title, text: eventText(event, ctx), sfx: event.tone === "bad" ? "bad" : "day" }], () => {
    if (choices.length > 0) {
      askChoice(
        event.title,
        "What will you do?",
        choices.map((c) => c.label),
        (i) => resolveWith(choices[i]!.resolve(ctx)),
      );
    } else if (event.resolve) {
      resolveWith(event.resolve(ctx));
    } else {
      onDone();
    }
  });
}

/** Plays out everything that happened during one simulated day. */
export function runDayResult(g: GameState, result: DayResult, onDone: () => void): void {
  const steps: Step[] = [];

  if (result.messages.length > 0) {
    steps.push((next) => showMessages(result.messages, "On the trail", next));
  }
  if (result.deaths.length > 0) {
    steps.push((next) => scenes.push(new MemorialScene(g, result.deaths, next)));
  }
  if (result.gameOver) {
    steps.push(() => scenes.reset(new GameOverScene(g)));
    runSteps(steps);
    return;
  }
  if (result.event) {
    const ev = result.event;
    steps.push((next) => runEvent(g, ev, next));
  }
  if (result.arrived) {
    const landmark = result.arrived;
    steps.push((next) => arriveAt(g, landmark, next));
  }
  steps.push(() => onDone());
  runSteps(steps);
}

/** Dispatches to the right arrival scene. Imported lazily to avoid a cycle. */
function arriveAt(g: GameState, landmark: Landmark, next: () => void): void {
  void g;
  void next;
  void landmark;
  arrivalDispatcher(g, landmark, next);
}

type ArrivalDispatcher = (g: GameState, landmark: Landmark, next: () => void) => void;
let arrivalDispatcher: ArrivalDispatcher = () => {
  throw new Error("arrival dispatcher not installed");
};

/** Installed once at start-up by main.ts, which knows about all the scenes. */
export function setArrivalDispatcher(fn: ArrivalDispatcher): void {
  arrivalDispatcher = fn;
}

// ---------------------------------------------------------------------------
// Memorial
// ---------------------------------------------------------------------------

export class MemorialScene implements Scene {
  readonly name = "memorial";
  capturesText = true;
  private field = new TextField(22);
  private stage: "mourn" | "carve" | "done" = "mourn";
  private index = 0;

  constructor(
    private g: GameState,
    private dead: PonyState[],
    private onDone: () => void,
  ) {}

  enter(): void {
    audio.playSong(MEMORIAL_THEME);
    audio.sfx("sad");
  }

  exit(): void {
    audio.stopMusic();
  }

  private current(): PonyState {
    return this.dead[Math.min(this.index, this.dead.length - 1)]!;
  }

  private advance(): void {
    this.index++;
    this.stage = "mourn";
    this.field.value = "";
    if (this.index >= this.dead.length) {
      scenes.pop();
      this.onDone();
    }
  }

  update(): void {
    if (this.stage === "mourn") {
      if (input.confirm() || input.pressed("Enter")) {
        audio.sfx("select");
        this.stage = "carve";
      }
      return;
    }
    if (this.stage === "carve") {
      if (this.field.update({ allowEmpty: true })) {
        const message = this.field.value.trim();
        if (message) {
          addMarker({ name: this.current().name, message, mile: Math.round(this.g.miles) });
        }
        this.advance();
      } else if (input.cancel()) {
        audio.sfx("back");
        this.advance();
      }
    }
  }

  draw(): void {
    const pony = this.current();
    screenFrame("");
    screen.clear(C.BLACK);
    screen.frame(0, 0, SCREEN_W, SCREEN_H, C.DARKGREY);

    screen.sprite(GRAVE, SCREEN_W / 2 - 22, 30, { scale: 4 });
    screen.rect(0, 30 + 44 * 1 + 0, 0, 0, C.BLACK);
    screen.ellipse(SCREEN_W / 2, 76, 46, 6, C.GREEN);

    screen.textCentered(SCREEN_W / 2, 92, `${pony.name} has passed on.`, C.WHITE);
    const lines = wrapText(
      `Cause: ${pony.causeOfDeath ?? "the trail"}. ${pony.dateOfDeath ?? formatDate(this.g.date)}.`,
      44,
    );
    let y = 104;
    for (const l of lines) {
      screen.textCentered(SCREEN_W / 2, y, l, C.GREY);
      y += CELL_H;
    }

    if (this.stage === "mourn") {
      screen.textCentered(SCREEN_W / 2, 126, "The party stops to bury a friend.", C.BROWN);
      footer("press SPACE BAR to continue");
    } else {
      screen.textCentered(SCREEN_W / 2, 124, "You may carve a message on the marker:", C.CYAN);
      panel(58, 136, 204, 18, { fill: C.BLACK, border: C.GREY });
      this.field.draw(64, 141, 22, C.WHITE, true);
      footer("RETURN to carve it, ESC to leave it blank", C.YELLOW, SCREEN_H - 18);
    }
    if (this.dead.length > 1 && blink()) {
      screen.textRight(SCREEN_W - 8, 8, `${this.index + 1} of ${this.dead.length}`, C.DARKGREY);
    }
  }
}

// ---------------------------------------------------------------------------
// Failure
// ---------------------------------------------------------------------------

export class GameOverScene implements Scene {
  readonly name = "gameover";
  private timer = 0;

  constructor(private g: GameState) {}

  enter(): void {
    audio.stopMusic();
    audio.sfx("sad");
    audio.playSong(MEMORIAL_THEME);
  }

  exit(): void {
    audio.stopMusic();
  }

  update(dt: number): void {
    this.timer += dt;
    if (this.timer > 1 && (input.confirm() || input.pressed("Enter"))) {
      audio.sfx("select");
      returnToTitle();
    }
  }

  draw(): void {
    screenFrame("THE JOURNEY ENDS HERE");
    const g = this.g;
    let y = 22;
    const lines = wrapText(
      "No pony of your party is left to carry the wagon west. Somewhere ahead, Appaloosa goes on planting apple trees without you.",
      46,
    );
    for (const l of lines) {
      screen.textCentered(SCREEN_W / 2, y, l, C.WHITE);
      y += CELL_H;
    }
    y += 6;
    screen.textCentered(SCREEN_W / 2, y, `${Math.round(g.miles)} miles travelled in ${g.day} days`, C.YELLOW);
    y += 14;
    screen.text(30, y, "IN MEMORIAM", C.BROWN);
    y += 10;
    for (const p of g.ponies) {
      screen.text(30, y, p.name.slice(0, 16), C.GREY);
      screen.text(140, y, (p.causeOfDeath ?? "lost on the trail").slice(0, 24), C.DARKGREY);
      y += CELL_H + 1;
    }
    footer("press SPACE BAR to return to the title");
  }
}

/** Installed by main.ts so scenes can get home without importing the title. */
let titleFactory: () => Scene = () => {
  throw new Error("title factory not installed");
};

export function setTitleFactory(fn: () => Scene): void {
  titleFactory = fn;
}

export function returnToTitle(): void {
  session.clear();
  scenes.reset(titleFactory());
}
