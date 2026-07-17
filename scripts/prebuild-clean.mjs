// Pre-build cleanup: remove packages that are not needed in the final app
// but would otherwise get packaged by electron-builder's dependency walker.
//
// 1. Non-target arch @zvec native bindings (@zvec ships separate packages
//    for linux-x64 and linux-arm64; only one is needed per build).
// 2. tesseract.js — a 44MB OCR library pulled in by officeparser's
//    dependency tree. officeparser only uses it for optional OCR; basic
//    PPTX/DOCX text extraction does not require it. The `!` glob exclusion
//    in package.json `files` does not reliably prevent electron-builder's
//    dependency walker from including it, so we remove it physically.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const targetArch = process.argv[2] || process.arch
const removeArch = targetArch === 'arm64' ? 'x64' : 'arm64'
const nodeModules = 'node_modules'

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

// 1. Non-target arch @zvec bindings
removePkg(`@zvec/bindings-linux-${removeArch}`, `not needed for ${targetArch}`)

// 2. tesseract.js — 44MB OCR library, not needed for basic office doc parsing
removePkg('tesseract.js', 'OCR not used; saves ~44MB')

console.log(`[prebuild-clean] Total freed: ${formatSize(removed)}`)
