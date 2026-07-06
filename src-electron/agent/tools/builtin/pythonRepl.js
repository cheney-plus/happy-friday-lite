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
 * 工作目录与脚本策略：
 *   - 脚本文件：统一保存到 {agentRootDir}/SANDBOX/tmpscript/，扩展名 .py，执行后保留不删除；
 *     同名脚本自动追加 -1/-2 后缀，永不覆盖。
 *   - 输出目录：当代码会产生输出文件时，必须通过 workDir 指定 {agentRootDir}/SANDBOX/{userWorkDir}/，
 *     工具会创建该子目录并作为 Python 进程 cwd；不传 workDir 时 cwd 回退到 tmpscript（禁止产生输出文件）。
 *
 * 安全约束：
 *   - 工作目录强制锁定在 Agent 沙盒区 {agentRootDir}/SANDBOX/ 下
 *   - 仅允许使用预装库（见下方 description），禁止 pip 安装或导入其它第三方库
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
 * 生成时间戳（用于自动脚本名）
 * @returns {string} 形如 20260706_153000
 */
function timestamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

/**
 * 解析输出文件目录（Python 进程 cwd）
 * - 用户指定 workDir：相对于 SANDBOX 的子目录，自动创建，用于保存输出文件
 * - 不传：由调用方自行回退到 tmpscript
 *
 * 安全约束：最终路径必须位于 sandboxDir 之内，禁止路径穿越。
 *
 * @param {string} sandboxDir SANDBOX 绝对路径
 * @param {string} userWorkDir 用户指定的输出目录（相对路径）
 * @returns {string} 输出目录绝对路径
 */
function resolveOutputDir(sandboxDir, userWorkDir) {
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
  // 二次校验：解析后仍需在 SANDBOX 内
  if (target !== sandboxDir && !target.startsWith(sandboxDir + path.sep)) {
    throw new Error(`工作目录越界：${userWorkDir}（仅允许在沙盒区 SANDBOX/ 下）`)
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }
  return target
}

/**
 * 解析脚本文件路径（固定存放在 tmpscript/，重名自动追加 -1/-2 后缀，永不覆盖）
 *
 * @param {string} scriptDir SANDBOX/tmpscript/ 绝对路径
 * @param {string} [scriptName] 用户指定的脚本名（不含扩展名）
 * @returns {string} 脚本文件绝对路径
 */
function resolveScriptPath(scriptDir, scriptName) {
  let base =
    scriptName && scriptName.trim()
      ? scriptName.trim().replace(/\.py$/i, '')
      : `script_${timestamp()}`
  // 安全化：仅允许字母数字下划线连字符，防止通过脚本名路径穿越
  base = base.replace(/[^A-Za-z0-9_-]/g, '_')
  if (!base) base = `script_${timestamp()}`

  const first = path.join(scriptDir, `${base}.py`)
  if (!fs.existsSync(first)) return first

  for (let i = 1; i < 10000; i++) {
    const candidate = path.join(scriptDir, `${base}-${i}.py`)
    if (!fs.existsSync(candidate)) return candidate
  }
  // 兜底（极小概率）
  return path.join(scriptDir, `${base}-${Date.now()}.py`)
}

const schema = z.object({
  code: z
    .string()
    .describe('要执行的 Python 代码（支持多行，可包含 import、函数定义、绘图等）'),
  scriptName: z
    .string()
    .optional()
    .describe(
      '脚本文件名（不含扩展名，工具会保存为 SANDBOX/tmpscript/{scriptName}.py）。' +
      '不传则按时间戳自动生成。同名脚本自动追加 -1/-2 后缀，不会覆盖既有脚本；脚本执行后保留不删除。'
    ),
  workDir: z
    .string()
    .optional()
    .describe(
      '输出文件目录（相对于 SANDBOX/ 的子路径，如 "mytask" 或 "data/process"）。' +
      '当代码会产生任何输出文件（.xlsx/.csv/.png/.json/.txt 等）时【必须】传入此参数，' +
      '工具会创建该子目录并作为 Python 进程 cwd，输出文件必须保存到该目录。' +
      '不传时 cwd 为 SANDBOX/tmpscript/，此时代码不得产生任何输出文件（仅用于纯计算/绘图显示等无文件产出场景）。'
    ),
  timeoutMs: z
    .number()
    .optional()
    .describe('超时时间（毫秒），默认 60000（60 秒）')
})

async function handler(args, ctx) {
  const { code, scriptName, workDir, timeoutMs = 60000 } = args
  ctx.logger.info(
    `[python_repl] codeLen=${code.length}, scriptName=${scriptName || '(自动)'}, ` +
      `workDir=${workDir || '(无)'}, timeout=${timeoutMs}ms`
  )

  const pythonPath = await getPythonPath()
  ctx.logger.info(`[python_repl] pythonPath=${pythonPath}`)

  // SANDBOX 根目录
  const sandboxDir = path.join(ctx.agentRootDir, 'SANDBOX')
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true })
  }

  // 脚本目录：固定为 SANDBOX/tmpscript/（脚本文件统一存放，执行后保留不删除）
  const scriptDir = path.join(sandboxDir, 'tmpscript')
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true })
  }

  // 输出目录（Python 进程 cwd）：workDir 指定则创建子目录；否则回退到 tmpscript
  let cwd
  const hasWorkDir = !!(workDir && workDir.trim())
  if (hasWorkDir) {
    try {
      cwd = resolveOutputDir(sandboxDir, workDir)
    } catch (e) {
      ctx.logger.warn(`[python_repl] 输出目录解析失败: ${e.message}`)
      return `输出目录解析失败: ${e.message}`
    }
  } else {
    cwd = scriptDir
  }
  ctx.logger.info(`[python_repl] sandboxDir=${sandboxDir}, scriptDir=${scriptDir}, cwd=${cwd}`)

  // 保存脚本文件（重名追加 -1/-2，永不覆盖，执行后不删除，保留审计痕迹）
  const scriptPath = resolveScriptPath(scriptDir, scriptName)
  fs.writeFileSync(scriptPath, code, 'utf-8')
  ctx.logger.info(`[python_repl] 脚本已保存: ${scriptPath}（执行后保留）`)

  // 执行脚本文件（-u unbuffered，-I 隔离环境）
  return new Promise(resolve => {
    const child = spawn(pythonPath, ['-u', '-I', scriptPath], {
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

      // 在输出前附加绝对路径信息，便于 LLM 和用户定位 SANDBOX 与生成文件
      const header =
        `SANDBOX 绝对路径：${sandboxDir}\n` +
        `脚本文件：${scriptPath}（执行后保留，不删除）\n` +
        `工作目录(cwd)：${cwd}${hasWorkDir ? '' : '（未指定 workDir，禁止在此产生输出文件）'}\n\n`
      resolve(header + output)
    })
  })
}

registerTool({
  name: 'python_repl',
  description:
    '执行任意 Python 代码（使用 Python 3.12 运行时）。需用户审批后执行。\n\n' +
    '【可用库（仅限以下库 + Python 标准库，禁止使用其它第三方库）】\n' +
    '- 网络请求与解析：requests、beautifulsoup4(bs4)、lxml\n' +
    '- 日期时区：python-dateutil、pytz\n' +
    '- Excel 操作：openpyxl、xlrd、xlwt、xlsxwriter\n' +
    '- 数据分析：pandas、numpy、scipy\n' +
    '- 绘图：matplotlib、seaborn、plotly\n' +
    '- 终端输出与表格：rich、tabulate\n' +
    '- 文本处理：PyYAML(yaml)、jieba\n' +
    '- 符号计算：sympy\n' +
    '- 文档转换：markitdown[all]（PDF/Word/PPT/Excel/图片OCR/HTML → Markdown）\n' +
    '- Python 标准库（os/sys/json/re/math/pathlib/subprocess 等均可用）\n' +
    '若所需功能无法用以上库实现，请直接告知用户"无法通过 python_repl 工具实现"，禁止尝试 pip install 或导入其它第三方库。\n\n' +
    '【脚本文件规则（强制）】\n' +
    '- 脚本文件由工具自动保存到 SANDBOX/tmpscript/ 目录下，扩展名 .py，执行后不会被删除（保留审计痕迹）。\n' +
    '- 可通过 scriptName 参数指定脚本名（不含扩展名）；不传则按时间戳自动生成。\n' +
    '- 同名脚本自动追加 -1/-2 后缀以避免覆盖。\n' +
    '- 禁止在代码中删除/移动/重命名 SANDBOX/tmpscript/ 下的脚本文件。\n\n' +
    '【工作目录与输出文件规则（强制）】\n' +
    '- SANDBOX 工作区的绝对路径会在每次执行结果开头给出（见"SANDBOX 绝对路径"行）。\n' +
    '- 当代码会产生任何输出文件（如 .xlsx/.csv/.png/.json/.txt 等）时，必须通过 workDir 参数指定一个 SANDBOX/ 下的自建子目录，' +
    '工具会创建该目录并作为 Python 进程 cwd，输出文件必须保存到该目录（决不允许写入 SANDBOX 之外的任何路径）。\n' +
    '- 不传 workDir 时 cwd 为 SANDBOX/tmpscript/，此时代码不得产生任何输出文件（仅用于纯计算/绘图显示等无文件产出的场景）。\n' +
    '- workDir 不得包含 .. 路径穿越。\n\n' +
    '【matplotlib 中文支持】\n' +
    'matplotlib 默认字体不支持中文，绘图时中文会显示为方框。需要中文图表时请在代码中配置：\n' +
    'import matplotlib\n' +
    'matplotlib.rcParams["font.sans-serif"] = ["Arial Unicode MS", "PingFang SC", "Heiti TC"]\n' +
    'matplotlib.rcParams["axes.unicode_minus"] = False\n',
  schema,
  handler,
  meta: { requireApproval: true } // 执行任意代码，需审批
})
