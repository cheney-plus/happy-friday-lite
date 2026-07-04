/**
 * Agent IPC 通道注册
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §6.1
 *
 * 注册的 IPC 通道：
 *   - agent-invoke: 发起 Agent 调用
 *   - agent-stop: 取消当前 Agent 调用
 *   - agent-tool-approval-resume: 用户审批决策回传
 *   - agent-list-tools: 列出已注册工具（供前端展示）
 *   - agent-list-skills: 列出 SKILL 目录下的技能（供前端展示）
 *
 * 主进程推送的事件（通过 mainWindow.webContents.send）：
 *   - chat-chunk: 流式正文分片（复用现有事件，前端流式渲染）
 *   - chat-reasoning-chunk: 流式思考分片（复用现有事件）
 *   - chat-error: 错误（复用现有事件）
 *   - chat-done: Agent 本轮完成（复用现有事件）
 *   - agent-tool-call: 工具调用开始
 *   - agent-tool-result: 工具调用结果
 *   - agent-tool-approval: 触发人机交互审批
 *
 * 持久化策略：Agent 会话复用现有 sessions/messages 表，
 * 这样 Agent 对话会出现在聊天历史中，与普通对话一致。
 */

import { ipcMain } from 'electron'
import { CancellationTokens } from '../cancellation.js'
import { streamAgentChat, resumeApproval, cancelApproval, getAvailableTools, getAvailableSkills } from './index.js'
import { logger } from './logger.js'
import * as db from '../db.js'
import { CHAT_DONE, CHAT_ERROR, SESSION_TITLE_UPDATED } from '../events.js'
import { generateTitle } from '../llm.js'
import { getDataDir } from '../config.js'
import path from 'path'

const log = logger.scope('IPC')

// Agent 专用取消令牌（独立于 chat 的 cancelTokens，避免冲突）
const agentCancelTokens = new CancellationTokens()

/**
 * 注册 Agent 相关 IPC 通道
 * @param {Object} mainWindow - Electron 主窗口
 */
export function registerAgentCommands(mainWindow) {
  log.info('注册 Agent IPC 通道...')

  // ========== Agent 调用 ==========
  ipcMain.handle('agent-invoke', async (_event, args) => {
    const { requestId, sessionId, model, message, enableThinking, historyMessages } = args

    log.info(`收到 agent-invoke: requestId=${requestId}, sessionId=${sessionId || '无'}`)

    let currentSessionId = sessionId
    let isNewSession = false
    let userMessageId = null

    try {
      // 1. 会话管理：复用现有 sessions 表
      if (!currentSessionId) {
        const session = db.createSession(message.slice(0, 20) || 'Agent 对话')
        currentSessionId = session.id
        isNewSession = true
        log.info(`创建新会话: ${currentSessionId}`)
      } else {
        const existing = db.getSession(currentSessionId)
        if (!existing) {
          throw new Error('Session not found')
        }
      }

      // 2. 保存用户消息
      const userMsg = db.saveMessage(currentSessionId, 'user', message)
      userMessageId = userMsg.id
      db.updateSessionTimestamp(currentSessionId)

      // 3. 新会话：异步生成标题（不阻塞主流程）
      if (isNewSession) {
        const modelClone = { ...model }
        const sessionIdClone = currentSessionId
        const userMsgClone = message
        setImmediate(async () => {
          try {
            const title = await generateTitle(modelClone, userMsgClone)
            db.updateSessionTitle(sessionIdClone, title)
            mainWindow.webContents.send(SESSION_TITLE_UPDATED, {
              sessionId: sessionIdClone,
              title,
            })
          } catch (_e) {
            // 标题生成失败不影响主流程
          }
        })
      }

      // 4. 插入取消令牌
      const cancelToken = agentCancelTokens.insert(requestId)

      // 5. 构造历史消息（从 DB 读取完整历史，确保工具调用上下文连续）
      const dbMessages = db.getMessages(currentSessionId)
      // 排除最后一条（本次刚保存的用户消息），避免重复
      const history = dbMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // 6. 执行 Agent 主循环
      let fullContent = ''
      let fullReasoning = ''
      try {
        const result = await streamAgentChat(mainWindow, {
          requestId,
          sessionId: currentSessionId,
          model,
          historyMessages: history,
          message,
          enableThinking: enableThinking || false,
          cancelToken,
        })
        fullContent = result.fullContent
        fullReasoning = result.fullReasoning
      } catch (e) {
        agentCancelTokens.remove(requestId)
        cancelApproval(requestId)
        throw e
      }

      // 7. 清理取消令牌
      agentCancelTokens.remove(requestId)

      // 8. 保存助手消息到 DB
      const assistantMsg = db.saveMessage(currentSessionId, 'assistant', fullContent)
      db.updateSessionTimestamp(currentSessionId)

      // 9. 推送完成事件（复用 CHAT_DONE，前端无需新增监听）
      mainWindow.webContents.send(CHAT_DONE, {
        requestId,
        sessionId: currentSessionId,
        fullContent,
        reasoningContent: fullReasoning,
        messageId: assistantMsg.id,
        userMessageId,
      })

      log.info(`Agent 完成: sessionId=${currentSessionId}, 输出 ${fullContent.length} 字符`)
      return { sessionId: currentSessionId }
    } catch (e) {
      // 任何阶段出错都通知前端，避免前端一直处于 streaming 状态
      log.error(`Agent 失败: ${e.message}`)
      mainWindow.webContents.send(CHAT_ERROR, {
        requestId,
        sessionId: currentSessionId || null,
        error: e?.message || String(e),
      })
      throw e
    }
  })

  // ========== 取消 Agent ==========
  ipcMain.handle('agent-stop', (_event, args) => {
    log.info(`取消 Agent: requestId=${args.requestId}`)
    agentCancelTokens.cancel(args.requestId)
    // 同时取消等待中的审批
    cancelApproval(args.requestId)
    return true
  })

  // ========== 用户审批决策回传 ==========
  ipcMain.handle('agent-tool-approval-resume', (_event, args) => {
    const { requestId, decision } = args
    log.info(`收到审批决策: requestId=${requestId}, type=${decision?.type}`)
    resumeApproval(requestId, decision)
    return true
  })

  // ========== 列出已注册工具 ==========
  ipcMain.handle('agent-list-tools', () => {
    return getAvailableTools()
  })

  // ========== 列出 SKILL 目录下的技能（供前端展示） ==========
  ipcMain.handle('agent-list-skills', () => {
    const dataDir = getDataDir()
    const agentRootDir = path.join(dataDir, 'knowledge', 'agent')
    return getAvailableSkills(agentRootDir)
  })

  log.info('Agent IPC 通道注册完成')
}
