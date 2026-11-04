import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// MV3 extension popup: a plain Vite SPA build. All code is bundled
// locally (MV3 CSP forbids remote code). Shared wallet logic is
// imported from the app's pure-TS libs via ../../src — single source
// of truth for chains, balances, prices and the Fluke/drand flow.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
});
