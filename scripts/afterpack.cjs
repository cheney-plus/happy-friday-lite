// electron-builder afterPack hook: prune files that don't belong to the
// target platform/arch from the packaged output.
//
// Pruned:
//   1. Foreign-platform native bindings that npm installed as
//      optionalDependencies for the BUILD machine but never used at runtime
//      on the target (e.g. @zvec/bindings-darwin-arm64 inside a Linux build,
//      ~41-94MB of dead weight; same for @img/sharp-* and @img/libvips-*).
//   2. LICENSES.chromium.html (~19MB, Electron ships it at the app root).
//   3. Restores manually-hoisted nested modules (see dedupe-nested-deps.mjs):
//      electron-builder's dependency collector resolves deps against its own
//      computed tree and skips our `node_modules/<scope>/node_modules/<name>`
//      hoisted copies, which would break resolution at runtime (e.g. dsh
//      packages would fall back to root zod@3 instead of zod@4).
//
// Only touches plain directories (asar:false layout). If asar is re-enabled,
// the asar-contained parts must be handled differently.
const fs = require("node:fs");
const path = require("node:path");
const { verifyKoffiNative } = require("./koffi-native.cjs");

// electron-builder <25 exports numeric Arch enum, >=25 may use strings.
function archName(arch) {
  if (typeof arch === "string") return arch;
  const names = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64", 4: "universal" };
  return names[arch] || String(arch);
}

// Package name parts -> [platform, arch] they are built for.
// Matches @zvec/bindings-darwin-arm64, @img/sharp-linux-x64, @img/libvips-linux-arm64, etc.
const PLATFORMS = ["darwin", "linux", "win32", "android", "freebsd"];
const ARCHES = ["x64", "arm64", "ia32", "armv7l", "armv6", "universal"];

function parsePlatformArch(name) {
  let rest = name;
  for (const p of PLATFORMS) {
    if (rest.includes(p)) {
      for (const a of ARCHES) {
        if (rest.includes(a)) return { platform: p, arch: a };
      }
      return null;
    }
  }
  return null;
}

function isForeign(name, targetPlatform, targetArch) {
  const parsed = parsePlatformArch(name);
  if (!parsed) return false;
  // "musl" variants never match a glibc target, but keep it simple: match
  // exact platform+arch, treat "universal" as matching any arch.
  if (parsed.platform !== targetPlatform) return true;
  if (parsed.arch === targetArch || parsed.arch === "universal" || targetArch === "universal") return false;
  return true;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

// Copy manually-hoisted nested modules (dedupe-nested-deps.mjs) from the
// project node_modules into the packaged app, since electron-builder's
// dependency collector does not know about them.
function restoreHoistedModules(srcNm, destNm, stats) {
  if (!fs.existsSync(srcNm) || !fs.existsSync(destNm)) return;

  const scopes = fs
    .readdirSync(srcNm, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith("@"));

  for (const scope of scopes) {
    const scopeDir = path.join(srcNm, scope.name);
    const hoistedDir = path.join(scopeDir, "node_modules");
    if (!fs.existsSync(hoistedDir)) continue;

    const destScopeDir = path.join(destNm, scope.name);
    const destHoistedDir = path.join(destScopeDir, "node_modules");
    if (!fs.existsSync(destHoistedDir)) fs.mkdirSync(destHoistedDir, { recursive: true });

    for (const entry of fs.readdirSync(hoistedDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      // Handle both plain names and nested scopes (e.g. @opentelemetry/resources)
      const name = entry.name;
      let srcCopy = path.join(hoistedDir, name);
      let destCopy = path.join(destHoistedDir, name);
      if (name.startsWith("@")) {
        for (const sub of fs.readdirSync(srcCopy, { withFileTypes: true })) {
          if (!sub.isDirectory()) continue;
          srcCopy = path.join(hoistedDir, name, sub.name);
          destCopy = path.join(destHoistedDir, name, sub.name);
          if (!fs.existsSync(destCopy)) {
            fs.mkdirSync(path.dirname(destCopy), { recursive: true });
            fs.cpSync(srcCopy, destCopy, { recursive: true });
            stats.push(`${scope.name}/node_modules/${name}/${sub.name}`);
          }
        }
        continue;
      }
      if (!fs.existsSync(destCopy)) {
        fs.cpSync(srcCopy, destCopy, { recursive: true });
        stats.push(`${scope.name}/node_modules/${name}`);
      }
    }
  }
}

function pruneNodeModules(nmDir, targetPlatform, targetArch, stats) {
  if (!fs.existsSync(nmDir)) return;

  // Prune foreign platform prebuilds shipped INSIDE packages
  // (e.g. node-pty >=1.2.0-beta.15 bundles prebuilds/{win32,darwin,linux}-*),
  // plus *.pdb debug symbols which are never needed at runtime.
  function prunePrebuilds(packageDir, relName) {
    const prebuildsDir = path.join(packageDir, "prebuilds");
    if (!fs.existsSync(prebuildsDir)) return;
    for (const entry of fs.readdirSync(prebuildsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdb")) {
        rmrf(path.join(prebuildsDir, entry.name));
        stats.push(`${relName}/prebuilds/${entry.name}`);
        continue;
      }
      if (!entry.isDirectory()) continue;
      if (isForeign(entry.name, targetPlatform, targetArch)) {
        rmrf(path.join(prebuildsDir, entry.name));
        stats.push(`${relName}/prebuilds/${entry.name}`);
      } else {
        // Remove .pdb files inside platform dirs too
        const platDir = path.join(prebuildsDir, entry.name);
        for (const f of fs.readdirSync(platDir, { withFileTypes: true })) {
          if (f.isFile() && f.name.toLowerCase().endsWith(".pdb")) {
            rmrf(path.join(platDir, f.name));
            stats.push(`${relName}/prebuilds/${entry.name}/${f.name}`);
          }
        }
      }
    }
  }

  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(nmDir, entry.name);
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const rel = `${entry.name}/${sub.name}`;
        if (isForeign(rel, targetPlatform, targetArch)) {
          rmrf(path.join(scopeDir, sub.name));
          stats.push(rel);
        } else {
          prunePrebuilds(path.join(scopeDir, sub.name), rel);
        }
      }
    } else {
      if (isForeign(entry.name, targetPlatform, targetArch)) {
        rmrf(path.join(nmDir, entry.name));
        stats.push(entry.name);
      } else {
        prunePrebuilds(path.join(nmDir, entry.name), entry.name);
      }
    }
  }
}

// electron-builder computes the packaged node_modules tree from the lockfile
// and does not follow peerDependencies. A @deepseek-ai package that only
// declares a sibling as a peer (e.g. dsh-session-log-export ->
// dsh-session-persistence) can therefore be missing entirely from the packaged
// tree, or be placed where Node's walk-up never looks — DSH's plugin loader
// then fails at boot ("loader entries failed to apply", ERR_MODULE_NOT_FOUND).
//
// Scan every @deepseek-ai package present anywhere in the packaged tree for
// bare imports of sibling @deepseek-ai packages, verify each resolves through
// Node's walk-up rules, and repair by copying the missing package from the
// build machine's node_modules into the packaged top-level node_modules.
// Repeat until a full pass finds nothing (a repaired package can itself
// import further missing ones).
const DEEPSEEK_SCOPE = "@deepseek-ai";
const REPAIR_JS_EXTS = new Set([".js", ".mjs", ".cjs"]);
const REPAIR_MAX_FILE_BYTES = 1 << 20; // skip frontend bundles; only real node code matters
const REPAIR_IMPORT_RE = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'](@deepseek-ai\/[a-z0-9][a-z0-9._-]*)/g;

// Yield every "@deepseek-ai/<pkg>" directory holding a package.json, reachable
// through node_modules nesting up to `depth` levels (electron-builder can lay
// packages out nested, e.g. <nm>/@deepseek-ai/dsh/node_modules/@deepseek-ai/x).
function* collectDeepseekPackages(dir, depth) {
  if (depth > 6 || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === DEEPSEEK_SCOPE) {
      let subs;
      try {
        subs = fs.readdirSync(full, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const sub of subs) {
        if (!sub.isDirectory()) continue;
        const pkgDir = path.join(full, sub.name);
        if (fs.existsSync(path.join(pkgDir, "package.json"))) yield pkgDir;
        yield* collectDeepseekPackages(pkgDir, depth + 1);
      }
    } else if (entry.name === "node_modules") {
      yield* collectDeepseekPackages(full, depth + 1);
    }
  }
}

// Collect bare "@deepseek-ai/<pkg>" import specifiers from the package's JS.
function scanDeepseekImports(pkgDir, found) {
  // Browser plugins are bundled by DSH's frontend build. Their development
  // imports are not Node runtime dependencies (React is excluded as well).
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const clientExport = manifest.exports?.["./client"];
  const clientPath = typeof clientExport === "string" ? clientExport : clientExport?.default;
  const browserEntry = clientPath ? path.resolve(pkgDir, clientPath) : null;
  const stack = [pkgDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "types"].includes(entry.name)) continue; // nested packages and declaration-build artifacts
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || full === browserEntry) continue;
      if (!REPAIR_JS_EXTS.has(path.extname(entry.name))) continue;
      let content;
      try {
        if (fs.statSync(full).size > REPAIR_MAX_FILE_BYTES) continue;
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      for (const match of content.matchAll(REPAIR_IMPORT_RE)) {
        found.push({ name: match[1], importer: full });
      }
    }
  }
}

// Confine resolution to the app: the project's node_modules must never hide
// missing packaged dependencies when the output lives inside the project.
function resolveDeepseekPackage(importer, name, nmDir) {
  const boundary = path.dirname(path.resolve(nmDir));
  let dir = path.dirname(importer);
  while (dir === boundary || dir.startsWith(boundary + path.sep)) {
    if (path.basename(dir) !== "node_modules") {
      const candidate = path.join(dir, "node_modules", name);
      if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Read-only verification for packaged/extracted artifacts on any host arch.
function verifyDeepseekImports(nmDir) {
  nmDir = path.resolve(nmDir);
  if (!fs.existsSync(path.join(nmDir, DEEPSEEK_SCOPE, "dsh", "package.json"))) {
    throw new Error(`[verify-harness] Missing packaged DSH in ${nmDir}`);
  }
  const missing = [];
  for (const pkgDir of collectDeepseekPackages(nmDir, 0)) {
    const imports = [];
    scanDeepseekImports(pkgDir, imports);
    for (const { name, importer } of imports) {
      if (!resolveDeepseekPackage(importer, name, nmDir)) missing.push(`${name} from ${importer}`);
    }
  }
  if (missing.length) throw new Error(`[verify-harness] Unresolved packaged imports:\n${missing.join("\n")}`);
}

function repairDeepseekImports(nmDir, srcNm, stats) {
  if (!fs.existsSync(nmDir)) return;
  nmDir = path.resolve(nmDir);
  srcNm = path.resolve(srcNm);
  const restored = new Set();
  // Each pass must restore a new package; there is no arbitrary depth limit
  // on the transitive peer dependency chain.
  for (;;) {
    const missing = new Map();
    for (const pkgDir of collectDeepseekPackages(nmDir, 0)) {
      const imports = [];
      scanDeepseekImports(pkgDir, imports);
      for (const { name, importer } of imports) {
        if (!resolveDeepseekPackage(importer, name, nmDir) && !missing.has(name)) {
          missing.set(name, importer);
        }
      }
    }
    if (!missing.size) return;
    for (const [name, importer] of missing) {
      // Prefer the equivalent source importer, preserving npm's nested layout.
      const sourceImporter = path.join(srcNm, path.relative(nmDir, importer));
      const src = resolveDeepseekPackage(sourceImporter, name, srcNm);
      if (!src || restored.has(name)) {
        throw new Error(`[afterpack] Cannot restore ${name} imported by ${importer}; reinstall dependencies before packaging`);
      }
      const dest = path.join(nmDir, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      restored.add(name);
      stats.push(`+ ${name} (restored missing package)`);
    }
  }
}

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName; // darwin | linux | win32
  const arch = archName(context.arch);

  // mac: target dir is "<appOutDir>/<productName>.app/Contents/Resources";
  // linux/win: "<appOutDir>/resources"
  const appBundleDir =
    platform === "darwin"
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
      : context.appOutDir;
  const resourcesDir =
    platform === "darwin"
      ? path.join(appBundleDir, "Contents", "Resources")
      : path.join(appBundleDir, "resources");

  // scripts/afterpack.cjs -> project root; projectDir from context is not
  // reliably exposed on the platform packager in all electron-builder versions
  const srcNm = path.join(__dirname, "..", "node_modules");

  const stats = [];

  // 1. Foreign native bindings (works for asar:false "app" dir and for
  //    app.asar.unpacked native modules)
  for (const nmDir of [
    path.join(resourcesDir, "app", "node_modules"),
    path.join(resourcesDir, "app.asar.unpacked", "node_modules"),
  ]) {
    pruneNodeModules(nmDir, platform, arch, stats);
    // Restore hoisted nested modules that electron-builder skipped
    restoreHoistedModules(srcNm, nmDir, stats);
    // Heal peer-only @deepseek-ai imports the dependency collector dropped
    repairDeepseekImports(nmDir, srcNm, stats);
    // Never publish an artifact whose loader tree still contains an unresolved
    // bare DeepSeek import. This catches platform-specific builder layouts
    // before an installer is produced.
    verifyDeepseekImports(nmDir);
  }

  // Fail before producing installers if Koffi JS and native packages disagree.
  verifyKoffiNative(path.join(resourcesDir, "app", "node_modules"), platform, arch);

  // 2. Chromium license file at app root (linux/win) — mac keeps it inside
  //    the framework, which we do not touch.
  const licenses = path.join(appBundleDir, "LICENSES.chromium.html");
  if (fs.existsSync(licenses)) {
    rmrf(licenses);
    stats.push("LICENSES.chromium.html");
  }

  if (stats.length) {
    console.log(`[afterpack] processed for ${platform}-${arch}:`);
    for (const s of stats) console.log(`  - ${s}`);
  } else {
    console.log(`[afterpack] nothing to prune/restore for ${platform}-${arch}`);
  }
};

// Test hook (not used by electron-builder).
exports._repairDeepseekImports = repairDeepseekImports;

exports.verifyDeepseekImports = verifyDeepseekImports;
