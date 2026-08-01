/**
 * Walks every screen in the game with the layout checker switched on and
 * reports any text that escapes its panel or the screen. Also steps through
 * every random event, since that is where the longest strings live.
 *
 *   node tools/layout-audit.mjs
 */

import puppeteer from "puppeteer-core";

const URL = "http://127.0.0.1:5173/?layout=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reports = new Set();
const errors = [];

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  defaultViewport: { width: 1280, height: 860 },
});
const page = await browser.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("LAYOUT:")) reports.add(t.slice(8));
  else if (m.type() === "error") errors.push(t);
});
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: "networkidle0" });
await page.waitForSelector("#screen");
await sleep(400);

const state = () => page.evaluate(() => window.__appaloosaDebug());
const press = async (k, d = 90) => {
  await page.keyboard.press(k);
  await sleep(d);
};
const settle = async (frames = 3) => sleep(frames * 60);
const until = async (want, k = "Space", limit = 60) => {
  const list = Array.isArray(want) ? want : [want];
  for (let i = 0; i < limit; i++) {
    if (list.includes((await state()).scene)) return;
    await press(k);
  }
  throw new Error(`stuck waiting for ${want}: ${(await state()).scene}`);
};
const backTo = async (target, limit = 40) => {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if (s.scene === target) return;
    if (s.scene === "pages" || s.scene === "choice") await press("Space");
    else if (s.scene === "landmark" || s.scene === "fork") await press("Digit1");
    else if (s.scene === "river") {
      await press("Digit1"); // ford it; the crossing animation then resolves
      await sleep(4000);
    } else await press("Escape");
  }
  throw new Error(`could not get back to ${target}: ${(await state()).scene}`);
};
const step = (n) => console.log(`- ${n}`);

// ---------------------------------------------------------------- front end
step("title, instructions, about, hall of fame");
await settle();
await press("Digit3");
for (let i = 0; i < 5; i++) {
  await settle();
  await press("Space");
}
await press("Digit6");
for (let i = 0; i < 3; i++) {
  await settle();
  await press("Space");
}
await press("Digit4");
await settle();
await press("Space");
await press("Digit5"); // sound and music
await settle();
for (let i = 0; i < 4; i++) {
  await press("ArrowDown");
  await settle(3);
}
await press("Escape");
await press("Digit2"); // load menu (empty)
await settle();
await press("Escape");

step("origins and naming");
await press("Digit1");
for (let i = 0; i < 3; i++) {
  await settle(6);
  await press("ArrowDown");
}
await press("Digit3"); // earth pony
await settle();
// Longest names the fields allow, to stress every screen that shows a name.
for (const name of ["Wagonwheel Sun", "Tumbleweed Joe", "Marigold Storm", "Dandelion Pie", "Hickory Bells"]) {
  await page.keyboard.type(name, { delay: 12 });
  await press("Enter", 70);
}
await settle();

step("departure months");
for (let i = 0; i < 5; i++) {
  await settle(4);
  await press("ArrowDown");
}
await press("Digit2");
await until("store");

step("store rows");
for (let i = 0; i < 7; i++) {
  await settle(4);
  await press("ArrowDown");
}
// Buy a big load so quantities and totals are wide.
const buy = async (row, times) => {
  for (let i = 0; i < row; i++) await press("ArrowDown", 40);
  for (let i = 0; i < times; i++) await press("ArrowRight", 30);
  for (let i = 0; i < row; i++) await press("ArrowUp", 40);
};
await buy(0, 8);
await buy(1, 50);
await buy(2, 5);
await buy(3, 3);
await buy(4, 3);
await buy(5, 3);
await buy(6, 4);
await settle();
await press("Enter");
await until("store");
for (let i = 0; i < 7; i++) {
  await settle(4);
  await press("ArrowDown");
}
await press("Space");
await until(["travel", "pages"], "Space", 8);
await until("travel", "Space", 8);
await settle(10);

// ------------------------------------------------------------------- events
step("every random event");
const eventIds = await page.evaluate(() => window.__appaloosaEventIds());
for (const id of eventIds) {
  const shown = await page.evaluate((i) => window.__appaloosaShowEvent(i), id);
  if (!shown) continue;
  for (let i = 0; i < 14; i++) {
    const s = await state();
    if (s.scene === "travel") break;
    await settle(3);
    if (s.scene === "choice") {
      // Look at every option's label before picking one.
      for (let k = 0; k < 4; k++) {
        await press("ArrowDown", 60);
      }
      await press("Enter");
    } else {
      await press("Space");
    }
  }
  await backTo("travel");
}
console.log(`  stepped through ${eventIds.length} events`);

// -------------------------------------------------------------- size up etc
step("size up and its screens");
await page.evaluate(() => window.__appaloosaCheat({ potions: 3, wheels: 2, axles: 2, tongues: 2, cloaks: 5 }));
await press("Space");
await until("sizeup", "Space", 6);
for (const [key, scene] of [
  ["Digit2", "supplies"],
  ["Digit3", "map"],
  ["Digit6", "party"],
]) {
  await press(key);
  await until(scene, "Space", 6);
  await settle(6);
  await press("Space");
  await until("sizeup", "Space", 6);
}
for (const [key, scene] of [
  ["Digit4", "pace"],
  ["Digit5", "rations"],
  ["Digit7", "rest"],
  ["Digit0", "save"],
]) {
  await press(key);
  await until(scene, "Space", 6);
  for (let i = 0; i < 6; i++) {
    await settle(4);
    await press("ArrowDown");
  }
  await press("Escape");
  await until("sizeup", "Escape", 6);
}
await press("Digit9"); // potion chooser
await until("choice", "Space", 6);
for (let i = 0; i < 6; i++) {
  await settle(3);
  await press("ArrowDown");
}
await press("Escape");
await backTo("travel");

step("foraging");
await press("Space");
await until("sizeup", "Space", 6);
await press("Digit8");
await until("forage", "Space", 6);
for (let i = 0; i < 5; i++) {
  await settle(5);
  await press("ArrowDown");
}
await press("Digit4"); // three hours, the widest HUD numbers
await sleep(4000);
await page.keyboard.press("Escape");
await backTo("travel");

// ---------------------------------------------------------------- landmarks
step("every landmark, river and the fork");
const landmarkIds = [
  "pioneers-bluff",
  "marezy-meadow",
  "hoofprint-river",
  "ponyville",
  "froggy-bottom",
  "whitetail-station",
  "rambling-rock",
  "galloping-gorge",
  "dodge-junction",
  "macintosh-hills",
  "serpents-bend",
  "san-palomino",
  "ghastly-gorge",
  "sunkissed-springs",
  "the-parting",
];
for (const id of landmarkIds) {
  await page.evaluate((i) => {
    window.__appaloosaCheat({ bits: 900 });
    window.__appaloosaShowLandmark(i);
  }, id);
  await sleep(200);
  console.log(`  ${id} (${(await state()).scene})`);
  await until(["landmark", "river", "fork"], "Space", 10);
  // Walk every menu row so long labels and notes all get drawn.
  for (let i = 0; i < 8; i++) {
    await settle(4);
    await press("ArrowDown");
  }
  const s = await state();
  if (s.scene === "landmark") {
    await press("Digit2"); // look around
    await until("pages", "Space", 6);
    await settle(4);
    await press("Space");
    await until("landmark", "Space", 6);
    await press("Digit4"); // talk, on stops that have it
    await settle(6);
    await backTo("landmark", 10).catch(() => undefined);
  } else if (s.scene === "river") {
    await press("Digit7"); // ask about the crossing
    await settle(6);
    await backTo("river", 10).catch(() => undefined);
  }
  await backTo("travel");
}

step("the Everfree and the ending");
await page.evaluate(() => window.__appaloosaShowLandmark("the-parting"));
await until("fork", "Space", 10);
await press("Digit2");
await until("everfree", "Space", 10);
await sleep(5000);
await page.evaluate(() => window.__appaloosaCheat({ finished: false }));
await backTo("travel", 60).catch(() => undefined);

await page.evaluate(() => window.__appaloosaShowLandmark("appaloosa"));
await until("arrival", "Space", 20);
await settle(8);
await press("Space");
await sleep(3000);
await settle(8);
await press("Space");
await sleep(600);
await settle(8);
await press("Space");
await until("title", "Space", 20);

step("memorial and game over");
await press("Digit1");
await press("Digit3");
await page.keyboard.type("Tumbleweed Joe", { delay: 8 });
for (let i = 0; i < 5; i++) await press("Enter", 70);
await press("Digit2");
await until("store");
await press("ArrowRight");
await press("ArrowRight");
await press("ArrowDown", 50);
for (let i = 0; i < 20; i++) await press("ArrowRight", 25);
await press("Enter");
await until("store");
await press("Space");
await until("travel", "Space", 10);
// Ponies get a rally roll each day, so keep pressing until the party is gone.
let sawMemorial = false;
for (let round = 0; round < 24; round++) {
  const s = await state();
  if (s.scene === "gameover") break;
  if (s.scene === "memorial") {
    await settle(8);
    if (!sawMemorial) {
      sawMemorial = true;
      await press("Space"); // to the epitaph field
      await settle(8);
      await page.keyboard.type("Gone west, the long way", { delay: 8 });
      await settle(8);
    }
    await press("Enter");
    continue;
  }
  if (s.scene === "travel") {
    await page.evaluate(() => window.__appaloosaHurtParty(0, 3));
    await sleep(1600);
    continue;
  }
  await press(s.scene === "pages" || s.scene === "choice" ? "Space" : "Escape");
}
await until("gameover", "Enter", 60);
await settle(8);
await press("Space");
await until("title", "Space", 10);
await settle(8);

step("hall of fame with entries and a filled save slot");
await press("Digit4");
await until("hof", "Space", 6);
await settle(8);
await press("Space");
await press("Digit2");
await until("load", "Space", 6);
await settle(8);
await press("Escape");

await browser.close();

console.log("");
if (errors.length) {
  console.error(`${errors.length} console error(s):`);
  for (const e of [...new Set(errors)]) console.error(` ! ${e}`);
}
if (reports.size === 0) {
  console.log("no layout problems found");
} else {
  console.log(`${reports.size} layout problem(s):`);
  for (const r of [...reports].sort()) console.log(` * ${r}`);
}
process.exit(reports.size > 0 || errors.length > 0 ? 1 : 0);
