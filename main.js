import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { setDataDir as setConfigDataDir } from './src-electron/config.js'
import { setDataDir as setDbDataDir, initDb, closeDb } from './src-electron/db.js'
import { registerCommands } from './src-electron/commands.js'
import { checkAutoBackup } from './src-electron/backup.js'
import { initPythonEnv } from './src-electron/python-env.js'
import { startKnowledgeWatcher } from './src-electron/fileWatcher.js'

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
let kbWatcherHandle = null

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
  // 1. 先创建窗口，让 splash 立即显示（窗口加载 index.html 与主进程初始化并行）
  createWindow()

  // 2. 初始化数据目录与数据库（sql.js WASM 加载），期间 splash 持续显示
  //    渲染进程加载 JS bundle + Vue mount 通常比此处更慢，IPC 注册会先于首次 invoke 完成
  const dataDir = await ensureDataDir()

  console.log('[Main] Registering IPC commands...')
  try {
    registerCommands(mainWindow)
    console.log('[Main] ✅ IPC commands registered successfully')
  } catch (error) {
    console.error('[Main] ❌ Failed to register IPC commands:', error)
  }

  // 3. 启动知识库目录监听（用于外部文件变更时自动刷新前端视图）
  try {
    kbWatcherHandle = startKnowledgeWatcher(mainWindow, dataDir)
  } catch (e) {
    console.error('[Main] ❌ Failed to start knowledge watcher:', e)
  }

  // 注册"动态监听当前浏览目录"IPC（Linux 不支持 recursive 监听，需前端切换目录时通知后端）
  ipcMain.handle('kb-watch-current-dir', (_event, args) => {
    if (kbWatcherHandle && args && args.dirPath) {
      try {
        kbWatcherHandle.watchCurrentDir(args.dirPath)
      } catch (e) {
        console.warn('[Main] watchCurrentDir error:', e?.message || e)
      }
    }
    return { success: true }
  })

  // 4. 以下均为非阻塞初始化，不等待完成
  // Python 运行时（macOS 优先检测系统 Python，其他平台使用打包 Python）
  initPythonEnv().catch(e => console.error('[Main] ❌ Python env init failed:', e))

  // RAG 模块（注册任务处理器、启动队列、可选启动时自动更新）——非阻塞，避免拖慢主流程
  import('./src-electron/rag/triggers.js')
    .then(({ initRag }) => initRag((channel, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data)
      }
    }))
    .then(() => console.log('[Main] ✅ RAG module initialized'))
    .catch(error => console.error('[Main] ❌ Failed to initialize RAG:', error))

  // 启动后检查自动备份（异步，不阻塞窗口）
  checkAutoBackup().catch(e => console.error('[Main] Auto backup check failed:', e))

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', function () {
  if (kbWatcherHandle) {
    kbWatcherHandle.close()
    kbWatcherHandle = null
  }
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
