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
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { koffiNativeSpec, nativePackageInstalled } from './koffi-native.cjs'
import { sharpNativePackageInstalled, sharpNativeSpecs } from './sharp-native.cjs'
import { runtimePackageInstalled, targetRuntimeSpecs } from './native-runtime.cjs'

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
    isInstalled: (root, spec, packageDirName = spec.name) =>
      nativePackageInstalled(root, { ...spec, name: packageDirName }),
  },
  {
    ...koffiNativeSpec('node_modules', platform, arch),
    isInstalled: (root, spec, packageDirName = spec.name) =>
      nativePackageInstalled(root, { ...spec, name: packageDirName }),
  },
  ...sharpNativeSpecs('node_modules', platform, arch).map(spec => ({
    ...spec,
    isInstalled: sharpNativePackageInstalled,
  })),
  ...targetRuntimeSpecs('node_modules', platform, arch)
    .filter(spec => ![
      `@zvec/bindings-${platform}-${arch}`,
      `@koromix/koffi-${platform}-${arch}`,
    ].includes(spec.name))
    .map(spec => ({ ...spec, isInstalled: runtimePackageInstalled })),
]

function installNativePackage(spec) {
  const { name, version, isInstalled } = spec
  const pkg = `${name}@${version}`
  const target = `node_modules/${name}`

  if (isInstalled('node_modules', spec)) {
    console.log(`[prebuild-install] ${pkg} already installed, skipping`)
    return
  }

  console.log(`[prebuild-install] Downloading ${pkg} via npm pack...`)
  const tmpDir = mkdtempSync(join(tmpdir(), `${name.replace('/', '-')}-`))
  try {
    execFileSync('npm', ['pack', pkg, '--pack-destination', tmpDir], { stdio: 'pipe' })
    const tarball = join(tmpDir, `${name.replace('@', '').replace('/', '-')}-${version}.tgz`)
    if (!existsSync(tarball)) {
      throw new Error(`npm pack did not produce expected tarball at ${tarball}`)
    }

    const staging = join(tmpDir, 'extract')
    mkdirSync(staging, { recursive: true })
    execFileSync('tar', ['-xzf', tarball, '-C', staging], { stdio: 'pipe' })

    const extracted = join(staging, 'package')
    if (!existsSync(extracted)) {
      throw new Error(`tar extraction did not produce expected 'package' dir`)
    }

    if (!isInstalled(staging, spec, 'package')) {
      throw new Error(`Downloaded ${pkg} has an invalid version or missing binary`)
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
