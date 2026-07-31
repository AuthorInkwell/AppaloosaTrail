/** Exercises code paths the main smoke test does not reach. */

import puppeteer from "puppeteer-core";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  defaultViewport: { width: 1400, height: 1000 },
});
const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && problems.push(`console.error: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
await page.waitForSelector("#screen");
await sleep(400);

const state = () => page.evaluate(() => window.__appaloosaDebug());
const press = async (k, d = 130) => {
  await page.keyboard.press(k);
  await sleep(d);
};
const until = async (want, k = "Space", limit = 80) => {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if ((Array.isArray(want) ? want : [want]).includes(s.scene)) return s;
    await press(k);
  }
  throw new Error(`stuck waiting for ${want}: ${(await state()).scene}`);
};
const step = (name) => console.log(`- ${name}`);
/** ESC closes menus; modal pages want SPACE. */
const backToTravel = async (limit = 24) => {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if (s.scene === "travel") return;
    await press(s.scene === "pages" || s.scene === "choice" ? "Space" : "Escape");
  }
  throw new Error(`could not get back to travel: ${(await state()).scene}`);
};

// Unicorn run, so levitation is on the menu.
step("start a unicorn run");
await press("Digit1");
await press("Digit1");
await press("F2");
for (let i = 0; i < 5; i++) await press("Enter", 140);
await press("Digit3"); // May
await until("store");
for (let i = 0; i < 5; i++) await press("ArrowRight", 40);
await press("ArrowDown", 60);
for (let i = 0; i < 30; i++) await press("ArrowRight", 35);
await press("ArrowDown", 60);
await press("ArrowRight", 60); // a cloak, so the potion row is reachable
await press("Enter");
await until("store");
await press("Space");
await until("travel", "Space", 12);

step("rest for three days");
await press("Space");
await until("sizeup", "Space", 4);
await press("Digit7");
await until("rest", "Space", 4);
await press("Digit3");
await until(["sizeup", "travel", "pages"], "Space", 10);
await backToTravel();

step("rest until somepony is well");
await press("Space");
await until("sizeup", "Space", 4);
await press("Digit7");
await until("rest", "Space", 4);
await press("Digit5");
await until(["sizeup", "travel", "pages"], "Space", 10);
await backToTravel();

step("wait at a river, then levitate across");
await page.evaluate(() => window.__appaloosaCheat({ miles: 176, landmarkIndex: 2 }));
await until("river", "Space", 60);
await press("Digit6"); // wait for the water to drop
await until("river", "Space", 10);
await press("Digit7"); // ask about the crossing
await until("river", "Space", 10);
await press("Digit4"); // levitate (unicorn only)
await sleep(4500);
await until(["pages", "travel"], "Space", 40);
await until("travel", "Space", 20);
console.log(`  after the crossing: ${JSON.stringify((await state()).game)}`);

step("take the toll road at the fork");
await page.evaluate(() => window.__appaloosaCheat({ miles: 1560, landmarkIndex: 14, bits: 400 }));
await until("fork", "Space", 90);
await press("Digit3"); // haggle first
await until("fork", "Space", 10);
await press("Digit1"); // take the road
await until(["pages", "travel"], "Space", 20);
await until("travel", "Space", 20);
const afterToll = await state();
console.log(`  after the toll: ${JSON.stringify(afterToll.game)}`);
if (afterToll.game.bits >= 400) throw new Error("the toll was never charged");

step("use a healing potion");
await page.evaluate(() => window.__appaloosaCheat({ potions: 2 }));
await press("Space");
await until("sizeup", "Space", 4);
await press("Digit9");
await until("choice", "Space", 6);
await press("Digit1");
await until(["sizeup", "pages"], "Space", 6);
await until("sizeup", "Space", 6);
console.log(`  potions left: ${(await state()).game.food !== undefined ? "ok" : "?"}`);
await press("Escape");

step("arrive");
await page.evaluate(() => window.__appaloosaCheat({ miles: 1705, landmarkIndex: 15 }));
await until("arrival", "Space", 90);
await press("Space");
await sleep(2500);
await press("Space");
await sleep(600);
await press("Space", 600);
await until("title", "Space", 20);

await browser.close();
if (problems.length) {
  console.error("\nproblems:");
  for (const p of [...new Set(problems)]) console.error(` - ${p}`);
  process.exit(1);
}
console.log("\nOK - all paths clean");
