/**
 * Builds the shareable release and then checks it the way the recipient will
 * use it: served by the real launcher script, and opened straight off disk.
 *
 *   node tools/release-check.mjs
 *
 * Needs PowerShell to test the launcher itself. Without it the file:// half
 * still runs and the PowerShell half is skipped with a warning.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(repo, "release", "AppaloosaTrail");
const PORT = 8749;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

function findPowerShell() {
  for (const candidate of [process.env.PWSH, `${process.env.HOME}/pwsh/pwsh`, "pwsh", "powershell"]) {
    if (!candidate) continue;
    try {
      execFileSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], { stdio: "pipe" });
      return candidate;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

console.log("\nBuilding the release\n");
execFileSync("node", [join(repo, "tools", "package.mjs")], { cwd: repo, stdio: "inherit" });

console.log("\nChecking the package contents\n");
for (const file of [
  "Play The Appaloosa Trail.bat",
  "README.txt",
  "play.command",
  "game/index.html",
  "launcher/serve.ps1",
  "music/How to add music.txt",
]) {
  check(`ships ${file}`, existsSync(join(app, file)));
}

// --------------------------------------------------------------- launcher
const pwsh = findPowerShell();
let server = null;
if (!pwsh) {
  console.log("\n!   PowerShell not found; skipping the launcher checks\n");
} else {
  console.log(`\nRunning the launcher with ${pwsh}\n`);
  server = spawn(pwsh, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(app, "launcher", "serve.ps1"), "-NoBrowser", "-Port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let banner = "";
  server.stdout.on("data", (d) => (banner += d.toString()));
  server.stderr.on("data", (d) => (banner += d.toString()));
  await sleep(4000);
  check("launcher starts and reports a URL", banner.includes(`http://127.0.0.1:${PORT}/`), banner.trim().split("\n").pop() ?? "");

  const get = async (path) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
  };

  const index = await get("/");
  check("serves the game", index.status === 200 && index.body.includes("<canvas"), `${index.status} ${index.type}`);

  const missing = await get("/no-such-file.txt");
  check("404s missing files", missing.status === 404);

  const traversal = await get("/../../../etc/passwd");
  check("refuses directory traversal", traversal.status === 404);

  const emptyManifest = await get("/music/manifest.json");
  check("serves an empty music manifest", emptyManifest.body.trim() === '{"files":[]}', emptyManifest.body.trim());

  // Drop a file in the music folder the way a player would.
  mkdirSync(join(app, "music"), { recursive: true });
  execFileSync("node", [join(repo, "tools", "make-test-midi.mjs"), join(app, "music", "title.mid")], { stdio: "pipe" });
  const liveManifest = await get("/music/manifest.json");
  check("notices dropped-in music without a rebuild", liveManifest.body.includes("title.mid"), liveManifest.body.trim());
  const midi = await get("/music/title.mid");
  check("serves the music file", midi.status === 200 && midi.type.includes("midi"), `${midi.status} ${midi.type}`);
}

// ------------------------------------------- closing the window stops it
if (pwsh) {
  console.log("\nChecking that closing the game window shuts the launcher down\n");
  const fake = (name, body) => {
    const path = join("/tmp", name);
    writeFileSync(path, `#!/bin/bash\n${body}\n`, { mode: 0o755 });
    return path;
  };
  const runLauncher = (browserPath, port) =>
    spawn(
      pwsh,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(app, "launcher", "serve.ps1"), "-Port", String(port)],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APPALOOSA_BROWSER: browserPath } },
    );

  // A browser window that stays open for a while, then closes.
  const shortLived = fake("fake-browser-8s.sh", "sleep 8");
  const a = runLauncher(shortLived, PORT + 1);
  let exitedAfter = null;
  const startedA = Date.now();
  a.on("exit", () => (exitedAfter = (Date.now() - startedA) / 1000));
  await sleep(5000);
  check("keeps serving while the window is open", exitedAfter === null);
  await sleep(6000);
  check("stops once the window closes", exitedAfter !== null, exitedAfter ? `after ${exitedAfter.toFixed(1)}s` : "still running");
  a.kill();

  // A browser that fails to start at all should not end the session.
  const instantFail = fake("fake-browser-fail.sh", "exit 1");
  const b = runLauncher(instantFail, PORT + 2);
  let bExited = false;
  b.on("exit", () => (bExited = true));
  await sleep(6000);
  check("survives a browser that refuses to start", !bExited);
  const stillServing = await fetch(`http://127.0.0.1:${PORT + 2}/`).then((r) => r.status).catch(() => 0);
  check("still serving after the fallback", stillServing === 200, String(stillServing));
  b.kill();
  await sleep(300);
}

// --------------------------------------------------------------- browsers
const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1100, height: 800 },
});

async function playSession(url, label) {
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : logs.push(m.text())));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector("#screen");
  await sleep(1200);

  const state = () => page.evaluate(() => window.__appaloosaDebug());
  const press = async (k, d = 120) => {
    await page.keyboard.press(k);
    await sleep(d);
  };
  const until = async (want, k = "Space", limit = 50) => {
    const list = [].concat(want);
    for (let i = 0; i < limit; i++) {
      if (list.includes((await state()).scene)) return true;
      await press(k);
    }
    return false;
  };

  check(`${label}: loads to the title screen`, (await state()).scene === "title");

  // Outfit a wagon and get rolling, which touches drawing, input and storage.
  await press("Digit1");
  await press("Digit3");
  await press("F2");
  for (let i = 0; i < 5; i++) await press("Enter", 140);
  await press("Digit2");
  await until("store");
  for (let i = 0; i < 6; i++) await press("ArrowRight", 40);
  await press("ArrowDown", 60);
  for (let i = 0; i < 30; i++) await press("ArrowRight", 25);
  await press("Enter");
  await until("store");
  await press("Space");
  await until(["travel", "pages"], "Space", 10);
  await until("travel", "Space", 10);
  await sleep(2500);
  const playing = await state();
  check(`${label}: plays`, (playing.game?.miles ?? 0) > 0, `day ${playing.game?.day}, ${playing.game?.miles} miles`);

  // Saving proves localStorage works, which is what keeps a journey between sessions.
  await press("Space");
  await until("sizeup", "Space", 6);
  await press("Digit0");
  await until("save", "Space", 6);
  await press("Digit1");
  await sleep(400);
  const saved = await page.evaluate(() => !!localStorage.getItem("appaloosa.save.1"));
  check(`${label}: saves a journey`, saved);

  check(`${label}: no console errors`, errors.length === 0, [...new Set(errors)].slice(0, 2).join(" | "));
  if (label.startsWith("launcher")) {
    check(`${label}: imports dropped-in music`, logs.some((l) => l.startsWith("music: imported")));
  }
  await page.close();
}

if (server) {
  console.log("\nPlaying through the launcher\n");
  await playSession(`http://127.0.0.1:${PORT}/`, "launcher");
}

console.log("\nPlaying the file opened straight off disk\n");
await playSession(`file://${join(app, "game", "index.html")}`, "double-click");

await browser.close();
if (server) {
  server.kill();
  await sleep(300);
}
// Stray fake browsers would hold the output pipe open and hang this script.
try {
  execFileSync("pkill", ["-f", "fake-browser"], { stdio: "ignore" });
} catch {
  /* nothing left to kill */
}
rmSync(join(app, "music", "title.mid"), { force: true });
writeFileSync(join(app, "music", ".gitkeep"), "");
rmSync(join(app, "music", ".gitkeep"), { force: true });

console.log("");
if (failures.length) {
  console.error(`${failures.length} problem(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("release looks good\n");
