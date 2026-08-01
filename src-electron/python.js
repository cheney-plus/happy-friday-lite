/**
 * Python 运行时调用模块
 *
 * 提供在 Electron 主进程中调用 Python 脚本的能力。
 * Python 可执行文件路径由 python-env.js 统一解析（用户配置 / 自动检测）。
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
 *   const pythonPath = await getPythonPath()
 */

import { spawn, spawnSync } from 'child_process'
import {
  getPythonPath,
  getCachedPythonPath,
  initPythonEnv
} from './python-env.js'

// 复用 python-env.js 导出的函数，便于外部从此处统一导入
export { initPythonEnv, getPythonPath }

/**
 * 未配置 Python 环境时的统一错误信息
 */
function notConfiguredError() {
  const err = new Error('未配置 Python 环境，请在「设置 → 通用 → Python 环境」中完成配置。')
  err.code = 'PYTHON_NOT_CONFIGURED'
  return err
}

/**
 * 异步执行 Python 脚本
 *
 * @param {string} scriptPath - Python 脚本路径
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [env={}] - 额外的环境变量
 * @param {string} [cwd] - 工作目录
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function runPython(scriptPath, args = [], env = {}, cwd) {
  return new Promise(async (resolve, reject) => {
    const pythonPath = await getPythonPath()
    if (!pythonPath) {
      reject(notConfiguredError())
      return
    }

    const pythonEnv = { ...process.env, PYTHONUNBUFFERED: '1', ...env }
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
 *
 * @param {string} scriptPath - Python 脚本路径
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [options={}] - 选项
 * @param {Object} [options.env={}] - 额外的环境变量
 * @param {string} [options.cwd] - 工作目录
 * @param {function} [options.onStdout] - stdout 数据回调 (data: string) => void
 * @param {function} [options.onStderr] - stderr 数据回调 (data: string) => void
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function runPythonStreaming(scriptPath, args = [], options = {}) {
  const { env: extraEnv = {}, cwd, onStdout, onStderr } = options

  return new Promise(async (resolve, reject) => {
    const pythonPath = await getPythonPath()
    if (!pythonPath) {
      reject(notConfiguredError())
      return
    }

    const pythonEnv = { ...process.env, PYTHONUNBUFFERED: '1', ...extraEnv }
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
 * 使用启动时已缓存的 Python 路径；若尚未初始化或未配置则抛错
 *
 * @param {string} scriptPath - Python 脚本路径
 * @param {string[]} [args=[]] - 传递给脚本的参数
 * @param {Object} [env={}] - 额外的环境变量
 * @param {string} [cwd] - 工作目录
 * @returns {{stdout: string, stderr: string, exitCode: number}}
 */
export function runPythonSync(scriptPath, args = [], env = {}, cwd) {
  const pythonPath = getCachedPythonPath()
  if (!pythonPath) {
    throw notConfiguredError()
  }

  const pythonEnv = { ...process.env, PYTHONUNBUFFERED: '1', ...env }
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
  const pythonPath = await getPythonPath()

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
