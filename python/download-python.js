#!/usr/bin/env node
/**
 * 下载嵌入式 Python 运行时
 * ============================================
 * 基于 python-build-standalone 项目（https://github.com/astral-sh/python-build-standalone）
 *
 * 下载后解压至 python/python-{platform}-{arch}/ 目录，
 * 目录结构与 src-electron/python.js 中 getPlatformDirName() 保持一致：
 *   - 开发环境：项目根目录/python/python-{platform}-{arch}/
 *   - 打包后：electron-builder 的 extraResources 会将其放入 resources/python/
 *
 * 用法：
 *   npm run python:download              # 下载当前平台运行时（经镜像加速）
 *   npm run python:download:all          # 下载所有平台运行时（经镜像加速）
 *   npm run python:download:github       # 下载当前平台运行时（直连 GitHub）
 *   node python/download-python.js --all # 下载所有平台
 *   node python/download-python.js --tag 20260623       # 指定 release tag
 *   node python/download-python.js --no-deps            # 跳过依赖安装
 *
 * 可选环境变量：
 *   PYTHON_BUILD_STANDALONE_TAG   指定 release tag（覆盖 --tag）
 *   PYTHON_MIRROR                 自定义镜像前缀（如 https://gh-proxy.com/）
 */

import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ────────────────────────────────────────────────────────────────────────────
// 配置
// ────────────────────────────────────────────────────────────────────────────

// 期望的 CPython 大版本（用于从 release assets 中筛选）
const PYTHON_MAJOR = '3.12'

// 预装到运行时中的第三方库（与 pythonRepl.js 中声明的预装库一致）
// 仅包含常用基础库，不含 scipy/scikit-learn/torch 等科学计算与机器学习库
const PREINSTALLED_PKGS = [
  // HTTP / 网络请求
  'requests',
  // HTML / XML 解析
  'beautifulsoup4',
  'lxml',
  // 数据处理
  'pandas',
  'numpy',
  'openpyxl', // Excel 读写
  // 绘图
  'matplotlib',
  // 图像处理（matplotlib 后端常用）
  'pillow',
  // 配置 / 序列化
  'PyYAML',
  // 日期时间处理（pandas 依赖，显式预装以便直接使用）
  'python-dateutil',
  // 进度条
  'tqdm',
  // 文档转换
  'markitdown'
]

// GitHub 镜像前缀（国内加速），可通过环境变量 PYTHON_MIRROR 覆盖
const DEFAULT_MIRROR = 'https://gh-proxy.com/'

// API 失败时的兜底 release tag
const FALLBACK_TAG = '20260623'

// 平台 → python-build-standalone target 映射
// target 用于匹配 release asset 名称中的平台段
// binDir / exeName 用于校验解压后的可执行文件路径
const PLATFORM_TARGETS = {
  'win32-x64':    { target: 'x86_64-pc-windows-msvc-shared',  exeName: 'python.exe', binDir: '' },
  'win32-arm64':  { target: 'aarch64-pc-windows-msvc-shared', exeName: 'python.exe', binDir: '' },
  'darwin-arm64': { target: 'aarch64-apple-darwin',           exeName: 'python3',    binDir: 'bin' },
  'darwin-x64':   { target: 'x86_64-apple-darwin',            exeName: 'python3',    binDir: 'bin' },
  'linux-x64':    { target: 'x86_64-unknown-linux-gnu',       exeName: 'python3',    binDir: 'bin' },
  'linux-arm64':  { target: 'aarch64-unknown-linux-gnu',      exeName: 'python3',    binDir: 'bin' }
}

// ────────────────────────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(msg + '\n')
}

function logStep(msg) {
  log(`\n▶ ${msg}`)
}

function logOk(msg) {
  log(`  ✓ ${msg}`)
}

function logWarn(msg) {
  process.stderr.write(`  ! ${msg}\n`)
}

function logErr(msg) {
  process.stderr.write(`  ✗ ${msg}\n`)
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    all: false,
    mirror: false,
    tag: null,
    noDeps: false,
    platform: null
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    switch (a) {
      case '--all':
        opts.all = true
        break
      case '--mirror':
        opts.mirror = true
        break
      case '--github':
        opts.mirror = false
        break
      case '--tag':
        opts.tag = args[++i]
        break
      case '--no-deps':
        opts.noDeps = true
        break
      case '--platform':
        opts.platform = args[++i]
        break
      case '-h':
      case '--help':
        printHelp()
        process.exit(0)
      default:
        logWarn(`未知参数: ${a}（忽略）`)
    }
  }
  return opts
}

function printHelp() {
  log(`
下载嵌入式 Python 运行时（python-build-standalone）

用法:
  node python/download-python.js [选项]

选项:
  --all            下载所有平台运行时（默认仅下载当前平台）
  --mirror         使用 GitHub 镜像加速（国内推荐）
  --github         直连 GitHub（默认）
  --tag <tag>      指定 release tag（如 20260623），默认取最新
  --platform <key> 指定平台（如 linux-x64 / win32-x64 / darwin-arm64）
  --no-deps        跳过预装第三方库
  -h, --help       显示帮助

环境变量:
  PYTHON_BUILD_STANDALONE_TAG   指定 release tag
  PYTHON_MIRROR                 自定义镜像前缀
`)
}

/**
 * 获取当前平台标识
 */
function getPlatformKey() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${process.platform}-${arch}`
}

/**
 * HTTPS GET，自动跟随重定向，支持写入文件流
 */
function httpsGet(url, { headers = {}, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        resolve(httpsGet(res.headers.location, { headers }))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      resolve(res)
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('请求超时'))
    })
  })
}

/**
 * 获取 JSON（自动跟随重定向）
 */
async function fetchJson(url) {
  const res = await httpsGet(url, {
    headers: { 'User-Agent': 'happy-friday-python-downloader', Accept: 'application/vnd.github+json' }
  })
  const chunks = []
  for await (const chunk of res) {
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
}

/**
 * 获取最新 release tag
 */
async function getLatestTag() {
  const envTag = process.env.PYTHON_BUILD_STANDALONE_TAG
  if (envTag) {
    log(`使用环境变量指定的 tag: ${envTag}`)
    return envTag
  }
  try {
    logStep('查询 python-build-standalone 最新 release...')
    const data = await fetchJson('https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest')
    logOk(`最新 release: ${data.tag_name}`)
    return data.tag_name
  } catch (e) {
    logWarn(`查询最新 release 失败: ${e.message}，使用兜底 tag: ${FALLBACK_TAG}`)
    return FALLBACK_TAG
  }
}

/**
 * 获取指定 release 的 assets 列表
 */
async function getReleaseAssets(tag) {
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/${tag}`
    )
    return data.assets || []
  } catch (e) {
    logWarn(`获取 release ${tag} 的 assets 失败: ${e.message}`)
    return []
  }
}

/**
 * 从 assets 中查找匹配目标平台的 install_only 包
 * install_only（非 stripped）包含完整标准库与 pip
 */
function findAsset(assets, target) {
  // 匹配规则：名称以 -install_only.tar.gz 结尾（排除 install_only_stripped），
  // 且包含目标平台字符串，且版本以 cpython-3.12. 开头
  const suffix = '-install_only.tar.gz'
  return assets.find((a) => {
    const name = a.name
    return (
      name.endsWith(suffix) &&
      !name.includes('install_only_stripped') &&
      name.includes(target) &&
      name.startsWith(`cpython-${PYTHON_MAJOR}.`)
    )
  })
}

/**
 * 下载文件到指定路径，显示进度
 */
async function downloadFile(url, destPath) {
  const res = await httpsGet(url, {
    headers: { 'User-Agent': 'happy-friday-python-downloader' },
    timeout: 300000
  })
  const total = parseInt(res.headers['content-length'] || '0', 10)
  let received = 0
  let lastReport = 0

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destPath)
    res.on('data', (chunk) => {
      received += chunk.length
      // 每下载 5% 报告一次
      if (total > 0) {
        const pct = Math.floor((received / total) * 100)
        if (pct >= lastReport + 5) {
          lastReport = pct
          process.stdout.write(`\r  下载进度: ${pct}% (${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB)`)
        }
      }
    })
    res.pipe(stream)
    stream.on('finish', () => {
      stream.close()
      if (total > 0) process.stdout.write('\r  下载进度: 100%                              \n')
      else log('')
      resolve()
    })
    stream.on('error', (e) => {
      fs.unlinkSync(destPath)
      reject(e)
    })
    res.on('error', (e) => {
      stream.destroy()
      try { fs.unlinkSync(destPath) } catch (_) {}
      reject(e)
    })
  })
}

/**
 * 解压 tar.gz 到目标目录
 * 使用 --strip-components=1 去掉顶层 python/ 目录，
 * 使解压后直接得到 bin/ lib/ 等内容
 */
function extractTarball(tarballPath, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  const result = spawnSync('tar', ['-xzf', tarballPath, '-C', destDir, '--strip-components=1'], {
    stdio: 'pipe',
    encoding: 'utf-8'
  })
  if (result.status !== 0) {
    throw new Error(`tar 解压失败: ${result.stderr || result.stdout}`)
  }
}

/**
 * 在解压后的 Python 运行时中安装预装库
 * 仅对当前平台有效（跨平台无法直接运行目标 Python）
 */
function installPackages(pythonDir, platformKey) {
  const conf = PLATFORM_TARGETS[platformKey]
  if (!conf) {
    logWarn(`未知平台 ${platformKey}，跳过依赖安装`)
    return
  }
  const exePath = path.join(pythonDir, conf.binDir, conf.exeName)
  if (!fs.existsSync(exePath)) {
    logWarn(`找不到 Python 可执行文件: ${exePath}，跳过依赖安装`)
    return
  }

  logStep(`安装预装库: ${PREINSTALLED_PKGS.join(', ')}`)
  // -m pip install，使用 --no-cache-dir 减小体积
  const result = spawnSync(
    exePath,
    ['-m', 'pip', 'install', '--no-cache-dir', '--disable-pip-version-check', ...PREINSTALLED_PKGS],
    {
      stdio: 'pipe',
      encoding: 'utf-8',
      env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }
    }
  )
  if (result.status !== 0) {
    logWarn(`pip 安装失败（退出码 ${result.status}）`)
    if (result.stderr) process.stderr.write(result.stderr.slice(-500) + '\n')
    return
  }
  logOk('预装库安装完成')
}

/**
 * 校验 Python 运行时可用
 */
function verifyPython(pythonDir, platformKey) {
  const conf = PLATFORM_TARGETS[platformKey]
  const exePath = path.join(pythonDir, conf.binDir, conf.exeName)
  if (!fs.existsSync(exePath)) {
    logErr(`校验失败：找不到 ${exePath}`)
    return false
  }
  // 仅当前平台可执行
  if (platformKey === getPlatformKey()) {
    const result = spawnSync(exePath, ['--version'], { encoding: 'utf-8' })
    if (result.status === 0) {
      logOk(`Python 可用: ${(result.stdout || result.stderr).trim()}`)
      return true
    }
    logWarn(`Python 执行失败: ${result.stderr}`)
    return false
  }
  logOk(`Python 可执行文件存在: ${conf.exeName}`)
  return true
}

/**
 * 下载并安装单个平台的运行时
 */
async function downloadPlatform(platformKey, tag, opts) {
  const conf = PLATFORM_TARGETS[platformKey]
  if (!conf) {
    logErr(`不支持的平台: ${platformKey}`)
    return false
  }

  const dirName = `python-${platformKey}`
  const destDir = path.join(__dirname, dirName)

  logStep(`处理平台: ${platformKey}（target: ${conf.target}）`)

  // 1. 查找 asset
  const assets = await getReleaseAssets(tag)
  if (assets.length === 0) {
    logErr(`未获取到 release ${tag} 的 assets`)
    return false
  }
  const asset = findAsset(assets, conf.target)
  if (!asset) {
    logErr(`在 release ${tag} 中未找到匹配 ${conf.target} 的 install_only 包`)
    logWarn('可能是该平台暂无构建，或 CPython 大版本不匹配')
    return false
  }
  logOk(`匹配到 asset: ${asset.name}（${(asset.size / 1048576).toFixed(1)} MB）`)

  // 2. 下载
  const cacheDir = path.join(__dirname, '.cache')
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  const tarballPath = path.join(cacheDir, asset.name)

  if (fs.existsSync(tarballPath)) {
    logOk(`已存在缓存: ${asset.name}，跳过下载`)
  } else {
    const mirror = opts.mirror
      ? (process.env.PYTHON_MIRROR || DEFAULT_MIRROR)
      : ''
    const downloadUrl = mirror + asset.browser_download_url
    log(`  下载地址: ${downloadUrl}`)
    await downloadFile(downloadUrl, tarballPath)
    logOk('下载完成')
  }

  // 3. 清理旧的解压目录
  if (fs.existsSync(destDir)) {
    logWarn(`清理旧目录: ${dirName}/`)
    fs.rmSync(destDir, { recursive: true, force: true })
  }

  // 4. 解压
  logStep('解压中...')
  extractTarball(tarballPath, destDir)
  logOk(`解压至 ${dirName}/`)

  // 5. 校验
  const ok = verifyPython(destDir, platformKey)
  if (!ok) return false

  // 6. 安装预装库（仅当前平台）
  if (!opts.noDeps && platformKey === getPlatformKey()) {
    installPackages(destDir, platformKey)
  } else if (!opts.noDeps) {
    logWarn(`非当前平台（${platformKey}），跳过预装库安装`)
    logWarn('  跨平台无法直接运行目标 Python，请在目标平台执行 npm run python:download')
  }

  // 7. 删除缓存压缩包以节省空间（--all 模式下保留以便复用）
  if (!opts.all && fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath)
    logOk('已清理缓存压缩包')
  }

  return true
}

// ────────────────────────────────────────────────────────────────────────────
// 主流程
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs()

  log('═══════════════════════════════════════════════════════════')
  log('  Python 运行时下载工具 (python-build-standalone)')
  log('═══════════════════════════════════════════════════════════')

  const tag = opts.tag || process.env.PYTHON_BUILD_STANDALONE_TAG || await getLatestTag()
  log(`Release tag: ${tag}`)
  log(`镜像加速: ${opts.mirror ? (process.env.PYTHON_MIRROR || DEFAULT_MIRROR) : '否（直连 GitHub）'}`)

  // 确定要下载的平台列表
  let platforms
  if (opts.all) {
    platforms = Object.keys(PLATFORM_TARGETS)
    log(`目标平台: 全部（${platforms.length} 个）`)
  } else if (opts.platform) {
    platforms = [opts.platform]
    log(`目标平台: ${opts.platform}（手动指定）`)
  } else {
    const current = getPlatformKey()
    platforms = [current]
    log(`目标平台: ${current}（当前平台）`)
  }

  const results = []
  for (const p of platforms) {
    try {
      const ok = await downloadPlatform(p, tag, opts)
      results.push({ platform: p, success: ok })
    } catch (e) {
      logErr(`${p} 下载失败: ${e.message}`)
      results.push({ platform: p, success: false })
    }
  }

  // 汇总
  log('\n═══════════════════════════════════════════════════════════')
  log('  下载结果汇总')
  log('═══════════════════════════════════════════════════════════')
  for (const r of results) {
    const mark = r.success ? '✓' : '✗'
    log(`  ${mark} ${r.platform}`)
  }

  const failed = results.filter((r) => !r.success)
  if (failed.length > 0) {
    log(`\n${failed.length} 个平台失败`)
    process.exit(1)
  }

  log('\n全部完成。运行时位于 python/python-{platform}-{arch}/ 目录。')
  log('打包时 electron-builder 会通过 extraResources 自动将其纳入制品。')
}

main().catch((e) => {
  logErr(`致命错误: ${e.message}`)
  process.exit(1)
})
