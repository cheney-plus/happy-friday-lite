import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { app, dialog, ipcMain, shell } from 'electron'
import XLSX from 'xlsx'
import { registerOfficeAiBridge } from './office-ai-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

/**
 * Office Host（主进程适配层）。
 *
 * 复用上游 happyoffice 各编辑器的主进程模块（docs/sheets/slides/pdf-main），
 * 以 WebContentsView 形式挂载到当前唯一 BrowserWindow 上。同一种编辑器可并存
 * 多个视图（多 Tab），每个视图以 viewId（如 'docs-1'）唯一标识，与前端
 * /office/<type>/<instId> 路由 Tab 一一对应；文件内容由上游模块自带的 IPC 与
 * renderer 自行管理。
 */

const EDITORS = ['docs', 'sheets', 'slides', 'pdf']

const EXT_TO_TYPE = {
  '.docx': 'docs',
  '.xlsx': 'sheets',
  '.xlsm': 'sheets',
  '.csv': 'sheets',
  '.pptx': 'slides',
  '.pdf': 'pdf',
}

const state = {
  mainWindow: null,
  bundles: null,
  // 打开的编辑器视图：viewId（'docs-1'）→ { viewId, type, view, filePath }
  views: new Map(),
  // viewId 自增序号（跨类型全局，保证唯一）
  seq: 0,
  // renderer 提供的编辑器视图摆放区域（窗口内容区坐标），未设置时回退全宽布局
  contentBounds: null,
  // 当前可见的 viewId（Electron 42 View 无 isVisible()，需自行维护）
  visibleId: null,
  // 编辑器内 HTML5 全屏（如 Slides 放映）状态：整个应用窗口进入系统全屏
  htmlFullScreen: false,
  wasWindowFullScreen: false,
  initialized: false,
}

let savedEventSubscribers = []

export function onOfficeFileSaved(fn) {
  savedEventSubscribers.push(fn)
}

function officeRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'office')
    : path.join(__dirname, '..', '..', 'resources', 'office')
}

let protocolInstaller = null

// genoffice-app:// 渲染协议必须在 app ready 前注册为特权协议
// （本模块在 main.js 顶部被导入，早于 app.whenReady）
try {
  const officeUtils = _require(path.join(officeRoot(), 'main', 'office-utils.cjs'))
  officeUtils.registerRendererScheme()
  protocolInstaller = officeUtils
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    console.warn('[Office] renderer scheme registration skipped:', e.message)
  }
}

export function isOfficeAvailable() {
  return fs.existsSync(path.join(officeRoot(), 'main', 'docs-main.cjs'))
}

function editorPaths(editor) {
  const root = officeRoot()
  return {
    preloadPath: path.join(root, editor, 'preload', 'index.js'),
    rendererFile: path.join(root, editor, 'renderer', 'index.html'),
    bundlePath: path.join(root, 'main', `${editor}-main.cjs`),
  }
}

/** 加载四个上游编辑器主进程 bundle（每个 bundle 自包含其 workspace 依赖） */
async function loadBundles() {
  const bundles = {}
  for (const editor of EDITORS) {
    const { bundlePath } = editorPaths(editor)
    if (!fs.existsSync(bundlePath)) {
      console.warn(`[Office] bundle missing: ${bundlePath}`)
      continue
    }
    const mod = await import(`file://${bundlePath}`)
    bundles[editor] = mod.default ?? mod
  }
  return bundles
}

/**
 * 上游多个编辑器会注册同名 IPC 通道（如 ai:*、app:get-language）。
 * 默认重复注册会抛异常导致后面的处理器丢失，这里改为"后注册者替换"。
 */
function tolerateDuplicateIpcHandlers() {
  if (ipcMain.handle.__officePatched) return
  const rawHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel, listener) => {
    try {
      ipcMain.removeHandler(channel)
    } catch {
      /* channel not registered yet */
    }
    return rawHandle(channel, listener)
  }
  ipcMain.handle.__officePatched = true
}

function configureRuntimes() {
  const { docs, sheets, slides, pdf } = state.bundles
  const root = officeRoot()

  docs.configureDocsRuntime({
    preloadPath: editorPaths('docs').preloadPath,
    rendererFile: editorPaths('docs').rendererFile,
  })

  const sidecarPath = path.join(root, 'sheets', 'sidecar', process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar')
  sheets.configureSheetsRuntime({
    preloadPath: editorPaths('sheets').preloadPath,
    rendererFile: editorPaths('sheets').rendererFile,
    sidecarPath: fs.existsSync(sidecarPath) ? sidecarPath : undefined,
    // 上游"在生成的文件所在 tab 打开"的回调：在我们这里始终打开对应编辑器
    // （新视图 + 通知前端创建/跳转对应 Tab）
    openGeneratedPath: (p) => {
      openOfficeFile(p, { notifyOpened: true })
      return true
    },
  })

  slides.configureSlidesRuntime({
    preloadPath: editorPaths('slides').preloadPath,
    rendererFilePath: editorPaths('slides').rendererFile,
    openGeneratedPath: (p) => {
      openOfficeFile(p, { notifyOpened: true })
      return true
    },
  })

  pdf.configurePdfRuntime({
    preloadPath: editorPaths('pdf').preloadPath,
    rendererFile: editorPaths('pdf').rendererFile,
    openGeneratedPath: (p) => {
      openOfficeFile(p, { notifyOpened: true })
      return true
    },
  })
}

function registerEditorIpc() {
  const { docs, sheets, slides } = state.bundles
  // ai:* / project:* / app:get-language 等重复通道由 tolerateDuplicateIpcHandlers 兜底
  try { docs.registerAiIpc?.() } catch (e) { console.warn('[Office] docs registerAiIpc:', e.message) }
  try { docs.registerProjectIpc?.() } catch (e) { console.warn('[Office] docs registerProjectIpc:', e.message) }
  try { docs.registerDocsIpc() } catch (e) { console.warn('[Office] registerDocsIpc:', e.message) }
  try { sheets.registerSheetsIpc() } catch (e) { console.warn('[Office] registerSheetsIpc:', e.message) }
  try { slides.registerSlidesIpc() } catch (e) { console.warn('[Office] registerSlidesIpc:', e.message) }
  // Friday 接管编辑器 ai:* 通道（须在编辑器注册之后，后注册者覆盖）
  registerOfficeAiBridge()
}

function wireShellHooks() {
  const { docs, sheets, slides } = state.bundles
  const win = state.mainWindow

  docs.setDocsShellWindow?.(win)
  sheets.setSheetsShellWindow?.(win)
  slides.setSlidesShellWindow?.(win)

  // 保存/另存为/首次保存 → 同步视图条目状态并通知知识库与 RAG
  docs.setDocsFileSavedHook?.((wc, filePath) => {
    const entry = entryByWebContents(wc)
    if (entry) entry.filePath = filePath
    emitFileSaved('docs', filePath, entry?.viewId)
  })
  docs.setDocsFileOpenedHook?.((wcArg, filePath) => {
    const entry = entryByWebContents(wcArg)
    if (entry) entry.filePath = filePath
  })
  sheets.setSheetsWorkbookOpenedHook?.((wc, filePath) => {
    const entry = entryByWebContents(wc)
    if (entry) entry.filePath = filePath
    // 最近文件统一记录在 docs bundle 的 recents 存储中
    try { docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
    emitFileSaved('sheets', filePath, entry?.viewId)
  })
  slides.setSlidesOpenedHook?.((wc, filePath) => {
    const entry = entryByWebContents(wc)
    if (entry) entry.filePath = filePath
    try { docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
    emitFileSaved('slides', filePath, entry?.viewId)
  })
  // PDF 编辑器无 opened hook，openOfficeFile 内统一补记
}

function emitFileSaved(type, filePath, viewId) {
  if (!filePath) return
  for (const fn of savedEventSubscribers) {
    try { fn(type, filePath, viewId) } catch (e) { console.warn('[Office] file-saved hook error:', e) }
  }
}

// ---- 视图布局与生命周期 -------------------------------------------------------

function contentBounds() {
  if (state.contentBounds) return { ...state.contentBounds }
  const { width, height } = state.mainWindow.getContentBounds()
  return {
    x: 0,
    y: 44,
    width,
    height: Math.max(0, height - 44),
  }
}

/** HTML5 全屏（如 Slides 放映）时编辑器视图占满整个窗口内容区（盖住 TabBar/侧栏） */
function fullContentBounds() {
  const { width, height } = state.mainWindow.getContentBounds()
  return { x: 0, y: 0, width, height }
}

function layout() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  // 注意：Electron 42 的 View 没有 isVisible()，可见性由 visibleId 自行维护
  const entry = state.visibleId ? state.views.get(state.visibleId) : null
  if (entry && !entry.view.webContents.isDestroyed()) {
    entry.view.setBounds(state.htmlFullScreen ? fullContentBounds() : contentBounds())
  }
}

/** 进入编辑器全屏放映：应用窗口切换为系统全屏（整屏放映，视图盖住 TabBar/侧栏）。
 *  macOS 用 setSimpleFullScreen（与上游 slides 一致，瞬时全屏，无 Space 动画）；
 *  Windows/Linux 走常规 setFullScreen。 */
function enterHtmlFullScreen() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  state.wasWindowFullScreen =
    state.mainWindow.isFullScreen() || (state.mainWindow.isSimpleFullScreen?.() ?? false)
  state.htmlFullScreen = true
  try {
    if (!state.wasWindowFullScreen) {
      if (process.platform === 'darwin' && !state.mainWindow.isFullScreen()) {
        state.mainWindow.setFullScreenable(false)
        state.mainWindow.setSimpleFullScreen(true)
      } else {
        state.mainWindow.setFullScreen(true)
      }
    }
  } catch { /* ignore */ }
  layout()
}

/** 退出编辑器全屏放映：恢复窗口状态与视图边界 */
function leaveHtmlFullScreen() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  state.htmlFullScreen = false
  try {
    if (!state.wasWindowFullScreen) {
      if (process.platform === 'darwin') {
        if (state.mainWindow.isSimpleFullScreen?.()) state.mainWindow.setSimpleFullScreen(false)
        state.mainWindow.setFullScreenable(true)
      } else {
        state.mainWindow.setFullScreen(false)
      }
    }
  } catch { /* ignore */ }
  layout()
}

function attachView(entry) {
  const { viewId, type, view } = entry
  state.mainWindow.contentView.addChildView(view)
  view.setVisible(false)
  view.setBounds(contentBounds())
  state.views.set(viewId, entry)
  // 编辑器内全屏（如 Slides 放映）：从"窗口内全屏"升级为整个屏幕的系统全屏
  view.webContents.on('enter-html-full-screen', enterHtmlFullScreen)
  view.webContents.on('leave-html-full-screen', leaveHtmlFullScreen)
  view.webContents.once('render-process-gone', () => {
    console.error(`[Office] ${viewId} renderer crashed`)
    // 保留崩溃现场供上层提示恢复；关闭视图并通知前端（对应 Tab 激活时会重建）
    hideView(viewId, true)
    notifyVue('office-view-closed', { type, viewId })
  })
}

function showView(viewId) {
  for (const [id, entry] of state.views) {
    if (id !== viewId && !entry.view.webContents.isDestroyed()) entry.view.setVisible(false)
  }
  const entry = state.views.get(viewId)
  if (entry) {
    entry.view.setBounds(state.htmlFullScreen ? fullContentBounds() : contentBounds())
    entry.view.setVisible(true)
    state.visibleId = viewId
  }
}

function hideView(viewId, destroy = false) {
  const entry = state.views.get(viewId)
  if (!entry) return
  entry.view.setVisible(false)
  state.mainWindow?.contentView?.removeChildView(entry.view)
  state.views.delete(viewId)
  if (state.visibleId === viewId) {
    state.visibleId = null
    // 视图关闭时若正处于 HTML5 全屏放映，恢复窗口状态
    if (state.htmlFullScreen) leaveHtmlFullScreen()
  }
  if (destroy && !entry.view.webContents.isDestroyed()) {
    try { entry.view.webContents.close() } catch { /* already gone */ }
  }
}

// ---- viewId 与视图查找 -------------------------------------------------------

function nextViewId(type) {
  return `${type}-${++state.seq}`
}

/** 分配 viewId：优先复用调用方指定的（且未被占用）id，否则自增 */
function allocViewId(type, requested) {
  if (
    typeof requested === 'string' &&
    requested.startsWith(`${type}-`) &&
    !state.views.has(requested)
  ) {
    return requested
  }
  return nextViewId(type)
}

/** 按 webContents（对象或 id）反查视图条目 */
function entryByWebContents(arg) {
  for (const entry of state.views.values()) {
    const wc = entry.view.webContents
    if (wc === arg || wc.id === arg) return entry
  }
  return null
}

// ---- 对外 API ---------------------------------------------------------------

export async function initOfficeHost(mainWindow) {
  if (state.initialized) return true
  if (!isOfficeAvailable()) {
    console.warn('[Office] resources/office 不存在，Office 工作区不可用（先运行 npm run office:build）')
    return false
  }
  state.mainWindow = mainWindow
  state.bundles = await loadBundles()
  if (Object.keys(state.bundles).length === 0) return false

  // ready 之后挂载 genoffice-app:// 协议处理器（各编辑器 renderer 目录）
  if (protocolInstaller && typeof protocolInstaller.installRendererProtocol === 'function') {
    const roots = {}
    for (const editor of EDITORS) {
      roots[editor] = path.join(officeRoot(), editor, 'renderer')
    }
    protocolInstaller.installRendererProtocol(roots)
  }

  tolerateDuplicateIpcHandlers()
  configureRuntimes()
  registerEditorIpc()
  wireShellHooks()
  wireSlidesShowFullscreen()

  // 窗口尺寸变化时让 renderer 重推最新边界（不套用陈旧 contentBounds，避免抖动）；
  // 覆盖 resize / 最大化 / 还原 / 全屏切换。放映全屏期间 renderer 推送被忽略，
  // 但视图需要跟随新窗口尺寸重排（整屏布局），因此直接调 layout()。
  const requestSync = () => {
    try {
      if (!state.mainWindow.isDestroyed()) {
        if (state.htmlFullScreen) layout()
        else state.mainWindow.webContents.send('office-layout-sync')
      }
    } catch { /* ignore */ }
  }
  for (const ev of ['resize', 'maximize', 'unmaximize', 'restore', 'enter-full-screen', 'leave-full-screen']) {
    mainWindow.on(ev, requestSync)
  }

  state.initialized = true
  console.log('[Office] Office Host initialized with editors:', Object.keys(state.bundles).join(', '))
  return true
}

/**
 * Slides 放映全屏接管。
 * 上游 macOS 放映不走 HTML5 Fullscreen API（渲染层 if (!IS_MAC) 跳过 requestFullscreen，
 * enter-html-full-screen 永远不触发），而是经 slides:show-fullscreen IPC 由主进程对
 * 宿主窗口做 simpleFullScreen 快照。嵌入模式下该处理器内 BrowserWindow.fromWebContents
 * （WebContentsView 的 wc 无属主窗口）与 windowRefs.shellWindow 均为空，上游逻辑直接
 * return，导致窗口不进入全屏。这里在其注册之后重新注册（tolerateDuplicateIpcHandlers
 * 的"后注册者替换"）为驱动 office-host 整屏布局的包装器；上游处理器在嵌入下为空操作，
 * 不再调用。
 */
function wireSlidesShowFullscreen() {
  const channel = 'slides:show-fullscreen'
  if (state.slidesShowWrapped) return
  if (!state.bundles?.slides || !ipcMain._invokeHandlers?.get(channel)) {
    console.warn('[Office] slides:show-fullscreen 未注册，放映全屏不可用')
    return
  }
  ipcMain.handle(channel, (e, on) => {
    if (on) {
      // simpleFullScreen 可能把 first responder 留在主窗口 renderer，主动聚焦放映视图
      // （与上游一致：响应者变更异步落地，下一 tick 再聚焦一次）
      try {
        e.sender.focus()
        setTimeout(() => { if (!e.sender.isDestroyed()) e.sender.focus() }, 50)
      } catch { /* ignore */ }
      enterHtmlFullScreen()
    } else {
      leaveHtmlFullScreen()
    }
  })
  state.slidesShowWrapped = true
}

/** 按类型创建上游编辑器视图（filePath 为空表示新建空白文档）。
 *  返回 { view, filePath }：sheets 新建时会生成空白工作簿文件，filePath 为其实际路径。 */
function createTypeView(type, filePath) {
  const b = state.bundles
  if (type === 'docs') {
    return { view: b.docs.createDocsView(filePath || undefined), filePath }
  }
  if (type === 'sheets') {
    // 上游 sheets renderer 的无会话空白视图是"演示模式"：编辑只留在内存，
    // 保存被拒绝（appDemoNoSave），pendingEdits 恒为 0，自动保存随之失效。
    // 因此新建表格时先落盘一个空白 xlsx，再按普通文件排队打开，让
    // Ctrl+S / 关闭前自动保存 / 脏跟踪全部走真实会话链路。
    let target = filePath
    if (!target) {
      try {
        target = createBlankWorkbookFile()
      } catch (e) {
        console.warn('[Office] create blank workbook failed, fallback to demo view:', e?.message || e)
        b.sheets.setSheetsNewBlank()
      }
    }
    const view = b.sheets.createSheetsView({ includeAiHandlers: false })
    if (target) b.sheets.queueWorkbookForView(view.webContents, target)
    return { view, filePath: target }
  }
  if (type === 'slides') {
    return { view: b.slides.createSlidesView(filePath || null), filePath }
  }
  return { view: b.pdf.createPdfView(filePath || null), filePath }
}

/** 新建空白表格的默认保存目录（与上游 sheets configuredDefaultSaveDir 一致：
 *  优先 app-settings.json 的 defaultSaveDir，回退 ~/Documents/GenOffice） */
function sheetsDefaultSaveDir() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'app-settings.json')
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const dir = raw.defaultSaveDir
      if (typeof dir === 'string' && path.isAbsolute(dir)) return dir
    }
  } catch { /* ignore */ }
  return path.join(app.getPath('documents'), 'GenOffice')
}

/** 生成空白 xlsx 工作簿文件并返回路径（单空 Sheet1，复用上游 uniquePathIn 去重命名） */
function createBlankWorkbookFile() {
  const dir = sheetsDefaultSaveDir()
  fs.mkdirSync(dir, { recursive: true })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Sheet1')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const filePath = state.bundles.sheets.uniquePathIn(dir, '未命名.xlsx')
  fs.writeFileSync(filePath, buffer)
  // 标记为"未命名"文件：沿用上游 autoRenameWorkbook 按内容自动改名的能力
  try { state.bundles.sheets.markSheetsUntitledPath(filePath) } catch { /* ignore */ }
  return filePath
}

/**
 * 在对应可视化编辑器中打开文件（每个文件一个独立视图/Tab）。
 * - 同一文件已在某个视图中打开 → 直接激活该视图（reused）；
 * - 否则创建新视图；opts.viewId 可指定复用的视图 id（Tab 恢复场景）；
 * - opts.notifyOpened：主进程内部发起的打开（如生成文件）需通知前端创建/跳转 Tab。
 */
export async function openOfficeFile(filePath, opts = {}) {
  const { resolveEditorType } = await import('./office-files.js')
  const type = resolveEditorType(filePath)
  if (!type || !state.bundles?.[type]) {
    return { success: false, error: `unsupported file type: ${filePath}` }
  }
  // 同一文件已在某个视图打开 → 直接激活
  for (const [id, entry] of state.views) {
    if (entry.type === type && entry.filePath === filePath && !entry.view.webContents.isDestroyed()) {
      showView(id)
      if (opts.notifyOpened) notifyVue('office-opened', { type, viewId: id, filePath })
      return { success: true, type, viewId: id, filePath, reused: true }
    }
  }

  const viewId = allocViewId(type, opts.viewId)
  const { view } = createTypeView(type, filePath)
  attachView({ viewId, type, view, filePath })
  // 最近文件统一记录在 docs bundle 的 recents 存储中（recordRecentFile 自带去重）
  if (filePath) {
    try { state.bundles.docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
  }
  showView(viewId)
  if (opts.notifyOpened) notifyVue('office-opened', { type, viewId, filePath })
  return { success: true, type, viewId, filePath }
}

/**
 * 关闭 Tab 前自动保存：向编辑器 renderer 触发保存（等价 Ctrl+S 菜单命令）并等待落盘。
 * 已有路径的文件静默保存；未保存过的新文档由 renderer 弹出另存为对话框。
 * 上限 120s，与上游 requestRendererSave 一致（覆盖另存为对话框的等待时间）。
 */
export async function autoSaveOfficeFile(viewId) {
  const b = state.bundles
  const entry = state.views.get(viewId)
  if (!b || !entry) return { success: true, saved: false }
  const type = entry.type
  const view = entry.view
  if (!view || view.webContents.isDestroyed()) return { success: true, saved: false }
  const wc = view.webContents
  const waitClean = async (isDirty, timeoutMs = 120000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (wc.isDestroyed()) return false
      try {
        if (!(await isDirty())) return true
      } catch {
        return false
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    return false
  }
  try {
    if (type === 'docs') {
      if (!(await b.docs.docsQueryDirty(wc))) return { success: true, saved: false }
      wc.send('menu:command', 'save')
      return { success: await waitClean(() => b.docs.docsQueryDirty(wc)), saved: true }
    }
    if (type === 'sheets') {
      if (b.sheets.sheetsPendingEditCount(wc.id) <= 0) return { success: true, saved: false }
      wc.send('menu:action', 'save')
      return {
        success: await waitClean(() => Promise.resolve(b.sheets.sheetsPendingEditCount(wc.id) > 0)),
        saved: true,
      }
    }
    if (type === 'slides') {
      if (!(await b.slides.slidesIsDirty(wc.id))) return { success: true, saved: false }
      wc.send('slides:menu', 'save')
      return { success: await waitClean(() => b.slides.slidesIsDirty(wc.id)), saved: true }
    }
    if (type === 'pdf') {
      const ok = await b.pdf.flushPdfSave(wc)
      return { success: ok !== false, saved: true }
    }
  } catch (e) {
    return { success: false, error: e?.message || String(e) }
  }
  return { success: false, error: 'unsupported editor type' }
}

/** 关闭前查询脏状态并弹出保存/放弃/取消确认；返回是否可以安全关闭 */
export async function closeOfficeFile(viewId) {
  const bundles = state.bundles
  const entry = state.views.get(viewId)
  if (!entry) return true
  const type = entry.type
  const view = entry.view
  const wc = view.webContents
  if (wc.isDestroyed()) { hideView(viewId); return true }

  let proceed = true
  if (type === 'docs') {
    if (await bundles.docs.docsQueryDirty(wc)) proceed = await bundles.docs.requestDocsClose(wc, state.mainWindow)
  } else if (type === 'sheets') {
    if (bundles.sheets.sheetsPendingEditCount(wc.id) > 0) proceed = await bundles.sheets.requestSheetsClose(wc, state.mainWindow)
  } else if (type === 'slides') {
    if (bundles.slides.slidesIsDirty(wc.id)) proceed = await bundles.slides.requestSlidesClose(wc, state.mainWindow)
  } else if (type === 'pdf') {
    if (bundles.pdf.pdfIsDirty(wc.id)) proceed = await bundles.pdf.requestPdfClose(wc, state.mainWindow)
  }
  if (!proceed) return false

  if (type === 'docs') bundles.docs.teardownDocsRenderer?.(wc)
  hideView(viewId, type !== 'docs') // docs 的 webContents.close() 会卡死 UI 线程（上游已知问题），仅分离
  notifyVue('office-view-closed', { type, viewId })
  return true
}

/**
 * 新建空白文档（对应编辑器的无参 createXxxView）。每个新建文档都是独立视图/Tab；
 * requestedViewId 用于 Tab 恢复场景（在原 Tab 的 viewId 下重建）。
 * sheets 新建会落盘空白工作簿文件，返回值携带其 filePath。
 */
export function newOfficeDocument(type, requestedViewId) {
  if (!state.bundles?.[type]) return { success: false, error: 'editor unavailable' }
  const viewId = allocViewId(type, requestedViewId)
  const { view, filePath } = createTypeView(type, null)
  attachView({ viewId, type, view, filePath })
  showView(viewId)
  return { success: true, type, viewId, blank: true, filePath }
}

/** 隐藏所有 Office 视图（路由离开 Office 工作区时调用，不销毁） */
export function hideAllOfficeViews() {
  for (const entry of state.views.values()) {
    if (!entry.view.webContents.isDestroyed()) entry.view.setVisible(false)
  }
  state.visibleId = null
}

/** 路由回到 Office 工作区时恢复该 Tab 的编辑器视图 */
export function showOfficeView(viewId) {
  const entry = state.views.get(viewId)
  if (entry && !entry.view.webContents.isDestroyed()) {
    showView(viewId)
    return true
  }
  return false
}

export function getOfficeState() {
  return [...state.views.values()].map(e => ({
    type: e.type,
    viewId: e.viewId,
    filePath: e.filePath,
    open: !e.view.webContents.isDestroyed(),
  }))
}

export function setOfficeContentBounds(rect) {
  // HTML5 全屏放映期间忽略 renderer 推送的工作区边界，保持整屏视图
  if (state.htmlFullScreen) return
  // 零面积矩形是 keep-alive 失活实例对分离 DOM 的错误测量，拒绝之，
  // 避免把正在显示的编辑器视图布局打成 0 尺寸（Tab 切换后页面空白）
  if (
    rect &&
    typeof rect.x === 'number' && Number.isFinite(rect.x) &&
    typeof rect.y === 'number' && Number.isFinite(rect.y) &&
    typeof rect.width === 'number' && Number.isFinite(rect.width) && rect.width > 0 &&
    typeof rect.height === 'number' && Number.isFinite(rect.height) && rect.height > 0
  ) {
    state.contentBounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    layout()
  }
}

/** 上游首页同款最近文件条目：路径 + stat 信息 + 收藏标记（保留已删除项，dimmed 展示） */
function recentEntries() {
  const docs = state.bundles?.docs
  if (!docs?.readRecentFiles) return []
  let starred = []
  try { starred = docs.readStarredFiles?.() || [] } catch { /* ignore */ }
  return docs.readRecentFiles()
    .filter(p => typeof p === 'string' && p)
    .map((p) => {
      let mtimeMs = null
      let sizeBytes = null
      let missing = true
      try {
        const st = fs.statSync(p)
        mtimeMs = st.mtimeMs
        sizeBytes = st.size
        missing = false
      } catch { /* transiently unavailable: keep listed, dimmed */ }
      return {
        path: p,
        name: path.basename(p),
        dir: path.dirname(p),
        type: EXT_TO_TYPE[path.extname(p).toLowerCase()] || 'docs',
        mtimeMs,
        sizeBytes,
        missing,
        starred: starred.includes(p),
      }
    })
}

/** Office 首页最近文件列表（含 stat 与收藏标记） */
export function getOfficeRecents() {
  try {
    return recentEntries()
  } catch (e) {
    console.warn('[Office] readRecentFiles failed:', e.message)
    return []
  }
}

/** 收藏/取消收藏（复用 docs bundle 的 starred 存储） */
export function toggleOfficeStarred(filePath) {
  const docs = state.bundles?.docs
  if (!docs?.toggleStarredFile) return { success: false }
  try {
    docs.toggleStarredFile(String(filePath))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/** 从最近文件列表移除（不删除磁盘文件） */
export function removeOfficeRecents(filePaths) {
  const docs = state.bundles?.docs
  if (!docs?.removeRecentFiles) return { success: false }
  try {
    docs.removeRecentFiles((filePaths || []).map(String))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/** 在系统文件管理器中显示文件 */
export function revealOfficePath(filePath) {
  try {
    shell.showItemInFolder(String(filePath))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/** Office 首页"打开本地文件"：弹出文件选择框并交给对应编辑器 */
export async function openOfficeFileDialog() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return { success: false, cancelled: true }
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(state.mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Office Documents', extensions: ['docx', 'xlsx', 'xlsm', 'csv', 'pptx', 'pdf'] },
    ],
  })
  if (canceled || !filePaths?.length) return { success: false, cancelled: true }
  return openOfficeFile(filePaths[0])
}

export async function queryOfficeDirty(viewId) {
  const entry = state.views.get(viewId)
  if (!entry || entry.view.webContents.isDestroyed()) return false
  const b = state.bundles
  const wc = entry.view.webContents
  switch (entry.type) {
    case 'docs': return b.docs.docsQueryDirty(wc)
    case 'sheets': return b.sheets.sheetsPendingEditCount(wc.id) > 0
    case 'slides': return b.slides.slidesIsDirty(wc.id)
    case 'pdf': return b.pdf.pdfIsDirty(wc.id)
    default: return false
  }
}

/** 应用退出前释放资源（停止 sidecar、关闭视图） */
export function shutdownOfficeHost() {
  try { state.bundles?.sheets?.stopSheetsSidecar?.() } catch { /* ignore */ }
  for (const [viewId, entry] of [...state.views]) hideView(viewId, entry.type !== 'docs')
  savedEventSubscribers = []
}

/** 调试/诊断：将指定编辑器视图当前画面截图保存为 PNG */
export async function captureOfficeView(viewId, outPath) {
  const entry = state.views.get(viewId)
  if (!entry || entry.view.webContents.isDestroyed()) return false
  const image = await entry.view.webContents.capturePage()
  fs.writeFileSync(outPath, image.toPNG())
  return true
}

/** 调试/诊断：探测指定编辑器 renderer 的加载状态 */
export async function probeOfficeView(viewId) {
  const entry = state.views.get(viewId)
  if (!entry || entry.view.webContents.isDestroyed()) return { ok: false, reason: 'no view' }
  const wc = entry.view.webContents
  try {
    const probe = await Promise.race([
      wc.executeJavaScript(
        `JSON.stringify({ ready: document.readyState, body: document.body ? document.body.childElementCount : -1, editor: !!document.querySelector('.tiptap, .univer-root, [class*=univer], [class*=slide], canvas') })`,
        true
      ),
      new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 15000)),
    ])
    return { ok: true, url: wc.getURL(), isLoading: wc.isLoading(), probe: JSON.parse(probe) }
  } catch (e) {
    return { ok: false, url: wc.getURL(), isLoading: wc.isLoading(), reason: e.message }
  }
}

function notifyVue(channel, payload) {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send(channel, payload)
  }
}

export { contentBounds }
