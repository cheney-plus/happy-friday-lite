import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig(() => ({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
  },
  base: "./",
  build: {
    outDir: "dist",
  },
}));
