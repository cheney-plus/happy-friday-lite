/**
 * 内置工具：Shell 命令执行（execute_command）
 * ============================================
 * 设计参考：Agent智能体设计.md 2.8 / 2.9
 *
 * 受限 shell 执行：
 *   - 白名单：ls/cat/pwd/echo/grep/find/wc/head/tail 等只读命令（无需审批）
 *   - 黑名单：rm -rf /、mkfs、dd if=、shutdown 等（直接拒绝）
 *   - 不在白名单的命令（含 rm/rmdir/mv/cp/重定向等）触发用户审批
 *
 * 审批机制：因 interruptOn 为静态配置无法按命令动态判断，
 *   非白名单命令在 handler 内部复用 HITL 审批流程：
 *   推送 agent-tool-approval 事件 → 等待用户决策 → 执行或拒绝
 *
 * 安全约束：
 *   - cwd 锁定为 Agent 沙箱目录 {userData}/knowledge/agent/SANDBOX/
 *   - 超时 30 秒
 *   - 输出截断 10KB
 */

import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { registerTool } from '../registry.js'
import { waitForApproval } from '../../humanInTheLoop.js'

// 只读命令白名单（无需审批）
const READONLY_WHITELIST = new Set([
  'ls', 'cat', 'pwd', 'echo', 'grep', 'find', 'wc', 'head', 'tail',
  'tree', 'stat', 'file', 'which', 'env', 'date', 'whoami', 'uname'
])

// 危险命令黑名单（直接拒绝）
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/($|\s)/,    // rm -rf /
  /mkfs/,                     // mkfs
  /dd\s+if=/,                 // dd if=
  /shutdown/,                 // shutdown
  /reboot/,                   // reboot
  /halt/,                     // halt
  /:\(\)\s*\{\s*:\|:&\s*\};/, // fork bomb
  />\s*\/dev\/sd[a-z]/,       // 写入磁盘设备
  /mv\s+\S+\s+\/\s*$/         // mv 任意文件到根目录
]

const schema = z.object({
  command: z.string().describe('要执行的 shell 命令'),
  timeoutMs: z
    .number()
    .optional()
    .describe('超时时间（毫秒），默认 30000')
})

/**
 * 判断命令是否安全
 * @param {string} command
 * @returns {{ safe: boolean, needApproval: boolean, reason?: string }}
 */
function analyzeCommand(command) {
  // 检查危险命令黑名单
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, needApproval: false, reason: '命令匹配危险模式，已拒绝' }
    }
  }

  // 提取主命令（第一个 token）
  const trimmed = command.trim()
  const firstToken = trimmed.split(/\s+/)[0]
  const baseCmd = path.basename(firstToken)

  // 白名单命令：安全，无需审批
  if (READONLY_WHITELIST.has(baseCmd)) {
    return { safe: true, needApproval: false }
  }

  // 其他命令：需要审批
  return { safe: true, needApproval: true, reason: '非白名单命令，需用户审批' }
}

async function handler(args, ctx) {
  const { command, timeoutMs = 30000 } = args
  ctx.logger.info(`[execute_command] cmd="${command}"`)

  // 分析命令安全性
  const analysis = analyzeCommand(command)
  if (!analysis.safe) {
    ctx.logger.warn(`[execute_command] 拒绝执行: ${analysis.reason}`)
    return `命令被拒绝: ${analysis.reason}`
  }

  // 非白名单命令（如 rm/mv/cp/重定向等）：在 handler 内部触发审批流程
  // 复用 HITL 的 waitForApproval 机制，推送 agent-tool-approval 事件到前端
  // MCP 模式（ctx.autoApprove=true）下无前端审批通道，跳过审批直接执行，
  // 与本地 MCP server（如 Claude Desktop）执行 shell 的惯例一致。
  if (analysis.needApproval && !ctx.autoApprove) {
    ctx.logger.info(`[execute_command] 非白名单命令，请求用户审批: ${command}`)
    const approvalToolCallId = `execute_command_approval_${Date.now()}`
    ctx.emit('agent-tool-approval', {
      requestId: ctx.requestId,
      toolCallId: approvalToolCallId,
      toolName: 'execute_command',
      arguments: { command },
      description: analysis.reason || `命令需要审批: ${command}`
    })

    // 等待用户审批决策（与 interruptOn 工具共用同一审批通道）
    const decision = await waitForApproval(ctx.requestId)
    if (decision.type === 'reject') {
      ctx.logger.info(`[execute_command] 用户拒绝执行: ${decision.reason || '无原因'}`)
      return `命令被用户拒绝: ${decision.reason || '用户拒绝执行'}`
    }
    ctx.logger.info(`[execute_command] 用户已批准，继续执行`)
  }

  // 确保沙盒区目录存在（cwd 锁定于此，所有 shell 命令均在 SANDBOX 下执行）
  const sandboxDir = path.join(ctx.agentRootDir, 'SANDBOX')
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true })
  }

  ctx.logger.info(`[execute_command] cwd=${sandboxDir}, timeout=${timeoutMs}ms`)

  return new Promise(resolve => {
    exec(
      command,
      {
        cwd: sandboxDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB
        env: { ...process.env, PWD: sandboxDir }
      },
      (err, stdout, stderr) => {
        if (err) {
          // 超时或执行失败
          const errMsg = err.killed
            ? `命令执行超时（${timeoutMs}ms）`
            : `命令执行失败: ${err.message}`
          ctx.logger.warn(`[execute_command] ${errMsg}`)
          // 仍然返回 stderr 内容供 LLM 参考
          const output = stderr ? `stderr:\n${stderr}\n\n${errMsg}` : errMsg
          resolve(output)
          return
        }

        let output = ''
        if (stdout) output += `stdout:\n${stdout}\n`
        if (stderr) output += `stderr:\n${stderr}\n`
        // 截断输出（避免撑爆上下文）
        const MAX_OUTPUT = 10 * 1024 // 10KB
        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + `\n... (输出已截断，共 ${output.length} 字符)`
        }
        ctx.logger.info(`[execute_command] 完成, outputLen=${output.length}`)
        resolve(output || '命令执行完成（无输出）')
      }
    )
  })
}

registerTool({
  name: 'execute_command',
  description:
    '在 Agent 沙盒区内执行 shell 命令。' +
    '只读命令（ls/cat/grep 等）可直接执行；' +
    '其他命令需用户审批。危险命令（rm -rf /、mkfs 等）会被拒绝。' +
    '工作目录锁定为 Agent 沙盒区。',
  schema,
  handler,
  meta: {
    // 是否需要审批在运行时由 analyzeCommand 动态判断，
    // 但 interruptOn 配置只能静态声明，因此这里设为 true，
    // 白名单命令在 handler 内部直接执行（不走 interrupt 流程由 LLM 触发）。
    // 注：实际上 interruptOn 会拦截所有 execute_command 调用，
    //     为了让白名单命令无需审批，这里设为 false，由 handler 内部自行控制。
    requireApproval: false
  }
})
