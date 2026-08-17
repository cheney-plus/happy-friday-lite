// Work around @deepseek-ai/dsh-host-directory-picker-native spawning its
// Win32 dialog worker through process.execPath. In Electron, that executable
// is electron.exe rather than node.exe, so the worker exits before it can send
// its IPC result unless Electron is explicitly asked to run as Node.
//
// The patch is idempotent and runs after every dependency installation.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const file = join(
  root,
  '..',
  'node_modules',
  '@deepseek-ai',
  'dsh-host-directory-picker-native',
  'lib',
  'index.js'
)
const marker = 'ELECTRON_RUN_AS_NODE: "1"'
const original = 'const env = {\n\t\t...process.env,\n\t\tDSH_DIALOG_TITLE: data.title\n\t};'
const replacement = 'const env = {\n\t\t...process.env,\n\t\tELECTRON_RUN_AS_NODE: "1",\n\t\tDSH_DIALOG_TITLE: data.title\n\t};'

if (!existsSync(file)) {
  console.log('[fix-dsh-directory-picker-electron] target not found, skipping')
  process.exit(0)
}

const source = readFileSync(file, 'utf8')
if (source.includes(marker)) {
  console.log('[fix-dsh-directory-picker-electron] already patched, no changes')
  process.exit(0)
}

if (!source.includes(original)) {
  throw new Error(
    '[fix-dsh-directory-picker-electron] unsupported DSH source; update this patch before packaging'
  )
}

writeFileSync(file, source.replace(original, replacement))
console.log('[fix-dsh-directory-picker-electron] patched Win32 dialog worker launch')
