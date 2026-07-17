// Cross-build helper: ensure the target arch's @zvec native bindings are
// installed before electron-builder packages the app.
//
// @zvec/bindings-linux-<arch> declares cpu:["<arch>"], so `npm install --force`
// still skips cross-arch packages on a mismatched host. We use `npm pack` to
// download the tarball and extract it manually into node_modules, bypassing
// the platform check.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arch = process.argv[2] || process.arch
const PKG = `@zvec/bindings-linux-${arch}@0.5.0`
const target = `node_modules/@zvec/bindings-linux-${arch}`
const marker = join(target, 'zvec_node_binding.node')

if (existsSync(marker)) {
  console.log(`[prebuild-install] ${PKG} already installed, skipping`)
} else {
  console.log(`[prebuild-install] Downloading ${PKG} via npm pack...`)
  const tmpDir = mkdtempSync(join(tmpdir(), `zvec-${arch}-`))
  try {
    execSync(`npm pack ${PKG} --pack-destination ${tmpDir}`, { stdio: 'pipe' })
    const tarball = join(tmpDir, `zvec-bindings-linux-${arch}-0.5.0.tgz`)
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
