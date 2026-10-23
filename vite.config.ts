import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Dev server and build for the examples. The toolkit itself ships as source
// (TypeScript + CSS) and is compiled by the consuming app's bundler.
export default defineConfig({
  root: "examples",
  plugins: [react()],
  server: {
    port: 5180,
    proxy: { "/api": "http://127.0.0.1:8790" },
  },
  build: {
    outDir: "../dist/examples",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "examples/index.html"),
        sensor: resolve(__dirname, "examples/sensor-site/index.html"),
        release: resolve(__dirname, "examples/release-matrix/index.html"),
        live: resolve(__dirname, "examples/live-service/index.html"),
        wellpad: resolve(__dirname, "examples/well-pad/index.html"),
      },
    },
  },
  test: { root: ".", include: ["test/**/*.test.ts"] },
} as any);
