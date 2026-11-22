import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "main/index": "src/main.ts" },
  format: ["cjs"],
  outDir: "dist",
  external: ["electron"],
  sourcemap: false,
});
