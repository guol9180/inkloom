import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    ssr: fileURLToPath(new URL("./src/server.ts", import.meta.url)),
    target: "node22",
    rollupOptions: {
      output: {
        entryFileNames: "server.mjs"
      }
    }
  },
  ssr: {
    noExternal: true
  }
});
