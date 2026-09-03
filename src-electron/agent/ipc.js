/**
 * IPC 通道注册与流式响应分发
 * =================================
 * 设计参考：Agent智能体设计.md 2.10
 *
 * 沿用项目 ipcMain.handle + mainWindow.webContents.send 模式。
 *
 * 通道清单：
 *   - agent-invoke: 发起 Agent 调用（渲染→主）
 *   - agent-stop: 取消当前调用（渲染→主）
 *   - agent-tool-approval-resume: 审批决策回传（渲染→主）
 *   - agent-list-tools: 查询已注册工具列表（渲染→主）
 *   - agent-list-skills: 查询已加载技能列表（渲染→主）
 *
 * 流式响应（主→渲染）：
 *   - chat-chunk / chat-reasoning-chunk / chat-done / chat-error（复用普通对话事件）
 *   - agent-tool-call / agent-tool-result / agent-tool-approval（Agent 专有事件）
 *
 * 流式订阅 agent.streamEvents(input, { version: "v2" })，
 * 按 on_chat_model_stream / on_tool_start / on_tool_end / on_interrupt 分发到上述通道。
 */

import { ipcMain, dialog } from 'electron'
import { Command } from '@langchain/langgraph'
import { CHAT_CHUNK, CHAT_REASONING_CHUNK, CHAT_DONE, CHAT_ERROR, CONFIG_CHANGED } from '../events.js'
import { CancellationTokens } from '../cancellation.js'
import { getDataDir, loadConfig } from '../config.js'
import * as db from '../db.js'
import { buildLlmMessage } from '../attachmentContext.js'
import { createAgentWithContext } from './index.js'
import { createLogger } from './logger.js'
import { listSkills, generateSkillIndex, deleteSkill, importSkill } from './skills.js'
import { listRegisteredTools, listToolNames } from './tools/registry.js'
import {
  listMcpServers,
  addMcpServers,
  deleteMcpServer,
  refreshMcpServer,
  getLocalMcpConfig,
  getLocalMcpStatus,
  startLocalMcpServer,
  stopLocalMcpServer
} from './mcp.js'
import {
  waitForApproval,
  resolveApprove,
  resolveReject,
  cancelApproval,
  buildResumeCommand,
  emitApprovalRequest
} from './humanInTheLoop.js'
import { createThread, touchThread } from './memory.js'
import { listMemoryFiles, readMemoryFile, writeMemoryFile } from './memoryFiles.js'

const log = createLogger('IPC')

/**
 * 校验模型配置：确保用户已配置自己的大模型
 * 若未配置或配置不完整，抛出错误提示用户前往设置
 * @param {Object} model 前端传入的模型配置
 * @returns {Object} 可用于 LLM 调用的模型配置
 */
function validateModelConfig(model) {
  if (!model || !model.apiKey || !model.modelName || !model.baseUrl) {
    throw new Error('未配置大模型，请在设置中添加自己的模型')
  }
  return model
}

// 取消令牌管理
const cancelTokens = new CancellationTokens()

// 活跃的 Agent 调用映射：requestId → { agent, config, threadId }
const activeInvocations = new Map()

/**
 * 注册所有 Agent IPC 通道
 * @param {Object} mainWindow Electron 主窗口
 */
export function registerAgentCommands(mainWindow) {
  log.info('====== 注册 Agent IPC 通道 ======')

  // ========== agent-invoke: 发起 Agent 调用 ==========
  ipcMain.handle('agent-invoke', async (_event, args) => {
    const { requestId, sessionId, model, message, enableThinking, attachments, folderPath } = args
    log.info(`====== agent-invoke 开始: requestId=${requestId} ======`)
    log.info(`model=${model?.modelName}, enableThinking=${!!enableThinking}, sessionId=${sessionId || '(new)'}, folderPath=${folderPath || '(none)'}`)

    let currentSessionId = sessionId
    let isNewSession = false
    let userMessageId = null

    try {
      // 1. 会话管理：复用 sessions 表（前端兼容），同时在 agent_threads 表记录
      if (!currentSessionId) {
        const session = db.createSession(message.slice(0, 20) || '新 Agent 对话', 'agent')
        currentSessionId = session.id
        isNewSession = true
        log.info(`创建新会话: ${currentSessionId}`)
      } else {
        const existing = db.getSession(currentSessionId)
        if (!existing) {
          throw new Error(`会话不存在: ${currentSessionId}`)
        }
      }

      // 在 agent_threads 表也记录一份（独立追踪 Agent 会话）
      createThread(message.slice(0, 20) || '新 Agent 对话')
      touchThread(currentSessionId)

      // 2. 保存用户消息到 messages 表（简洁引用格式，前端展示一致）
      const userMsg = db.saveMessage(currentSessionId, 'user', message)
      userMessageId = userMsg.id
      db.updateSessionTimestamp(currentSessionId)

      // 3. 获取历史消息构建 Agent 输入
      const dbMessages = db.getMessages(currentSessionId)
      // 移除最后一条用户消息（避免重复，因为我们会在 input 中传）
      const historyMessages = dbMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }))

      // 4. 构造 LLM 输入：如果有 @ 引用附件，替换为 LLM 完整格式
      //    Agent 模式只列名称，由 Agent 自主调用工具读取内容
      const userContent = (attachments && attachments.length > 0)
        ? buildLlmMessage(message, attachments, 'agent')
        : message

      // 4. 创建带上下文的 Agent
      // 校验模型配置：确保用户已配置自己的大模型
      const effectiveModel = validateModelConfig(model)
      const modelConfig = { ...effectiveModel, enableThinking: enableThinking || false }
      const runtimeCtx = {
        mainWindow,
        requestId,
        threadId: currentSessionId,
        dataDir: getDataDir(),
        folderPath: folderPath || ''
      }
      const { agent, rootDir } = await createAgentWithContext(modelConfig, runtimeCtx)
      log.info(`Agent 创建完成, rootDir=${rootDir}`)

      // 5. 记忆文件为 filesystem-backed memory（/memories/*.md 落盘）。
      //    createAgent 每次 invoke 都从磁盘实时读取并注入系统提示词（不使用 SDK memory:
      //    参数，避免 checkpointer 缓存导致内容过期），Agent 通过 edit_file 写入即持久化。

      // 6. 配置 checkpointer thread_id
      const config = { configurable: { thread_id: currentSessionId } }
      activeInvocations.set(requestId, { agent, config, threadId: currentSessionId })

      // 7. 取消令牌
      const cancelToken = cancelTokens.insert(requestId)

      // 8. 构建 Agent 输入（使用 LLM 完整格式的 userContent）
      const input = {
        messages: [
          ...historyMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          { role: 'user', content: userContent }
        ]
      }

      // 9. 流式执行 Agent（含 HITL 中断处理循环）
      let fullContent = ''
      let fullReasoning = ''
      let toolSegments = []

      try {
        const result = await streamAgentWithHITL({
          agent,
          input,
          config,
          requestId,
          mainWindow,
          cancelToken
        })
        fullContent = result.fullContent
        fullReasoning = result.fullReasoning
        toolSegments = result.segments || []
      } catch (e) {
        log.error(`Agent 流式执行失败: ${e.message}`)
        log.error(e.stack)
        throw e
      }

      // 10. 记忆文件为磁盘文件，Agent 通过 edit_file 写入即持久化，无需额外同步。

      // 11. 保存助手消息（含工具调用时间线段 metadata）
      const metadata = toolSegments.length > 0 ? { segments: toolSegments } : null
      const assistantMsg = db.saveMessage(currentSessionId, 'assistant', fullContent, metadata)
      db.updateSessionTimestamp(currentSessionId)

      // 12. 发送完成事件
      mainWindow.webContents.send(CHAT_DONE, {
        requestId,
        sessionId: currentSessionId,
        fullContent,
        reasoningContent: fullReasoning,
        messageId: assistantMsg.id,
        userMessageId
      })

      log.info(`====== agent-invoke 完成: requestId=${requestId} ======`)
      return { sessionId: currentSessionId }
    } catch (e) {
      // 取消导致的异常：发 CHAT_DONE（stopped=true）而非 CHAT_ERROR，避免前端卡在错误态
      // 正常取消路径已在 streamAgentWithHITL 内部处理（返回部分内容，不抛出），此处为兜底
      const token = cancelTokens.get(requestId)
      if (token?.cancelled) {
        log.info(`agent-invoke 因取消结束，发送 CHAT_DONE`)
        mainWindow.webContents.send(CHAT_DONE, {
          requestId,
          sessionId: currentSessionId || null,
          fullContent: '',
          reasoningContent: '',
          messageId: null,
          userMessageId: userMessageId || null
        })
        return { sessionId: currentSessionId }
      }
      log.error(`agent-invoke 失败: ${e.message}`)
      log.error(e.stack)
      if (currentSessionId && userMessageId) {
        const errorContent = `请求失败：${e?.message || String(e)}`
        db.saveMessage(currentSessionId, 'assistant', errorContent, { error: true })
        db.updateSessionTimestamp(currentSessionId)
      }
      mainWindow.webContents.send(CHAT_ERROR, {
        requestId,
        sessionId: currentSessionId || null,
        error: e?.message || String(e)
      })
      throw e
    } finally {
      cancelTokens.remove(requestId)
      activeInvocations.delete(requestId)
      cancelApproval(requestId)
    }
  })

  // ========== agent-stop: 取消当前调用 ==========
  ipcMain.handle('agent-stop', async (_event, args) => {
    const { requestId } = args
    log.info(`agent-stop: requestId=${requestId}`)
    cancelTokens.cancel(requestId)
    cancelApproval(requestId)
    return { ok: true }
  })

  // ========== agent-tool-approval-resume: 审批决策回传 ==========
  ipcMain.handle('agent-tool-approval-resume', async (_event, args) => {
    const { requestId, decision } = args
    log.info(`agent-tool-approval-resume: requestId=${requestId}, decision=${decision.type}`)

    if (decision.type === 'approve') {
      resolveApprove(requestId)
    } else {
      resolveReject(requestId, decision.reason)
    }
    return { ok: true }
  })

  // ========== agent-list-tools: 查询已注册工具列表 ==========
  ipcMain.handle('agent-list-tools', async () => {
    const tools = listRegisteredTools()
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      requireApproval: !!t.meta?.requireApproval
    }))
  })

  // ========== agent-list-skills: 查询已加载技能列表 ==========
  ipcMain.handle('agent-list-skills', async () => {
    generateSkillIndex()
    return listSkills()
  })

  // ========== agent-delete-skill: 删除指定技能 ==========
  // 删除是不可逆操作，先弹出原生确认框；用户取消时返回 canceled: true
  ipcMain.handle('agent-delete-skill', async (_event, args) => {
    const id = args?.id
    if (!id) return { success: false, error: '缺少 skill id' }

    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['取消', '删除'],
      defaultId: 0,
      cancelId: 0,
      title: '删除 Skill',
      message: '确定要删除该 Skill 吗？',
      detail: '删除后无法恢复，该 Skill 目录下的所有文件将被一并移除。'
    })
    if (confirm.response !== 1) {
      return { success: false, canceled: true }
    }
    return deleteSkill(id)
  })

  // ========== agent-import-skill: 通过文件夹选择器导入技能 ==========
  // 弹出原生目录选择框，将选中文件夹复制进 SKILL 目录并解析 SKILL.md
  ipcMain.handle('agent-import-skill', async () => {
    const dlg = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Skill 文件夹',
      properties: ['openDirectory']
    })
    if (dlg.canceled || !dlg.filePaths.length) {
      return { success: false, canceled: true }
    }
    return importSkill(dlg.filePaths[0])
  })

  // ========== MCP 连接管理 ==========
  // 设计参考：src-electron/agent/mcp.js
  // 通道：
  //   - mcp-list-servers: 查询已添加的 MCP 服务器列表
  //   - mcp-add-servers:  粘贴 JSON 添加（remote streamable_http/sse、stdio）
  //   - mcp-delete-server: 删除指定服务器
  //   - mcp-refresh-server: 重新连接并刷新工具列表
  //   - mcp-get-local-config: 获取本机 MCP 服务的可复制 JSON
  //   - mcp-local-toggle: 启停本机 MCP 服务（args: { enabled }）

  ipcMain.handle('mcp-list-servers', async () => {
    return listMcpServers()
  })

  ipcMain.handle('mcp-add-servers', async (_event, args) => {
    const json = args?.json
    if (!json || typeof json !== 'string') {
      return { success: false, error: 'invalidJson' }
    }
    return addMcpServers(json)
  })

  ipcMain.handle('mcp-delete-server', async (_event, args) => {
    const name = args?.name
    if (!name) return { success: false, error: '缺少 name' }
    return deleteMcpServer(name)
  })

  ipcMain.handle('mcp-refresh-server', async (_event, args) => {
    const name = args?.name
    if (!name) return { success: false, error: '缺少 name' }
    return refreshMcpServer(name)
  })

  ipcMain.handle('mcp-get-local-config', async () => {
    return getLocalMcpConfig()
  })

  ipcMain.handle('mcp-local-toggle', async (_event, args) => {
    const enabled = !!args?.enabled
    try {
      let result
      if (enabled) {
        result = await startLocalMcpServer()
      } else {
        result = await stopLocalMcpServer()
      }
      // 保留 stopLocalMcpServer 返回的 keptAlive / consumers，
      // 渲染进程据此提示 DeepSeek Harness 正在占用本机 MCP 服务。
      return { ...result, ...getLocalMcpStatus() }
    } catch (e) {
      log.error(`mcp-local-toggle 失败: ${e.message}`)
      return { success: false, error: e.message, ...getLocalMcpStatus() }
    }
  })

  // ========== 记忆文件管理 ==========
  // 设计参考：LangChain Deep Agents「filesystem-backed memory」
  // 通道：
  //   - agent-list-memories:  列出四份记忆文件（含内容、大小、更新时间）
  //   - agent-read-memory:    读取单份记忆文件
  //   - agent-write-memory:   写入（编辑）单份记忆文件
  // 文件：SOUL.md / USER.md / MEMORY.md / Agent.md，存放于 Agent 沙箱 /memories/ 下。

  ipcMain.handle('agent-list-memories', async () => {
    return listMemoryFiles()
  })

  ipcMain.handle('agent-read-memory', async (_event, args) => {
    const fileName = args?.fileName
    if (!fileName) return { success: false, error: '缺少 fileName' }
    return readMemoryFile(fileName)
  })

  ipcMain.handle('agent-write-memory', async (_event, args) => {
    const { fileName, content } = args || {}
    if (!fileName) return { success: false, error: '缺少 fileName' }
    if (typeof content !== 'string') return { success: false, error: '缺少 content' }
    const res = writeMemoryFile(fileName, content)
    if (res.success) {
      // 广播 config-changed 并无必要（记忆文件不在 config 中），
      // 但 Agent 下次 invoke 会自动读取最新记忆文件，无需额外通知。
      log.info(`记忆文件已更新: ${fileName}`)
    }
    return res
  })

  log.info('====== Agent IPC 通道注册完成 ======')
}

/**
 * 从 LangChain ToolMessage 中提取可读的工具输出文本
 *
 * on_tool_end 事件的 data.output 通常是 ToolMessage 对象，结构如：
 *   { content: string | Array, name, tool_call_id, additional_kwargs, response_metadata }
 *
 * 直接 JSON.stringify 会得到完整对象 JSON，难以阅读。
 * 本函数提取 content 字段（兼容 string 和数组形式），保留 handler 原始返回的文本。
 *
 * @param {any} output on_tool_end 事件的 data.output
 * @returns {string} 可读的工具输出文本
 */
function extractToolOutput(output) {
  if (!output) return ''
  // 字符串：handler 直接返回的字符串
  if (typeof output === 'string') return output
  // ToolMessage 对象：提取 content 字段
  if (typeof output === 'object') {
    const content = output.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      // content 可能是 [{ type: 'text', text }, ...] 形式
      const text = content
        .map(c => typeof c === 'string' ? c : (c?.text || c?.content || ''))
        .join('')
      if (text) return text
    }
    // 兜底：尝试常见字段
    if (typeof output.text === 'string') return output.text
    if (typeof output.output === 'string') return output.output
    // 最终兜底：JSON 序列化（避免丢失信息）
    try {
      return JSON.stringify(output, null, 2)
    } catch (_e) {
      return String(output)
    }
  }
  return String(output)
}

/**
 * 流式执行 Agent，处理 HITL 中断循环
 *
 * 当 Agent 调用需审批的工具时，会触发 interrupt 暂停。
 * 此时我们：
 *   1. 从 Agent 状态中提取 interrupt 信息
 *   2. 推送 agent-tool-approval 事件到前端
 *   3. 等待用户审批决策
 *   4. 用 Command({ resume }) 恢复执行
 *   5. 循环直到无 interrupt
 *
 * @param {Object} params { agent, input, config, requestId, mainWindow, cancelToken }
 * @returns {Promise<{ fullContent, fullReasoning }>}
 */
async function streamAgentWithHITL({ agent, input, config, requestId, mainWindow, cancelToken }) {
  let fullContent = ''
  let fullReasoning = ''
  let currentInput = input
  let iteration = 0
  const MAX_ITERATIONS = 20 // 防止无限循环

  // 收集工具调用时间线段，用于持久化到消息 metadata
  // 段类型: { type: 'text', content } 或 { type: 'tool', toolCallId, toolName, arguments, status, output, requireApproval }
  const segments = []
  let currentTextSegment = null // 当前正在构建的 text 段引用

  while (iteration < MAX_ITERATIONS) {
    if (cancelToken?.cancelled) {
      log.info(`Agent 已取消，退出 HITL 循环`)
      break
    }

    iteration++
    log.info(`HITL 循环第 ${iteration} 轮: 流式执行 Agent`)

    // 流式执行，收集 tokens
    log.info(`调用 streamEvents, version=v2, thread_id=${config.configurable.thread_id}`)
    // 用 AbortController 实现抢占式中止：cancel() 会立即 controller.abort()，
    // 中断 streamEvents 迭代（pending 阶段 / chunk 间隙 / 审批等待均生效）
    const abortController = new AbortController()
    if (cancelToken) {
      cancelToken.abort = () => abortController.abort()
      if (cancelToken.cancelled) abortController.abort()
    }
    let stream
    try {
      stream = await agent.streamEvents(currentInput, {
        version: 'v2',
        signal: abortController.signal,
        ...config
      })
    } catch (e) {
      if (cancelToken?.cancelled) {
        log.info(`streamEvents 创建期间已取消，退出循环`)
        break
      }
      log.error(`streamEvents 创建失败: ${e.message}`)
      log.error(e.stack)
      throw e
    }
    log.info(`stream 已创建，开始迭代事件`)

    let interruptHit = false
    let eventCount = 0

    try {
      for await (const event of stream) {
        eventCount++
        if (eventCount === 1) {
          log.info(`收到第一个事件: ${event.event}`)
        }

        if (cancelToken?.cancelled) {
          log.info(`Agent 已取消，中断流`)
          break
        }

        const { event: eventType, data, name } = event

        // 处理 LLM token 流
        if (eventType === 'on_chat_model_stream') {
          const chunk = data?.chunk
          if (chunk) {
            // 诊断日志：打印 chunk.content 的类型和工具调用信息
            const contentType = typeof chunk.content
            const hasToolCalls = !!(chunk.tool_calls?.length || chunk.additional_kwargs?.tool_calls?.length)
            if (hasToolCalls) {
              log.info(`on_chat_model_stream: tool_calls chunk (content type=${contentType})`)
            }
            // 正文内容
            const content = typeof chunk.content === 'string'
              ? chunk.content
              : Array.isArray(chunk.content)
                ? chunk.content.map(c => typeof c === 'string' ? c : (c?.text || '')).join('')
                : ''
            if (content) {
              fullContent += content
              // 维护 segments：追加到当前 text 段
              if (!currentTextSegment) {
                currentTextSegment = { type: 'text', content }
                segments.push(currentTextSegment)
              } else {
                currentTextSegment.content += content
              }
              mainWindow.webContents.send(CHAT_CHUNK, {
                requestId,
                sessionId: config.configurable.thread_id,
                content
              })
            }

            // 思考内容（reasoning_content，部分 provider 支持）
            const reasoning = chunk.additional_kwargs?.reasoning_content
              || chunk.additional_kwargs?.reasoning
            if (reasoning) {
              fullReasoning += reasoning
              mainWindow.webContents.send(CHAT_REASONING_CHUNK, {
                requestId,
                sessionId: config.configurable.thread_id,
                content: reasoning
              })
            }
          }
        }

        // 处理工具调用事件（补充日志，主要通知由 registry.js 包装层处理）
        if (eventType === 'on_tool_start') {
          log.info(`工具开始: ${name}`)
          // 新工具调用开始，关闭当前 text 段
          currentTextSegment = null
          const toolCallId = data?.run_id || `tool_${segments.length}_${Date.now()}`
          const toolArgs = data?.input || {}
          // 对 interruptOn 工具：on_tool_start 在 interrupt 之后才触发
          // （LangGraph 在 tool 实际执行前才触发 on_tool_start，而 interrupt 在此之前已暂停）
          // 此时审批代码已推送一个 pending_approval / running（已批准）段，这里复用而非新建，避免重复
          // 匹配条件：同名工具 + 无 output（on_tool_end 未触发）+ 非 rejected
          const existingSeg = [...segments]
            .reverse()
            .find(s =>
              s.type === 'tool' &&
              s.toolName === name &&
              s.output === '' &&
              s.status !== 'rejected'
            )
          if (existingSeg) {
            // 复用已有段（来自审批代码或 on_tool_start 先于 interrupt 的情况）
            existingSeg.status = 'running'
            existingSeg.toolCallId = toolCallId
            // 参数以 on_tool_start 的为准（更准确）
            existingSeg.arguments = toolArgs
          } else {
            // 普通工具（无 interruptOn）：新建段
            segments.push({
              type: 'tool',
              toolCallId,
              toolName: name || 'unknown',
              arguments: toolArgs,
              status: 'running',
              output: '',
              requireApproval: false
            })
          }
        }
        if (eventType === 'on_tool_end') {
          log.info(`工具结束: ${name}`)
          // 更新对应 tool 段状态
          const lastTool = [...segments].reverse().find(s => s.type === 'tool' && s.status === 'running')
          if (lastTool) {
            lastTool.status = 'success'
            // on_tool_end 的 data.output 通常是 LangChain ToolMessage 对象
            // 直接 JSON.stringify 会得到 {"content":"...","name":"...","tool_call_id":"..."} 难以阅读
            // 这里提取 content 字段，保留 handler 返回的可读文本
            lastTool.output = extractToolOutput(data?.output)
          }
          currentTextSegment = null // 下一段文本应新建
        }

        // 处理中断事件
        if (eventType === 'on_interrupt') {
          interruptHit = true
          log.info(`检测到 interrupt 事件，Agent 暂停等待审批`)
        }
      }
    } catch (e) {
      // abort / 取消导致的流迭代中断：不再抛出，落入下方 if (cancelToken?.cancelled) break 正常退出
      if (cancelToken?.cancelled) {
        log.info(`流迭代因取消中断 (已收到 ${eventCount} 事件)，正常退出`)
      } else {
        log.error(`流迭代出错 (已收到 ${eventCount} 事件): ${e.message}`)
        log.error(e.stack)
        throw e
      }
    }

    log.info(`流迭代结束，共收到 ${eventCount} 个事件, contentLen=${fullContent.length}`)

    if (cancelToken?.cancelled) break

    // 检查是否有待处理的 interrupt
    const state = await agent.getState(config)
    if (state && state.tasks) {
      // 查找 interrupt 类型的任务
      const interruptTask = state.tasks.find(t => t.interrupts && t.interrupts.length > 0)
      if (interruptTask && interruptTask.interrupts.length > 0) {
        const interrupt = interruptTask.interrupts[0]
        log.info(`Agent 因审批暂停: ${JSON.stringify(interrupt.value).slice(0, 200)}`)

        // 提取工具调用信息，推送到前端审批
        const actionRequests = interrupt.value?.actionRequests || interrupt.value?.action_requests || []
        let approvalToolCallId = `approval_${iteration}`
        let approvalToolName = 'unknown'
        let approvalToolArgs = {}
        if (actionRequests.length > 0) {
          const req = actionRequests[0]
          approvalToolCallId = req.id || approvalToolCallId
          approvalToolName = req.name || approvalToolName
          approvalToolArgs = req.args || req.arguments || {}
          const riskAssessment = approvalToolArgs?.riskAssessment || approvalToolArgs?.risk_assessment
          if (!riskAssessment || !['high', 'medium', 'low'].includes(String(riskAssessment.level || '').toLowerCase()) || !String(riskAssessment.evaluation || '').trim()) {
            log.warn(`工具 ${approvalToolName} 缺少有效 riskAssessment，要求模型重新调用`)
            currentInput = buildResumeCommand({
              type: 'reject',
              reason: '该工具调用缺少必填的 riskAssessment。请根据本次实际参数补充 level（high/medium/low）和具体 evaluation 后重新调用。'
            })
            continue
          }
          emitApprovalRequest(mainWindow, {
            requestId,
            toolCallId: approvalToolCallId,
            toolName: approvalToolName,
            arguments: approvalToolArgs,
            riskAssessment,
            description: interrupt.value?.description || `工具 ${approvalToolName} 需要审批`
          })
        } else {
          // 兜底：直接用 interrupt value
          approvalToolArgs = interrupt.value
          const riskAssessment = approvalToolArgs?.riskAssessment || approvalToolArgs?.risk_assessment
          if (!riskAssessment || !['high', 'medium', 'low'].includes(String(riskAssessment.level || '').toLowerCase()) || !String(riskAssessment.evaluation || '').trim()) {
            log.warn(`工具 ${approvalToolName} 缺少有效 riskAssessment，要求模型重新调用`)
            currentInput = buildResumeCommand({
              type: 'reject',
              reason: '该工具调用缺少必填的 riskAssessment。请根据本次实际参数补充 level（high/medium/low）和具体 evaluation 后重新调用。'
            })
            continue
          }
          emitApprovalRequest(mainWindow, {
            requestId,
            toolCallId: approvalToolCallId,
            toolName: approvalToolName,
            arguments: approvalToolArgs,
            riskAssessment,
            description: '操作需要审批'
          })
        }

        // 添加需要审批的 tool 段
        // 优化：复用 on_tool_start 已推送的 running 段，避免出现重复的工具调用段
        // （否则会得到两段：一段只有参数无结果，一段既有参数也有结果）
        currentTextSegment = null
        // 查找最近的 running 工具段（on_tool_start 已推送）
        let approvalToolSeg = [...segments]
          .reverse()
          .find(s => s.type === 'tool' && s.status === 'running')
        if (approvalToolSeg) {
          // 复用已有段：更新为待审批状态
          approvalToolSeg.status = 'pending_approval'
          approvalToolSeg.requireApproval = true
          // 用 interrupt 中的工具信息覆盖（更准确，包含 LLM 的 tool_call_id）
          approvalToolSeg.toolCallId = approvalToolCallId
          approvalToolSeg.toolName = approvalToolName
          approvalToolSeg.arguments = approvalToolArgs
        } else {
          // 兜底：on_tool_start 未触发时（理论上不会发生），新建段
          approvalToolSeg = {
            type: 'tool',
            toolCallId: approvalToolCallId,
            toolName: approvalToolName,
            arguments: approvalToolArgs,
            status: 'pending_approval',
            output: '',
            requireApproval: true
          }
          segments.push(approvalToolSeg)
        }

        // 等待用户审批决策
        log.info(`等待用户审批决策...`)
        let decision
        try {
          decision = await waitForApproval(requestId)
        } catch (e) {
          // agent-stop 调用 cancelApproval 会 reject 此 promise：取消时退出循环，返回部分内容
          if (cancelToken?.cancelled) {
            log.info(`审批等待期间被取消，退出循环`)
            break
          }
          throw e
        }

        // 更新审批 tool 段状态
        if (decision.type === 'approve') {
          log.info(`用户已批准，恢复执行`)
          // 批准后恢复为 running，让 on_tool_end 能找到此段并填充结果
          approvalToolSeg.status = 'running'
          approvalToolSeg.requireApproval = false
        } else {
          log.info(`用户已拒绝: ${decision.reason}`)
          approvalToolSeg.status = 'rejected'
          approvalToolSeg.output = decision.reason || '用户拒绝'
        }

        // 构造 Command resume 继续执行
        currentInput = buildResumeCommand(decision)
        continue
      }
    }

    // 无 interrupt，Agent 已完成
    log.info(`Agent 执行完成，共 ${iteration} 轮`)
    break
  }

  if (iteration >= MAX_ITERATIONS) {
    log.warn(`HITL 循环达到最大次数 ${MAX_ITERATIONS}，强制退出`)
  }

  return { fullContent, fullReasoning, segments }
}
