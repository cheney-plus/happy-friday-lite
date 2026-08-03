/**
 * 主进程文件日志器
 * ================
 * 将主进程所有 console.* 输出与未捕获异常写入磁盘日志文件，
 * 便于客户端安装后用户在数据目录下查看运行日志、排查异常报错。
 *
 * 日志位置：<userData>/logs/main.log（开发环境为 app-data/logs/main.log）
 * 滚动策略：单文件超过 MAX_LOG_SIZE 后按序号滚动，最多保留 MAX_LOG_FILES 个。
 */

import fs from 'fs'
import path from 'path'

let logDir = null
let logFilePath = null
let originalConsole = null
let initialized = false

// 单个日志文件最大体积，超过则滚动
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB
// 保留的滚动文件数量（不含当前 main.log）
const MAX_LOG_FILES = 5

function formatTimestamp() {
  const d = new Date()
  // ISO 格式带毫秒，便于精确排序
  return d.toISOString()
}

function formatArg(arg) {
  if (arg == null) return String(arg)
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`
  }
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg)
    } catch (_e) {
      return String(arg)
    }
  }
  return String(arg)
}

function formatArgs(args) {
  if (!args || args.length === 0) return ''
  return Array.from(args).map(formatArg).join(' ')
}

// 同步追加写入一行，保证进程崩溃前日志已落盘
function writeLine(level, args) {
  if (!logFilePath) return
  const line = `[${formatTimestamp()}] [${level}] ${formatArgs(args)}\n`
  try {
    fs.appendFileSync(logFilePath, line, 'utf-8')
  } catch (_e) {
    // 写入失败时静默忽略，避免日志逻辑本身导致崩溃
  }
}

function rotateIfNeeded() {
  if (!logFilePath) return
  let stat
  try {
    stat = fs.statSync(logFilePath)
  } catch (_e) {
    return
  }
  if (stat.size < MAX_LOG_SIZE) return

  try {
    // 丢弃最旧的一份，其余依次后移：main.<n>.log -> main.<n+1>.log
    const oldest = path.join(logDir, `main.${MAX_LOG_FILES}.log`)
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest)
    }
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const src = path.join(logDir, `main.${i}.log`)
      const dst = path.join(logDir, `main.${i + 1}.log`)
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst)
      }
    }
    // 当前 main.log -> main.1.log，下一次写入会自动新建 main.log
    const first = path.join(logDir, 'main.1.log')
    if (fs.existsSync(logFilePath)) {
      fs.renameSync(logFilePath, first)
    }
  } catch (_e) {
    // 滚动失败时静默，下一次写入仍会写入当前 main.log（可能超限，但不丢日志）
  }
}

/**
 * 初始化文件日志器，接管 console.* 与未捕获异常。
 * 应在主进程启动最早期（同步阶段）调用一次。
 * @param {string} baseDir 数据目录（与 config/db 同级）
 */
export function initLogger(baseDir) {
  if (initialized) return
  if (!baseDir) {
    // 没有目录则不启用文件日志，避免影响启动
    return
  }

  logDir = path.join(baseDir, 'logs')
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  } catch (e) {
    // 目录创建失败，回退到仅控制台输出
    console.error('[Logger] Failed to create log directory:', e)
    return
  }

  logFilePath = path.join(logDir, 'main.log')

  // 保存原始 console 方法，日志器自身输出走原方法避免递归
  originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug ? console.debug : console.log).bind(console)
  }

  const wrap = (level, original) => {
    return (...args) => {
      original(...args)
      writeLine(level, args)
      rotateIfNeeded()
    }
  }

  console.log = wrap('INFO', originalConsole.log)
  console.info = wrap('INFO', originalConsole.info)
  console.warn = wrap('WARN', originalConsole.warn)
  console.error = wrap('ERROR', originalConsole.error)
  console.debug = wrap('DEBUG', originalConsole.debug)

  // 捕获未捕获异常：同步写盘保证崩溃前日志已落盘
  process.on('uncaughtException', (err) => {
    writeLine('FATAL', ['Uncaught Exception:', err])
    if (originalConsole) originalConsole.error('Uncaught Exception:', err)
  })
  process.on('unhandledRejection', (reason) => {
    writeLine('ERROR', ['Unhandled Rejection:', reason])
    if (originalConsole) originalConsole.error('Unhandled Rejection:', reason)
  })

  initialized = true

  // 写入一条分隔标记，便于区分每次启动
  try {
    fs.appendFileSync(
      logFilePath,
      `\n========== Application start: ${formatTimestamp()} (pid=${process.pid}) ==========\n`,
      'utf-8'
    )
  } catch (_e) {
    // 忽略
  }
  originalConsole.log('[Logger] Initialized, log file:', logFilePath)
}

/**
 * 获取日志目录绝对路径
 * @returns {string|null}
 */
export function getLogDir() {
  return logDir
}
