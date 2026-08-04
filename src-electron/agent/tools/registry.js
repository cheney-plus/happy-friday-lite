/**
 * 可扩展 Tool 注册中心
 * =====================
 * 设计参考：Agent智能体设计.md 2.9
 *
 * 目标：写代码 → 注册 → 即用，无需改动 Agent 核心。
 *
 * 注册接口 registerTool({ name, description, schema, handler, meta })：
 *   - name: 工具名（唯一）
 *   - description: 给 LLM 看的描述
 *   - schema: Zod schema 描述参数
 *   - handler: async (args, ctx) => string，执行逻辑
 *   - meta.requireApproval: 是否需要人机审批（自动加入 interruptOn）
 *
 * 聚合接口：
 *   - buildLangChainTools(ctx): 把所有注册项转为 LangChain tool 数组，并自动包装日志与审计
 *   - buildInterruptConfig(): 自动收集 requireApproval=true 的工具生成 interruptOn 配置
 *
 * 用户扩展方式：
 *   1. 在 tools/builtin/ 下新增文件，调用 registerTool()
 *   2. 在 tools/index.js 中追加一行 import './builtin/xxx.js'
 *   3. 完成，Agent 启动时自动加载
 */

import { tool } from '@langchain/core/tools'
import { createLogger } from '../logger.js'
import { logToolCall } from '../memory.js'

const log = createLogger('Tool')

// 工具注册表：Map<name, ToolDefinition>
const registry = new Map()

/**
 * Tool 上下文（ctx）
 * 在 buildLangChainTools 时由调用方注入，传递给每个 tool handler
 * @typedef {Object} ToolContext
 * @property {Object} db - src-electron/db.js 实例
 * @property {string} dataDir - 项目数据目录
 * @property {string} agentRootDir - Agent 沙箱根目录
 * @property {Object} mainWindow - Electron 主窗口
 * @property {string} threadId - 当前会话 ID
 * @property {string} requestId - 当前请求 ID
 * @property {Object} logger - 统一日志器
 * @property {(event, payload) => void} emit - 便捷推送 IPC 事件
 */

/**
 * 注册一个工具
 * @param {Object} def 工具定义
 * @param {string} def.name 工具名（唯一，小写下划线）
 * @param {string} def.description 给 LLM 看的工具描述
 * @param {import('zod').ZodObject} def.schema Zod 参数 schema
 * @param {(args: Object, ctx: ToolContext) => Promise<string>} def.handler 执行逻辑
 * @param {Object} [def.meta] 元信息
 * @param {boolean} [def.meta.requireApproval=false] 是否需要人机审批
 * @param {boolean} [def.meta.exposedViaMcp=false] 是否通过本机 MCP 服务对外暴露（仅应用功能工具应设为 true）
 */
export function registerTool({ name, description, schema, handler, meta = {} }) {
  if (registry.has(name)) {
    log.warn(`工具已存在，覆盖注册: ${name}`)
  }
  registry.set(name, { name, description, schema, handler, meta })
  log.info(`注册工具: ${name}${meta.requireApproval ? ' (需审批)' : ''}`)
}

/**
 * 获取所有已注册的工具定义
 * @returns {Array}
 */
export function listRegisteredTools() {
  return Array.from(registry.values())
}

/**
 * 获取所有已注册的工具名
 * @returns {string[]}
 */
export function listToolNames() {
  return Array.from(registry.keys())
}

/**
 * 把所有注册项转为 LangChain tool 数组
 * 自动包装：
 *   1. 日志：调用前后打印 args/result/duration
 *   2. 审计：调用结果落库到 agent_tool_logs 表
 *   3. IPC 通知：推送 agent-tool-call / agent-tool-result 事件到前端
 *
 * @param {ToolContext} ctx 工具上下文
 * @returns {Array} LangChain tool 数组
 */
export function buildLangChainTools(ctx) {
  const tools = []
  for (const def of registry.values()) {
    const { name, description, schema, handler, meta } = def

    // 包装 handler：增加日志、审计、IPC 通知
    const wrappedHandler = async (args) => {
      const startTime = Date.now()
      const toolCallId = `${name}_${startTime}_${Math.random().toString(36).slice(2, 8)}`

      log.info(`调用工具: ${name}, args=${JSON.stringify(args)}`)

      // 推送工具调用开始事件到前端
      ctx.emit('agent-tool-call', {
        requestId: ctx.requestId,
        toolCallId,
        toolName: name,
        arguments: args,
        requireApproval: !!meta.requireApproval
      })

      let output = ''
      let status = 'success'
      try {
        output = await handler(args, ctx)
        log.info(`工具完成: ${name}, duration=${Date.now() - startTime}ms, outputLen=${String(output).length}`)
      } catch (e) {
        status = 'error'
        output = `工具执行失败: ${e.message}`
        log.error(`工具失败: ${name}, error=${e.message}`)
        log.error(e.stack)
      }

      // 推送工具结果事件到前端
      ctx.emit('agent-tool-result', {
        requestId: ctx.requestId,
        toolCallId,
        toolName: name,
        output,
        status
      })

      // 审计日志落库
      try {
        logToolCall({
          threadId: ctx.threadId,
          requestId: ctx.requestId,
          toolName: name,
          arguments: args,
          output,
          status,
          durationMs: Date.now() - startTime
        })
      } catch (e) {
        log.warn(`审计日志落库失败: ${name}`, e.message)
      }

      return output
    }

    // 使用 LangChain tool() 函数创建工具
    const lcTool = tool(wrappedHandler, {
      name,
      description,
      schema
    })
    tools.push(lcTool)
  }

  log.info(`构建 LangChain 工具集: 共 ${tools.length} 个工具`)
  return tools
}

/**
 * 自动收集 requireApproval=true 的工具生成 interruptOn 配置
 * @returns {Record<string, boolean>}
 */
export function buildInterruptConfig() {
  const interruptOn = {}
  for (const def of registry.values()) {
    if (def.meta?.requireApproval) {
      interruptOn[def.name] = true
    }
  }
  log.info(`构建 interruptOn 配置: ${Object.keys(interruptOn).length} 个工具需审批`)
  return interruptOn
}
