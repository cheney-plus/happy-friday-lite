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
const unpackedDir = targetArch === 'x64' ? 'linux-unpacked' : `linux-${targetArch}-unpacked`
const targetMachine = targetArch === 'arm64' ? 183 : 62 // ELF: AArch64 / x86-64
const targetLabel = targetArch === 'arm64' ? 'ARM64' : 'x64'
const candidates = [
  join('release', unpackedDir, 'resources', 'app', 'node_modules', 'node-pty', 'build', 'Release', 'pty.node'),
  join('release', unpackedDir, 'resources', 'app', 'node_modules', 'node-pty', 'prebuilds', `linux-${targetArch}`, 'pty.node'),
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
