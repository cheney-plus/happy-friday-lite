// Workaround for @langchain/langgraph-sdk publish bug:
// its dist/utils/async_caller.{js,cjs} hardcode relative pnpm virtual-store paths
// (../node_modules/.pnpm/p-retry@x/.../index.js) that get stripped from the
// electron-builder asar, breaking the packaged app with ERR_MODULE_NOT_FOUND.
// Re-point those imports to bare specifiers so Node resolves the hoisted copies.
// Idempotent; safe to run via "postinstall" on every npm install.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const file = join(root, "..", "node_modules", "@langchain", "langgraph-sdk", "dist", "utils", "async_caller.js");

if (!existsSync(file)) {
  console.log("[fix-langgraph-sdk] target not found, skipping");
  process.exit(0);
}

let src = readFileSync(file, "utf8");
const before = src;

src = src
  .replace(
    /import pRetry\$1 from "\.\.\/node_modules\/\.pnpm\/p-retry@[\d.]+\/node_modules\/p-retry\/index\.js";/,
    'import pRetry$1 from "p-retry";'
  )
  .replace(
    /import PQueue from "\.\.\/node_modules\/\.pnpm\/p-queue@[\d.]+\/node_modules\/p-queue\/dist\/index\.js";/,
    'import PQueue from "p-queue";'
  );

if (src !== before) {
  writeFileSync(file, src);
  console.log("[fix-langgraph-sdk] patched async_caller.js -> bare imports");
} else {
  console.log("[fix-langgraph-sdk] already patched, no changes");
}
