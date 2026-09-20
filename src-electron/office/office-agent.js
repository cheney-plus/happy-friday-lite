/**
 * Office Bridge：编辑器与 Agent 的工具桥接（阶段5）
 * ================================================
 * 注册 office_* 系列内置工具：
 *   - office_open        在可视化编辑器中打开文件
 *   - office_inspect     读取文档/工作簿/幻灯片/PDF 结构（CLI info，只读免审批）
 *   - office_create      新建 DOCX/XLSX/PPTX/PDF（CLI create）
 *   - office_edit_active 对未打开文件执行受控编辑（CLI <domain> apply）
 *   - office_export      导出 PDF/DOCX/XLSX/PPTX 或渲染图片（CLI convert/render）
 *   - office_batch       对沙箱内文件批量生成或修改（CLI 参数透传）
 *
 * 并发写保护（活动文件操作锁）：凡是当前正在可视化编辑器中打开的文件，
 * 一律拒绝 CLI 写入，提示先在 Office 工作区关闭——避免 renderer 与 CLI
 * 并发写同一文件导致损坏。
 *
 * 审批流程与 execute_command 一致：写类操作在 handler 内复用 HITL
 * waitForApproval（MCP/unattended 模式跳过）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { z } from 'zod'
import { registerTool, isValidRiskAssessment, riskAssessmentSchema } from '../agent/tools/registry.js'
import { waitForApproval } from '../agent/humanInTheLoop.js'
import { openOfficeFile, getOfficeState, isOfficeAvailable } from './office-host.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EXT_TO_TYPE = {
  '.docx': 'docs',
  '.xlsx': 'sheets',
  '.xlsm': 'sheets',
  '.csv': 'sheets',
  '.pptx': 'slides',
  '.pdf': 'pdf',
}

const MAX_OUTPUT = 10 * 1024 // 10KB

function officeCliBundle() {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'office')
    : path.resolve(__dirname, '..', '..', 'resources', 'office')
  return path.join(root, 'cli', 'happyfriday-office.cjs')
}

/** 当前正在可视化编辑器中打开的文件（绝对路径） */
function openFilePaths() {
  try {
    return Object.values(getOfficeState())
      .filter((e) => e?.open && e.filePath)
      .map((e) => path.resolve(e.filePath))
  } catch {
    return []
  }
}

function assertNotOpenForWrite(p) {
  const resolved = path.resolve(String(p))
  if (openFilePaths().includes(resolved)) {
    throw new Error(`文件正在 Office 编辑器中打开，为避免并发写入损坏，请先在 Office 工作区关闭后再执行写操作: ${resolved}`)
  }
}

function truncate(output) {
  if (output.length <= MAX_OUTPUT) return output
  return output.slice(0, MAX_OUTPUT) + `\n... (输出已截断，共 ${output.length} 字符)`
}

/** 以 Electron run-as-node 模式运行内置 CLI（dev 与打包后一致） */
function runCli(args, { timeoutMs = 120000 } = {}) {
  const bundle = officeCliBundle()
  if (!fs.existsSync(bundle)) return Promise.resolve('错误：Office CLI 未安装（office:build 产物缺失）')
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  if (!app.isPackaged) {
    // dev 下 pdf/html 导出需要 CLI 能以项目为 app 路径拉起 Electron
    const devBin = path.resolve(__dirname, '..', '..', 'scripts', 'office', 'dev-app-bin.sh')
    if (fs.existsSync(devBin)) env.GENOFFICE_APP_BIN = devBin
  }
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [bundle, ...args],
      {
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        encoding: 'utf8',
        env,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          resolve(`错误：CLI 执行超时（${timeoutMs}ms）`)
          return
        }
        // CLI 用退出码与 JSON status 表达失败，stdout 仍含结构化结果
        const out = stdout || ''
        const errOut = stderr ? `\nstderr:\n${stderr}` : ''
        resolve(truncate(out + errOut) || (err ? `命令失败: ${err.message}` : '命令执行完成（无输出）'))
      }
    )
  })
}

/** 写类操作审批（与 execute_command 相同的 HITL 通道） */
async function requireApproval(ctx, toolName, args, description) {
  if (ctx.autoApprove || ctx.unattended) return null
  const riskAssessment = ctx.currentRiskAssessment
  if (!isValidRiskAssessment(riskAssessment)) {
    return '参数错误：该写操作需要用户审批，必须提供结合本次操作的 riskAssessment（level 与 evaluation）。'
  }
  ctx.emit('agent-tool-approval', {
    requestId: ctx.requestId,
    toolCallId: `${toolName}_approval_${Date.now()}`,
    toolName,
    arguments: args,
    riskAssessment,
    description,
  })
  const decision = await waitForApproval(ctx.requestId)
  if (decision.type === 'reject') return `操作被用户拒绝: ${decision.reason || '用户拒绝执行'}`
  return null
}

function checkAvailable() {
  if (!isOfficeAvailable()) return '错误：Office 模块不可用（未构建或加载失败）'
  return null
}

function resolveType(filePath) {
  const type = EXT_TO_TYPE[path.extname(String(filePath || '')).toLowerCase()]
  if (!type) throw new Error(`不支持的文件类型，仅支持 docx/xlsx/xlsm/csv/pptx/pdf: ${filePath}`)
  return type
}

// ---- office_open ------------------------------------------------------------

registerTool({
  name: 'office_open',
  description:
    '在 Office 可视化编辑器中打开一个 Office 文件（docx/xlsx/xlsm/csv/pptx/pdf），' +
    '用户将直接看到编辑器界面。只打开，不做写入。',
  schema: z.object({
    filePath: z.string().describe('要打开的文件绝对路径'),
  }),
  handler(args) {
    try {
      checkAvailable() || resolveType(args.filePath)
    } catch (e) {
      return `错误：${e.message}`
    }
    return openOfficeFile(args.filePath).then((r) =>
      JSON.stringify({ success: !!r?.success, type: r?.type || null, error: r?.error || null })
    )
  },
  meta: { requireApproval: false },
})

// ---- office_inspect ----------------------------------------------------------

registerTool({
  name: 'office_inspect',
  description:
    '读取 Office 文件的结构与内容摘要（docx 块/标题、pptx 页、xlsx 工作表、pdf 页数），' +
    '只读操作无需审批。',
  schema: z.object({
    filePath: z.string().describe('要读取的文件绝对路径'),
  }),
  handler(args) {
    try {
      resolveType(args.filePath)
    } catch (e) {
      return `错误：${e.message}`
    }
    return runCli(['info', args.filePath, '--json'])
  },
  meta: { requireApproval: false },
})

// ---- office_create -----------------------------------------------------------

const createSchema = z.object({
  type: z.enum(['docx', 'xlsx', 'pptx', 'pdf']).describe('要创建的文件类型'),
  out: z.string().describe('输出文件路径（不能是当前编辑器中打开的文件）'),
  from: z.string().optional().describe('源数据文件：docx 用 md/html，xlsx 用 csv/json'),
  ops: z.string().optional().describe('pptx 幻灯片 ops JSON 文件'),
  spec: z.string().optional().describe('pptx 页面 spec 目录或文件'),
  header: z.boolean().optional().describe('xlsx：冻结首行并加筛选'),
})

registerTool({
  name: 'office_create',
  description: '新建 Office 文件（docx 来自 md/html，xlsx 来自 csv/json，pptx 来自 ops/spec，pdf 由渲染器打印）。写操作，需用户审批。',
  schema: createSchema,
  handler: async (args, ctx) => {
    const unavailable = checkAvailable()
    if (unavailable) return unavailable
    try {
      assertNotOpenForWrite(args.out)
    } catch (e) {
      return `错误：${e.message}`
    }
    const cliArgs = ['create', '--type', args.type, '--out', args.out]
    if (args.from) cliArgs.push('--from', args.from)
    if (args.ops) cliArgs.push('--ops', args.ops)
    if (args.spec) cliArgs.push('--spec', args.spec)
    if (args.header) cliArgs.push('--header')
    const rejected = await requireApproval(ctx, 'office_create', args, `新建 ${args.type} 文件: ${args.out}`)
    if (rejected) return rejected
    return runCli([...cliArgs, '--json'])
  },
  meta: { requireApproval: false },
})

// ---- office_edit_active ------------------------------------------------------

registerTool({
  name: 'office_edit_active',
  description:
    '对 Office 文件执行结构化编辑（ops JSON 批量操作）。' +
    '文件若正在可视化编辑器中打开则被拒绝（先在 Office 工作区关闭，避免并发写入）。写操作，需用户审批。',
  schema: z.object({
    filePath: z.string().describe('目标文件绝对路径（docx/xlsx/xlsm/csv/pptx）'),
    opsFile: z.string().describe('ops 操作 JSON 文件路径（"-" 表示 stdin，配合 execute_command 使用）'),
    dryRun: z.boolean().optional().describe('只校验不写入'),
    track: z.boolean().optional().describe('docx：以修订模式记录本次编辑'),
  }),
  handler: async (args, ctx) => {
    const unavailable = checkAvailable()
    if (unavailable) return unavailable
    let domain
    try {
      domain = { docs: 'docs', sheets: 'sheet', slides: 'slides' }[resolveType(args.filePath)]
    } catch (e) {
      return `错误：${e.message}`
    }
    if (!domain) return '错误：PDF 不支持 ops 编辑，请用 office_export 转换或 office_inspect 读取'
    try {
      assertNotOpenForWrite(args.filePath)
    } catch (e) {
      return `错误：${e.message}`
    }
    const cliArgs = [domain, 'apply', args.filePath, '--ops', args.opsFile]
    if (args.dryRun) cliArgs.push('--dry-run')
    if (args.track) cliArgs.push('--track')
    const rejected = await requireApproval(ctx, 'office_edit_active', args, `编辑文件: ${args.filePath}`)
    if (rejected) return rejected
    return runCli([...cliArgs, '--json'])
  },
  meta: { requireApproval: false },
})

// ---- office_export -----------------------------------------------------------

registerTool({
  name: 'office_export',
  description:
    '导出/转换 Office 文件：convert 支持 pdf/docx/xlsx/pptx/md/html/csv 互转；' +
    'render 将文件每页渲染为 PNG（可 --grid 拼接整册）。写操作，需用户审批。',
  schema: z.object({
    filePath: z.string().describe('源文件绝对路径'),
    mode: z.enum(['convert', 'render']).default('convert').describe('convert=格式转换，render=渲染为图片'),
    to: z.string().optional().describe('convert：目标格式（pdf/docx/xlsx/pptx/md/html/csv）'),
    out: z.string().describe('convert：输出文件路径；render：输出目录'),
    page: z.number().int().optional().describe('render：只渲染指定页'),
    scale: z.number().optional().describe('render：缩放倍数（默认 2）'),
  }),
  handler: async (args, ctx) => {
    const unavailable = checkAvailable()
    if (unavailable) return unavailable
    try {
      resolveType(args.filePath)
      assertNotOpenForWrite(args.out)
    } catch (e) {
      return `错误：${e.message}`
    }
    let cliArgs
    if (args.mode === 'render') {
      cliArgs = ['render', args.filePath, '--out', args.out]
      if (args.page) cliArgs.push('--page', String(args.page))
      if (args.scale) cliArgs.push('--scale', String(args.scale))
    } else {
      if (!args.to) return '错误：convert 模式必须提供 to（目标格式）'
      cliArgs = ['convert', args.filePath, '--to', args.to, '--out', args.out, '--force']
    }
    const rejected = await requireApproval(ctx, 'office_export', args, `导出文件: ${args.filePath} → ${args.out}`)
    if (rejected) return rejected
    return runCli([...cliArgs, '--json'])
  },
  meta: { requireApproval: false },
})

// ---- office_batch ------------------------------------------------------------

registerTool({
  name: 'office_batch',
  description:
    '对 Agent 沙箱内的一批文件批量生成或修改：透传 happyfriday-office CLI 参数（如 batch 子命令），' +
    'cwd 为沙箱目录。写操作，需用户审批；正在编辑器中打开的文件会被拒绝写入。',
  schema: z.object({
    args: z.array(z.string()).min(1).describe('CLI 参数列表（不含程序名），例如 ["batch","--spec","jobs.json"]'),
    riskAssessment: riskAssessmentSchema
      .optional()
      .describe('仅当即将触发审批时必填；需结合本次批量操作说明具体风险'),
  }),
  handler: async (passedArgs, ctx) => {
    const unavailable = checkAvailable()
    if (unavailable) return unavailable
    try {
      for (const token of passedArgs.args) {
        if (openFilePaths().length) {
          const p = path.resolve(String(token))
          if (openFilePaths().includes(p)) {
            return `错误：目标文件正在 Office 编辑器中打开，请先关闭再批量操作: ${p}`
          }
        }
      }
    } catch { /* 路径解析失败交给 CLI 报错 */ }
    const rejected = await requireApproval(
      ctx, 'office_batch', passedArgs.args,
      `批量 Office 操作: ${passedArgs.args.join(' ').slice(0, 200)}`
    )
    if (rejected) return rejected
    const sandboxDir = path.join(ctx.agentRootDir, 'SANDBOX')
    if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true })
    const prevCwd = process.cwd()
    process.chdir(sandboxDir)
    try {
      return await runCli(passedArgs.args)
    } finally {
      process.chdir(prevCwd)
    }
  },
  meta: { requireApproval: false },
})
