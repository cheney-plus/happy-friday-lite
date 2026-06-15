/**
 * Python 运行时调用模块
 *
 * 提供在 Electron 主进程中调用 Python 脚本的能力。
 * 自动检测平台，使用对应的嵌入式 Python 运行时。
 *
 * 用法：
 *   import { runPython, runPythonSync, getPythonPath } from './python.js'
 *
 *   // 异步执行 Python 脚本，获取 stdout
 *   const result = await runPython('script.py', ['arg1', 'arg2'], { KEY: 'value' })
 *
 *   // 同步执行（阻塞，谨慎使用）
 *   const result = runPythonSync('script.py', ['arg1'])
 *
 *   // 获取 Python 可执行文件路径
 *   const pythonPath = getPythonPath()
 */

import { spawn, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { app } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 获取 Python 运行时根目录
 * 开发环境：项目根目录/python
 * 打包后：app 内的 python 目录
 */
function getPythonRoot() {
  const isDev = !app.isPackaged
  if (isDev) {
    // 开发环境：项目根目录/python
    return join(__dirname, '..', 'python')
  }
  // 打包后：resources/python
  // electron-builder 会将 extraResources 放到 resources/ 下
  if (process.platform === 'darwin') {
    // macOS: app 内 Contents/Resources/python
    return join(process.resourcesPath, 'python')
  }
  // Windows/Linux: resources/python
  return join(process.resourcesPath, 'python')
}

/**
 * 获取当前平台标识
 */
function getPlatformKey() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `${process.platform}-${arch}`
}

/**
 * 获取平台对应的 Python 目录名
 */
function getPlatformDirName() {
  const key = getPlatformKey()
  const dirMap = {
    'win32-x64': 'python-win32-x64',
    'win32-arm64': 'python-win32-arm64',
    'darwin-arm64': 'python-darwin-arm64',
    'darwin-x64': 'python-darwin-x64',
    'linux-x64': 'python-linux-x64',
    'linux-arm64': 'python-linux-arm64'
  }
  return dirMap[key] || null
}

/**
 * 获取 Python 可执行文件路径
 * @returns {string|null} Python 可执行文件的绝对路径，未找到返回 null
 */
export function getPythonPath() {
  const root = getPythonRoot()
  const platformDir = getPlatformDirName()

  if (platformDir) {
    const platformPath = join(root, platformDir)
    if (process.platform === 'win32') {
      const exePath = join(platformPath, 'python.exe')
      if (existsSync(exePath)) return exePath
    } else {
      const exePath = join(platformPath, 'bin', 'python3')
      if (existsSync(exePath)) return exePath
      // 某些构建可能只有 python 而没有 python3
      const altPath = join(platformPath, 'bin', 'python')
      if (existsSync(altPath)) return altPath
    }
  }

  // 回退：尝试系统 Python
  if (process.platform === 'win32') {
    return 'python.exe'
  }
  return 'python3'
}

/**
 * 获取 Python 运行时的环境变量
 * 主要是设置 PATH 以确保能找到共享库
 */
function getPythonEnv() {
  const env = { ...process.env }
  const root = getPythonRoot()
  const platformDir = getPlatformDirName()

  if (platformDir) {
    const platformPath = join(root, platformDir)

    if (process.platform === 'win32') {
      // Windows: 将 Python 目录和 Scripts 加入 PATH
      env.PATH = `${platformPath};${join(platformPath, 'Scripts')};${env.PATH || ''}`
    } else {
      // macOS/Linux: 将 Python bin 目录加入 PATH，设置 LD_LIBRARY_PATH
      const binDir = join(platformPath, 'bin')
      env.PATH = `${binDir}:${env.PATH || ''}`

      const libDir = join(platformPath, 'lib')
      if (existsSync(libDir)) {
        if (process.platform === 'linux') {
          env.LD_LIBRARY_PATH = `${libDir}:${env.LD_LIBRARY_PATH || ''}`
        } else if (process.platform === 'darwin') {
          env.DYLD_LIBRARY_PATH = `${libDir}:${env.DYLD_LIBRARY_PATH || ''}`
        }
      }

      // 设置 PYTHONHOME
      env.PYTHONHOME = platformPath
    }
  }

  // 确保 Python 输出不被缓冲，方便实时获取输出
  env.PYTHONUNBUFFERED = '1'

  return env
}

/**
 * 异步执行 Python 脚本
 *
 * @param {string} scriptPath - Python 脚本路径（相对于项目根目录的绝对路径或相对路径）
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [env={}] - 额外的环境变量
 * @param {string} [cwd] - 工作目录
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function runPython(scriptPath, args = [], env = {}, cwd) {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath()
    if (!pythonPath) {
      reject(new Error('Python runtime not found'))
      return
    }

    const pythonEnv = { ...getPythonEnv(), ...env }
    const workDir = cwd || process.cwd()

    const proc = spawn(pythonPath, [scriptPath, ...args], {
      env: pythonEnv,
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      })
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`))
    })
  })
}

/**
 * 异步执行 Python 脚本（流式输出）
 * 适用于长时间运行的脚本，需要实时获取输出
 *
 * @param {string} scriptPath - Python 脚本路径
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [options={}] - 选项
 * @param {Object} [options.env={}] - 额外的环境变量
 * @param {string} [options.cwd] - 工作目录
 * @param {function} [options.onStdout] - stdout 数据回调 (data: string) => void
 * @param {function} [options.onStderr] - stderr 数据回调 (data: string) => void
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, process: ChildProcess}>}
 */
export function runPythonStreaming(scriptPath, args = [], options = {}) {
  const { env: extraEnv = {}, cwd, onStdout, onStderr } = options

  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath()
    if (!pythonPath) {
      reject(new Error('Python runtime not found'))
      return
    }

    const pythonEnv = { ...getPythonEnv(), ...extraEnv }
    const workDir = cwd || process.cwd()

    const proc = spawn(pythonPath, [scriptPath, ...args], {
      env: pythonEnv,
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      const str = data.toString()
      stdout += str
      if (onStdout) onStdout(str)
    })

    proc.stderr.on('data', (data) => {
      const str = data.toString()
      stderr += str
      if (onStderr) onStderr(str)
    })

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      })
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`))
    })
  })
}

/**
 * 同步执行 Python 脚本（阻塞调用，谨慎使用）
 *
 * @param {string} scriptPath - Python 脚本路径
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [env={}] - 额外的环境变量
 * @param {string} [cwd] - 工作目录
 * @returns {{stdout: string, stderr: string, exitCode: number}}
 */
export function runPythonSync(scriptPath, args = [], env = {}, cwd) {
  const pythonPath = getPythonPath()
  if (!pythonPath) {
    throw new Error('Python runtime not found')
  }

  const pythonEnv = { ...getPythonEnv(), ...env }
  const workDir = cwd || process.cwd()

  const result = spawnSync(pythonPath, [scriptPath, ...args], {
    env: pythonEnv,
    cwd: workDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    exitCode: result.status || 0
  }
}

/**
 * 检查 Python 运行时是否可用
 * @returns {Promise<{available: boolean, path: string|null, version: string|null}>}
 */
export async function checkPython() {
  const pythonPath = getPythonPath()

  if (!pythonPath) {
    return { available: false, path: null, version: null }
  }

  try {
    const result = await runPython('-c', ['import sys; print(sys.version)'])
    if (result.exitCode === 0) {
      return {
        available: true,
        path: pythonPath,
        version: result.stdout
      }
    }
  } catch (_e) {
    // ignore
  }

  return { available: false, path: pythonPath, version: null }
}
