// Verify that native modules inside an unpacked Electron app match the target
// Linux architecture. electron-builder can otherwise package an existing host
// binary when a cross-architecture build is attempted.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const targetArch = process.argv[2] || process.arch
const unpackedDir = targetArch === 'x64' ? 'linux-unpacked' : `linux-${targetArch}-unpacked`
const targetMachine = targetArch === 'arm64' ? 183 : 62 // ELF: AArch64 / x86-64
const targetLabel = targetArch === 'arm64' ? 'ARM64' : 'x64'
const nativeModule = join(
  'release',
  unpackedDir,
  'resources',
  'app',
  'node_modules',
  'node-pty',
  'build',
  'Release',
  'pty.node'
)

if (!existsSync(nativeModule)) {
  console.error(`[verify-packaged-native-modules] ERROR: Missing ${nativeModule}`)
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
