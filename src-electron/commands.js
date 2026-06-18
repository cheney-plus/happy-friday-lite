import { ipcMain, shell, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { CancellationTokens } from './cancellation.js'
import { loadConfig, saveConfig, getDataDir } from './config.js'
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
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stat.size,
            modifiedTime: stat.mtime.toISOString()
          }
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

        if (nameLower.includes(lowerQuery)) {
          let stat
          try { stat = fs.statSync(fullPath) } catch (e) { continue }
          // 对文件进行扩展名过滤
          if (!entry.isDirectory()) {
            const ext = entry.name.split('.').pop().toLowerCase()
            if (allowedExtensions && allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
              // 不匹配白名单，跳过
            } else {
              results.push({
                name: entry.name,
                path: fullPath,
                relativePath: relPath,
                isDirectory: false,
                size: stat.size,
                modifiedTime: stat.mtime.toISOString()
              })
            }
          } else {
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              isDirectory: true,
              size: 0,
              modifiedTime: stat.mtime.toISOString()
            })
          }
        }

        if (entry.isDirectory()) {
          walk(fullPath, relPath)
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

  // 抓取网页 HTML 并保存到指定目录
  ipcMain.handle('kb-save-webpage', async (_event, args) => {
    const { url, destDir } = args
    if (!url || !destDir) return { success: false, error: 'Missing parameters' }
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

      let html = await response.text()

      // 从 URL 提取文件名
      const urlObj = new URL(fetchUrl)

      // 注入 <base> 标签，使相对路径（图片、CSS等）能正确解析到原网站
      const baseUrl = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1)
      const baseTag = `<base href="${baseUrl}">`
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, match => match + baseTag)
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(/<html[^>]*>/i, match => match + `<head>${baseTag}</head>`)
      } else {
        html = baseTag + html
      }
      let baseName = urlObj.pathname.split('/').filter(Boolean).pop() || urlObj.hostname
      // 移除可能的查询参数
      baseName = baseName.split('?')[0].split('#')[0]
      // 移除扩展名（后续统一加 .html）
      baseName = baseName.replace(/\.[^/.]+$/, '')
      // 清理非法文件名字符
      baseName = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || urlObj.hostname
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

      fs.writeFileSync(filePath, html, 'utf-8')
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

  console.log('[Commands] ✅ All IPC handlers registered successfully')
}
