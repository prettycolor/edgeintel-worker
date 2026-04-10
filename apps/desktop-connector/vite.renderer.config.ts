import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(__dirname, "src", "renderer"),
  build: {
    outDir: ".vite/renderer/main_window",
    emptyOutDir: false,
    rollupOptions: {
      input: path.join(__dirname, "src", "renderer", "index.html"),
    },
  },
});
