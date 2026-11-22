import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";
import { resolveViteBase } from "./src/base-path";
import { ffmpegAssetsPlugin } from "./vite-plugins/ffmpeg-assets";

const require = createRequire(import.meta.url);

function ffmpegCoreDir(): string {
  const umd = require.resolve("@ffmpeg/core");
  return path.resolve(path.dirname(umd), "../esm");
}

export default defineConfig({
  base: resolveViteBase(),
  plugins: [react(), ffmpegAssetsPlugin(ffmpegCoreDir())],
  resolve: {
    alias: {
      "@openreel/core": path.resolve(__dirname, "../../packages/core/src"),
    },
  },
  worker: { format: "es" },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "@ffmpeg/core", "@huggingface/transformers"],
  },
  build: { target: "esnext" },
});
