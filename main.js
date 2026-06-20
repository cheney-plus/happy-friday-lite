import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { setDataDir as setConfigDataDir } from './src-electron/config.js'
import { setDataDir as setDbDataDir, initDb, closeDb } from './src-electron/db.js'
import { registerCommands } from './src-electron/commands.js'
import { checkAutoBackup } from './src-electron/backup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

if (isDev) {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
  app.setPath('userData', path.join(__dirname, 'app-data', 'electron-user-data'))
}

let mainWindow = null

async function ensureDataDir() {
  const dataDir = isDev
    ? path.join(__dirname, 'app-data')
    : app.getPath('userData')

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  } catch (e) {
    console.error('Failed to create data directory:', e)
  }

  setConfigDataDir(dataDir)
  setDbDataDir(dataDir)
  await initDb()

  return dataDir
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } } : { frame: false }),
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  Menu.setApplicationMenu(null)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await ensureDataDir()
  createWindow()

  console.log('[Main] Registering IPC commands...')
  try {
    registerCommands(mainWindow)
    console.log('[Main] ✅ IPC commands registered successfully')
  } catch (error) {
    console.error('[Main] ❌ Failed to register IPC commands:', error)
  }

  // 初始化 RAG 模块（注册任务处理器、启动队列、可选启动时自动更新）
  try {
    const { initRag } = await import('./src-electron/rag/triggers.js')
    await initRag((channel, data) => mainWindow.webContents.send(channel, data))
    console.log('[Main] ✅ RAG module initialized')
  } catch (error) {
    console.error('[Main] ❌ Failed to initialize RAG:', error)
  }

  // 启动后检查自动备份（异步，不阻塞窗口）
  checkAutoBackup().catch(e => console.error('[Main] Auto backup check failed:', e))

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', function () {
  closeDb()
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
