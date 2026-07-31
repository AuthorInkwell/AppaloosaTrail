/** Captures the arrival, score and hall of fame screens. */

import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] ?? "shots-pr";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  defaultViewport: { width: 1400, height: 1000 },
});
const page = await browser.newPage();
await mkdir(OUT, { recursive: true });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
await page.waitForSelector("#screen");
await sleep(500);

const canvas = await page.$("#screen");
const state = () => page.evaluate(() => window.__appaloosaDebug());
const press = async (k, d = 130) => {
  await page.keyboard.press(k);
  await sleep(d);
};
const shot = async (n) => {
  await canvas.screenshot({ path: `${OUT}/${n}.png` });
  console.log(`  ${n}`);
};
const until = async (want, k = "Space", limit = 60) => {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if ((Array.isArray(want) ? want : [want]).includes(s.scene)) return s;
    await press(k);
  }
  throw new Error(`stuck waiting for ${want}: ${(await state()).scene}`);
};

await press("Digit1");
await press("Digit3");
await press("F2");
for (let i = 0; i < 5; i++) await press("Enter", 140);
await press("Digit2");
await until("store");
for (let i = 0; i < 6; i++) await press("ArrowRight", 40);
await press("ArrowDown", 50);
for (let i = 0; i < 40; i++) await press("ArrowRight", 35);
await press("Enter");
await until("store");
await press("Space");
await until("travel", "Space", 10);

await page.evaluate(() =>
  window.__appaloosaCheat({ miles: 1700, landmarkIndex: 15, bits: 380, food: 240, potions: 2, wheels: 1 }),
);
await until("arrival", "Space", 90);
await sleep(500);
await shot("15-arrival");
await press("Space");
await sleep(3000);
await shot("16-score");
await press("Space", 400);
await sleep(500);
await shot("17-hall-of-fame");

await browser.close();
console.log("done");
