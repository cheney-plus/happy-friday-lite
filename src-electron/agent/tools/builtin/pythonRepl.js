/**
 * 内置工具：Python 代码执行（python_repl）
 * ============================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 使用 Python 运行时执行任意 Python 代码，
 * 支持数据处理、绘图、脚本导入等场景。
 *
 * Python 运行时解析由 src-electron/python-env.js 统一管理：
 *   - macOS：优先使用系统 Python（含全部依赖），否则使用打包 Python
 *   - Windows/Linux：使用打包 Python（从 resourcesPath 解压到 userData）
 *   - 开发环境：项目根目录/python/python-{platform}/bin/python3
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
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { registerTool } from '../registry.js'
import { getPythonPath } from '../../../python-env.js'

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

  const pythonPath = await getPythonPath()
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
    '执行任意 Python 代码（使用 Python 3.12 运行时）。' +
    '适用于数据处理（pandas/numpy/scipy）、绘图（matplotlib/seaborn/plotly）、Excel 操作（openpyxl/xlrd/xlwt/xlsxwriter）、' +
    '网页解析（beautifulsoup4/lxml）、文档转换（markitdown[all]）、符号计算（sympy）、中文分词（jieba）等场景。\n' +
    '工作目录默认为 Agent 沙盒区 SANDBOX/YYYYMMDD-N/（自动递增避免冲突），可通过 workDir 参数指定 SANDBOX/ 下的子目录。决不允许使用非 SANDBOX 下的子目录。\n' +
    'Python 进程的 cwd 与输出文件目录统一为该工作目录。\n' +
    '已预装 requirements.txt 中所有依赖库（含 requests/beautifulsoup4/lxml/pandas/numpy/scipy/matplotlib/seaborn/plotly/openpyxl/PyYAML/jieba/sympy/markitdown 等）。需用户审批后执行。' +
    'matplotlib 中文支持：matplotlib 默认字体不支持中文，绘图时中文会显示为方框。如果需要中文图表，可在 Python 代码中配置：' +
    'import matplotlib' +
    'matplotlib.rcParams["font.sans-serif"] = ["Arial Unicode MS", "PingFang SC", "Heiti TC"]' +
    'matplotlib.rcParams["axes.unicode_minus"] = False\n',
  schema,
  handler,
  meta: { requireApproval: true } // 执行任意代码，需审批
})
