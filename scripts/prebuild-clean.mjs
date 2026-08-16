// Pre-build cleanup: remove packages that are not needed in the final app
// but would otherwise get packaged by electron-builder's dependency walker.
//
// 1. Non-target arch @zvec and Koffi native bindings. Both packages ship
//    separate packages for linux-x64 and linux-arm64; only one is needed per
//    build.
// 2. tesseract.js — a 44MB OCR library pulled in by officeparser's
//    dependency tree. officeparser only uses it for optional OCR; basic
//    PPTX/DOCX text extraction does not require it. The `!` glob exclusion
//    in package.json `files` does not reliably prevent electron-builder's
//    dependency walker from including it, so we remove it physically.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const targetArch = process.argv[2] || process.arch
const removeArch = targetArch === 'arm64' ? 'x64' : 'arm64'
const nodeModules = 'node_modules'

// ============================================================
// Pre-flight check: verify all production dependencies are installed.
// electron-builder silently omits packages missing from node_modules,
// producing a broken asar that crashes at runtime with ERR_MODULE_NOT_FOUND.
// ============================================================
function verifyDependencies() {
  const pkgJson = JSON.parse(readFileSync('package.json', 'utf-8'))
  const deps = Object.keys(pkgJson.dependencies || {})
  const missing = deps.filter((dep) => !existsSync(join(nodeModules, dep, 'package.json')))
  if (missing.length > 0) {
    console.error('[prebuild-clean] ERROR: The following dependencies are missing from node_modules:')
    for (const dep of missing) {
      console.error(`  - ${dep}`)
    }
    console.error('[prebuild-clean] Run `npm install` or `npm ci` before building.')
    process.exit(1)
  }
  console.log(`[prebuild-clean] Verified ${deps.length} production dependencies are installed`)
}

verifyDependencies()

// node-pty does not publish a Linux ARM64 prebuild. electron-builder cannot
// turn an x64 .node file into ARM64, so fail before producing a broken package.
function verifyNodePtyArchitecture() {
  const targetMachine = targetArch === 'arm64' ? 183 : 62 // ELF: AArch64 / x86-64
  const targetLabel = targetArch === 'arm64' ? 'ARM64' : 'x64'
  const nativeModule = join(nodeModules, 'node-pty', 'build', 'Release', 'pty.node')

  if (!existsSync(nativeModule)) {
    console.error(`[prebuild-clean] ERROR: Missing ${nativeModule}. Run npm install on the target architecture first.`)
    process.exit(1)
  }

  const header = readFileSync(nativeModule).subarray(0, 20)
  const machine = header.length >= 20 && header[0] === 0x7f && header.toString('ascii', 1, 4) === 'ELF'
    ? header.readUInt16LE(18)
    : null

  if (machine !== targetMachine) {
    console.error(`[prebuild-clean] ERROR: node-pty is not a Linux ${targetLabel} binary.`)
    console.error(`[prebuild-clean] Build the Linux ${targetLabel} package on a Linux ${targetLabel} machine, then run npm run electron:build:${targetArch}.`)
    process.exit(1)
  }

  console.log(`[prebuild-clean] Verified node-pty is a Linux ${targetLabel} binary`)
}

verifyNodePtyArchitecture()

let removed = 0

function getDirSize(dir) {
  let total = 0
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) total += getDirSize(full)
      else total += statSync(full).size
    }
  } catch {}
  return total
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return bytes + 'B'
}

function removePkg(pkg, reason) {
  const dir = join(nodeModules, pkg)
  if (existsSync(dir)) {
    const size = getDirSize(dir)
    rmSync(dir, { recursive: true, force: true })
    console.log(`[prebuild-clean] Removed ${pkg} (${formatSize(size)}) — ${reason}`)
    removed += size
  }
}

// 1. Non-target arch native bindings
removePkg(`@zvec/bindings-linux-${removeArch}`, `not needed for ${targetArch}`)
removePkg(`@koromix/koffi-linux-${removeArch}`, `not needed for ${targetArch}`)

// 2. tesseract.js — 44MB OCR library, not needed for basic office doc parsing
removePkg('tesseract.js', 'OCR not used; saves ~44MB')

console.log(`[prebuild-clean] Total freed: ${formatSize(removed)}`)
