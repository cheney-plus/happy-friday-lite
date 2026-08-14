// Cross-build helper: ensure target platform/arch native bindings are installed
// before electron-builder packages the app, or restore the host's bindings
// after a cross-arch build.
//
// These packages declare os/cpu filters, so `npm install` skips mismatched
// packages on a foreign host. We use `npm pack` to download their tarballs and
// extract them manually into node_modules, bypassing those filters.
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

const nativePackages = [
  {
    name: `@zvec/bindings-${platform}-${arch}`,
    version: '0.5.0',
    marker: 'zvec_node_binding.node',
  },
  {
    name: `@koromix/koffi-${platform}-${arch}`,
    version: '3.1.5',
    marker: `${platform}_${arch}/koffi.node`,
  },
]

function installNativePackage({ name, version, marker }) {
  const pkg = `${name}@${version}`
  const target = `node_modules/${name}`

  if (existsSync(join(target, marker))) {
    console.log(`[prebuild-install] ${pkg} already installed, skipping`)
    return
  }

  console.log(`[prebuild-install] Downloading ${pkg} via npm pack...`)
  const tmpDir = mkdtempSync(join(tmpdir(), `${name.replace('/', '-')}-`))
  try {
    execSync(`npm pack ${pkg} --pack-destination ${tmpDir}`, { stdio: 'pipe' })
    const tarball = join(tmpDir, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`)
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

    mkdirSync(join('node_modules', name.substring(0, name.lastIndexOf('/'))), { recursive: true })
    rmSync(target, { recursive: true, force: true })
    cpSync(extracted, target, { recursive: true })

    console.log(`[prebuild-install] Installed ${pkg} -> ${target}`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

for (const nativePackage of nativePackages) installNativePackage(nativePackage)
