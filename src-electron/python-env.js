/**
 * Python 环境管理
 * ===============
 *
 * 不再在制品中内置 Python 运行时，改由用户在系统中安装 Python，
 * 应用通过以下策略解析可用的 Python 可执行文件：
 *
 *   1. 用户在设置中显式指定的 python.path（优先级最高）
 *   2. 自动检测系统 Python（PATH 中的 python3/python 及常见安装位置）
 *      - 若检测到，会自动写入 config.python.path（满足"非开发者无感配置"）
 *   3. 以上均失败 → 返回 null，调用方应提示用户前往设置配置 Python
 *
 * 依赖库（requirements.txt）由设置中的"一键配置环境"功能通过
 * `<python> -m pip install -r requirements.txt` 安装到用户的环境中。
 */

import fs from 'fs'
import path from 'path'
import { spawn, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { loadConfig, saveConfig } from './config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// requirements.txt 路径（与 src-electron 同级的 python/ 目录）
const REQUIREMENTS_PATH = path.resolve(__dirname, '..', 'python', 'requirements.txt')

// 需要校验的依赖库 import 名（与 requirements.txt 对应）
// pip 包名与 import 名不同，此处用 import 名进行校验
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
]

// 缓存状态：undefined=尚未初始化, null=未配置/未检测到, string=可执行文件路径
let cachedPythonPath = undefined
let initPromise = null

/**
 * 初始化 Python 环境
 * 在应用启动时调用：读取用户配置，缺失时尝试自动检测并回写配置
 * @returns {Promise<string|null>} Python 可执行文件路径，未配置返回 null
 */
export function initPythonEnv() {
  if (!initPromise) {
    initPromise = doInit()
  }
  return initPromise
}

async function doInit() {
  console.log('[Python] 初始化 Python 环境...')

  // 数据目录尚未就绪时直接返回，避免 loadConfig 抛错
  let config
  try {
    config = loadConfig()
  } catch (e) {
    console.warn('[Python] 配置尚未就绪，跳过初始化:', e.message)
    cachedPythonPath = null
    return null
  }

  // 1. 优先使用用户配置的路径
  const configured = config?.python?.path
  if (configured) {
    const version = getVersion(configured)
    if (version) {
      cachedPythonPath = configured
      console.log(`[Python] ✓ 使用已配置的 Python: ${configured} (${version})`)
      return cachedPythonPath
    }
    console.warn(`[Python] 已配置的 Python 不可用: ${configured}`)
  }

  // 2. 自动检测系统 Python
  const detected = autoDetectPythonSync()
  if (detected) {
    cachedPythonPath = detected
    // 自动写回配置（满足"非开发者无感配置"）
    try {
      const cfg = loadConfig()
      cfg.python = cfg.python || {}
      cfg.python.path = detected
      saveConfig(cfg)
      console.log(`[Python] ✓ 自动检测到 Python 并已写入配置: ${detected}`)
    } catch (e) {
      console.warn(`[Python] 自动检测到 ${detected}，但写回配置失败: ${e.message}`)
    }
    return detected
  }

  cachedPythonPath = null
  console.warn('[Python] ⚠ 未检测到 Python 运行时，请在设置中配置 Python 路径')
  return null
}

/**
 * 获取 Python 可执行文件路径
 * 若尚未初始化会自动触发初始化
 * @returns {Promise<string|null>} 未配置时返回 null
 */
export async function getPythonPath() {
  if (cachedPythonPath === undefined) {
    await initPythonEnv()
  }
  return cachedPythonPath
}

/**
 * 同步获取已缓存的 Python 路径（不触发初始化）
 * 供同步调用方使用；若尚未初始化返回 undefined
 * @returns {string|null|undefined}
 */
export function getCachedPythonPath() {
  return cachedPythonPath
}

/**
 * 清除缓存（路径变更后调用，强制下次重新解析）
 */
export function invalidatePythonCache() {
  cachedPythonPath = undefined
  initPromise = null
}

/**
 * 设置用户指定的 Python 路径并写回配置
 * @param {string|null} pythonPath
 * @returns {Promise<boolean>}
 */
export async function setPythonPath(pythonPath) {
  const trimmed = (pythonPath || '').trim()
  cachedPythonPath = trimmed || null
  try {
    const cfg = loadConfig()
    cfg.python = cfg.python || {}
    cfg.python.path = cachedPythonPath
    saveConfig(cfg)
  } catch (e) {
    console.warn('[Python] 写回配置失败:', e.message)
  }
  return true
}

/**
 * 自动检测系统 Python（同步）
 * 检查 PATH 中的 python3/python 以及常见安装位置
 * @returns {string|null} 返回第一个可用的 Python 3.x 路径
 */
export function autoDetectPythonSync() {
  const names = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']

  // 1. PATH 中的可执行文件
  for (const name of names) {
    const found = findOnPath(name)
    if (found) {
      const v = getVersion(found)
      if (v && /Python 3\./.test(v)) return found
    }
  }

  // 2. 常见安装位置
  const commonDirs = getCommonInstallDirs()
  for (const dir of commonDirs) {
    if (!dir || !fs.existsSync(dir)) continue
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (_e) {
      continue
    }
    for (const entry of entries) {
      const candidate = process.platform === 'win32'
        ? path.join(dir, entry.name, 'python.exe')
        : path.join(dir, entry.name)
      if (fs.existsSync(candidate)) {
        const v = getVersion(candidate)
        if (v && /Python 3\./.test(v)) return candidate
      }
    }
  }

  return null
}

/**
 * 返回常见 Python 安装目录（用于扫描子目录）
 * - Windows：%LOCALAPPDATA%\Programs\Python、%ProgramFiles%\Python
 * - macOS：/usr/local/bin、/opt/homebrew/bin
 * - Linux：/usr/local/bin、/usr/bin
 */
function getCommonInstallDirs() {
  if (process.platform === 'win32') {
    const dirs = []
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Python'))
    if (process.env['ProgramFiles']) dirs.push(path.join(process.env['ProgramFiles'], 'Python'))
    if (process.env['ProgramFiles(x86)']) dirs.push(path.join(process.env['ProgramFiles(x86)'], 'Python'))
    return dirs
  }
  if (process.platform === 'darwin') {
    return ['/usr/local/bin', '/opt/homebrew/bin']
  }
  return ['/usr/local/bin', '/usr/bin']
}

/**
 * 在 PATH 中查找可执行文件
 * @param {string} name
 * @returns {string|null} 绝对路径或 null
 */
function findOnPath(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    const r = spawnSync(cmd, [name], { encoding: 'utf-8', timeout: 5000 })
    if (r.status === 0) {
      const out = (r.stdout || '').trim().split(/\r?\n/)[0].trim()
      if (out && fs.existsSync(out)) return out
    }
  } catch (_e) {
    // ignore
  }
  return null
}

/**
 * 获取 Python 版本字符串
 * @param {string} pythonPath
 * @returns {string|null}
 */
function getVersion(pythonPath) {
  try {
    const r = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', timeout: 10000 })
    if (r.status !== 0) return null
    return (r.stdout || r.stderr || '').trim()
  } catch (_e) {
    return null
  }
}

/**
 * 校验给定 Python 路径的可用性（不检查依赖库）
 * @param {string} pythonPath
 * @returns {{ ok: boolean, path: string, version: string|null, reason: string }}
 */
export function checkPythonPath(pythonPath) {
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { ok: false, path: pythonPath || '', version: null, reason: 'not_found' }
  }
  const version = getVersion(pythonPath)
  if (!version || !/Python 3\./.test(version)) {
    return { ok: false, path: pythonPath, version, reason: 'invalid_version' }
  }
  return { ok: true, path: pythonPath, version, reason: 'ok' }
}

/**
 * 获取当前 Python 环境状态（轻量，不检查依赖）
 * 用于设置页面展示
 * @returns {Promise<{configured: string|null, path: string|null, version: string|null, available: boolean, reason: string}>}
 */
export async function getPythonStatus() {
  let configured = null
  try {
    const cfg = loadConfig()
    configured = cfg?.python?.path || null
  } catch (_e) {
    // ignore
  }

  const resolved = await getPythonPath()
  if (!resolved) {
    return {
      configured,
      path: null,
      version: null,
      available: false,
      reason: configured ? 'invalid' : 'not_configured'
    }
  }
  const check = checkPythonPath(resolved)
  return {
    configured,
    path: resolved,
    version: check.version,
    available: check.ok,
    reason: check.reason
  }
}

/**
 * 校验 Python 依赖库是否齐全
 * @param {string} [pythonPath] 不传则使用已缓存的路径
 * @returns {Promise<{ok: boolean, path: string|null, version: string|null, missingDeps: string[], reason: string}>}
 */
export async function verifyPythonDeps(pythonPath) {
  const target = pythonPath || (await getPythonPath())
  if (!target) {
    return { ok: false, path: null, version: null, missingDeps: [], reason: 'not_configured' }
  }
  const check = checkPythonPath(target)
  if (!check.ok) {
    return { ok: false, path: target, version: check.version, missingDeps: [], reason: check.reason }
  }

  // 先用单次组合 import 快速判定（全部存在则一次成功）
  const combined = spawnSync(
    target,
    ['-c', `import ${REQUIRED_IMPORTS.join(', ')}`],
    { encoding: 'utf-8', timeout: 30000 }
  )
  if (combined.status === 0) {
    return { ok: true, path: target, version: check.version, missingDeps: [], reason: 'ok' }
  }

  // 组合失败 → 逐个检测以列出缺失项
  const missing = []
  for (const imp of REQUIRED_IMPORTS) {
    const r = spawnSync(target, ['-c', `import ${imp}`], { encoding: 'utf-8', timeout: 15000 })
    if (r.status !== 0) missing.push(imp)
  }
  return {
    ok: false,
    path: target,
    version: check.version,
    missingDeps: missing,
    reason: 'missing_deps'
  }
}

/**
 * 通过 pip 安装 requirements.txt 依赖（流式输出）
 * @param {string} [pythonPath] 不传则使用已缓存的路径
 * @param {Object} [callbacks]
 * @param {function(string):void} [callbacks.onStdout]
 * @param {function(string):void} [callbacks.onStderr]
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
export function installPythonDeps(pythonPath, callbacks = {}) {
  const { onStdout, onStderr } = callbacks
  return new Promise(async (resolve, reject) => {
    const target = pythonPath || await getPythonPath()
    if (!target) {
      reject(new Error('未配置 Python 环境，请先在设置中指定 Python 路径'))
      return
    }
    if (!fs.existsSync(REQUIREMENTS_PATH)) {
      reject(new Error(`找不到依赖清单: ${REQUIREMENTS_PATH}`))
      return
    }

    const args = ['-m', 'pip', 'install', '--no-cache-dir', '--disable-pip-version-check', '-r', REQUIREMENTS_PATH]
    const proc = spawn(target, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => {
      const s = d.toString('utf-8')
      stdout += s
      if (onStdout) onStdout(s)
    })
    proc.stderr.on('data', (d) => {
      const s = d.toString('utf-8')
      stderr += s
      if (onStderr) onStderr(s)
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      // 安装成功后刷新缓存，使后续调用使用最新状态
      invalidatePythonCache()
      resolve({ exitCode: code || 0, stdout, stderr })
    })
  })
}

/**
 * 获取 requirements.txt 路径
 * @returns {string}
 */
export function getRequirementsPath() {
  return REQUIREMENTS_PATH
}
