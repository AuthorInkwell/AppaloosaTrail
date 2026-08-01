/** Boot: wire up the display, input and scene stack, then run the frame loop. */

import { audio } from "./engine/audio";
import { input } from "./engine/input";
import { scenes } from "./engine/scene";
import { C, SCREEN_H, SCREEN_W, screen } from "./engine/screen";
import { wrapText } from "./engine/ui";
import { LandmarkScene } from "./game/scenes/landmark";
import { RiverScene } from "./game/scenes/river";
import { ArrivalScene, ForkScene } from "./game/scenes/finale";
import { runEvent, setArrivalDispatcher, setTitleFactory } from "./game/scenes/eventrunner";
import { TitleScene } from "./game/scenes/setup";
import { session } from "./game/session";
import { EVENTS } from "./game/data/events";
import { TRAIL } from "./game/data/trail";
import { loadImportedMusic } from "./game/systems/music";

const canvas = document.getElementById("screen") as HTMLCanvasElement | null;
if (!canvas) throw new Error("canvas #screen missing");

screen.attach(canvas);
screen.debugLayout = new URLSearchParams(location.search).has("layout");
input.attach();
input.onFirstGesture(() => audio.init());

// Imported tracks arrive asynchronously; the built-ins cover the gap.
void loadImportedMusic().then((loaded) => {
  if (loaded.length) console.info(`music: imported ${loaded.join(", ")}`);
});

setTitleFactory(() => new TitleScene());
setArrivalDispatcher((g, landmark, next) => {
  switch (landmark.kind) {
    case "river":
      scenes.push(new RiverScene(g, landmark, next));
      break;
    case "fork":
      scenes.push(new ForkScene(g, landmark, next));
      break;
    case "end":
      scenes.push(new ArrivalScene(g, landmark));
      break;
    default:
      scenes.push(new LandmarkScene(g, landmark, { onDone: next }));
      break;
  }
});

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

scenes.push(new TitleScene());

// Exposed for the scripted smoke test in tools/smoketest.mjs.
(window as unknown as { __appaloosaDebug: () => unknown }).__appaloosaDebug = () => {
  const g = session.game;
  return {
    scene: scenes.top?.name ?? null,
    depth: scenes.depth,
    music: audio.nowPlaying,
    peak: Number(audio.peakLevel().toFixed(3)),
    game: g
      ? {
          day: g.day,
          miles: Math.round(g.miles),
          food: Math.round(g.food),
          bits: Math.round(g.bits),
          team: g.team,
          alive: g.ponies.filter((p) => p.alive).length,
          landmarkIndex: g.landmarkIndex,
          finished: g.finished,
          outcome: g.outcome,
        }
      : null,
  };
};

if (import.meta.env.DEV) {
  // Dev-only shortcuts so the smoke test and the layout audit can reach any
  // screen without playing the whole trail to get there.
  const hooks = window as unknown as {
    __appaloosaCheat: (patch: Record<string, unknown>) => void;
    __appaloosaEventIds: () => string[];
    __appaloosaShowEvent: (id: string) => boolean;
    __appaloosaShowLandmark: (id: string) => boolean;
    __appaloosaHurtParty: (health: number, criticalDays: number) => void;
  };
  (window as unknown as { __appaloosaAudio: typeof audio }).__appaloosaAudio = audio;
  hooks.__appaloosaHurtParty = (health, criticalDays) => {
    const g = session.game;
    if (!g) return;
    for (const p of g.ponies) {
      if (!p.alive) continue;
      p.health = health;
      p.criticalDays = criticalDays;
    }
    // Starve them too, or the daily recovery lifts them straight back out.
    g.potions = 0;
    g.food = 0;
    g.rations = "bare";
    g.pace = "grueling";
  };
  hooks.__appaloosaCheat = (patch) => {
    if (session.game) Object.assign(session.game, patch);
  };
  hooks.__appaloosaEventIds = () => EVENTS.map((e) => e.id);
  hooks.__appaloosaShowEvent = (id) => {
    const event = EVENTS.find((e) => e.id === id);
    if (!event || !session.game) return false;
    runEvent(session.game, event, () => undefined);
    return true;
  };
  hooks.__appaloosaShowLandmark = (id) => {
    const landmark = TRAIL.find((l) => l.id === id);
    if (!landmark || !session.game) return false;
    session.game.miles = landmark.mile;
    session.game.flags[`arrived:${landmark.id}`] = true;
    const done = () => undefined;
    if (landmark.kind === "river") scenes.push(new RiverScene(session.game, landmark, done));
    else if (landmark.kind === "fork") scenes.push(new ForkScene(session.game, landmark, done));
    else if (landmark.kind === "end") scenes.push(new ArrivalScene(session.game, landmark));
    else scenes.push(new LandmarkScene(session.game, landmark, { onDone: done }));
    return true;
  };
}

let last = performance.now();
let crashed: string | null = null;

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  input.beginFrame();

  if (crashed) {
    drawCrash(crashed);
    requestAnimationFrame(frame);
    return;
  }

  try {
    const top = scenes.top;
    if (!top?.capturesText) {
      if (input.pressed("m")) audio.toggleMute();
      if (input.pressed("f")) toggleFullscreen();
    }
    scenes.update(dt);
    scenes.draw();
  } catch (err) {
    crashed = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
    console.error(err);
  }
  requestAnimationFrame(frame);
}

function drawCrash(message: string): void {
  screen.clear(C.BLUE);
  screen.frame(0, 0, SCREEN_W, SCREEN_H, C.WHITE);
  screen.textCentered(SCREEN_W / 2, 10, "THE WAGON HAS THROWN A WHEEL", C.YELLOW);
  let y = 26;
  for (const line of wrapText(message, 50).slice(0, 18)) {
    screen.text(8, y, line, C.WHITE);
    y += 8;
  }
  screen.textCentered(SCREEN_W / 2, SCREEN_H - 14, "reload the page to start again", C.BRIGHTCYAN);
}

requestAnimationFrame(frame);
