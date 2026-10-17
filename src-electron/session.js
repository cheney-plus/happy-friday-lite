import fs from 'fs'
import path from 'path'
import { ipcMain } from 'electron'

// 会话状态持久化（标签页布局等）：写入数据目录 session.json
let sessionPath = null

export function initSession(dataDir) {
  sessionPath = path.join(dataDir, 'session.json')
}

function readSession() {
  if (!sessionPath) return {}
  try {
    if (!fs.existsSync(sessionPath)) return {}
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
  } catch (e) {
    console.warn('[Session] Failed to read session:', e.message)
    return {}
  }
}

function writeSession(state) {
  if (!sessionPath || !state || typeof state !== 'object') return
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[Session] Failed to write session:', e.message)
  }
}

export function registerSessionIpc() {
  ipcMain.handle('session-get', () => readSession())
  ipcMain.handle('session-save', (_event, state) => {
    writeSession(state)
    return { success: true }
  })
  // 窗口关闭前的兜底同步保存（fire-and-forget，不等待渲染层）
  ipcMain.on('session-save-sync', (_event, state) => {
    writeSession(state)
  })
}
