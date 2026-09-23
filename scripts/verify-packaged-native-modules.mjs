// Verify that native modules inside an unpacked Electron app match the target
// Linux architecture. electron-builder can otherwise package an existing host
// binary when a cross-architecture build is attempted.
//
// node-pty >= 1.2.0-beta.15 ships platform prebuilds, so a source-built
// build/Release/pty.node is no longer guaranteed — accept the shipped
// prebuilds/linux-<arch>/pty.node as well (runtime checks build first,
// then prebuilds).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const targetArch = process.argv[2] || process.arch
const outputDir = process.argv[3] || 'release'
const unpackedDir = targetArch === 'x64' ? 'linux-unpacked' : `linux-${targetArch}-unpacked`
const targetMachine = targetArch === 'arm64' ? 183 : 62 // ELF: AArch64 / x86-64
const targetLabel = targetArch === 'arm64' ? 'ARM64' : 'x64'
const candidates = [
  join(outputDir, unpackedDir, 'resources', 'app', 'node_modules', 'node-pty', 'build', 'Release', 'pty.node'),
  join(outputDir, unpackedDir, 'resources', 'app', 'node_modules', 'node-pty', 'prebuilds', `linux-${targetArch}`, 'pty.node'),
]
const nativeModule = candidates.find((file) => existsSync(file))

if (!nativeModule) {
  console.error(`[verify-packaged-native-modules] ERROR: Missing node-pty binary (checked: ${candidates.join(', ')})`)
  process.exit(1)
}

const header = readFileSync(nativeModule).subarray(0, 20)
const machine = header.length >= 20 && header[0] === 0x7f && header.toString('ascii', 1, 4) === 'ELF'
  ? header.readUInt16LE(18)
  : null

if (machine !== targetMachine) {
  console.error(`[verify-packaged-native-modules] ERROR: Packaged node-pty is not a Linux ${targetLabel} binary.`)
  console.error(`[verify-packaged-native-modules] Rebuild on a Linux ${targetLabel} machine before publishing this artifact.`)
  process.exit(1)
}

console.log(`[verify-packaged-native-modules] Verified packaged node-pty is a Linux ${targetLabel} binary`)

const { verifyKoffiNative } = await import('./koffi-native.cjs')
const { verifySharpNative } = await import('./sharp-native.cjs')
const { spawnSync } = await import('node:child_process')
const { resolve } = await import('node:path')
const appDir = resolve(outputDir, unpackedDir)
const packagedModules = join(appDir, 'resources/app/node_modules')
const { verifyDeepseekImports } = await import('./afterpack.cjs')
verifyDeepseekImports(packagedModules)
console.log('[verify-packaged-native-modules] Verified packaged Harness imports')
const spec = verifyKoffiNative(packagedModules, 'linux', targetArch)
console.log(`[verify-packaged-native-modules] Verified ${spec.name}@${spec.version}`)
const sharpSpecs = verifySharpNative(packagedModules, 'linux', targetArch)
console.log(`[verify-packaged-native-modules] Verified ${sharpSpecs.map(item => `${item.name}@${item.version}`).join(' and ')}`)
if (process.platform === 'linux' && process.arch === targetArch) {
  const probe = spawnSync(join(appDir, 'happy-friday-lite'), ['-e',
    `const koffi = require(${JSON.stringify(join(packagedModules, 'koffi'))}); console.log('Loaded Koffi ' + koffi.version)`], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30000,
  })
  if (probe.error || probe.status !== 0) {
    throw new Error(`Packaged Electron failed to load Koffi: ${probe.error || probe.stderr || probe.stdout}`)
  }
  console.log(probe.stdout.trim())

  const sharpProbe = spawnSync(join(appDir, 'happy-friday-lite'), ['-e',
    `const sharp = require(${JSON.stringify(join(packagedModules, 'sharp'))}); sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer().then(buffer => { if (!buffer.length) throw new Error('empty output'); console.log('Loaded Sharp ' + sharp.versions.sharp); }).catch(error => { console.error(error); process.exitCode = 1; });`], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30000,
  })
  if (sharpProbe.error || sharpProbe.status !== 0) {
    throw new Error(`Packaged Electron failed to load Sharp: ${sharpProbe.error || sharpProbe.stderr || sharpProbe.stdout}`)
  }
  console.log(sharpProbe.stdout.trim())
}
