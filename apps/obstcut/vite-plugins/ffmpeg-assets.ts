import { createReadStream } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const FILES = ["ffmpeg-core.js", "ffmpeg-core.wasm"] as const;

export function ffmpegAssetsPlugin(sourceDir: string): Plugin {
  return {
    name: "obstcut-ffmpeg-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const name = FILES.find((file) => url.endsWith(`/ffmpeg/${file}`));
        if (!name) {
          next();
          return;
        }
        res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        createReadStream(path.join(sourceDir, name)).pipe(res);
      });
    },
    generateBundle() {
      for (const name of FILES) {
        this.emitFile({
          type: "asset",
          fileName: `ffmpeg/${name}`,
          source: readFileSync(path.join(sourceDir, name)),
        });
      }
    },
  };
}
