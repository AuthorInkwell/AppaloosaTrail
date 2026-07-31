/** Boot: wire up the display, input and scene stack, then run the frame loop. */

import { audio } from "./engine/audio";
import { input } from "./engine/input";
import { scenes } from "./engine/scene";
import { C, SCREEN_H, SCREEN_W, screen } from "./engine/screen";
import { wrapText } from "./engine/ui";
import { LandmarkScene } from "./game/scenes/landmark";
import { RiverScene } from "./game/scenes/river";
import { ArrivalScene, ForkScene } from "./game/scenes/finale";
import { setArrivalDispatcher, setTitleFactory } from "./game/scenes/eventrunner";
import { TitleScene } from "./game/scenes/setup";

const canvas = document.getElementById("screen") as HTMLCanvasElement | null;
if (!canvas) throw new Error("canvas #screen missing");

screen.attach(canvas);
input.attach();
input.onFirstGesture(() => audio.init());

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
