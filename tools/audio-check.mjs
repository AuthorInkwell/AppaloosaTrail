/**
 * Verifies that music is actually reaching the output: samples the master
 * analyser while each slot plays, for both the built-in chiptune and an
 * imported MIDI file.
 *
 *   node tools/audio-check.mjs
 */

import puppeteer from "puppeteer-core";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1000, height: 720 },
});
const page = await browser.newPage();
const errors = [];
const info = [];
page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : info.push(m.text())));
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
await page.waitForSelector("#screen");
await sleep(500);

const state = () => page.evaluate(() => window.__appaloosaDebug());
const press = async (k, d = 130) => {
  await page.keyboard.press(k);
  await sleep(d);
};
const until = async (want, k = "Space", limit = 50) => {
  const list = [].concat(want);
  for (let i = 0; i < limit; i++) {
    if (list.includes((await state()).scene)) return;
    await press(k);
  }
  throw new Error(`stuck waiting for ${want}: ${(await state()).scene}`);
};

/** Peak level over a window, so a rest between notes does not read as silence. */
const measure = async (ms = 2500) => {
  let peak = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await state();
    peak = Math.max(peak, s.peak ?? 0);
    await sleep(60);
  }
  return peak;
};

const expectSound = async (label, minimum = 0.01) => {
  const s = await state();
  const peak = await measure();
  const ok = peak >= minimum;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(26)} track=${String(s.music).padEnd(14)} peak=${peak.toFixed(3)}`);
  if (!ok) failures.push(label);
};

// Nudge the audio context awake with a real key press first.
await press("ArrowDown");
await press("ArrowUp");

console.log("checking each music slot reaches the output:\n");
await expectSound("title (imported MIDI)");

await press("Digit1");
await press("Digit3");
await press("F2");
for (let i = 0; i < 5; i++) await press("Enter", 140);
await press("Digit2");
await until("store");
await expectSound("store (built-in)");

for (let i = 0; i < 6; i++) await press("ArrowRight", 40);
await press("ArrowDown", 60);
for (let i = 0; i < 30; i++) await press("ArrowRight", 30);
await press("Enter");
await until("store");
await press("Space");
await until(["travel", "pages"], "Space", 8);
await until("travel", "Space", 8);

await page.evaluate(() => window.__appaloosaShowLandmark("ponyville"));
await until("landmark", "Space", 12);
await expectSound("landmark (built-in)");

await press("Digit6"); // forage
await until("forage", "Space", 8);
await press("Digit2");
await sleep(600);
await expectSound("forage (built-in)");
await page.keyboard.press("Escape");
await until(["landmark", "travel", "pages"], "Space", 12);
await until(["landmark", "travel"], "Space", 12);

await page.evaluate(() => window.__appaloosaShowLandmark("the-parting"));
await until("fork", "Space", 12);
await press("Digit2");
await until("everfree", "Space", 10);
await expectSound("everfree (built-in)");

console.log("\nchecking the settings actually take effect:\n");
// The Everfree run lasts the better part of a minute; wait it out.
for (let i = 0; i < 90 && (await state()).scene === "everfree"; i++) await sleep(1000);
await until(["travel", "pages", "landmark"], "Space", 40);
await until(["travel", "landmark"], "Space", 40);

await page.evaluate(() => window.__appaloosaShowLandmark("ponyville"));
await until("landmark", "Space", 12);
await page.evaluate(() => window.__appaloosaAudio.setMusicEnabled(false));
await sleep(400);
const mutedPeak = await measure(1500);
console.log(`${mutedPeak < 0.01 ? "ok  " : "FAIL"} music off -> silence      peak=${mutedPeak.toFixed(3)}`);
if (mutedPeak >= 0.01) failures.push("music off");

await page.evaluate(() => window.__appaloosaAudio.setMusicEnabled(true));
await sleep(300);
await press("ArrowDown");
await expectSound("music back on");

await browser.close();
console.log("");
if (errors.length) {
  console.error("console errors:");
  for (const e of [...new Set(errors)]) console.error(` ! ${e}`);
}
for (const line of info.filter((l) => l.startsWith("music:"))) console.log(line);
if (failures.length || errors.length) {
  console.error(`\n${failures.length} audio failure(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall music slots produce output");
