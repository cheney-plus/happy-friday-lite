// Audit every native binary and every platform package in an unpacked Linux
// Electron app. This runs after afterPack and before release artifact upload.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { auditNativeArtifact } from './native-artifact-audit.cjs'
import { verifyDeepseekImports } from './afterpack.cjs'

const targetArch = process.argv[2] || process.arch
const outputDir = process.argv[3] || 'release'
const unpackedDir = targetArch === 'x64' ? 'linux-unpacked' : `linux-${targetArch}-unpacked`
const appDir = resolve(outputDir, unpackedDir)
const packagedModules = join(appDir, 'resources', 'app', 'node_modules')

if (!existsSync(packagedModules)) {
  throw new Error(`Unpacked app not found: ${packagedModules}`)
}

verifyDeepseekImports(packagedModules)
console.log('[verify-packaged-native-modules] Verified packaged Harness imports')

const audit = auditNativeArtifact(appDir, targetArch)
console.log(`[verify-packaged-native-modules] Verified ${audit.binaries.length} native binaries are Linux ${targetArch}`)
console.log(`[verify-packaged-native-modules] Verified ${audit.specs.length} target runtime packages`)
console.log(`[verify-packaged-native-modules] Verified ${audit.platformOptionals.length} platform-specific optional dependency edges`)
for (const warning of audit.warnings) {
  console.warn(`[verify-packaged-native-modules] WARNING: ${warning}`)
}

if (process.platform === 'linux' && process.arch === targetArch) {
  const executable = join(appDir, 'happy-friday-lite')
  const probeScript = fileURLToPath(new URL('./probe-packaged-native-modules.cjs', import.meta.url))
  const probe = spawnSync(executable, [probeScript, packagedModules, '--include-lazy'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    timeout: 60000,
  })
  if (probe.error || probe.status !== 0) {
    throw new Error(`Packaged Electron native probe failed: ${probe.error || probe.stderr || probe.stdout}`)
  }
  process.stdout.write(probe.stdout)
}
