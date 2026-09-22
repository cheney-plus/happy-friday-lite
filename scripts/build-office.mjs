#!/usr/bin/env node
/**
 * Build HappyOffice editor bundles into resources/office/.
 *
 * Stages:
 *  1. Build the Rust xlsx-sidecar (Sheets) via cargo (optional, skipped when cargo is missing).
 *  2. Build each editor's preload + renderer with electron-vite (upstream build).
 *  3. Bundle each editor's main-process module (the API surface the upstream
 *     shell imports, e.g. createDocsView / configureDocsRuntime) with esbuild
 *     into a self-contained CJS bundle loadable from our JS main process.
 *  4. Copy an allowlist of artifacts into resources/office/.
 *
 * Usage: node scripts/build-office.mjs [--skip-renderer] [--skip-native]
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VENDOR = path.join(ROOT, 'vendor', 'happyoffice')
const OFFICE_ROOT = path.join(ROOT, 'resources', 'office')

const EDITORS = ['docs', 'sheets', 'slides', 'pdf']
const BUNDLE_ENTRIES = [...EDITORS, 'office-utils']
const SKIP_RENDERER = process.argv.includes('--skip-renderer')
const SKIP_NATIVE = process.argv.includes('--skip-native')
const SKIP_CLI = process.argv.includes('--skip-cli')

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    shell: process.platform === 'win32',
  })
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${res.status}`)
  }
}

function ensureVendorDeps() {
  if (!fs.existsSync(path.join(VENDOR, 'node_modules', '.bin'))) {
    console.log('[office] Installing vendor dependencies (first run)…')
    run('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: VENDOR,
      env: { ELECTRON_SKIP_BINARY_DOWNLOAD: '1' },
    })
  }
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true })
}

// ---- 1. Rust sidecar -------------------------------------------------------

function buildSidecar() {
  if (SKIP_NATIVE) return null
  const cargoManifest = path.join(VENDOR, 'apps', 'sheets', 'native', 'xlsx-engine', 'Cargo.toml')
  if (!fs.existsSync(cargoManifest)) return null
  const cargo = spawnSync('cargo', ['--version'], { encoding: 'utf8' })
  if (cargo.status !== 0) {
    console.warn('[office] cargo not found — skipping xlsx-sidecar build (Sheets will lack the native engine)')
    return null
  }
  console.log('[office] Building Rust xlsx-sidecar…')
  run('cargo', ['build', '--release', '--manifest-path', cargoManifest], { cwd: VENDOR })
  const exe = process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar'
  const bin = path.join(path.dirname(cargoManifest), 'target', 'release', exe)
  if (!fs.existsSync(bin)) throw new Error(`sidecar binary not found: ${bin}`)
  return bin
}

// ---- 2. Preload + renderer builds ------------------------------------------

function buildEditorApps() {
  for (const editor of EDITORS) {
    const out = path.join(VENDOR, 'apps', editor, 'out')
    if (SKIP_RENDERER && fs.existsSync(path.join(out, 'renderer', 'index.html'))) {
      console.log(`[office] ${editor}: renderer build cached (--skip-renderer)`)
      continue
    }
    console.log(`[office] Building ${editor} (electron-vite)…`)
    run('npx', ['electron-vite', 'build'], {
      cwd: path.join(VENDOR, 'apps', editor),
      env: { ELECTRON_SKIP_BINARY_DOWNLOAD: '1' },
    })
  }
}

// ---- 3. Main-process bundles ------------------------------------------------

/** 将指定模块 stub 为空对象（如本产品禁用的上游自动更新） */
function stubPlugin(modules) {
  const filter = new RegExp(`^(${modules.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)
  return {
    name: 'stub-modules',
    setup(build) {
      build.onResolve({ filter }, () => ({ path: 'stub', namespace: 'stub' }))
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'module.exports = {}',
        loader: 'js',
      }))
    },
  }
}

/** Vite 的 `?raw` 文本导入插件（esbuild 原生不支持） */
function rawImportPlugin() {
  return {
    name: 'raw-import',
    setup(build) {
      build.onResolve({ filter: /\?raw$/ }, (args) => ({
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'raw-file',
      }))
      build.onLoad({ filter: /.*/, namespace: 'raw-file' }, (args) => ({
        contents: fs.readFileSync(args.path.replace(/\?raw$/, '')),
        loader: 'text',
      }))
    },
  }
}

/**
 * Vite/electron-vite 的 `?asset` 导入：运行时解析为文件绝对路径。
 * esbuild 插件将资源复制到 resources/office/assets/<hash>.<ext>，
 * 并导出基于 bundle __dirname 的运行时绝对路径（dev 与打包后一致）。
 */
function assetImportPlugin() {
  const crypto = createRequire(path.join(VENDOR, 'package.json'))('node:crypto')
  const assetsDir = path.join(OFFICE_ROOT, 'assets')
  fs.mkdirSync(assetsDir, { recursive: true })
  return {
    name: 'asset-import',
    setup(build) {
      build.onResolve({ filter: /\?asset$/ }, async (args) => {
        const clean = args.path.replace(/\?asset$/, '')
        const direct = path.resolve(args.resolveDir, clean)
        if (fs.existsSync(direct)) return { path: direct, namespace: 'asset-file' }
        // 裸包名（如 @genoffice/ui/fonts/x.ttf）走常规包解析
        const resolved = await build.resolve(clean, { resolveDir: args.resolveDir, kind: 'import-statement' })
        return { path: resolved.path || direct, namespace: 'asset-file' }
      })
      build.onLoad({ filter: /.*/, namespace: 'asset-file' }, (args) => {
        const src = args.path.replace(/\?asset$/, '')
        const ext = path.extname(src)
        const hash = crypto.createHash('sha1').update(src).digest('hex').slice(0, 12)
        const name = `${hash}${ext}`
        fs.copyFileSync(src, path.join(assetsDir, name))
        return {
          contents: `module.exports = require("path").join(__dirname, "..", "assets", ${JSON.stringify(name)})`,
          loader: 'js',
        }
      })
    },
  }
}

async function buildMainBundles() {
  console.log('[office] Bundling editor main-process modules (esbuild)…')
  const vendorRequire = createRequire(path.join(VENDOR, 'package.json'))
  const esbuild = vendorRequire('esbuild')
  const entriesRoot = path.join(__dirname, 'office', 'entries')
  const outDir = path.join(OFFICE_ROOT, 'main')
  fs.mkdirSync(outDir, { recursive: true })
  for (const editor of BUNDLE_ENTRIES) {
    await esbuild.build({
      entryPoints: [path.join(entriesRoot, `${editor}.ts`)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      outfile: path.join(outDir, editor === 'office-utils' ? 'office-utils.cjs' : `${editor}-main.cjs`),
      // pdf ocr.ts / wasm-path.ts 依赖 import.meta.url（CJS 输出下退化为空），
      // 用 bundle 自身的 file URL 替代，使 createRequire 仍指向 bundle 位置
      define: {
        'import.meta.url': JSON.stringify(`file://${path.join(outDir, `${editor}-main.cjs`)}`),
      },
      external: ['electron'],
      // 上游自动更新依赖在本产品中不使用，stub 为空模块
      plugins: [stubPlugin(['electron-updater']), rawImportPlugin(), assetImportPlugin()],
      logLevel: 'warning',
    })
    console.log(`[office] bundled ${editor === 'office-utils' ? 'office-utils' : `${editor}-main`}.cjs`)
  }
}

// ---- 3b. Headless CLI (happyfriday-office) -----------------------------------

function buildCli() {
  if (SKIP_CLI) return
  console.log('[office] Building happyfriday-office CLI (upstream @genoffice/cli)…')
  run('npm', ['run', 'build', '--workspace', '@genoffice/cli', '--no-audit', '--no-fund'], {
    cwd: VENDOR,
    env: { ELECTRON_SKIP_BINARY_DOWNLOAD: '1' },
  })
  const bundle = path.join(VENDOR, 'packages', 'cli', 'dist', 'genoffice.cjs')
  if (!fs.existsSync(bundle)) throw new Error(`CLI bundle not found: ${bundle}`)
}

// ---- 4. Stage artifacts ------------------------------------------------------

function stage(sidecarBin) {
  console.log('[office] Staging artifacts into resources/office…')
  for (const editor of EDITORS) {
    const out = path.join(VENDOR, 'apps', editor, 'out')
    const dest = path.join(OFFICE_ROOT, editor)
    fs.rmSync(dest, { recursive: true, force: true })
    fs.mkdirSync(dest, { recursive: true })
    copyDir(path.join(out, 'preload'), path.join(dest, 'preload'))
    copyDir(path.join(out, 'renderer'), path.join(dest, 'renderer'))
  }
  if (sidecarBin) {
    const sidecarDir = path.join(OFFICE_ROOT, 'sheets', 'sidecar')
    fs.mkdirSync(sidecarDir, { recursive: true })
    fs.copyFileSync(sidecarBin, path.join(sidecarDir, path.basename(sidecarBin)))
    // CLI 通过 packagedResourcesDir() 定位 <root>/native/xlsx-sidecar
    const nativeDir = path.join(OFFICE_ROOT, 'native')
    fs.mkdirSync(nativeDir, { recursive: true })
    fs.copyFileSync(sidecarBin, path.join(nativeDir, path.basename(sidecarBin)))
  }
  // happyfriday-office CLI：单 CJS bundle + 旁置 jsdom 依赖树
  if (!SKIP_CLI) {
    const cliDist = path.join(VENDOR, 'packages', 'cli', 'dist')
    const cliDir = path.join(OFFICE_ROOT, 'cli')
    fs.rmSync(cliDir, { recursive: true, force: true })
    fs.mkdirSync(cliDir, { recursive: true })
    fs.copyFileSync(path.join(cliDist, 'genoffice.cjs'), path.join(cliDir, 'happyfriday-office.cjs'))
    if (fs.existsSync(path.join(cliDist, 'node_modules'))) {
      copyDir(path.join(cliDist, 'node_modules'), path.join(cliDir, 'node_modules'))
    }
  }
  // PDF 运行时 WASM（打包后 electron-builder 将其放到 Resources/wasm）
  const wasmDir = path.join(OFFICE_ROOT, 'wasm')
  fs.mkdirSync(wasmDir, { recursive: true })
  const pdfiumWasm = path.join(VENDOR, 'node_modules', '@embedpdf', 'pdfium', 'dist', 'pdfium.wasm')
  if (fs.existsSync(pdfiumWasm)) fs.copyFileSync(pdfiumWasm, path.join(wasmDir, 'pdfium.wasm'))
  const hbSubset = path.join(VENDOR, 'node_modules', 'harfbuzzjs', 'dist', 'harfbuzz-subset.wasm')
  if (fs.existsSync(hbSubset)) fs.copyFileSync(hbSubset, path.join(wasmDir, 'hb-subset.wasm'))
  // Keep upstream license notices alongside the editor bundles.
  const upstreamRoot = VENDOR
  for (const f of ['LICENSE', 'NOTICE', 'LICENSE-UNICODE.txt']) {
    const src = path.join(upstreamRoot, f)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OFFICE_ROOT, f))
  }
}

// ---- 4b. Agent skill（路径/命令改写后的 SKILL.md）----------------------------

/**
 * 将上游 skills/genoffice/SKILL.md 适配为本产品内置 skill：
 *  - 命令名 genoffice → happyfriday-office（仅反引号内的命令调用）
 *  - 启动器段落改写为本产品 CLI 的实际位置与推荐用法（office_* Agent 工具）
 *  - 保留上游 frontmatter（name: genoffice 与目录名一致）与许可证
 */
function stageSkill() {
  const src = path.join(VENDOR, 'skills', 'genoffice', 'SKILL.md')
  if (!fs.existsSync(src)) {
    console.warn('[office] upstream SKILL.md missing — skipping skill staging')
    return
  }
  let md = fs.readFileSync(src, 'utf8')
  // 上游启动器段落（~/.genoffice/launcher 等）对本产品无意义，整段替换
  md = md.replace(
    /^`genoffice` is installed with GenOffice\..*$/m,
    '`happyfriday-office` ships inside Happy Friday (no separate installation). In this app you normally do not call the binary directly: prefer the `office_open` / `office_create` / `office_inspect` / `office_export` / `office_edit_active` / `office_batch` agent tools, which locate and run the bundled CLI for you (headless, on the app\'s own Node/Electron runtime). The `open` and `selection` commands are covered by the `office_open` tool and are not available to the bare CLI here. Direct invocation, when a tool does not fit: the bundle lives at `<app resources>/office/cli/happyfriday-office.cjs` with its `node_modules` beside it, the pdfium wasm at `<app resources>/office/wasm/pdfium.wasm` and the xlsx sidecar at `<app resources>/office/native/xlsx-sidecar`; when running the bundle with a plain Node, point `GENOFFICE_PDFIUM_WASM` / `XLSX_SIDECAR_PATH` at those two files. Every command runs headless on the app\'s own engines; only `search`, `image` and `media` send data off the machine.'
  )
  // 其余反引号内的命令调用统一改名（GenOffice 专名为大小写不同，不受影响）
  md = md.replace(/`genoffice\b/g, '`happyfriday-office')
  // 代码示例块中的裸命令调用（先保护 frontmatter 的 name: genoffice）
  md = md.replace(/^name: genoffice$/m, 'name: __SKILL_NAME__')
  md = md.replace(/\bgenoffice\b/g, 'happyfriday-office')
  md = md.replace('name: __SKILL_NAME__', 'name: genoffice')
  const destDir = path.join(ROOT, 'public', 'skills', 'genoffice')
  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(path.join(destDir, 'SKILL.md'), md)
  // 保留上游许可证
  for (const f of ['LICENSE', 'NOTICE']) {
    const lic = path.join(VENDOR, f)
    if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(destDir, f))
  }
  console.log('[office] staged agent skill → public/skills/genoffice')
}

// ---- Main -------------------------------------------------------------------

function main() {
  if (!fs.existsSync(path.join(VENDOR, 'apps'))) {
    console.error('[office] vendor/happyoffice is missing. Run: git submodule update --init vendor/happyoffice')
    process.exit(1)
  }
  ensureVendorDeps()
  const sidecarBin = buildSidecar()
  buildEditorApps()
  buildMainBundles()
  buildCli()
  stage(sidecarBin)
  stageSkill()
  console.log('[office] Done. Artifacts staged in resources/office')
}

main()
