/**
 * Builds a folder that a non-technical person can unzip and double-click.
 *
 *   node tools/package.mjs [--out release] [--no-zip]
 *
 * The result:
 *
 *   AppaloosaTrail/
 *     Play The Appaloosa Trail.bat    <- Windows: double-click this
 *     play.command                    <- macOS and Linux
 *     README.txt
 *     music/                          <- drop .mid files in here
 *     game/index.html                 <- the whole game, one self-contained file
 *     launcher/serve.ps1
 *
 * game/index.html has the script inlined rather than loaded as a module, so it
 * also works if opened straight off disk, without any server at all.
 */

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const outRoot = resolve(repo, arg("out", "release"));
const appDir = join(outRoot, "AppaloosaTrail");
const makeZip = !args.includes("--no-zip");

const log = (msg) => console.log(`  ${msg}`);

// --------------------------------------------------------------- build
console.log("\nPackaging The Appaloosa Trail\n");
log("building");
execFileSync("npx", ["vite", "build"], { cwd: repo, stdio: "pipe" });

const dist = join(repo, "dist");
const html = readFileSync(join(dist, "index.html"), "utf8");

// ------------------------------------------------- inline the script
const scriptMatch = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/.exec(html);
if (!scriptMatch) throw new Error("could not find the built script tag in dist/index.html");
const scriptPath = join(dist, scriptMatch[1].replace(/^\.?\//, ""));
let js = readFileSync(scriptPath, "utf8");
if (/import\s*[({*]|export\s+/.test(js.slice(0, 2000))) {
  throw new Error("the bundle still uses module syntax and cannot be inlined");
}
// A literal </script> inside a string would end the tag early.
js = js.replace(/<\/script/gi, "<\\/script");

// The original tag is a module, which defers until the document is parsed. An
// inline classic script does not, so it has to move to the end of the body or
// it runs before the canvas exists.
let standalone = html
  .replace(/\s*<link\b[^>]*rel="modulepreload"[^>]*>/gi, "")
  .replace(scriptMatch[0], "");
if (!standalone.includes("</body>")) throw new Error("dist/index.html has no </body> to append to");
standalone = standalone.replace("</body>", `  <script>\n${js}\n  </script>\n  </body>`);
log(`inlined ${(js.length / 1024).toFixed(0)} kB of script into a single page`);

// ------------------------------------------------------------ assemble
rmSync(appDir, { recursive: true, force: true });
mkdirSync(join(appDir, "game"), { recursive: true });
mkdirSync(join(appDir, "launcher"), { recursive: true });
mkdirSync(join(appDir, "music"), { recursive: true });

writeFileSync(join(appDir, "game", "index.html"), standalone);
cpSync(join(repo, "launcher", "serve.ps1"), join(appDir, "launcher", "serve.ps1"));
cpSync(join(repo, "launcher", "Play The Appaloosa Trail.bat"), join(appDir, "Play The Appaloosa Trail.bat"));
cpSync(join(repo, "launcher", "README.txt"), join(appDir, "README.txt"));
cpSync(join(repo, "launcher", "play.command"), join(appDir, "play.command"));
chmodSync(join(appDir, "play.command"), 0o755);
cpSync(join(repo, "public", "music", "README.md"), join(appDir, "music", "How to add music.txt"));

// Any music already sitting in public/music travels with the build.
const srcMusic = join(repo, "public", "music");
for (const file of readdirSync(srcMusic)) {
  if (/\.(mid|midi|ogg|mp3|wav|m4a)$/i.test(file)) {
    cpSync(join(srcMusic, file), join(appDir, "music", file));
    log(`bundled music/${file}`);
  }
}

const totalBytes = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, e) => sum + (e.isDirectory() ? totalBytes(join(dir, e.name)) : statSync(join(dir, e.name)).size),
    0,
  );
log(`assembled ${appDir} (${(totalBytes(appDir) / 1024).toFixed(0)} kB)`);

// ---------------------------------------------------------------- zip
if (makeZip) {
  const zipPath = join(outRoot, "AppaloosaTrail.zip");
  rmSync(zipPath, { force: true });
  try {
    execFileSync("zip", ["-r", "-q", zipPath, "AppaloosaTrail"], { cwd: outRoot });
    log(`zipped ${zipPath} (${(statSync(zipPath).size / 1024).toFixed(0)} kB)`);
  } catch {
    log("zip not available; the folder is ready to compress by hand");
  }
}

if (!existsSync(join(appDir, "game", "index.html"))) throw new Error("packaging produced no game");
console.log("\nDone. Send the zip, or the AppaloosaTrail folder, to anyone with Windows.\n");
