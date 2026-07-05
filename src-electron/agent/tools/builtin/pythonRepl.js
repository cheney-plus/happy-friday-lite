/**
 * 内置工具：Python 代码执行（python_repl）
 * ============================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 使用项目内置的 Python 运行时（python/python-darwin-arm64/）执行任意 Python 代码，
 * 支持数据处理、绘图、脚本导入等场景。
 *
 * 工作目录策略：
 *   - 默认：{agentRootDir}/SANDBOX/YYYYMMDD-N/（自动生成，N 从 1 递增避免冲突）
 *   - 用户指定：{agentRootDir}/SANDBOX/{userWorkDir}/（仍锁定在 SANDBOX 下）
 *   - Python 进程的 cwd 与输出文件目录统一为该工作目录
 *
 * 安全约束：
 *   - 工作目录强制锁定在 Agent 沙盒区 {agentRootDir}/SANDBOX/ 下
 *   - 超时 60 秒（可配置）
 *   - stdout/stderr 输出截断 20KB
 *   - 需用户审批后执行
 *
 * Python 路径解析：
 *   - 开发环境：项目根目录/python/python-{platform}-{arch}/bin/python
 *   - 打包环境：process.resourcesPath/python/python-{platform}-{arch}/bin/python
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { registerTool } from '../registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 检测是否处于 Electron 打包环境
 * 通过 process.versions.electron 判断是否在 Electron 中运行，
 * 通过 process.resourcesPath 是否非默认值判断是否打包后运行。
 * @returns {boolean}
 */
function isPackagedEnvironment() {
  // process.versions.electron 在 Electron 主进程中存在
  if (!process.versions.electron) return false
  // 打包后 process.resourcesPath 以 app.asar 结尾；开发环境则是项目内 node_modules
  try {
    return (
      typeof process.resourcesPath === 'string' &&
      !process.resourcesPath.includes('node_modules') &&
      // process.execPath 在打包后指向 Electron 可执行文件，不是 node
      !process.execPath.endsWith('node') &&
      !process.execPath.endsWith('node.exe')
    )
  } catch (_e) {
    return false
  }
}

/**
 * 根据当前平台解析 Python 可执行文件路径
 * @returns {string} Python 可执行文件绝对路径
 */
function resolvePythonPath() {
  // 平台映射：darwin-arm64 / darwin-x64 / win32-x64 / win32-arm64 / linux-x64 / linux-arm64
  const platformKey = `${process.platform}-${process.arch}`

  // 子目录名（与 python/download-python.js 中 DOWNLOADS.dirName 保持一致）
  const dirName = `python-${platformKey}`

  // 可执行文件名
  const exeName = process.platform === 'win32' ? 'python.exe' : 'python3'

  // 1. 优先查找打包环境（extraResources 中包含 python 目录）
  //    打包后 process.resourcesPath 指向 app.asar/resources/
  if (isPackagedEnvironment() && typeof process.resourcesPath === 'string') {
    const packagedPath = path.join(process.resourcesPath, 'python', dirName, 'bin', exeName)
    if (fs.existsSync(packagedPath)) {
      return packagedPath
    }
    // Windows 下可执行文件位于 python-{platform}/python.exe（无 bin/）
    const winPackagedPath = path.join(process.resourcesPath, 'python', dirName, exeName)
    if (fs.existsSync(winPackagedPath)) {
      return winPackagedPath
    }
  }

  // 2. 开发环境：项目根目录/python/python-{platform}-{arch}/bin/python
  //    __dirname = src-electron/agent/tools/builtin/
  //    上四级回到项目根目录：tools → agent → src-electron → 项目根
  const projectRoot = path.resolve(__dirname, '..', '..', '..', '..')
  const devPath = path.join(projectRoot, 'python', dirName, 'bin', exeName)
  if (fs.existsSync(devPath)) {
    return devPath
  }
  // Windows 开发环境
  const winDevPath = path.join(projectRoot, 'python', dirName, exeName)
  if (fs.existsSync(winDevPath)) {
    return winDevPath
  }

  // 3. 兜底：使用系统 PATH 中的 python3 / python
  return process.platform === 'win32' ? 'python' : 'python3'
}

// 缓存解析结果，避免每次调用都重复文件系统检查
let cachedPythonPath = null

function getPythonPath() {
  if (!cachedPythonPath) {
    cachedPythonPath = resolvePythonPath()
  }
  return cachedPythonPath
}

/**
 * 解析 Python 工作目录
 * - 用户指定 workDir：相对于 SANDBOX 的子目录，自动创建（已存在则复用）
 * - 默认：自动生成 YYYYMMDD-N 目录，N 从 1 递增直到找到不存在的目录
 *
 * 安全约束：最终路径必须位于 sandboxDir 之内，禁止路径穿越。
 *
 * @param {string} agentRootDir Agent 沙箱根目录
 * @param {string} [userWorkDir] 用户指定的工作目录（相对路径）
 * @returns {{ workDir: string, sandboxDir: string, isAuto: boolean }}
 */
function resolveWorkDir(agentRootDir, userWorkDir) {
  const sandboxDir = path.join(agentRootDir, 'SANDBOX')
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true })
  }

  // 用户指定目录
  if (userWorkDir && userWorkDir.trim()) {
    // 仅清理前导 /（把绝对路径转为相对路径），保留 . 和 .. 用于穿越检查
    const cleaned = userWorkDir
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
    // 禁止任何 .. 路径段（防止穿越到 SANDBOX 之外）
    if (cleaned === '..' || cleaned.startsWith('../') || cleaned.includes('/../') || cleaned.endsWith('/..')) {
      throw new Error('工作目录不允许包含 .. 路径穿越')
    }
    const target = path.resolve(sandboxDir, cleaned)
    // 二次校验：解析后仍需在 SANDBOXDir 内
    if (target !== sandboxDir && !target.startsWith(sandboxDir + path.sep)) {
      throw new Error(`工作目录越界：${userWorkDir}（仅允许在沙盒区 SANDBOX/ 下）`)
    }
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true })
    }
    return { workDir: target, sandboxDir, isAuto: false }
  }

  // 默认：生成 YYYYMMDD-N 目录
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`

  let n = 1
  let target = path.join(sandboxDir, `${dateStr}-${n}`)
  while (fs.existsSync(target)) {
    n++
    target = path.join(sandboxDir, `${dateStr}-${n}`)
  }
  fs.mkdirSync(target, { recursive: true })
  return { workDir: target, sandboxDir, isAuto: true }
}

const schema = z.object({
  code: z
    .string()
    .describe('要执行的 Python 代码（支持多行，可包含 import、函数定义、绘图等）'),
  workDir: z
    .string()
    .optional()
    .describe(
      '工作目录（相对于 Agent 沙盒区 SANDBOX/ 的子路径，如 "mytask" 或 "data/process"）。' +
      '不传则自动生成 YYYYMMDD-N 格式的目录（如 20260705-1，重复时递增为 -2、-3）。' +
      'Python 进程的 cwd 与输出文件目录统一为该目录。'
    ),
  timeoutMs: z
    .number()
    .optional()
    .describe('超时时间（毫秒），默认 60000（60 秒）')
})

async function handler(args, ctx) {
  const { code, workDir, timeoutMs = 60000 } = args
  ctx.logger.info(`[python_repl] codeLen=${code.length}, workDir=${workDir || '(自动)'}, timeout=${timeoutMs}ms`)

  const pythonPath = getPythonPath()
  ctx.logger.info(`[python_repl] pythonPath=${pythonPath}`)

  // 解析工作目录（强制锁定在 SANDBOX 下）
  let workDirInfo
  try {
    workDirInfo = resolveWorkDir(ctx.agentRootDir, workDir)
  } catch (e) {
    ctx.logger.warn(`[python_repl] 工作目录解析失败: ${e.message}`)
    return `工作目录解析失败: ${e.message}`
  }
  const { workDir: cwd, sandboxDir, isAuto } = workDirInfo
  ctx.logger.info(`[python_repl] cwd=${cwd}, isAuto=${isAuto}`)

  // 通过 -c 传代码（-u unbuffered，-I 隔离环境）
  return new Promise(resolve => {
    const child = spawn(pythonPath, ['-u', '-I', '-c', code], {
      cwd,
      env: {
        ...process.env,
        // 让 Python 能在工作目录中导入本地模块
        PYTHONPATH: cwd,
        // 禁用用户 site-packages，避免污染
        PYTHONNOUSERSITE: '1',
        // 设置默认编码
        PYTHONIOENCODING: 'utf-8'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    const MAX_OUTPUT = 20 * 1024 // 20KB

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf-8')
      // 提前截断，避免内存膨胀
      if (stdout.length > MAX_OUTPUT * 2) {
        stdout = stdout.slice(0, MAX_OUTPUT * 2)
      }
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8')
      if (stderr.length > MAX_OUTPUT * 2) {
        stderr = stderr.slice(0, MAX_OUTPUT * 2)
      }
    })

    const timer = setTimeout(() => {
      ctx.logger.warn(`[python_repl] 执行超时，终止进程`)
      try {
        child.kill('SIGKILL')
      } catch (_e) {
        /* 忽略 */
      }
    }, timeoutMs)

    child.on('error', err => {
      clearTimeout(timer)
      ctx.logger.error(`[python_repl] 进程错误: ${err.message}`)
      resolve(`Python 启动失败: ${err.message}\n（请确认项目已运行 \`npm run python:download\` 下载 Python 运行时）`)
    })

    child.on('close', exitCode => {
      clearTimeout(timer)
      ctx.logger.info(`[python_repl] 进程退出, exitCode=${exitCode}`)

      let output = ''
      if (stdout) output += `stdout:\n${stdout}\n`
      if (stderr) output += `stderr:\n${stderr}\n`
      if (exitCode !== 0) {
        output += `\n（进程退出码：${exitCode}）`
      }

      // 截断最终输出
      if (output.length > MAX_OUTPUT) {
        output = output.slice(0, MAX_OUTPUT) + `\n... (输出已截断，共 ${output.length} 字符)`
      }

      if (!output) {
        output = '代码执行完成（无输出）'
      }

      // 在输出前附加工作目录信息，便于 LLM 和用户定位生成的文件
      const relPath = path.relative(ctx.agentRootDir, cwd)
      const header =
        `工作目录：${relPath}\n` +
        `（Python 进程在此目录执行，输出文件也保存在此目录）\n\n`
      resolve(header + output)
    })
  })
}

registerTool({
  name: 'python_repl',
  description:
    '执行任意 Python 代码（使用项目内置的 Python 3.12 运行时）。' +
    '适用于数据处理（pandas/numpy）、绘图（matplotlib）、文件转换、调用第三方库等场景。\n' +
    '工作目录默认为 Agent 沙盒区 SANDBOX/YYYYMMDD-N/（自动递增避免冲突），可通过 workDir 参数指定 SANDBOX/ 下的子目录。决不允许使用非 SANDBOX 下的子目录。\n' +
    'Python 进程的 cwd 与输出文件目录统一为该工作目录。\n' + 
    '已预装 requests/beautifulsoup4/pandas/numpy/openpyxl/markitdown 等库。需用户审批后执行。'+
    'matplotlib 中文支持 ：matplotlib 默认字体不支持中文，绘图时中文会显示为方框。如果需要中文图表，可在 Python 代码中配置：'+
    'import matplotlib'+
    'matplotlib.rcParams["font.sans-serif"] = ["Arial Unicode MS", "PingFang SC", "Heiti TC"]'+
    'matplotlib.rcParams["axes.unicode_minus"] = False\n',
  schema,
  handler,
  meta: { requireApproval: true } // 执行任意代码，需审批
})
