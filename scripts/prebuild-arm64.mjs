// Cross-build helper: force-install linux-arm64 native bindings before
// electron-builder packages the app on an x64 host.
//
// @zvec/bindings-linux-arm64 declares cpu:["arm64"], so npm skips it on x64.
// We use npm install --force to bypass the platform check.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PKG = '@zvec/bindings-linux-arm64@0.5.0'
const marker = 'node_modules/@zvec/bindings-linux-arm64'

if (existsSync(marker)) {
  console.log(`[prebuild-arm64] ${PKG} already installed, skipping`)
} else {
  console.log(`[prebuild-arm64] Installing ${PKG} (force, cross-compile)...`)
  execSync(`npm install ${PKG} --force --no-save`, { stdio: 'inherit' })
  console.log(`[prebuild-arm64] Done.`)
}
