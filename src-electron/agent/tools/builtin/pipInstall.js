/**
 * 内置工具：Python 包安装（pip_install）
 * ============================================
 *
 * 通过 pip 安装 Python 第三方库到用户配置的 Python 环境。
 * 支持安装指定包、从 requirements.txt 安装、升级已安装包。
 *
 * pip 命令解析（由 python-env.js 的 resolvePipCommand 统一处理）：
 *   1. `<python> -m pip`（与目标 Python 绑定，最可靠）
 *   2. PATH 中的 pip3
 *   3. PATH 中的 pip
 *   4. 若以上均不可用 → 自动尝试 `<python> -m ensurepip` 引导安装 pip 后重试
 *
 * 安全约束：
 *   - 需用户审批后执行（安装包会修改用户 Python 环境）
 *   - 超时 5 分钟（pip install 可能涉及编译，耗时较长）
 *   - 输出截断 30KB
 *   - 禁止安装路径穿越或包含 shell 元字符的包名
 */

import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import { z } from 'zod'
import { registerTool } from '../registry.js'
import { getPythonPath, resolvePipCommand, getRequirementsPath } from '../../../python-env.js'

// 包名合法性校验：允许字母数字 . _ - [ ]（如 markitdown[all]），禁止空格/路径分隔符/shell 元字符
const VALID_PACKAGE_PATTERN = /^[A-Za-z0-9_.\-\[\]]+$/

// 默认超时 5 分钟
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

// 输出截断阈值
const MAX_OUTPUT = 30 * 1024

// 保持为纯 ZodObject，便于注册器统一追加 riskAssessment 并生成 OpenAI object schema。
// packages/requirements 的二选一约束在 handler 中继续校验，避免 refine 产生 ZodEffects。
const schema = z.object({
  packages: z
    .array(z.string())
    .optional()
    .describe(
      '要安装的 Python 包名列表（如 ["requests", "pandas", "markitdown[all]"]）。' +
      '与 requirements 二选一：传 packages 安装指定包，传 requirements 安装全部依赖。'
    ),
  requirements: z
    .boolean()
    .optional()
    .describe(
      '是否安装应用内置 requirements.txt 中的所有依赖库。' +
      '当用户需要完整的 Python 环境或首次配置时传 true。' +
      '与 packages 二选一。'
    ),
  upgrade: z
    .boolean()
    .optional()
    .describe('是否升级已安装的包到最新版本（添加 --upgrade 参数）。默认 false。'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(DEFAULT_TIMEOUT_MS)
    .optional()
    .describe('安装超时时间（毫秒），范围 1000 至 300000，默认 300000')
})

/**
 * 校验包名列表合法性，防止 shell 注入或路径穿越
 * @param {string[]} packages
 * @returns {{ valid: boolean, invalid?: string[] }}
 */
function validatePackages(packages) {
  if (!packages || packages.length === 0) return { valid: true }
  const invalid = packages.filter((p) => !VALID_PACKAGE_PATTERN.test(p))
  if (invalid.length > 0) return { valid: false, invalid }
  return { valid: true }
}

/**
 * 尝试通过 `<python> -m ensurepip` 引导安装 pip
 * @param {string} pythonPath
 * @returns {boolean} 是否成功
 */
function tryEnsurePip(pythonPath) {
  try {
    const r = spawnSync(pythonPath, ['-m', 'ensurepip', '--upgrade'], {
      encoding: 'utf-8',
      timeout: 60000
    })
    return r.status === 0
  } catch (_e) {
    return false
  }
}

/**
 * 执行 pip 命令并收集输出
 * @param {string} command 可执行文件
 * @param {string[]} args 完整参数（含 install 子命令）
 * @param {number} timeoutMs 超时
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string, timedOut: boolean }>}
 */
function runPip(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    proc.stdout.on('data', (d) => {
      stdout += d.toString('utf-8')
      if (stdout.length > MAX_OUTPUT * 2) stdout = stdout.slice(0, MAX_OUTPUT * 2)
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString('utf-8')
      if (stderr.length > MAX_OUTPUT * 2) stderr = stderr.slice(0, MAX_OUTPUT * 2)
    })

    const timer = setTimeout(() => {
      timedOut = true
      try { proc.kill('SIGKILL') } catch (_e) { /* ignore */ }
    }, timeoutMs)

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    proc.on('error', () => {
      finish({ exitCode: -1, stdout, stderr: stderr + '\n进程启动失败', timedOut })
    })

    proc.on('close', (code) => {
      finish({ exitCode: typeof code === 'number' ? code : -1, stdout, stderr, timedOut })
    })
  })
}

/**
 * 构建 pip install 参数
 * @param {string[]} preArgs pip 前置参数（如 ['-m', 'pip'] 或 []）
 * @param {Object} opts
 * @param {string[]} [opts.packages]
 * @param {boolean} [opts.requirements]
 * @param {boolean} [opts.upgrade]
 * @returns {string[]}
 */
function buildInstallArgs(preArgs, { packages, requirements, upgrade }) {
  const args = [...preArgs, 'install', '--no-cache-dir', '--disable-pip-version-check']
  if (upgrade) args.push('--upgrade')
  if (requirements) {
    args.push('-r', getRequirementsPath())
  } else if (packages && packages.length > 0) {
    args.push(...packages)
  }
  return args
}

async function handler(args, ctx) {
  const { packages, requirements, upgrade } = args
  const hasPackages = Array.isArray(packages) && packages.length > 0
  if (hasPackages === (requirements === true)) {
    return '参数错误：packages 与 requirements=true 必须且只能传一个。'
  }
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const requirementsPath = getRequirementsPath()

  ctx.logger.info(
    `[pip_install] packages=${JSON.stringify(packages || [])}, ` +
    `requirements=${!!requirements}, upgrade=${!!upgrade}, timeout=${timeoutMs}ms`
  )

  // 1. 获取 Python 路径
  const pythonPath = await getPythonPath()
  if (!pythonPath) {
    ctx.logger.warn('[pip_install] Python 环境未配置，无法安装依赖')
    return (
      '⚠️ 未配置 Python 环境，无法安装依赖包。\n\n' +
      '请在「设置 → 通用 → Python 环境」中：\n' +
      '1. 点击「自动检测」尝试发现系统已安装的 Python；或\n' +
      '2. 点击「选择文件」手动指定系统 Python 可执行文件路径。\n\n' +
      '配置完成后重试本操作。'
    )
  }

  // 2. 校验包名合法性
  if (packages && packages.length > 0) {
    const validation = validatePackages(packages)
    if (!validation.valid) {
      ctx.logger.warn(`[pip_install] 包名不合法: ${validation.invalid.join(', ')}`)
      return `包名不合法（包含非法字符）: ${validation.invalid.join(', ')}\n` +
        '包名仅允许字母、数字、点号、下划线、连字符及 [ ]（用于 extras 如 markitdown[all]）。'
    }
  }

  // 3. 校验 requirements.txt 存在
  if (requirements && !fs.existsSync(requirementsPath)) {
    ctx.logger.warn(`[pip_install] 找不到 requirements.txt: ${requirementsPath}`)
    return `找不到依赖清单: ${requirementsPath}`
  }

  // 4. 解析可用的 pip 命令
  let pipCmd = resolvePipCommand(pythonPath)
  let usedEnsurePip = false

  // 5. pip 不可用 → 尝试 ensurepip 引导安装
  if (!pipCmd) {
    ctx.logger.warn('[pip_install] 未检测到 pip，尝试通过 ensurepip 引导安装')
    const ensured = tryEnsurePip(pythonPath)
    if (ensured) {
      usedEnsurePip = true
      pipCmd = resolvePipCommand(pythonPath)
    }
  }

  if (!pipCmd) {
    ctx.logger.error('[pip_install] pip 仍不可用，无法安装')
    return (
      '❌ 未找到可用的 pip，且 ensurepip 引导安装失败。\n\n' +
      '请手动安装 pip：\n' +
      '- Windows: 重新运行 Python 安装程序并勾选 "pip"\n' +
      '- macOS/Linux: 运行 `python3 -m ensurepip --upgrade` 或通过包管理器安装 python3-pip\n\n' +
      '安装完成后重试。'
    )
  }

  // 6. 构建安装参数并执行
  const installArgs = buildInstallArgs(pipCmd.preArgs, { packages, requirements, upgrade })
  const installTarget = requirements
    ? `requirements.txt (${requirementsPath})`
    : (packages || []).join(' ')

  ctx.logger.info(`[pip_install] 使用 ${pipCmd.source} 安装: ${installTarget}`)

  let header = `使用 ${pipCmd.source} 安装: ${installTarget}\n`
  if (usedEnsurePip) {
    header += '（pip 此前缺失，已通过 ensurepip 自动引导安装）\n'
  }
  header += '\n'

  const result = await runPip(pipCmd.command, installArgs, timeoutMs)

  let output = header
  if (result.stdout) output += `stdout:\n${result.stdout}\n`
  if (result.stderr) output += `stderr:\n${result.stderr}\n`

  if (result.timedOut) {
    output += `\n❌ 安装超时（${timeoutMs}ms），可能部分包未完成安装。可增大 timeoutMs 后重试。`
  } else if (result.exitCode === 0) {
    output += `\n✅ 安装完成（退出码 0）。`
  } else {
    output += `\n❌ 安装失败（退出码 ${result.exitCode}）。请检查上方输出中的错误信息。`
  }

  // 截断最终输出
  if (output.length > MAX_OUTPUT) {
    output = output.slice(0, MAX_OUTPUT) + `\n... (输出已截断，共 ${output.length} 字符)`
  }

  ctx.logger.info(`[pip_install] 完成, exitCode=${result.exitCode}, timedOut=${result.timedOut}`)
  return output
}

registerTool({
  name: 'pip_install',
  description:
    '通过 pip 安装 Python 第三方库到用户配置的 Python 环境。需用户审批后执行。\n\n' +
    '【使用场景】\n' +
    '- 当 python_repl 执行代码因缺少库而失败（如 ModuleNotFoundError）时，用本工具安装缺失的库后重试。\n' +
    '- 用户要求安装特定 Python 包时。\n' +
    '- 首次配置完整 Python 环境时（传 requirements=true 安装应用所需的全部依赖）。\n\n' +
    '【参数说明】\n' +
    '- packages: 要安装的包名列表（如 ["requests", "pandas"]），支持 extras 语法如 "markitdown[all]"。\n' +
    '- requirements: 传 true 时安装应用内置 requirements.txt 中的所有依赖库（与 packages 二选一）。\n' +
    '- upgrade: 传 true 时升级已安装的包到最新版本。\n\n' +
    '【pip 解析策略】\n' +
    '按以下顺序查找可用的 pip：\n' +
    '  1. `<python> -m pip`（推荐，与目标 Python 绑定）\n' +
    '  2. PATH 中的 pip3\n' +
    '  3. PATH 中的 pip\n' +
    '  4. 若以上均不可用，自动尝试 `python -m ensurepip` 引导安装 pip 后重试\n\n' +
    '【安全约束】\n' +
    '- 需用户审批后执行\n' +
    '- 超时默认 5 分钟（可通过 timeoutMs 调整）\n' +
    '- 包名仅允许字母、数字、. _ - [ ]，禁止 shell 元字符\n' +
    '- 输出截断 30KB',
  schema,
  handler,
  meta: { requireApproval: true } // 安装包会修改用户 Python 环境，需审批
})
