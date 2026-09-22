// Deduplicate identical nested node_modules copies inside scoped packages.
//
// Problem: the project pins zod@3.x at root, while every @deepseek-ai/dsh-*
// package depends on zod@4.x. npm therefore nests a full copy of zod inside
// EACH of the ~37 dsh packages (~9MB each, ~330MB total on disk, ~180MB in
// the packaged app after .ts pruning).
//
// Node resolution walks up ancestor node_modules, so ONE copy placed at
// node_modules/@deepseek-ai/node_modules/zod is visible to every dsh-*
// package. This script:
//   1. groups nested copies under <scope>/<pkg>/node_modules/<name> by version
//   2. if all copies of <name> share one version, keeps a single hoisted copy
//      at <scope>/node_modules/<name> and deletes the rest
//   3. copies with divergent versions are left untouched (safety)
//
// Idempotent; safe to run via "postinstall" on every npm install.
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nm = join(root, "node_modules");

function readVersion(pkgDir) {
  try {
    return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version || null;
  } catch {
    return null;
  }
}

// Collect scopes (e.g. @deepseek-ai) that actually exist
const scopes = readdirSync(nm, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith("@"))
  .map(d => d.name);

let deduped = 0;

for (const scope of scopes) {
  const scopeDir = join(nm, scope);
  const pkgs = readdirSync(scopeDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);

  // name -> Map<version, string[]> (nested copy paths)
  const nested = new Map();

  for (const pkg of pkgs) {
    const nestedNm = join(scopeDir, pkg, "node_modules");
    if (!existsSync(nestedNm)) continue;
    let entries;
    try {
      entries = readdirSync(nestedNm, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name.startsWith("@")
        ? `${entry.name}/${readdirSync(join(nestedNm, entry.name), { withFileTypes: true }).find(d => d.isDirectory())?.name}`
        : entry.name;
      if (!name) continue;
      const copyDir = join(nestedNm, name);
      const version = readVersion(copyDir);
      if (!version) continue;
      if (!nested.has(name)) nested.set(name, new Map());
      const byVersion = nested.get(name);
      if (!byVersion.has(version)) byVersion.set(version, []);
      byVersion.get(version).push(copyDir);
    }
  }

  for (const [name, byVersion] of nested) {
    if (byVersion.size !== 1) continue; // divergent versions: keep as-is
    const [version, copies] = [...byVersion.entries()][0];
    if (copies.length < 2) continue; // nothing to dedupe

    const hoistDir = join(scopeDir, "node_modules");
    const target = join(hoistDir, name);

    // Already hoisted with a different version? Leave nested copies alone.
    if (existsSync(target)) {
      const existing = readVersion(target);
      if (existing === version) {
        // Same version already hoisted: all nested copies are redundant.
        for (const dir of copies) rmSync(dir, { recursive: true, force: true });
        deduped += copies.length;
        console.log(`[dedupe-nested] ${scope}/${name}@${version}: removed ${copies.length} redundant nested copies (already hoisted)`);
      }
      continue;
    }

    mkdirSync(join(hoistDir, dirname(name)), { recursive: true });
    cpSync(copies[0], target, { recursive: true });
    for (const dir of copies) rmSync(dir, { recursive: true, force: true });
    deduped += copies.length;
    console.log(`[dedupe-nested] ${scope}/${name}@${version}: ${copies.length} nested copies -> 1 hoisted copy`);
  }
}

if (deduped === 0) {
  console.log("[dedupe-nested] nothing to dedupe");
}
