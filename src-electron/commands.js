import { ipcMain, shell, dialog } from 'electron'
import { CancellationTokens } from './cancellation.js'
import { loadConfig, saveConfig } from './config.js'
import * as db from './db.js'
import { streamChat, generateTitle, streamNoteAI, fimCompletion } from './llm.js'
import { exportHtmlToPdf, exportMarkdown } from './pdf.js'
import { runPython, runPythonStreaming, checkPython, getPythonPath } from './python.js'
import { CONFIG_CHANGED, CHAT_DONE, SESSION_TITLE_UPDATED, NOTE_AI_DONE, NOTE_FIM_RESULT } from './events.js'

const cancelTokens = new CancellationTokens()

export function registerCommands(mainWindow) {
  console.log('[Commands] Starting to register all IPC handlers...')

  ipcMain.handle('get-config', () => {
    return loadConfig()
  })

  ipcMain.handle('save-config', (_event, config) => {
    const result = saveConfig(config)
    mainWindow.webContents.send(CONFIG_CHANGED, config)
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
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || []
    })
    return result.filePaths.length > 0 ? result.filePaths[0] : null
  })

  ipcMain.handle('get_sessions', () => {
    return db.getSessions()
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
    db.deleteSession(args.sessionId)
    return true
  })

  ipcMain.handle('get_session_messages', (_event, args) => {
    return db.getMessages(args.sessionId)
  })

  ipcMain.handle('save_message', (_event, args) => {
    return db.saveMessage(args.sessionId, args.role, args.content)
  })

  ipcMain.handle('rollback_session', (_event, args) => {
    db.rollbackSession(args.sessionId, args.messageId)
    return true
  })

  ipcMain.handle('chat_with_memory', async (_event, args) => {
    const { requestId, sessionId, model, message, enableThinking, systemPrompt } = args

    let currentSessionId = sessionId
    let isNewSession = false
    let userMessageId = null

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

    const userMsg = db.saveMessage(currentSessionId, 'user', message)
    userMessageId = userMsg.id
    db.updateSessionTimestamp(currentSessionId)

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
            title
          })
        } catch (_e) {
        }
      })
    }

    const dbMessages = db.getMessages(currentSessionId)
    const historyMessages = dbMessages.map(m => ({
      role: m.role,
      content: m.content
    }))

    const appConfig = loadConfig()
    const effectiveSystemPrompt = systemPrompt || appConfig.systemPrompt
    const allMessages = [
      { role: 'system', content: effectiveSystemPrompt },
      ...historyMessages
    ]

    const cancelToken = cancelTokens.insert(requestId)

    let fullContent = ''
    let fullReasoning = ''

    try {
      const result = await streamChat(
        mainWindow,
        allMessages,
        model,
        requestId,
        currentSessionId,
        enableThinking || false,
        cancelToken
      )
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
  })

  ipcMain.handle('chat_without_memory', async (_event, args) => {
    const { requestId, model, message, enableThinking } = args

    const appConfig = loadConfig()
    const messages = [
      { role: 'system', content: appConfig.systemPrompt },
      { role: 'user', content: message }
    ]

    const cancelToken = cancelTokens.insert(requestId)

    let fullContent = ''
    let fullReasoning = ''

    try {
      const result = await streamChat(
        mainWindow,
        messages,
        model,
        requestId,
        null,
        enableThinking || false,
        cancelToken
      )
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
    return db.updateNote(args.noteId, args.title, args.content, args.contentText, args.notebookId)
  })

  ipcMain.handle('delete_note', (_event, args) => {
    return db.softDeleteNote(args.noteId)
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

    const cancelToken = cancelTokens.insert(requestId)

    let fullContent = ''

    try {
      const result = await streamNoteAI(
        mainWindow,
        action,
        noteContent,
        selectedText,
        model,
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

    const cancelToken = cancelTokens.insert(requestId)

    try {
      const result = await fimCompletion(model, prefix, suffix, cancelToken)
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
    const token = cancelTokens.get(args.requestId)
    if (token && token._abortController) {
      token._abortController.abort()
    }
    cancelTokens.cancel(args.requestId)
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

  console.log('[Commands] ✅ All IPC handlers registered successfully')
}
