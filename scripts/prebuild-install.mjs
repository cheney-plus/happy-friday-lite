// Cross-build helper: ensure the target platform/arch's @zvec native bindings
// are installed before electron-builder packages the app, or restore the
// host's bindings after a cross-arch build.
//
// @zvec/bindings-<platform>-<arch> declares os/cpu filters, so `npm install`
// skips mismatched packages on a foreign host. We use `npm pack` to download
// the tarball and extract it manually into node_modules, bypassing the check.
//
// Usage:
//   node prebuild-install.mjs                      restore host binding (process.platform + process.arch)
//   node prebuild-install.mjs <arch>               backward compat: Linux <arch> (for existing electron:build scripts)
//   node prebuild-install.mjs <platform> <arch>    explicit, e.g. linux x64 / darwin arm64 / win32 x64
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const a1 = process.argv[2]
const a2 = process.argv[3]
let platform, arch
if (a1 && a2) {
  platform = a1; arch = a2
} else if (a1) {
  platform = 'linux'; arch = a1
} else {
  platform = process.platform; arch = process.arch
}

const PKG = `@zvec/bindings-${platform}-${arch}@0.5.0`
const target = `node_modules/@zvec/bindings-${platform}-${arch}`
const marker = join(target, 'zvec_node_binding.node')

if (existsSync(marker)) {
  console.log(`[prebuild-install] ${PKG} already installed, skipping`)
} else {
  console.log(`[prebuild-install] Downloading ${PKG} via npm pack...`)
  const tmpDir = mkdtempSync(join(tmpdir(), `zvec-${platform}-${arch}-`))
  try {
    execSync(`npm pack ${PKG} --pack-destination ${tmpDir}`, { stdio: 'pipe' })
    const tarball = join(tmpDir, `zvec-bindings-${platform}-${arch}-0.5.0.tgz`)
    if (!existsSync(tarball)) {
      throw new Error(`npm pack did not produce expected tarball at ${tarball}`)
    }

    const staging = join(tmpDir, 'extract')
    mkdirSync(staging, { recursive: true })
    execSync(`tar -xzf ${tarball} -C ${staging}`, { stdio: 'pipe' })

    const extracted = join(staging, 'package')
    if (!existsSync(extracted)) {
      throw new Error(`tar extraction did not produce expected 'package' dir`)
    }

    mkdirSync('node_modules/@zvec', { recursive: true })
    rmSync(target, { recursive: true, force: true })
    cpSync(extracted, target, { recursive: true })

    console.log(`[prebuild-install] Installed ${PKG} -> ${target}`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
