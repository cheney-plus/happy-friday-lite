import { ipcMain, shell, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import TurndownService from 'turndown'
import { CancellationTokens } from './cancellation.js'
import { loadConfig, saveConfig, getDataDir } from './config.js'
import * as db from './db.js'
import { streamChat, streamChatWithRagAgent, generateTitle, streamNoteAI, fimCompletion } from './llm.js'
import { exportHtmlToPdf, exportMarkdown } from './pdf.js'
import { runPython, runPythonStreaming, checkPython, getPythonPath } from './python.js'
import {
  getPythonStatus,
  autoDetectPythonSync,
  setPythonPath,
  checkPythonPath,
  verifyPythonDeps,
  invalidatePythonCache
} from './python-env.js'
import { CONFIG_CHANGED, CHAT_DONE, CHAT_ERROR, SESSION_TITLE_UPDATED, NOTE_AI_DONE, NOTE_FIM_RESULT, BACKUP_PROGRESS } from './events.js'
import { createBackup, restoreBackup } from './backup.js'
import { cleanHistoryNow } from './historyClean.js'
import { clearEmbeddingsCache } from './rag/embeddings.js'
import { buildLlmMessage } from './attachmentContext.js'
import { getUsageStats, clearUsage } from './usage.js'
import { queryBalance } from './balance.js'
import { registerAgentCommands } from './agent/ipc.js'
import {
  registerHarnessCommands,
  syncHarnessConfigurationIfRunning
} from './harness/index.js'
import { getLogDir, setLoggingEnabled } from './logger.js'
import { getShareUrl, getNoteShareUrl } from './shareServer.js'
import {
  createAutomationTask,
  getActiveAutomationRun,
  isAutomationRunActive,
  isAutomationTaskRunning,
  updateAutomationTask,
  runAutomationTaskNow
} from './automation.js'

const cancelTokens = new CancellationTokens()

function noteFileName(title, usedNames, exportDir) {
  const baseName = String(title || '未命名笔记')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120) || '未命名笔记'

  let index = 1
  let fileName = `${baseName}.md`
  while (usedNames.has(fileName.toLowerCase()) || fs.existsSync(path.join(exportDir, fileName))) {
    index += 1
    fileName = `${baseName} (${index}).md`
  }
  usedNames.add(fileName.toLowerCase())
  return fileName
}

function noteHtmlToMarkdown(html) {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  })
  turndown.addRule('taskListItems', {
    filter: node => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => {
      const checkbox = node.querySelector('input[type="checkbox"]')
      return `- [${checkbox?.hasAttribute('checked') ? 'x' : ' '}] ${content.trim()}\n`
    }
  })
  return turndown.turndown(html || '')
}

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

// 扫描 KB 根目录下所有 .note 文件，返回匹配 noteId 的文件路径列表
function findNoteRefFiles(noteId) {
  const dataDir = getDataDir()
  if (!dataDir) return []
  const kbRoot = path.join(dataDir, 'knowledge')
  if (!fs.existsSync(kbRoot)) return []

  const results = []
  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.note')) {
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8')
          const meta = JSON.parse(raw)
          if (meta.noteId === noteId) {
            results.push({ path: fullPath, meta })
          }
        } catch (e) {
          // 损坏的 .note 文件，跳过
        }
      }
    }
  }
  walk(kbRoot)
  return results
}

// 笔记标题变更时，同步更新关联 .note 文件内 JSON 的 title 字段
// 文件名使用 noteId 永不变，只需更新内容
function syncNoteRefOnRename(noteId, newTitle) {
  const refs = findNoteRefFiles(noteId)
  for (const ref of refs) {
    try {
      const updatedMeta = { ...ref.meta, title: newTitle || '未命名笔记' }
      fs.writeFileSync(ref.path, JSON.stringify(updatedMeta, null, 2), 'utf-8')
    } catch (e) {
      console.error('[Commands] syncNoteRefOnRename error:', e)
    }
  }
}

// 笔记删除时，同步删除关联的 .note 文件
function syncNoteRefOnDelete(noteId) {
  const refs = findNoteRefFiles(noteId)
  for (const ref of refs) {
    try {
      fs.unlinkSync(ref.path)
    } catch (e) {
      console.error('[Commands] syncNoteRefOnDelete error:', e)
    }
  }
}

export function registerCommands(mainWindow) {
  console.log('[Commands] Starting to register all IPC handlers...')

  ipcMain.handle('get-config', () => {
    return loadConfig()
  })

  ipcMain.handle('save-config', (_event, config) => {
    const previousConfig = loadConfig()
    const result = saveConfig(config)
    if (previousConfig.runtimeLogsEnabled !== config.runtimeLogsEnabled) {
      const enabled = setLoggingEnabled(config.runtimeLogsEnabled !== false)
      if (!enabled && config.runtimeLogsEnabled !== false) {
        return { success: false, error: 'Failed to enable runtime logs' }
      }
    }
    // 模型配置变更时清除 Embedding 缓存
    clearEmbeddingsCache()
    mainWindow.webContents.send(CONFIG_CHANGED, config)
    syncHarnessConfigurationIfRunning().catch(error => {
      console.warn('[Commands] Failed to sync Harness model config:', error.message)
    })
    return result
  })

  ipcMain.handle('get-platform', () => {
    return process.platform
  })

  ipcMain.handle('save-file-dialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options?.defaultPath,
      filters: options?.filters || []
    })
    return result.filePath || null
  })

  ipcMain.handle('open-file-dialog', async (_event, options) => {
    const properties = options?.properties || ['openFile']
    const result = await dialog.showOpenDialog(mainWindow, {
      properties,
      filters: options?.filters || []
    })
    if (result.canceled) return null
    return properties.includes('multiSelections') ? result.filePaths : result.filePaths[0]
  })

  ipcMain.handle('get_sessions', () => {
    return db.getSessions()
  })

  ipcMain.handle('get_sessions_with_stats', (_event, args) => {
    return db.getSessionsWithStats(args?.startDate, args?.endDate)
  })

  ipcMain.handle('get_session', (_event, args) => {
    return db.getSession(args.sessionId)
  })

  ipcMain.handle('create_session', (_event, args) => {
    return db.createSession(args?.title)
  })

  ipcMain.handle('update_session_title', (_event, args) => {
    const result = db.updateSessionTitle(args.sessionId, args.title)
    mainWindow.webContents.send(SESSION_TITLE_UPDATED, {
      sessionId: args.sessionId,
      title: args.title
    })
    return result
  })

  ipcMain.handle('delete_session', (_event, args) => {
    const result = db.deleteSession(args.sessionId)
    if (result.automationRunsDeleted > 0) {
      mainWindow.webContents.send('automation-updated')
    }
    return true
  })

  ipcMain.handle('get_session_messages', (_event, args) => {
    return db.getMessages(args.sessionId)
  })

  // 生成内网分享链接：返回只读对话查看页面的 URL
  ipcMain.handle('get-share-link', (_event, args) => {
    const url = getShareUrl(args.sessionId)
    if (!url) {
      return { success: false, error: '分享服务未启动' }
    }
    return { success: true, url }
  })

  // 生成笔记内网分享链接
  ipcMain.handle('get-note-share-link', (_event, args) => {
    const url = getNoteShareUrl(args.noteId)
    if (!url) {
      return { success: false, error: '分享服务未启动' }
    }
    return { success: true, url }
  })

  ipcMain.handle('save_message', (_event, args) => {
    return db.saveMessage(args.sessionId, args.role, args.content)
  })

  ipcMain.handle('rollback_session', (_event, args) => {
    db.rollbackSession(args.sessionId, args.messageId)
    return true
  })

  ipcMain.handle('chat_with_memory', async (_event, args) => {
    const { requestId, sessionId, model, message, enableThinking, systemPrompt, kbName, kbCategoryId, folderPath, topK, attachments } = args

    let currentSessionId = sessionId
    let isNewSession = false
    let userMessageId = null

    // 校验模型配置：确保用户已配置自己的大模型
    const effectiveModel = validateModelConfig(model)

    try {
      if (!currentSessionId) {
        const session = db.createSession(message.slice(0, 20) || '新对话')
        currentSessionId = session.id
        isNewSession = true
      } else {
        const existing = db.getSession(currentSessionId)
        if (!existing) {
          throw new Error('Session not found')
        }
      }

      // 保存用户消息到数据库（简洁引用格式）
      const userMsg = db.saveMessage(currentSessionId, 'user', message)
      userMessageId = userMsg.id
      db.updateSessionTimestamp(currentSessionId)

      if (isNewSession) {
        const modelClone = { ...effectiveModel }
        const sessionIdClone = currentSessionId
        const userMsgClone = message
        setImmediate(async () => {
          try {
            const title = await generateTitle(modelClone, userMsgClone)
            db.updateSessionTitle(sessionIdClone, title)
            mainWindow.webContents.send(SESSION_TITLE_UPDATED, {
              sessionId: sessionIdClone,
              title
            })
          } catch (_e) {
          }
        })
      }

      const dbMessages = db.getMessages(currentSessionId)
      let historyMessages = dbMessages.map(m => ({
        role: m.role,
        content: m.content
      }))

      // 如果有 @ 引用附件，将最后一条用户消息替换为 LLM 完整格式（含引用内容）
      // 数据库仍存储简洁格式，仅 LLM 输入使用完整格式
      if (attachments && attachments.length > 0) {
        const llmContent = buildLlmMessage(message, attachments, 'chat')
        historyMessages = historyMessages.slice(0, -1)
        historyMessages.push({ role: 'user', content: llmContent })
      }

      const appConfig = loadConfig()
      const effectiveSystemPrompt = systemPrompt || appConfig.systemPrompt
      const allMessages = [
        { role: 'system', content: effectiveSystemPrompt },
        ...historyMessages
      ]

      const cancelToken = cancelTokens.insert(requestId)

      // 选择了知识库时走 RAG Agent：由 LLM 通过 Function Calling 自主决定是否检索
      // 工作区(agent)不参与向量化与检索，跳过 RAG 配置
      const isAgentKb = kbCategoryId === 'agent'
      const ragConfig = (!isAgentKb && (kbName || kbCategoryId || folderPath))
        ? { kbName: kbName || '', kbCategoryId: kbCategoryId || '', folderPath: folderPath || '', topK: topK || 3 }
        : null

      let fullContent = ''
      let fullReasoning = ''

      try {
        const result = ragConfig
          ? await streamChatWithRagAgent(mainWindow, allMessages, effectiveModel, requestId, currentSessionId, enableThinking || false, cancelToken, ragConfig)
          : await streamChat(mainWindow, allMessages, effectiveModel, requestId, currentSessionId, enableThinking || false, cancelToken)
        fullContent = result.fullContent
        fullReasoning = result.fullReasoning
      } catch (e) {
        cancelTokens.remove(requestId)
        throw e
      }

      cancelTokens.remove(requestId)

      const assistantMsg = db.saveMessage(currentSessionId, 'assistant', fullContent)
      db.updateSessionTimestamp(currentSessionId)

      mainWindow.webContents.send(CHAT_DONE, {
        requestId,
        sessionId: currentSessionId,
        fullContent,
        reasoningContent: fullReasoning,
        messageId: assistantMsg.id,
        userMessageId
      })

      return { sessionId: currentSessionId }
    } catch (e) {
      // 将异常也作为助手消息保存，历史记录再次打开时不会出现用户消息后空白。
      if (currentSessionId && userMessageId) {
        const errorContent = `请求失败：${e?.message || String(e)}`
        db.saveMessage(currentSessionId, 'assistant', errorContent, { error: true })
        db.updateSessionTimestamp(currentSessionId)
      }
      // 任何阶段出错都通知前端，避免前端一直处于 streaming 状态
      mainWindow.webContents.send(CHAT_ERROR, {
        requestId,
        sessionId: currentSessionId || null,
        error: e?.message || String(e)
      })
      throw e
    }
  })

  ipcMain.handle('chat_without_memory', async (_event, args) => {
    const { requestId, model, message, enableThinking, kbName, kbCategoryId, folderPath, topK, attachments } = args

    // 校验模型配置：确保用户已配置自己的大模型
    const effectiveModel = validateModelConfig(model)

    try {
      const appConfig = loadConfig()
      // 如果有 @ 引用附件，将用户消息替换为 LLM 完整格式（含引用内容）
      const userContent = (attachments && attachments.length > 0)
        ? buildLlmMessage(message, attachments, 'memoryless')
        : message
      const messages = [
        { role: 'system', content: appConfig.systemPrompt },
        { role: 'user', content: userContent }
      ]

      const cancelToken = cancelTokens.insert(requestId)

      // 选择了知识库时走 RAG Agent：由 LLM 通过 Function Calling 自主决定是否检索
      // 工作区(agent)不参与向量化与检索，跳过 RAG 配置
      const isAgentKb = kbCategoryId === 'agent'
      const ragConfig = (!isAgentKb && (kbName || kbCategoryId || folderPath))
        ? { kbName: kbName || '', kbCategoryId: kbCategoryId || '', folderPath: folderPath || '', topK: topK || 3 }
        : null

      let fullContent = ''
      let fullReasoning = ''

      try {
        const result = ragConfig
          ? await streamChatWithRagAgent(mainWindow, messages, effectiveModel, requestId, null, enableThinking || false, cancelToken, ragConfig)
          : await streamChat(mainWindow, messages, effectiveModel, requestId, null, enableThinking || false, cancelToken)
        fullContent = result.fullContent
        fullReasoning = result.fullReasoning
      } catch (e) {
        cancelTokens.remove(requestId)
        throw e
      }

      cancelTokens.remove(requestId)

      mainWindow.webContents.send(CHAT_DONE, {
        requestId,
        sessionId: null,
        fullContent,
        reasoningContent: fullReasoning,
        messageId: null,
        userMessageId: null
      })

      return {}
    } catch (e) {
      // 无记忆模式没有 session，错误由前端展示即可。
      // 任何阶段出错都通知前端，避免前端一直处于 streaming 状态
      mainWindow.webContents.send(CHAT_ERROR, {
        requestId,
        sessionId: null,
        error: e?.message || String(e)
      })
      throw e
    }
  })

  ipcMain.handle('stop_chat', (_event, args) => {
    cancelTokens.cancel(args.requestId)
    return true
  })

  ipcMain.handle('get_notes', (_event, args) => {
    return db.getNotes(args?.knowledgeBaseId, args?.notebookId)
  })

  ipcMain.handle('get_note', (_event, args) => {
    return db.getNote(args.noteId)
  })

  ipcMain.handle('create_note', (_event, args) => {
    return db.createNote(args?.knowledgeBaseId, args?.notebookId, args?.title)
  })

  ipcMain.handle('import_note', (_event, args) => {
    return db.importNote(args?.knowledgeBaseId, args?.notebookId, args?.title, args?.content, args?.contentText)
  })

  ipcMain.handle('update_note', (_event, args) => {
    const oldNote = db.getNote(args.noteId)
    const updated = db.updateNote(args.noteId, args.title, args.content, args.contentText, args.notebookId)
    // 标题变更时同步重命名关联的 .note 文件
    if (updated && oldNote && oldNote.title !== updated.title) {
      syncNoteRefOnRename(args.noteId, updated.title)
    }
    return updated
  })

  ipcMain.handle('delete_note', (_event, args) => {
    const result = db.softDeleteNote(args.noteId)
    // 笔记删除时同步删除关联的 .note 文件
    if (result) {
      syncNoteRefOnDelete(args.noteId)
    }
    return result
  })

  ipcMain.handle('search_notes', (_event, args) => {
    return db.searchNotes(args.query)
  })

  ipcMain.handle('get_schedule_events', () => {
    return db.getScheduleEvents()
  })

  ipcMain.handle('get_schedule_events_by_date_range', (_event, args) => {
    return db.getScheduleEventsByDateRange(args.start, args.end)
  })

  ipcMain.handle('get_schedule_event', (_event, args) => {
    return db.getScheduleEvent(args.eventId)
  })

  ipcMain.handle('create_schedule_event', (_event, args) => {
    return db.createScheduleEvent(args)
  })

  ipcMain.handle('update_schedule_event', (_event, args) => {
    return db.updateScheduleEvent(args.eventId, args)
  })

  ipcMain.handle('delete_schedule_event', (_event, args) => {
    db.deleteScheduleEvent(args.eventId)
    return true
  })

  ipcMain.handle('get_notebooks', () => {
    console.log('[Commands] get_notebooks called')
    return db.getNotebooks()
  })

  ipcMain.handle('get_notebook', (_event, args) => {
    return db.getNotebook(args.notebookId)
  })

  ipcMain.handle('create_notebook', (_event, args) => {
    console.log('[Commands] create_notebook called with:', args)
    return db.createNotebook(args?.name, args?.description)
  })

  ipcMain.handle('update_notebook', (_event, args) => {
    return db.updateNotebook(args.notebookId, args.name, args.description)
  })

  ipcMain.handle('delete_notebook', (_event, args) => {
    return db.deleteNotebook(args.notebookId)
  })

  ipcMain.handle('export_html_to_pdf', async (_event, args) => {
    await exportHtmlToPdf(args.html, args.savePath)
    return true
  })

  ipcMain.handle('export_markdown', async (_event, args) => {
    await exportMarkdown(args.markdown, args.savePath)
    return true
  })

  ipcMain.handle('export_all_notes', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择笔记导出目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true }

    const exportDir = result.filePaths[0]
    const notes = db.getNotes()
    const usedNames = new Set()
    const errors = []
    let exported = 0

    for (const note of notes) {
      try {
        const fileName = noteFileName(note.title, usedNames, exportDir)
        fs.writeFileSync(path.join(exportDir, fileName), noteHtmlToMarkdown(note.content), 'utf-8')
        exported += 1
      } catch (error) {
        errors.push({ title: note.title || '未命名笔记', error: error.message })
      }
    }

    return { success: errors.length === 0, exported, total: notes.length, errors, exportDir }
  })

  ipcMain.handle('open-external', (_event, url) => {
    shell.openExternal(url)
    return true
  })

  ipcMain.handle('note_ai_action', async (_event, args) => {
    const { requestId, action, noteContent, selectedText, model, userInstruction } = args

    const validActions = ['interpret', 'refine', 'polish', 'expand', 'translate', 'summarize', 'continue_write', 'fix_grammar', 'generate_plan', 'generate_table', 'custom']
    if (!validActions.includes(action)) {
      throw new Error(`Invalid note AI action: ${action}`)
    }

    // 校验模型配置：确保用户已配置自己的大模型
    const effectiveModel = validateModelConfig(model)

    const cancelToken = cancelTokens.insert(requestId)

    let fullContent = ''

    try {
      const result = await streamNoteAI(
        mainWindow,
        action,
        noteContent,
        selectedText,
        effectiveModel,
        requestId,
        cancelToken,
        userInstruction
      )
      fullContent = result.fullContent
    } catch (e) {
      cancelTokens.remove(requestId)
      throw e
    }

    cancelTokens.remove(requestId)

    mainWindow.webContents.send(NOTE_AI_DONE, {
      requestId,
      fullContent
    })

    return {}
  })

  ipcMain.handle('stop_note_ai', (_event, args) => {
    cancelTokens.cancel(args.requestId)
    return true
  })

  ipcMain.handle('note_fim_completion', async (_event, args) => {
    const { requestId, model, prefix, suffix } = args

    // 校验模型配置：确保用户已配置自己的大模型
    const effectiveModel = validateModelConfig(model)

    const cancelToken = cancelTokens.insert(requestId)

    try {
      const result = await fimCompletion(effectiveModel, prefix, suffix, cancelToken)
      cancelTokens.remove(requestId)

      mainWindow.webContents.send(NOTE_FIM_RESULT, {
        requestId,
        completion: result.completion
      })

      return {}
    } catch (e) {
      cancelTokens.remove(requestId)
      throw e
    }
  })

  ipcMain.handle('stop_note_fim_completion', (_event, args) => {
    // cancel() 现在会自动调用 token.abort()（即 controller.abort()），无需手动查找 _abortController
    cancelTokens.cancel(args.requestId)
    return true
  })

  // ========== 知识库文件系统命令 ==========

  ipcMain.handle('kb-get-data-dir', () => {
    return getDataDir()
  })

  ipcMain.handle('kb-read-dir', async (_event, args) => {
    const dirPath = args.dirPath
    if (!dirPath || !fs.existsSync(dirPath)) {
      return []
    }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => {
          const fullPath = path.join(dirPath, entry.name)
          const stat = fs.statSync(fullPath)
          const result = {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stat.size,
            modifiedTime: stat.mtime.toISOString()
          }
          // .note 文件：用 JSON 内的 title 作为显示名，path 保持真实路径
          if (!entry.isDirectory() && entry.name.endsWith('.note')) {
            try {
              const meta = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
              if (meta.title) {
                result.name = `${meta.title}.note`
              }
            } catch (e) {
              // 损坏的 .note 文件，保留原文件名
            }
          }
          return result
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name, 'zh-CN')
        })
    } catch (e) {
      console.error('[Commands] kb-read-dir error:', e)
      return []
    }
  })

  ipcMain.handle('kb-create-dir', async (_event, args) => {
    const dirPath = args.dirPath
    if (!dirPath) return { success: false, error: 'No path provided' }
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 递归搜索目录下匹配的文件和文件夹
  ipcMain.handle('kb-search-files', async (_event, args) => {
    const { dirPath, query, allowedExtensions } = args
    if (!dirPath || !query) return []
    const lowerQuery = String(query).toLowerCase()
    const results = []

    function walk(currentPath, relativePath) {
      if (!fs.existsSync(currentPath)) return
      let entries
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true })
      } catch (e) {
        return
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(currentPath, entry.name)
        const relPath = relativePath ? relativePath + '/' + entry.name : entry.name
        const nameLower = entry.name.toLowerCase()

        if (entry.isDirectory()) {
          if (nameLower.includes(lowerQuery)) {
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              isDirectory: true,
              size: 0,
              modifiedTime: fs.statSync(fullPath).mtime.toISOString()
            })
          }
          walk(fullPath, relPath)
        } else {
          const ext = entry.name.split('.').pop().toLowerCase()
          if (allowedExtensions && allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
            continue
          }
          let stat
          try { stat = fs.statSync(fullPath) } catch (e) { continue }

          // .note 文件：读取 JSON 内 title 参与搜索匹配，并用 title 作为显示名
          if (entry.name.endsWith('.note')) {
            let displayTitle = ''
            try {
              const meta = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
              displayTitle = meta.title || ''
            } catch (e) {
              // 损坏的 .note 文件
            }
            const titleLower = displayTitle.toLowerCase()
            if (nameLower.includes(lowerQuery) || titleLower.includes(lowerQuery)) {
              results.push({
                name: displayTitle ? `${displayTitle}.note` : entry.name,
                path: fullPath,
                relativePath: relPath,
                isDirectory: false,
                size: stat.size,
                modifiedTime: stat.mtime.toISOString()
              })
            }
          } else if (nameLower.includes(lowerQuery)) {
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              isDirectory: false,
              size: stat.size,
              modifiedTime: stat.mtime.toISOString()
            })
          }
        }
      }
    }

    walk(dirPath, '')
    return results
  })

  ipcMain.handle('kb-mkdir', async (_event, args) => {
    const parentPath = args.parentPath
    const dirName = args.dirName
    if (!parentPath || !dirName) return { success: false, error: 'Missing parameters' }
    try {
      const fullPath = path.join(parentPath, dirName)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
      return { success: true, path: fullPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-path-exists', async (_event, args) => {
    return fs.existsSync(args.path)
  })

  ipcMain.handle('kb-copy-file', async (_event, args) => {
    const { srcPath, destDir } = args
    if (!srcPath || !destDir) return { success: false, error: 'Missing parameters' }
    try {
      const fileName = path.basename(srcPath)
      const destPath = path.join(destDir, fileName)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  function copyDirectoryRecursive(src, dest, allowedExtensions) {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        copyDirectoryRecursive(srcPath, destPath, allowedExtensions)
      } else {
        // 过滤非法格式文件
        if (allowedExtensions && allowedExtensions.length > 0) {
          const ext = entry.name.split('.').pop().toLowerCase()
          if (!allowedExtensions.includes(ext)) continue
        }
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  ipcMain.handle('kb-copy-folder', async (_event, args) => {
    const { srcPath, destDir, allowedExtensions } = args
    if (!srcPath || !destDir) return { success: false, error: 'Missing parameters' }
    try {
      const folderName = path.basename(srcPath)
      const destPath = path.join(destDir, folderName)
      copyDirectoryRecursive(srcPath, destPath, allowedExtensions)
      return { success: true, path: destPath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 桌面拖放同时支持文件和文件夹，并在主进程按实际文件类型执行格式过滤。
  ipcMain.handle('kb-copy-drop-items', async (_event, args) => {
    const { srcPaths, destDir, allowedExtensions } = args
    if (!Array.isArray(srcPaths) || !destDir) return { success: false, error: 'Missing parameters' }
    const copied = []
    const failed = []
    for (const srcPath of srcPaths) {
      try {
        const stat = fs.statSync(srcPath)
        if (stat.isDirectory()) {
          const destPath = path.join(destDir, path.basename(srcPath))
          copyDirectoryRecursive(srcPath, destPath, allowedExtensions)
          copied.push(destPath)
        } else {
          const ext = path.extname(srcPath).slice(1).toLowerCase()
          if (allowedExtensions && allowedExtensions.length && !allowedExtensions.includes(ext)) {
            failed.push({ path: srcPath, error: 'Unsupported file type' })
            continue
          }
          const destPath = path.join(destDir, path.basename(srcPath))
          fs.copyFileSync(srcPath, destPath)
          copied.push(destPath)
        }
      } catch (e) {
        failed.push({ path: srcPath, error: e.message })
      }
    }
    return { success: failed.length === 0, copied, failed }
  })

  // 抓取网页原始 HTML（在主进程执行以规避渲染进程跨域限制）
  // 正文清洗交由渲染进程的 @mozilla/readability 完成，这里只负责抓取
  ipcMain.handle('kb-fetch-webpage', async (_event, args) => {
    const { url } = args
    if (!url) return { success: false, error: 'Missing url' }
    try {
      // 规范化 URL
      let fetchUrl = url.trim()
      if (!/^https?:\/\//i.test(fetchUrl)) {
        fetchUrl = 'https://' + fetchUrl
      }

      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      })

      if (!response.ok) {
        return { success: false, error: `请求失败，状态码：${response.status}` }
      }

      const html = await response.text()
      // response.url 为跟随重定向后的最终地址，用于解析相对链接
      return { success: true, html, finalUrl: response.url || fetchUrl }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 保存经 Readability 清洗后的网页正文 HTML 到指定目录
  ipcMain.handle('kb-save-webpage', async (_event, args) => {
    const { content, destDir, sourceUrl } = args
    if (!content || !destDir) return { success: false, error: 'Missing parameters' }
    try {
      // 从来源 URL 提取文件名
      let baseName
      try {
        const urlObj = new URL(sourceUrl || 'webpage')
        baseName = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname
        // 移除可能的查询参数
        baseName = baseName.split('?')[0].split('#')[0]
        // 移除扩展名（后续统一加 .html）
        baseName = baseName.replace(/\.[^/.]+$/, '')
      } catch (e) {
        baseName = 'webpage'
      }
      // 清理非法文件名字符
      baseName = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'webpage'
      // 限制文件名长度
      if (baseName.length > 80) baseName = baseName.substring(0, 80)

      let fileName = baseName + '.html'
      let filePath = path.join(destDir, fileName)

      // 处理文件名冲突
      if (fs.existsSync(filePath)) {
        let counter = 1
        while (fs.existsSync(filePath)) {
          fileName = `${baseName} 副本${counter > 1 ? ' ' + counter : ''}.html`
          filePath = path.join(destDir, fileName)
          counter++
        }
      }

      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true, path: filePath, fileName }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 将笔记作为 .note 元数据文件保存到指定目录（实时引用，非快照）
  // 文件名使用 noteId（永不变），显示名从 JSON 的 title 读取
  ipcMain.handle('kb-save-note', async (_event, args) => {
    const { noteId, title, destDir } = args
    if (!destDir) return { success: false, error: 'Missing destDir' }
    if (!noteId) return { success: false, error: 'Missing noteId' }
    try {
      const fileName = `${noteId}.note`
      const filePath = path.join(destDir, fileName)

      const meta = {
        type: 'note-ref',
        noteId,
        title: title || '未命名笔记',
        exportedAt: new Date().toISOString()
      }
      fs.writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf-8')
      return { success: true, path: filePath, fileName }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-delete-dir', async (_event, args) => {
    const dirPath = args.dirPath
    if (!dirPath) return { success: false, error: 'No path provided' }
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-rename-dir', async (_event, args) => {
    const { oldPath, newPath } = args
    if (!oldPath || !newPath) return { success: false, error: 'Missing parameters' }
    try {
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath)
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-open-in-explorer', async (_event, args) => {
    if (args.path) {
      await shell.openPath(args.path)
    }
  })

  // 打开日志目录（系统文件管理器），供安装后用户查看运行日志
  ipcMain.handle('logs-open-dir', async () => {
    const dir = getLogDir()
    if (!dir) return { success: false, error: 'Logger not initialized' }
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      await shell.openPath(dir)
      return { success: true, logDir: dir }
    } catch (e) {
      return { success: false, error: e.message, logDir: dir }
    }
  })

  ipcMain.handle('kb-read-file', async (_event, args) => {
    const filePath = args.filePath
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-read-file-buffer', async (_event, args) => {
    const filePath = args.filePath
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    try {
      const buffer = fs.readFileSync(filePath)
      // 转为 ArrayBuffer 以确保 IPC 序列化正确
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      return { success: true, data: arrayBuffer }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('kb-open-file-external', async (_event, args) => {
    if (args.filePath) {
      await shell.openPath(args.filePath)
    }
    return true
  })

  // ========== Python 相关命令 ==========

  ipcMain.handle('python-check', async () => {
    return await checkPython()
  })

  ipcMain.handle('python-run', async (_event, args) => {
    const { scriptPath, scriptArgs, env, cwd } = args
    return await runPython(scriptPath, scriptArgs || [], env || {}, cwd)
  })

  ipcMain.handle('python-run-streaming', async (_event, args) => {
    const { scriptPath, scriptArgs, env, cwd } = args
    const result = await runPythonStreaming(scriptPath, scriptArgs || [], {
      env: env || {},
      cwd,
      onStdout: (data) => {
        mainWindow.webContents.send('python-stdout', data)
      },
      onStderr: (data) => {
        mainWindow.webContents.send('python-stderr', data)
      }
    })
    return result
  })

  ipcMain.handle('python-get-path', () => {
    return getPythonPath()
  })

  // 获取 Python 环境状态（配置路径 / 解析路径 / 版本 / 是否可用）
  ipcMain.handle('python-status', async () => {
    return await getPythonStatus()
  })

  // 自动检测系统 Python，不写回配置，仅返回检测结果
  ipcMain.handle('python-autodetect', async () => {
    const detected = autoDetectPythonSync()
    if (!detected) {
      return { ok: false, path: null, version: null }
    }
    const check = checkPythonPath(detected)
    return { ok: check.ok, path: detected, version: check.version, reason: check.reason }
  })

  // 设置 Python 路径（写回配置并刷新缓存）；传 null/空串清除配置
  ipcMain.handle('python-set-path', async (_event, args) => {
    const target = (args && typeof args === 'object') ? args.path : args
    await setPythonPath(target || null)
    return { success: true, path: target || null }
  })

  // 弹出文件选择对话框，让用户选择 Python 可执行文件
  ipcMain.handle('python-select-file', async () => {
    const isWin = process.platform === 'win32'
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Python 可执行文件',
      properties: ['openFile'],
      filters: isWin
        ? [{ name: 'Python 可执行文件', extensions: ['exe'] }]
        : [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    const selected = result.filePaths[0]
    const check = checkPythonPath(selected)
    return { success: true, path: selected, ok: check.ok, version: check.version, reason: check.reason }
  })

  // 校验依赖库是否齐全
  ipcMain.handle('python-verify', async (_event, args) => {
    const target = args && args.path ? args.path : undefined
    return await verifyPythonDeps(target)
  })

  // 清除 Python 路径缓存（设置页面在切换路径后可调用以强制重新解析）
  ipcMain.handle('python-invalidate-cache', async () => {
    invalidatePythonCache()
    return { success: true }
  })

  // ========== 数据备份 ==========

  // 手动备份：弹出保存对话框，选择保存位置
  ipcMain.handle('backup-create', async () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const defaultName = `friday-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    // 压缩在 worker 线程中执行，主进程将进度推送给渲染进程
    const backupResult = await createBackup(result.filePath, false, (p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(BACKUP_PROGRESS, p)
      }
    })
    // 手动备份成功后也更新 lastBackupAt
    if (backupResult.success) {
      try {
        const config = loadConfig()
        if (config.backup) {
          config.backup.lastBackupAt = new Date().toISOString()
          saveConfig(config)
        }
      } catch (e) {}
    }
    return backupResult
  })

  // 恢复备份：弹出打开对话框，选择 zip 文件
  ipcMain.handle('backup-restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return await restoreBackup(result.filePaths[0])
  })

  // 获取备份配置
  ipcMain.handle('backup-get-config', async () => {
    const config = loadConfig()
    return config.backup || null
  })

  // 设置备份配置
  ipcMain.handle('backup-set-config', async (_event, args) => {
    const config = loadConfig()
    config.backup = { ...config.backup, ...args }
    saveConfig(config)
    return { success: true, backup: config.backup }
  })

  // 选择自动备份目录
  ipcMain.handle('backup-select-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, dir: result.filePaths[0] }
  })

  // ========== 对话历史自动清理相关命令 ==========
  // 获取对话历史清理配置
  ipcMain.handle('history-get-config', async () => {
    const config = loadConfig()
    return config.history || null
  })

  // 设置对话历史清理配置
  ipcMain.handle('history-set-config', async (_event, args) => {
    const config = loadConfig()
    config.history = { ...config.history, ...args }
    saveConfig(config)
    return { success: true, history: config.history }
  })

  // 立即执行一次对话历史清理（用户开启功能时触发，属用户主动操作）
  ipcMain.handle('history-clean-now', async () => {
    try {
      const result = await cleanHistoryNow()
      return { success: true, ...result }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ========== RAG 知识检索相关命令 ==========

  // 手动构建单个文件的向量索引（右键"构建索引"）
  // 强制重新索引，即使已索引过也会重新构建
  // 进度通过 rag-build-progress 事件实时推送，完成/取消通过 rag-task-complete 通知
  ipcMain.handle('rag-build-index', async (_event, args) => {
    const { filePath } = args
    if (!filePath) {
      return { success: false, error: 'filePath required' }
    }
    try {
      const { triggerOnFileUpload } = await import('./rag/triggers.js')
      const enqueued = triggerOnFileUpload(filePath)
      return { success: true, enqueued }
    } catch (e) {
      console.error('[RAG] build-index error:', e)
      return { success: false, error: e.message }
    }
  })

  // 停止当前正在进行的索引任务（用户点击"停止"按钮）
  // 取消后队列会清理已插入的向量和状态记录
  ipcMain.handle('rag-stop-build-index', async () => {
    try {
      const { stopBuildIndex } = await import('./rag/triggers.js')
      stopBuildIndex()
      return { success: true }
    } catch (e) {
      console.error('[RAG] stop-build-index error:', e)
      return { success: false, error: e.message }
    }
  })

  // 手动触发知识库检索更新（设置页"更新索引"按钮）
  // 批量重建：清理已删除文件向量 + 重新索引未索引/已变更文件
  ipcMain.handle('rag-manual-update', async (_event, args) => {
    const { kbType } = args || {}
    try {
      const { triggerManualUpdate } = await import('./rag/triggers.js')
      const results = await triggerManualUpdate(kbType, (progress) => {
        mainWindow.webContents.send('rag-update-progress', progress)
      })
      mainWindow.webContents.send('rag-update-done', { results })
      return { success: true, results }
    } catch (e) {
      console.error('[RAG] manual-update error:', e)
      mainWindow.webContents.send('rag-update-done', { error: e.message })
      return { success: false, error: e.message }
    }
  })

  // 获取单个文件的索引状态
  // 返回值：'pending'/'processing'/'success'/'failed'（已入队或已索引）
  //         'not-indexed'（可索引但尚未建立索引）
  //         'excluded'（工作区/不可索引，不显示状态指示器）
  ipcMain.handle('rag-get-file-status', async (_event, args) => {
    const { filePath } = args
    if (!filePath) return { success: false, error: 'filePath required' }
    try {
      const { getFileIndexStatus, inferKbType } = await import('./rag/index.js')
      const kbType = inferKbType(filePath)
      if (!kbType) return { success: true, status: 'excluded' }
      const status = getFileIndexStatus(filePath)
      return { success: true, status: status ? status.index_status : 'not-indexed' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 批量获取文件索引状态
  ipcMain.handle('rag-get-batch-status', async (_event, args) => {
    const { filePaths } = args
    if (!filePaths || !Array.isArray(filePaths)) {
      return { success: false, error: 'filePaths required' }
    }
    try {
      const { getBatchFileIndexStatus } = await import('./rag/index.js')
      const statusMap = getBatchFileIndexStatus(filePaths)
      return { success: true, statusMap }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 获取知识库索引摘要
  ipcMain.handle('rag-get-kb-summary', async (_event, args) => {
    const { kbType } = args || {}
    try {
      const { getKbIndexSummary } = await import('./rag/index.js')
      if (kbType) {
        const summary = await getKbIndexSummary(kbType)
        return { success: true, summary: { [kbType]: summary } }
      }
      // 返回所有知识库摘要
      const { KB_TYPES } = await import('./rag/vectorstore.js')
      const allSummary = {}
      for (const type of KB_TYPES) {
        allSummary[type] = await getKbIndexSummary(type)
      }
      return { success: true, summary: allSummary }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 获取队列状态
  ipcMain.handle('rag-get-queue-stats', async (_event, args) => {
    const { kbType } = args || {}
    try {
      const { getQueueStats } = await import('./rag/queue.js')
      const stats = getQueueStats(kbType)
      return { success: true, stats }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 重试失败任务
  ipcMain.handle('rag-retry-failed', async (_event, args) => {
    const { kbType } = args || {}
    try {
      const { retryFailed } = await import('./rag/queue.js')
      retryFailed(kbType)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 清空指定知识库索引
  ipcMain.handle('rag-clear-kb-index', async (_event, args) => {
    const { kbType } = args
    if (!kbType) return { success: false, error: 'kbType required' }
    try {
      const { clearKbIndex } = await import('./rag/index.js')
      await clearKbIndex(kbType)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // RAG 知识检索：根据用户查询在知识库中检索相关内容
  // 流程：Zvec 向量检索 → 置信度过滤 → TOP 10 → 知识库/文件夹路径过滤 → 父块查表
  ipcMain.handle('rag-search', async (_event, args) => {
    const { query, kbName, kbCategoryId, topK, scoreThreshold, folderPath } = args || {}
    console.log(`[IPC] rag-search 收到请求: query="${query}", kbName="${kbName}", kbCategoryId="${kbCategoryId}", folderPath="${folderPath || ''}"`)
    if (!query) {
      console.warn(`[IPC] rag-search 缺少 query 参数`)
      return { success: false, error: 'query required', results: [] }
    }
    try {
      const { searchKnowledgeBase } = await import('./rag/index.js')
      const results = await searchKnowledgeBase(
        query,
        kbName || '',
        kbCategoryId || '',
        topK || 10,
        scoreThreshold || 0.5,
        folderPath || ''
      )
      console.log(`[IPC] rag-search 返回 ${results.length} 条结果`)
      return { success: true, results }
    } catch (e) {
      console.error('[IPC] rag-search 错误:', e)
      return { success: false, error: e.message, results: [] }
    }
  })

  // RAG 判断已移除：现在由 RAG Agent 通过 Function Calling 自主决定是否检索，
  // 不再需要单独的预判断请求。详见 llm.js 中的 streamChatWithRagAgent。

  // ========== 用量统计与余额查询 ==========
  // 获取 Token 用量统计：按时间范围（today/7d/30d/all）聚合
  ipcMain.handle('usage-get-stats', (_event, args) => {
    const range = (args && args.range) || 'all'
    try {
      return { success: true, data: getUsageStats(range) }
    } catch (e) {
      console.error('[IPC] usage-get-stats 错误:', e)
      return { success: false, error: e.message, data: null }
    }
  })

  // 清空所有用量记录
  ipcMain.handle('usage-clear', () => {
    try {
      clearUsage()
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 查询单个模型的账户余额（仅支持部分厂商）
  ipcMain.handle('model-query-balance', async (_event, args) => {
    const model = args && args.model
    if (!model) {
      return { success: false, error: '缺少 model 参数' }
    }
    try {
      const data = await queryBalance(model)
      return { success: true, data }
    } catch (e) {
      console.error('[IPC] model-query-balance 错误:', e)
      return { success: false, error: e.message, data: null }
    }
  })

  // ========== Local DeepAgent automation ==========
  ipcMain.handle('automation-list-tasks', () => db.getAutomationTasks())
  ipcMain.handle('automation-list-runs', (_event, filters) => db.getAutomationRuns(filters || {}))
  ipcMain.handle('automation-get-active-run', (_event, args) => {
    if (!args?.runId) throw new Error('缺少执行记录 ID')
    return getActiveAutomationRun(args.runId)
  })
  ipcMain.handle('automation-create-task', (_event, args) => createAutomationTask(args || {}))
  ipcMain.handle('automation-update-task', (_event, args) => {
    if (!args?.taskId) throw new Error('缺少任务 ID')
    return updateAutomationTask(args.taskId, args)
  })
  ipcMain.handle('automation-delete-task', (_event, args) => {
    if (!args?.taskId) throw new Error('缺少任务 ID')
    db.deleteAutomationTask(args.taskId)
    return { ok: true }
  })
  ipcMain.handle('automation-delete-run', (_event, args) => {
    if (!args?.runId) throw new Error('缺少执行记录 ID')
    if (isAutomationRunActive(args.runId)) return { ok: false, error: '任务正在执行，无法删除执行记录' }
    const deleted = db.deleteAutomationRun(args.runId)
    if (deleted) mainWindow.webContents.send('automation-updated')
    return { ok: deleted }
  })
  ipcMain.handle('automation-run-task', async (_event, args) => {
    if (!args?.taskId) throw new Error('缺少任务 ID')
    if (!db.getAutomationTask(args.taskId)) throw new Error('自动化任务不存在')
    if (isAutomationTaskRunning(args.taskId)) return { ok: false, error: '任务正在执行' }
    runAutomationTaskNow(args.taskId).catch(error => {
      console.error('[Automation] 手动执行任务失败:', error)
    })
    return { ok: true }
  })

  // ========== Agent 智能体相关命令 ==========
  // 设计参考：src/views/knowledge/agent/Agent智能体设计.md
  // Agent 模式提供工具调用能力（知识检索、笔记/日程操作、文件操作），
  // 支持 HITL 审批。会话复用 sessions 表，与普通对话历史一致。
  registerAgentCommands(mainWindow)
  registerHarnessCommands(mainWindow)

  console.log('[Commands] ✅ All IPC handlers registered successfully')
}
