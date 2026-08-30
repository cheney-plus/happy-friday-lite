import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { createReadStream, readFileSync } from "node:fs";

const PDFJS_WASM_FILES = ['openjpeg.wasm', 'jbig2.wasm'];
const pdfjsWasmDir = resolve(__dirname, 'node_modules/pdfjs-dist/wasm');

function pdfjsWasmAssets() {
  return {
    name: 'pdfjs-wasm-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs/wasm', (req, res, next) => {
        const fileName = (req.url || '').replace(/^\//, '');
        if (!PDFJS_WASM_FILES.includes(fileName)) return next();
        res.setHeader('Content-Type', 'application/wasm');
        createReadStream(resolve(pdfjsWasmDir, fileName)).pipe(res);
      });
    },
    generateBundle() {
      for (const fileName of PDFJS_WASM_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/wasm/${fileName}`,
          source: readFileSync(resolve(pdfjsWasmDir, fileName))
        });
      }
    }
  };
}

export default defineConfig(() => ({
  plugins: [
    vue(),
    pdfjsWasmAssets(),
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
