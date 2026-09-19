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
  // (e.g. node-pty >=1.2.0-beta.15 bundles prebuilds/{win32,darwin,linux}-*)
  function prunePrebuilds(packageDir, relName) {
    const prebuildsDir = path.join(packageDir, "prebuilds");
    if (!fs.existsSync(prebuildsDir)) return;
    for (const entry of fs.readdirSync(prebuildsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (isForeign(entry.name, targetPlatform, targetArch)) {
        rmrf(path.join(prebuildsDir, entry.name));
        stats.push(`${relName}/prebuilds/${entry.name}`);
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
  }

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
