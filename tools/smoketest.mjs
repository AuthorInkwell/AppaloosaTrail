/**
 * Scripted playthrough against a running dev server. Drives the game with
 * synthetic key presses, waits on the actual scene stack rather than on
 * timers, captures screenshots, and fails on any console error.
 *
 *   node tools/smoketest.mjs [--url http://127.0.0.1:5173] [--out shots]
 */

import { mkdir, rm } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const URL = arg("url", "http://127.0.0.1:5173/");
const OUT = arg("out", "shots");
const CHROME = arg("chrome", "/usr/local/bin/google-chrome");
const RUN_SECONDS = Number(arg("seconds", "240"));

const problems = [];
let shotIndex = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900", "--mute-audio"],
    defaultViewport: { width: 1280, height: 860 },
  });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.waitForSelector("#screen");
  await sleep(400);

  const state = () => page.evaluate(() => window.__appaloosaDebug());
  const shot = async (label) => {
    const name = `${String(++shotIndex).padStart(2, "0")}-${label}`;
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`  shot ${name}`);
  };
  const press = async (k, delay = 110) => {
    await page.keyboard.press(k);
    await sleep(delay);
  };
  const hold = async (k, ms) => {
    await page.keyboard.down(k);
    await sleep(ms);
    await page.keyboard.up(k);
  };

  /** Presses `k` until the top scene is `want`, or throws. */
  const until = async (want, k = "Space", limit = 40) => {
    for (let i = 0; i < limit; i++) {
      const s = await state();
      if ((Array.isArray(want) ? want : [want]).includes(s.scene)) return s;
      await press(k, 130);
    }
    const s = await state();
    throw new Error(`expected scene ${want}, stuck on ${s.scene} (depth ${s.depth})`);
  };
  const expect = async (want, note = "") => {
    const s = await state();
    if (s.scene !== want) throw new Error(`expected scene ${want} but found ${s.scene} ${note}`);
    return s;
  };

  console.log("title screen");
  await shot("title");
  await expect("title");

  await press("Digit3");
  await expect("text");
  await shot("instructions");
  await until("title");

  await press("Digit4");
  await expect("hof");
  await shot("hall-of-fame");
  await until("title");

  console.log("new game");
  await press("Digit1");
  await expect("origin");
  await shot("origin-unicorn");
  await press("ArrowDown");
  await press("ArrowDown");
  await shot("origin-earth");
  await press("Digit3"); // earth pony
  await expect("naming");
  await shot("naming-empty");
  await press("F2");
  await shot("naming-random");
  for (let i = 0; i < 5; i++) await press("Enter", 140);
  await expect("departure");
  await shot("departure");

  await press("Digit2"); // April
  await until("store");
  await shot("store");

  console.log("outfitting");
  const buy = async (row, times, key = "ArrowRight") => {
    for (let i = 0; i < row; i++) await press("ArrowDown", 60);
    for (let i = 0; i < times; i++) await press(key, 45);
    for (let i = 0; i < row; i++) await press("ArrowUp", 60);
  };
  await buy(0, 6); // team
  await buy(1, 45); // food, +10 each
  await buy(2, 5); // cloaks
  await buy(3, 1);
  await buy(4, 1);
  await buy(5, 1);
  await buy(6, 2); // potions
  await shot("store-cart");
  await press("Enter");
  await until("store");
  await shot("store-bought");
  await press("Space"); // leave
  await until(["travel", "pages", "choice"], "Space", 6);
  await sleep(1200);
  await shot("travel");

  console.log("size up menus");
  const backToTravel = async () => {
    for (let i = 0; i < 20; i++) {
      const s = await state();
      if (s.scene === "travel") return;
      await press("Escape", 120);
      const t = await state();
      if (t.scene === s.scene) await press("Space", 120);
    }
  };
  const openSizeUp = async () => {
    await backToTravel();
    await press("Space");
    await expect("sizeup");
  };

  await openSizeUp();
  await shot("sizeup");
  await press("Digit2");
  await expect("supplies");
  await shot("supplies");
  await press("Space");

  await press("Digit3");
  await expect("map");
  await shot("map");
  await press("Space");

  await press("Digit6");
  await expect("party");
  await shot("party");
  await press("Space");

  await press("Digit4");
  await expect("pace");
  await shot("pace");
  await press("Digit2"); // strenuous

  await press("Digit5");
  await expect("rations");
  await shot("rations");
  await press("Digit1"); // filling

  console.log("foraging");
  await press("Digit8");
  await expect("forage");
  await shot("forage-choose");
  await press("Digit3"); // two hours
  await sleep(2500);
  await shot("forage-play");
  await hold("ArrowLeft", 600);
  await hold("ArrowDown", 400);
  await hold("ArrowRight", 900);
  await hold("ArrowUp", 400);
  await sleep(2500);
  await shot("forage-play-2");
  await page.keyboard.press("Escape");
  await sleep(400);
  await shot("forage-result");
  await until(["sizeup", "travel"], "Space", 12);

  console.log("save menu");
  await openSizeUp();
  await press("Digit0");
  await expect("save");
  await shot("save-menu");
  await press("Digit1");
  await sleep(300);
  await shot("saved");
  await until("save", "Space", 6);
  const before = await state();

  console.log("quit to title and reload the save");
  await press("Digit4"); // quit to the title screen
  await press("Digit1"); // confirm
  await until("title", "Space", 8);
  await press("Digit2"); // continue a saved journey
  await expect("load");
  await shot("load-menu");
  await press("Digit1");
  await until("travel", "Space", 8);
  const after = await state();
  if (!after.game || after.game.miles !== before.game.miles) {
    throw new Error(`load mismatch: saved at ${before.game?.miles} mi, loaded ${after.game?.miles} mi`);
  }
  console.log(`  loaded at ${after.game.miles} mi, day ${after.game.day}`);
  await shot("loaded");
  await backToTravel();

  if (arg("skip-ahead", "")) {
    const miles = Number(arg("skip-ahead", "1500"));
    console.log(`skipping ahead to mile ${miles}`);
    await page.evaluate((m) => window.__appaloosaCheat({ miles: m, landmarkIndex: 14, food: 260, bits: 260 }), miles);
  }

  console.log(`long haul for ${RUN_SECONDS}s`);
  const deadline = Date.now() + RUN_SECONDS * 1000;
  let lastShot = 0;
  const seen = new Set();
  while (Date.now() < deadline) {
    const s = await state();
    if (s.game?.finished) {
      console.log("  run finished:", s.game.outcome);
    }
    if (!seen.has(s.scene)) {
      seen.add(s.scene);
      await shot(`scene-${s.scene}`);
    }
    // Steer through the interactive scenes rather than just mashing SPACE.
    if (s.scene === "forage") {
      await hold("ArrowRight", 500);
      await hold("ArrowLeft", 500);
      continue;
    }
    if (s.scene === "everfree") {
      await hold("ArrowUp", 400);
      await hold("ArrowRight", 700);
      await hold("ArrowDown", 400);
      continue;
    }
    if (s.scene === "memorial") {
      await press("Enter", 200);
      await press("Enter", 200);
      continue;
    }
    if (s.scene === "landmark" || s.scene === "river" || s.scene === "fork") {
      if (Date.now() - lastShot > 6000) {
        lastShot = Date.now();
        await shot(`${s.scene}-${s.game?.landmarkIndex ?? 0}`);
      }
      // 1 continues at a landmark, 2 caulks and floats a river, 2 takes the
      // Everfree at the fork so the minigame gets exercised.
      await press(s.scene === "landmark" ? "Digit1" : "Digit2", 200);
      continue;
    }
    if (s.scene === "arrival" || s.scene === "gameover") {
      await shot(`end-${s.scene}`);
      for (let i = 0; i < 12; i++) await press("Space", 400);
      await shot("end-followup");
      break;
    }
    await press("Space", 200);
    if (Date.now() - lastShot > 15000) {
      lastShot = Date.now();
      await shot(`longhaul-${s.game?.miles ?? 0}mi`);
    }
  }

  const finalState = await state();
  console.log("final state:", JSON.stringify(finalState));
  await shot("final");
  await browser.close();

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of [...new Set(problems)]) console.error(` - ${p}`);
    process.exit(1);
  }
  console.log(`\nOK - ${shotIndex} screenshots in ${OUT}/`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
