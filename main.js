import { app, BrowserWindow, ipcMain, Menu, powerSaveBlocker } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { setDataDir as setConfigDataDir } from './src-electron/config.js'
import { setDataDir as setDbDataDir, initDb, closeDb } from './src-electron/db.js'
import { registerCommands } from './src-electron/commands.js'
import { ensureDefaultAvatar } from './src-electron/avatar.js'
import { checkAutoBackup } from './src-electron/backup.js'
import { checkAutoCleanHistory } from './src-electron/historyClean.js'
import { initPythonEnv } from './src-electron/python-env.js'
import { startKnowledgeWatcher } from './src-electron/fileWatcher.js'
import { initLogger, setLoggingEnabled } from './src-electron/logger.js'
import { startShareServer, stopShareServer } from './src-electron/shareServer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

// 禁止渲染进程后台化，避免窗口失焦/被遮挡时被系统挂起，切回时卡顿
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

// macOS：禁用窗口遮挡检测，避免被遮挡窗口进入 AppNap 低功耗状态
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

if (isDev) {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
  app.setPath('userData', path.join(__dirname, 'app-data', 'electron-user-data'))
}

// 尽早初始化文件日志器，接管 console.* 与未捕获异常，
// 将运行日志落盘到数据目录，便于安装后排查异常。
// 必须在 app.whenReady 之前同步执行，以捕获后续所有模块的输出。
initLogger(
  isDev ? path.join(__dirname, 'app-data') : app.getPath('userData')
)

let mainWindow = null
let kbWatcherHandle = null
let powerBlockerId = null

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
      backgroundThrottling: false,
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

  // 阻止操作系统将应用挂起
  // - macOS：阻止 AppNap 导致的进程冻结
  // - Windows：阻止 Power Throttling 对后台进程的 CPU 限流
  // - Linux：通过 D-Bus inhibit 阻止桌面环境挂起应用
  powerBlockerId = powerSaveBlocker.start('prevent-app-suspension')

  // 2. 初始化数据目录与数据库（sql.js WASM 加载），期间 splash 持续显示
  //    渲染进程加载 JS bundle + Vue mount 通常比此处更慢，IPC 注册会先于首次 invoke 完成
  const dataDir = await ensureDataDir()
  // 读取持久化配置后应用日志开关，兼容升级前已存在的配置文件。
  try {
    const configPath = path.join(dataDir, 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    setLoggingEnabled(config.runtimeLogsEnabled !== false)
  } catch (e) {
    console.warn('[Main] Failed to apply runtime log setting:', e.message)
  }

  // 首次启动时为未设置头像的用户随机分配 5 个普通头像（稀有头像不参与默认分配）
  // 需在数据目录初始化后、IPC 注册前完成，确保前端首次 get-config 即可拿到头像
  ensureDefaultAvatar()

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

  // 启动后检查对话历史自动清理（异步，至多每天一次，不阻塞窗口）
  checkAutoCleanHistory().catch(e => console.error('[Main] Auto history clean check failed:', e))

  // 启动内网分享服务（只读 HTTP，供局域网浏览器查看对话）
  startShareServer().catch(e => console.error('[Main] Share server failed to start:', e))

  // 若用户曾开启本机 MCP 服务，则自动拉起（异步，不阻塞窗口）
  import('./src-electron/agent/mcp.js')
    .then(({ autoStartLocalIfEnabled }) => autoStartLocalIfEnabled())
    .then(() => console.log('[Main] ✅ MCP module initialized'))
    .catch(error => console.error('[Main] ❌ Failed to initialize MCP:', error))

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
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId)
    powerBlockerId = null
  }
  stopShareServer()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前关闭 Agent MCP 连接（stdio 子进程等），避免残留进程
app.on('before-quit', () => {
  import('./src-electron/agent/mcp.js')
    .then(({ closeAgentMcpConnections }) => closeAgentMcpConnections())
    .catch(() => {})
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
