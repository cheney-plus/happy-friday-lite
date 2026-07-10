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
    minify: true,
    esbuild: {
      drop: ["console", "debugger"],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@tiptap")) return "vendor-tiptap";
            if (id.includes("@schedule-x")) return "vendor-schedule";
            if (id.includes("pdfjs-dist")) return "vendor-pdfjs";
            if (id.includes("@somecat/epub-reader") || id.includes("foliate-js")) return "vendor-epub";
            if (id.includes("highlight.js") || id.includes("lowlight")) return "vendor-highlight";
            if (id.includes("lucide-vue-next")) return "vendor-icons";
            if (id.includes("marked")) return "vendor-marked";
            if (
              id.includes("vue/") ||
              id.includes("vue-router") ||
              id.includes("pinia") ||
              id.includes("vue-i18n")
            )
              return "vendor-vue";
          }
        },
      },
    },
  },
}));
