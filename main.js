import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

let dataDir

function ensureDataDir() {
  dataDir = path.join(__dirname, 'app-data')
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  } catch (e) {
    console.error('Failed to create data directory:', e)
  }
}

function readJsonFile(filename) {
  const filePath = path.join(dataDir, filename)
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.error(`Failed to read ${filename}:`, e)
    return null
  }
}

function writeJsonFile(filename, data) {
  const filePath = path.join(dataDir, filename)
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error(`Failed to write ${filename}:`, e)
    return false
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

if (isDev) {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
  app.setPath('userData', path.join(__dirname, 'app-data', 'electron-user-data'))
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

ipcMain.handle('save-file-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath,
    filters: options?.filters || []
  })
  return result.filePath || null
})

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || []
  })
  return result.filePaths.length > 0 ? result.filePaths[0] : null
})

ipcMain.handle('get-config', () => {
  return readJsonFile('config.json') || { language: 'zh-CN', theme: 'light' }
})

ipcMain.handle('save-config', (event, config) => {
  return writeJsonFile('config.json', config)
})

ipcMain.handle('get_notes', (event, args) => {
  const data = readJsonFile('notes.json') || []
  if (args?.knowledgeBaseId) {
    return data.filter(n => n.knowledgeBaseId === args.knowledgeBaseId && !n.isDeleted)
  }
  return data.filter(n => !n.isDeleted)
})

ipcMain.handle('get_note', (event, args) => {
  const data = readJsonFile('notes.json') || []
  return data.find(n => n.id === args.noteId && !n.isDeleted) || null
})

ipcMain.handle('create_note', (event, args) => {
  const data = readJsonFile('notes.json') || []
  const now = new Date().toISOString()
  const note = {
    id: generateId(),
    knowledgeBaseId: args?.knowledgeBaseId || null,
    title: args?.title || '新建笔记',
    content: '',
    contentText: '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  }
  data.unshift(note)
  writeJsonFile('notes.json', data)
  return note
})

ipcMain.handle('update_note', (event, args) => {
  const data = readJsonFile('notes.json') || []
  const idx = data.findIndex(n => n.id === args.noteId)
  if (idx >= 0) {
    if (args.title !== undefined) data[idx].title = args.title
    if (args.content !== undefined) data[idx].content = args.content
    if (args.contentText !== undefined) data[idx].contentText = args.contentText
    data[idx].updatedAt = new Date().toISOString()
    writeJsonFile('notes.json', data)
    return data[idx]
  }
  return null
})

ipcMain.handle('delete_note', (event, args) => {
  const data = readJsonFile('notes.json') || []
  const idx = data.findIndex(n => n.id === args.noteId)
  if (idx >= 0) {
    data[idx].isDeleted = true
    data[idx].updatedAt = new Date().toISOString()
    writeJsonFile('notes.json', data)
    return true
  }
  return false
})

ipcMain.handle('search_notes', (event, args) => {
  const data = readJsonFile('notes.json') || []
  const query = (args?.query || '').toLowerCase()
  return data.filter(n =>
    !n.isDeleted &&
    (n.title.toLowerCase().includes(query) || n.contentText.toLowerCase().includes(query))
  )
})

ipcMain.handle('get_schedule_events', () => {
  return readJsonFile('schedule_events.json') || []
})

ipcMain.handle('create_schedule_event', (event, args) => {
  const data = readJsonFile('schedule_events.json') || []
  const now = new Date().toISOString()
  const newEvent = {
    id: generateId(),
    title: args.title || '',
    start: args.startDate || '',
    end: args.endDate || '',
    startTime: args.startTime || '',
    endTime: args.endTime || '',
    allDay: args.allDay || false,
    description: args.description || '',
    color: args.color || '#60a5fa',
    reminder: args.reminder || false,
    completed: args.completed || false,
    createdAt: now,
    updatedAt: now
  }
  data.push(newEvent)
  writeJsonFile('schedule_events.json', data)
  return newEvent
})

ipcMain.handle('update_schedule_event', (event, args) => {
  const data = readJsonFile('schedule_events.json') || []
  const idx = data.findIndex(e => e.id === args.eventId)
  if (idx >= 0) {
    if (args.title !== undefined) data[idx].title = args.title
    if (args.startDate !== undefined) data[idx].start = args.startDate
    if (args.endDate !== undefined) data[idx].end = args.endDate
    if (args.startTime !== undefined) data[idx].startTime = args.startTime
    if (args.endTime !== undefined) data[idx].endTime = args.endTime
    if (args.allDay !== undefined) data[idx].allDay = args.allDay
    if (args.description !== undefined) data[idx].description = args.description
    if (args.color !== undefined) data[idx].color = args.color
    if (args.reminder !== undefined) data[idx].reminder = args.reminder
    if (args.completed !== undefined) data[idx].completed = args.completed
    data[idx].updatedAt = new Date().toISOString()
    writeJsonFile('schedule_events.json', data)
    return data[idx]
  }
  return null
})

ipcMain.handle('delete_schedule_event', (event, args) => {
  let data = readJsonFile('schedule_events.json') || []
  data = data.filter(e => e.id !== args.eventId)
  writeJsonFile('schedule_events.json', data)
  return true
})

ipcMain.handle('get_sessions', () => {
  const data = readJsonFile('sessions.json') || []
  return data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
})

ipcMain.handle('get_session', (event, args) => {
  const data = readJsonFile('sessions.json') || []
  return data.find(s => s.id === args.sessionId) || null
})

ipcMain.handle('get_session_messages', (event, args) => {
  const data = readJsonFile('messages.json') || []
  return data
    .filter(m => m.session_id === args.sessionId)
    .sort((a, b) => a.id - b.id)
})

ipcMain.handle('create_session', (event, args) => {
  const data = readJsonFile('sessions.json') || []
  const now = new Date().toISOString()
  const session = {
    id: args?.id || generateId(),
    title: args?.title || '新对话',
    createdAt: now,
    updatedAt: now
  }
  data.push(session)
  writeJsonFile('sessions.json', data)
  return session
})

ipcMain.handle('update_session_title', (event, args) => {
  const data = readJsonFile('sessions.json') || []
  const idx = data.findIndex(s => s.id === args.sessionId)
  if (idx >= 0) {
    data[idx].title = args.title
    data[idx].updatedAt = new Date().toISOString()
    writeJsonFile('sessions.json', data)
    return true
  }
  return false
})

ipcMain.handle('delete_session', (event, args) => {
  let sessions = readJsonFile('sessions.json') || []
  sessions = sessions.filter(s => s.id !== args.sessionId)
  writeJsonFile('sessions.json', sessions)

  let messages = readJsonFile('messages.json') || []
  messages = messages.filter(m => m.session_id !== args.sessionId)
  writeJsonFile('messages.json', messages)
  return true
})

ipcMain.handle('save_message', (event, args) => {
  const data = readJsonFile('messages.json') || []
  const now = new Date().toISOString()
  const message = {
    id: args.id || data.length + 1,
    session_id: args.sessionId,
    role: args.role,
    content: args.content,
    reasoning: args.reasoning || null,
    created_at: now
  }
  data.push(message)
  writeJsonFile('messages.json', data)
  return message
})

ipcMain.handle('rollback_session', (event, args) => {
  let data = readJsonFile('messages.json') || []
  data = data.filter(m => !(m.session_id === args.sessionId && m.id >= args.messageId))
  writeJsonFile('messages.json', data)
  return true
})

ipcMain.handle('chat_with_memory', async (event, args) => {
  const { requestId, sessionId, model, message, enableThinking } = args

  let currentSessionId = sessionId
  if (!currentSessionId) {
    const session = await ipcMain.invoke('create_session', { title: message.slice(0, 20) || '新对话' })
    currentSessionId = session.id
    mainWindow.webContents.send('chat-done', {
      requestId,
      sessionId: currentSessionId,
      fullContent: '',
      reasoningContent: '',
      messageId: null,
      userMessageId: null
    })
    return { sessionId: currentSessionId }
  }

  const messages = readJsonFile('messages.json') || []
  const userMsgId = messages.length + 1
  const now = new Date().toISOString()
  messages.push({
    id: userMsgId,
    session_id: currentSessionId,
    role: 'user',
    content: message,
    reasoning: null,
    created_at: now
  })
  writeJsonFile('messages.json', messages)

  const replyContent = `[模拟回复] 收到您的消息：${message}\n\n当前为本地模式，AI 对话功能需要配置模型 API 后使用。请在设置中添加模型配置。`
  const assistantMsgId = userMsgId + 1
  messages.push({
    id: assistantMsgId,
    session_id: currentSessionId,
    role: 'assistant',
    content: replyContent,
    reasoning: null,
    created_at: new Date().toISOString()
  })
  writeJsonFile('messages.json', messages)

  const sessions = readJsonFile('sessions.json') || []
  const sessionIdx = sessions.findIndex(s => s.id === currentSessionId)
  if (sessionIdx >= 0) {
    sessions[sessionIdx].updatedAt = new Date().toISOString()
    writeJsonFile('sessions.json', sessions)
  }

  mainWindow.webContents.send('chat-chunk', {
    requestId,
    sessionId: currentSessionId,
    content: replyContent
  })

  mainWindow.webContents.send('chat-done', {
    requestId,
    sessionId: currentSessionId,
    fullContent: replyContent,
    reasoningContent: '',
    messageId: assistantMsgId,
    userMessageId: userMsgId
  })

  return { sessionId: currentSessionId }
})

ipcMain.handle('chat_without_memory', async (event, args) => {
  const { requestId, model, message, enableThinking } = args

  const replyContent = `[模拟回复] 收到您的消息：${message}\n\n当前为本地模式，AI 对话功能需要配置模型 API 后使用。请在设置中添加模型配置。`

  mainWindow.webContents.send('chat-chunk', {
    requestId,
    content: replyContent
  })

  mainWindow.webContents.send('chat-done', {
    requestId,
    fullContent: replyContent,
    reasoningContent: '',
    messageId: null,
    userMessageId: null
  })

  return {}
})

ipcMain.handle('stop_chat', () => {
  return true
})

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url)
  return true
})
