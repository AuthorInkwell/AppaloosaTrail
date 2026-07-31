/** Captures canvas-only screenshots of key scenes for documentation. */

import { mkdir, rm } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] ?? "shots-pr";
const URL = "http://127.0.0.1:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  defaultViewport: { width: 1400, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.waitForSelector("#screen");
await sleep(500);

const canvas = await page.$("#screen");
const state = () => page.evaluate(() => window.__appaloosaDebug());
const press = async (k, d = 130) => {
  await page.keyboard.press(k);
  await sleep(d);
};
const shot = async (name) => {
  await canvas.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}`);
};
const until = async (want, k = "Space", limit = 40) => {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if ((Array.isArray(want) ? want : [want]).includes(s.scene)) return s;
    await press(k);
  }
  throw new Error(`stuck waiting for ${want}: ${(await state()).scene}`);
};

await shot("01-title");
await press("Digit1");
await shot("02-origin");
await press("Digit3");
await press("F2");
await shot("03-naming");
for (let i = 0; i < 5; i++) await press("Enter", 140);
await shot("04-departure");
await press("Digit2");
await until("store");
const buy = async (row, times) => {
  for (let i = 0; i < row; i++) await press("ArrowDown", 50);
  for (let i = 0; i < times; i++) await press("ArrowRight", 40);
  for (let i = 0; i < row; i++) await press("ArrowUp", 50);
};
await buy(0, 6);
await buy(1, 42);
await buy(2, 5);
await buy(3, 1);
await buy(6, 2);
await shot("05-store");
await press("Enter");
await until("store");
await press("Space");
await until(["travel", "pages"], "Space", 6);
await until("travel", "Space", 8);
await sleep(2500);
await shot("06-travel");

// Let a few days pass so an event or two shows up.
for (let i = 0; i < 6; i++) {
  await sleep(1400);
  const s = await state();
  if (s.scene === "pages" || s.scene === "choice") {
    await shot(`07-event-${i}`);
    break;
  }
}
await until("travel", "Space", 12);
await press("Space");
await until("sizeup", "Space", 4);
await shot("08-sizeup");
await press("Digit3");
await sleep(200);
await shot("09-map");
await press("Space");
await press("Digit6");
await sleep(200);
await shot("10-party");
await press("Space");
await press("Digit8");
await sleep(200);
await press("Digit2");
await sleep(4000);
await shot("11-forage");
await page.keyboard.press("Escape");
await until(["sizeup", "travel"], "Space", 12);
await until("travel", "Escape", 8);

// River crossing.
await page.evaluate(() => window.__appaloosaCheat({ miles: 170, landmarkIndex: 2 }));
await until("river", "Space", 60);
await sleep(400);
await shot("12-river");

// The fork and the Everfree.
await press("Digit2");
await sleep(4000); // the crossing animation plays out
await until(["pages", "travel"], "Space", 40);
await page.evaluate(() => window.__appaloosaCheat({ miles: 1560, landmarkIndex: 14, bits: 240 }));
await until("fork", "Space", 60);
await sleep(300);
await shot("13-fork");
await press("Digit2");
await until("everfree", "Space", 10);
await sleep(4000);
await shot("14-everfree");

// Arrival.
await until(["travel", "pages"], "Space", 200);
await page.evaluate(() => window.__appaloosaCheat({ miles: 1700, landmarkIndex: 15 }));
await until("arrival", "Space", 90);
await sleep(400);
await shot("15-arrival");
await press("Space");
await sleep(2500);
await shot("16-score");
await press("Space");
await sleep(400);
await shot("17-hall-of-fame");

await browser.close();
console.log(`done -> ${OUT}/`);
