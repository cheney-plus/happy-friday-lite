import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { app, dialog, ipcMain, shell } from 'electron'
import { registerOfficeAiBridge } from './office-ai-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

/**
 * Office Host（主进程适配层）。
 *
 * 复用上游 happyoffice 各编辑器的主进程模块（docs/sheets/slides/pdf-main），
 * 以 WebContentsView 形式挂载到当前唯一 BrowserWindow 上。每种编辑器至多
 * 一个活跃视图；文件内容由上游模块自带的 IPC 与 renderer 自行管理。
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
  // 每种编辑器至多一个活跃视图
  views: { docs: null, sheets: null, slides: null, pdf: null },
  files: { docs: null, sheets: null, slides: null, pdf: null },
  // renderer 提供的编辑器视图摆放区域（窗口内容区坐标），未设置时回退全宽布局
  contentBounds: null,
  // 当前可见的编辑器类型（Electron 42 View 无 isVisible()，需自行维护）
  visibleType: null,
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
    openGeneratedPath: (p) => {
      openOfficeFile(p)
      return true
    },
  })

  slides.configureSlidesRuntime({
    preloadPath: editorPaths('slides').preloadPath,
    rendererFilePath: editorPaths('slides').rendererFile,
    openGeneratedPath: (p) => {
      openOfficeFile(p)
      return true
    },
  })

  pdf.configurePdfRuntime({
    preloadPath: editorPaths('pdf').preloadPath,
    rendererFile: editorPaths('pdf').rendererFile,
    openGeneratedPath: (p) => {
      openOfficeFile(p)
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

  // 保存/另存为/首次保存 → 同步内部状态并通知知识库与 RAG
  docs.setDocsFileSavedHook?.((_wc, filePath) => {
    if (state.files.docs && state.files.docs !== filePath) state.files.docs = filePath
    emitFileSaved('docs', filePath)
  })
  docs.setDocsFileOpenedHook?.((_wcId, filePath) => {
    state.files.docs = filePath
  })
  sheets.setSheetsWorkbookOpenedHook?.((_wc, filePath) => {
    state.files.sheets = filePath
    // 最近文件统一记录在 docs bundle 的 recents 存储中
    try { docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
    emitFileSaved('sheets', filePath)
  })
  slides.setSlidesOpenedHook?.((_wc, filePath) => {
    state.files.slides = filePath
    try { docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
    emitFileSaved('slides', filePath)
  })
  // PDF 编辑器无 opened hook，openOfficeFile 内统一补记
}

function emitFileSaved(type, filePath) {
  if (!filePath) return
  for (const fn of savedEventSubscribers) {
    try { fn(type, filePath) } catch (e) { console.warn('[Office] file-saved hook error:', e) }
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

function layout() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  // 注意：Electron 42 的 View 没有 isVisible()，可见性由 visibleType 自行维护
  const view = state.visibleType ? state.views[state.visibleType] : null
  if (view && !view.webContents.isDestroyed()) view.setBounds(contentBounds())
}

function attachView(type, view) {
  state.mainWindow.contentView.addChildView(view)
  view.setVisible(false)
  view.setBounds(contentBounds())
  state.views[type] = view
  view.webContents.once('render-process-gone', () => {
    console.error(`[Office] ${type} renderer crashed`)
    // 保留崩溃现场供上层提示恢复；关闭视图
    hideView(type, true)
  })
}

function showView(type) {
  for (const [t, v] of Object.entries(state.views)) {
    if (v && !v.webContents.isDestroyed()) v.setVisible(t === type)
  }
  const view = state.views[type]
  if (view) {
    view.setBounds(contentBounds())
    view.setVisible(true)
    state.visibleType = type
  }
}

function hideView(type, destroy = false) {
  const view = state.views[type]
  if (!view) return
  view.setVisible(false)
  state.mainWindow?.contentView?.removeChildView(view)
  state.views[type] = null
  if (state.visibleType === type) state.visibleType = null
  if (destroy && !view.webContents.isDestroyed()) {
    try { view.webContents.close() } catch { /* already gone */ }
  }
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

  // 窗口尺寸变化时让 renderer 重推最新边界（不套用陈旧 contentBounds，避免抖动）；
  // 覆盖 resize / 最大化 / 还原 / 全屏切换
  const requestSync = () => {
    try {
      if (!state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('office-layout-sync')
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

/** 在对应可视化编辑器中打开文件；重复打开同一文件时仅激活已有视图 */
export async function openOfficeFile(filePath) {
  const { resolveEditorType } = await import('./office-files.js')
  const type = resolveEditorType(filePath)
  if (!type || !state.bundles?.[type]) {
    return { success: false, error: `unsupported file type: ${filePath}` }
  }
  // 同一文件已在编辑器中打开 → 直接激活
  if (state.files[type] === filePath && state.views[type] && !state.views[type].webContents.isDestroyed()) {
    showView(type)
    return { success: true, type, filePath, reused: true }
  }
  // 换文件前先走关闭确认
  if (state.views[type]) {
    const closed = await closeOfficeFile(type)
    if (!closed) return { success: false, cancelled: true }
  }

  const bundles = state.bundles
  let view
  if (type === 'docs') {
    view = bundles.docs.createDocsView(filePath)
  } else if (type === 'sheets') {
    view = bundles.sheets.createSheetsView({ includeAiHandlers: false })
    bundles.sheets.queueWorkbookForView(view.webContents, filePath)
  } else if (type === 'slides') {
    view = bundles.slides.createSlidesView(filePath)
  } else {
    view = bundles.pdf.createPdfView(filePath)
  }

  state.files[type] = filePath
  // 最近文件统一记录在 docs bundle 的 recents 存储中（recordRecentFile 自带去重）
  if (filePath) {
    try { state.bundles.docs.recordRecentFile?.(filePath) } catch { /* ignore */ }
  }
  attachView(type, view)
  showView(type)
  notifyVue('office-opened', { type, filePath })
  return { success: true, type, filePath }
}

/** 关闭前查询脏状态并弹出保存/放弃/取消确认；返回是否可以安全关闭 */
export async function closeOfficeFile(type) {
  const bundles = state.bundles
  const view = state.views[type]
  if (!view) return true
  const wc = view.webContents
  if (wc.isDestroyed()) { hideView(type); return true }

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
  hideView(type, type !== 'docs') // docs 的 webContents.close() 会卡死 UI 线程（上游已知问题），仅分离
  state.files[type] = null
  notifyVue('office-view-closed', { type })
  return true
}

/** 新建空白文档（对应编辑器的无参 createXxxView） */
export function newOfficeDocument(type) {
  if (!state.bundles?.[type]) return { success: false, error: 'editor unavailable' }
  if (state.views[type]) {
    // 已有打开的文件时先走关闭确认
    return closeOfficeFile(type).then(closed => {
      if (!closed) return { success: false, cancelled: true }
      return createBlank(type)
    })
  }
  return createBlank(type)
}

async function createBlank(type) {
  const b = state.bundles
  let view
  if (type === 'docs') {
    view = b.docs.createDocsView()
  } else if (type === 'sheets') {
    b.sheets.setSheetsNewBlank()
    view = b.sheets.createSheetsView({ includeAiHandlers: false })
  } else if (type === 'slides') {
    view = b.slides.createSlidesView(null)
  } else {
    view = b.pdf.createPdfView(null)
  }
  state.files[type] = null
  attachView(type, view)
  showView(type)
  notifyVue('office-opened', { type, filePath: null })
  return { success: true, type, blank: true }
}

/** 隐藏所有 Office 视图（路由离开 Office 工作区时调用，不销毁） */
export function hideAllOfficeViews() {
  for (const t of EDITORS) {
    const v = state.views[t]
    if (v && !v.webContents.isDestroyed()) v.setVisible(false)
  }
}

/** 路由回到 Office 工作区时恢复该编辑器视图 */
export function showOfficeView(type) {
  if (state.views[type] && !state.views[type].webContents.isDestroyed()) {
    showView(type)
    return true
  }
  return false
}

export function getOfficeState() {
  return EDITORS.map(t => ({
    type: t,
    filePath: state.files[t],
    open: !!(state.views[t] && !state.views[t].webContents.isDestroyed()),
  }))
}

export function setOfficeContentBounds(rect) {
  if (
    rect &&
    typeof rect.x === 'number' && Number.isFinite(rect.x) &&
    typeof rect.y === 'number' && Number.isFinite(rect.y) &&
    typeof rect.width === 'number' && Number.isFinite(rect.width) && rect.width >= 0 &&
    typeof rect.height === 'number' && Number.isFinite(rect.height) && rect.height >= 0
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

export async function queryOfficeDirty(type) {
  const view = state.views[type]
  if (!view || view.webContents.isDestroyed()) return false
  const b = state.bundles
  switch (type) {
    case 'docs': return b.docs.docsQueryDirty(view.webContents)
    case 'sheets': return b.sheets.sheetsPendingEditCount(view.webContents.id) > 0
    case 'slides': return b.slides.slidesIsDirty(view.webContents.id)
    case 'pdf': return b.pdf.pdfIsDirty(view.webContents.id)
    default: return false
  }
}

/** 应用退出前释放资源（停止 sidecar、关闭视图） */
export function shutdownOfficeHost() {
  try { state.bundles?.sheets?.stopSheetsSidecar?.() } catch { /* ignore */ }
  for (const t of EDITORS) hideView(t, t !== 'docs')
  savedEventSubscribers = []
}

/** 调试/诊断：将指定编辑器视图当前画面截图保存为 PNG */
export async function captureOfficeView(type, outPath) {
  const view = state.views[type]
  if (!view || view.webContents.isDestroyed()) return false
  const image = await view.webContents.capturePage()
  fs.writeFileSync(outPath, image.toPNG())
  return true
}

/** 调试/诊断：探测指定编辑器 renderer 的加载状态 */
export async function probeOfficeView(type) {
  const view = state.views[type]
  if (!view || view.webContents.isDestroyed()) return { ok: false, reason: 'no view' }
  const wc = view.webContents
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
