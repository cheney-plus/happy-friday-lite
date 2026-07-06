/**
 * Python 环境管理
 * ===============
 *
 * 负责在应用启动时检测和准备 Python 运行时。
 *
 * 优先级：
 *   1. macOS 系统 Python（如果存在且包含 requirements.txt 中所有依赖库）
 *   2. 打包的嵌入式 Python（从 resourcesPath 解压到 userData，可写）
 *   3. 开发环境的 Python（项目根目录/python/python-{platform}/）
 *   4. 系统 PATH 中的 python3 / python（最后兜底）
 *
 * 平台策略：
 *   - macOS：优先使用系统 Python（Homebrew/系统自带），否则使用打包 Python
 *   - Windows/Linux：仅使用打包 Python（不检查系统 Python，因发行版差异大）
 *
 * 打包 Python 的工作流程：
 *   1. 构建时：download-python.js 下载 python-build-standalone 并安装 requirements.txt 依赖
 *   2. electron-builder 通过 extraResources 将 Python 目录打包进制品
 *   3. 运行时：首次启动时将 Python 从 resourcesPath 复制到 userData（可写目录）
 *   4. 后续启动：检测版本标记，版本一致则跳过复制
 *
 * 缓存策略：
 *   - 解析结果缓存至 {userData}/python/.python-env.json
 *   - 缓存包含 appVersion，版本变化时重新解析
 *   - 缓存中的 pythonPath 不存在时也会重新解析
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 平台标识
const PLATFORM_KEY = `${process.platform}-${process.arch}`
const DIR_NAME = `python-${PLATFORM_KEY}`
const EXE_NAME = process.platform === 'win32' ? 'python.exe' : 'python3'

// 系统 Python 需要的依赖库 import 名称（与 requirements.txt 对应）
// 注意：pip 包名与 import 名不同，此处用 import 名
const REQUIRED_IMPORTS = [
  'requests',    // requests
  'bs4',         // beautifulsoup4
  'lxml',        // lxml
  'dateutil',    // python-dateutil
  'pytz',        // pytz
  'openpyxl',    // openpyxl
  'xlrd',        // xlrd
  'xlwt',        // xlwt
  'xlsxwriter',  // xlsxwriter
  'pandas',      // pandas
  'numpy',       // numpy
  'scipy',       // scipy
  'matplotlib',  // matplotlib
  'seaborn',     // seaborn
  'plotly',      // plotly
  'rich',        // rich
  'tabulate',    // tabulate
  'yaml',        // PyYAML
  'jieba',       // jieba
  'sympy',       // sympy
  'markitdown'   // markitdown[all]
].join(', ')

let cachedPythonPath = null
let initPromise = null

/**
 * 初始化 Python 环境
 * 在应用启动时调用，检测并准备 Python 运行时
 * @returns {Promise<string>} Python 可执行文件路径
 */
export function initPythonEnv() {
  if (!initPromise) {
    initPromise = doInit()
  }
  return initPromise
}

/**
 * 获取 Python 可执行文件路径
 * 若尚未初始化，会自动触发初始化
 * @returns {Promise<string>}
 */
export async function getPythonPath() {
  if (!cachedPythonPath) {
    await initPythonEnv()
  }
  return cachedPythonPath
}

async function doInit() {
  console.log('[Python] 开始初始化 Python 环境...')

  const cacheFile = getCacheFilePath()

  // 1. 尝试从缓存读取
  const cached = readCache(cacheFile)
  if (cached && fs.existsSync(cached.pythonPath)) {
    console.log(`[Python] 使用缓存的 Python: ${cached.pythonPath} (source: ${cached.source})`)
    cachedPythonPath = cached.pythonPath
    return cachedPythonPath
  }

  // 2. 重新解析
  let pythonPath = null
  let source = null

  // 2a. macOS: 检查系统 Python
  if (process.platform === 'darwin') {
    const systemPython = checkSystemPython()
    if (systemPython) {
      pythonPath = systemPython
      source = 'system'
      console.log(`[Python] ✓ 使用系统 Python: ${pythonPath}`)
    } else {
      console.log('[Python] 系统 Python 不可用或缺少依赖，回退到打包 Python')
    }
  }

  // 2b. 使用打包的 Python（解压到 userData）
  if (!pythonPath && app.isPackaged) {
    pythonPath = resolvePackagedPython()
    source = 'packaged'
    if (pythonPath) {
      console.log(`[Python] ✓ 使用打包 Python: ${pythonPath}`)
    }
  }

  // 2c. 开发环境：项目根目录下的 Python
  if (!pythonPath && !app.isPackaged) {
    pythonPath = resolveDevPython()
    source = 'dev'
    if (pythonPath) {
      console.log(`[Python] ✓ 使用开发环境 Python: ${pythonPath}`)
    }
  }

  // 2d. 最后兜底：系统 PATH 中的 python3 / python
  if (!pythonPath) {
    pythonPath = process.platform === 'win32' ? 'python' : 'python3'
    source = 'fallback'
    console.warn(`[Python] ⚠ 未找到合适的 Python 运行时，兜底使用: ${pythonPath}`)
    console.warn('[Python]   请运行 `npm run python:download` 下载嵌入式 Python 运行时')
  }

  // 3. 写入缓存
  writeCache(cacheFile, { pythonPath, source })

  cachedPythonPath = pythonPath
  console.log('[Python] 初始化完成')
  return pythonPath
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath() {
  const dataDir = app.getPath('userData')
  return path.join(dataDir, 'python', '.python-env.json')
}

/**
 * 读取缓存
 * @returns {{ pythonPath: string, source: string } | null}
 */
function readCache(cacheFile) {
  try {
    if (!fs.existsSync(cacheFile)) return null
    const content = fs.readFileSync(cacheFile, 'utf-8')
    const data = JSON.parse(content)
    // 应用版本变化时缓存失效
    if (data.appVersion !== app.getVersion()) {
      console.log('[Python] 缓存因版本变化失效，重新解析')
      return null
    }
    return data
  } catch (e) {
    return null
  }
}

/**
 * 写入缓存
 */
function writeCache(cacheFile, { pythonPath, source }) {
  try {
    const dir = path.dirname(cacheFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const data = {
      appVersion: app.getVersion(),
      pythonPath,
      source,
      updatedAt: Date.now()
    }
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.warn(`[Python] 写入缓存失败: ${e.message}`)
  }
}

/**
 * 检查系统 Python（仅 macOS）
 * 验证 python3 是否存在且包含 requirements.txt 中所有依赖库
 * @returns {string | null} Python 可执行文件路径，不可用返回 null
 */
function checkSystemPython() {
  if (process.platform !== 'darwin') return null

  // 1. 查找 python3
  const which = spawnSync('which', ['python3'], { encoding: 'utf-8' })
  if (which.status !== 0) return null

  const pythonPath = which.stdout.trim()
  if (!pythonPath) return null

  // 2. 检查版本（需要 Python 3.x）
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8' })
  if (versionResult.status !== 0) return null

  const versionStr = (versionResult.stdout || versionResult.stderr || '').trim()
  if (!versionStr.startsWith('Python 3.')) {
    console.log(`[Python] 系统 Python 版本不满足要求: ${versionStr}`)
    return null
  }

  // 3. 检查依赖库是否齐全
  const checkResult = spawnSync(
    pythonPath,
    ['-c', `import ${REQUIRED_IMPORTS}`],
    { encoding: 'utf-8', timeout: 15000 }
  )

  if (checkResult.status !== 0) {
    const err = (checkResult.stderr || '').trim()
    const lastLine = err.split('\n').filter(Boolean).slice(-1)[0] || ''
    console.log(`[Python] 系统 Python 缺少依赖库: ${lastLine}`)
    return null
  }

  return pythonPath
}

/**
 * 解析打包的 Python 路径
 * 首次使用时从 resourcesPath 复制到 userData（可写目录）
 * @returns {string | null}
 */
function resolvePackagedPython() {
  if (!app.isPackaged) return null

  const sourceDir = path.join(process.resourcesPath, 'python', DIR_NAME)
  const destDir = path.join(app.getPath('userData'), 'python', DIR_NAME)
  const exePath = getExePath(destDir)

  // 检查源目录是否存在
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[Python] 打包 Python 源目录不存在: ${sourceDir}`)
    console.warn('[Python] 请确认构建时已执行 `npm run python:download`')
    return null
  }

  // 检查是否需要复制（通过版本标记判断）
  const versionFile = path.join(destDir, '.app-version')
  const currentVersion = app.getVersion()

  let needCopy = true
  if (fs.existsSync(destDir) && fs.existsSync(versionFile) && fs.existsSync(exePath)) {
    const extractedVersion = fs.readFileSync(versionFile, 'utf-8').trim()
    if (extractedVersion === currentVersion) {
      needCopy = false
      console.log(`[Python] 打包 Python 已解压（版本 ${currentVersion}），跳过复制`)
    }
  }

  if (needCopy) {
    console.log('[Python] 正在解压打包 Python 到用户数据目录...')
    console.log(`[Python]   源:   ${sourceDir}`)
    console.log(`[Python]   目标: ${destDir}`)

    // 清理旧目录
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true })
    }

    try {
      // 复制整个目录（fs.cpSync 在 Node.js 16.7+ 可用）
      fs.cpSync(sourceDir, destDir, { recursive: true })
      fs.writeFileSync(versionFile, currentVersion, 'utf-8')
      console.log('[Python] 解压完成')
    } catch (e) {
      console.error(`[Python] 解压失败: ${e.message}`)
      // 回退：尝试直接使用源目录（只读）
      const sourceExePath = getExePath(sourceDir)
      if (fs.existsSync(sourceExePath)) {
        console.warn(`[Python] 回退到直接使用源目录（只读）: ${sourceExePath}`)
        return sourceExePath
      }
      return null
    }
  }

  return exePath
}

/**
 * 解析开发环境的 Python 路径
 * 项目根目录/python/python-{platform}/bin/python3
 * @returns {string | null}
 */
function resolveDevPython() {
  const projectRoot = path.resolve(__dirname, '..')
  const devPath = path.join(projectRoot, 'python', DIR_NAME, 'bin', EXE_NAME)
  if (fs.existsSync(devPath)) {
    return devPath
  }
  // Windows 开发环境（无 bin/ 子目录）
  const winDevPath = path.join(projectRoot, 'python', DIR_NAME, EXE_NAME)
  if (fs.existsSync(winDevPath)) {
    return winDevPath
  }
  return null
}

/**
 * 根据平台获取 Python 可执行文件路径
 * @param {string} dir Python 根目录
 * @returns {string}
 */
function getExePath(dir) {
  return process.platform === 'win32'
    ? path.join(dir, EXE_NAME)
    : path.join(dir, 'bin', EXE_NAME)
}
