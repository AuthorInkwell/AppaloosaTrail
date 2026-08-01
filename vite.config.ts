import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Plugin, defineConfig } from "vite";

const MUSIC_DIR = resolve(__dirname, "public/music");
const MUSIC_EXT = /\.(mid|midi|ogg|mp3|wav|m4a)$/i;

function listMusic(): string[] {
  try {
    return readdirSync(MUSIC_DIR)
      .filter((f) => MUSIC_EXT.test(f))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Publishes a listing of public/music so the game can find dropped-in tracks
 * without probing for files that may not exist. Drop title.mid in that folder
 * and it is picked up on the next reload; no configuration to edit.
 */
function musicManifest(): Plugin {
  const body = () => JSON.stringify({ files: listMusic() }, null, 2);
  return {
    name: "appaloosa-music-manifest",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split("?")[0]?.endsWith("/music/manifest.json")) return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(body());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "music/manifest.json", source: body() });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [musicManifest()],
  server: { host: "127.0.0.1", port: 5173 },
  build: { target: "es2020", assetsInlineLimit: 0 },
});
