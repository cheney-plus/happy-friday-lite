/**
 * 系统文件关联模块
 * 将本客户端注册为操作系统打开 Markdown / Word / Excel / PPT 文档的默认程序。
 *
 * 平台支持情况：
 * - Windows：写入 HKCU\Software\Classes 注册表（无需管理员权限），运行时可设置/取消
 * - Linux：写入 ~/.local/share/applications 的 .desktop 文件 + xdg-mime 设置默认程序
 * - macOS：系统不允许运行时注册默认程序，需打包时在 Info.plist 声明文件关联
 *   （见 package.json build.mac.fileAssociations），用户在访达中手动设置默认程序
 */
import { app } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

// 文档分组与扩展名（与渲染进程 src/utils/docOpen.js 保持一致）
export const FILE_ASSOC_GROUPS = [
  { key: 'markdown', exts: ['md', 'markdown'] },
  { key: 'word', exts: ['doc', 'docx'] },
  { key: 'excel', exts: ['xls', 'xlsx', 'csv'] },
  { key: 'ppt', exts: ['ppt', 'pptx'] }
]

const MIME_BY_EXT = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

const DESKTOP_FILE_ID = 'happy-friday-lite.desktop'
const PROG_ID_PREFIX = 'HappyFridayLite'
const APP_NAME = 'Happy Friday Lite'

function extsOfGroups(groups) {
  const wanted = new Set(groups)
  const exts = []
  for (const g of FILE_ASSOC_GROUPS) {
    if (wanted.size === 0 || wanted.has(g.key)) exts.push(...g.exts)
  }
  return exts
}

function execFileAsync(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout || '', stderr: stderr || '' })
    })
  })
}

// ---------- Windows（注册表，HKCU 无需管理员权限） ----------

function winProgId(ext) {
  return `${PROG_ID_PREFIX}.${ext}`
}

function winExePath() {
  // AppImage 风格环境变量不适用于 Windows；直接取当前可执行文件
  return process.execPath
}

async function winSet(ext) {
  const progId = winProgId(ext)
  const exe = winExePath()
  const base = `HKCU\\Software\\Classes`
  const results = []
  results.push(await execFileAsync('reg', ['add', `${base}\\${progId}`, '/ve', '/d', `${APP_NAME} Document`, '/f']))
  results.push(await execFileAsync('reg', ['add', `${base}\\${progId}\\shell\\open\\command`, '/ve', '/d', `"${exe}" "%1"`, '/f']))
  results.push(await execFileAsync('reg', ['add', `${base}\\.${ext}`, '/ve', '/d', progId, '/f']))
  const failed = results.find(r => r.error)
  return failed ? { success: false, error: failed.error.message } : { success: true }
}

async function winClear(ext) {
  const progId = winProgId(ext)
  const base = `HKCU\\Software\\Classes`
  // 仅当扩展名默认值仍指向本应用时才移除，避免破坏用户已有的其他默认程序
  const query = await execFileAsync('reg', ['query', `${base}\\.${ext}`, '/ve'])
  if (query.stdout.includes(progId)) {
    await execFileAsync('reg', ['delete', `${base}\\.${ext}`, '/ve', '/f'])
  }
  await execFileAsync('reg', ['delete', `${base}\\${progId}`, '/f'])
  return { success: true }
}

async function winIsDefault(ext) {
  const query = await execFileAsync('reg', ['query', `HKCU\\Software\\Classes\\.${ext}`, '/ve'])
  return query.stdout.includes(winProgId(ext))
}

// ---------- Linux（.desktop + xdg-mime） ----------

function linuxDesktopFilePath() {
  return path.join(os.homedir(), '.local', 'share', 'applications', DESKTOP_FILE_ID)
}

function linuxExecPath() {
  // AppImage 运行时提供 APPIMAGE 环境变量指向自身；deb 包为安装后的可执行文件
  return process.env.APPIMAGE || process.execPath
}

function ensureDesktopFile() {
  const filePath = linuxDesktopFilePath()
  const exec = linuxExecPath()
  const content = [
    '[Desktop Entry]',
    `Name=${APP_NAME}`,
    `Exec=${exec} %f`,
    'Type=Application',
    'Categories=Office;Utility;',
    'MimeType=' + Object.values(MIME_BY_EXT).join(';') + ';',
    'NoDisplay=true',
    ''
  ].join('\n')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

async function linuxSet(exts) {
  try {
    ensureDesktopFile()
  } catch (e) {
    return { success: false, error: e.message }
  }
  const mimes = exts.map(ext => MIME_BY_EXT[ext]).filter(Boolean)
  const { error } = await execFileAsync('xdg-mime', ['default', DESKTOP_FILE_ID, ...mimes])
  return error ? { success: false, error: error.message } : { success: true }
}

async function linuxClear(exts) {
  // 从 mimeapps.list 的 [Default Applications] 中移除本应用的条目
  const mimeSet = new Set(exts.map(ext => MIME_BY_EXT[ext]).filter(Boolean))
  const filePath = path.join(os.homedir(), '.config', 'mimeapps.list')
  try {
    if (!fs.existsSync(filePath)) return { success: true }
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    const filtered = lines.filter(line => {
      const eq = line.indexOf('=')
      if (eq === -1) return true
      const mime = line.slice(0, eq).trim()
      const apps = line.slice(eq + 1).split(';').map(s => s.trim())
      return !(mimeSet.has(mime) && apps.includes(DESKTOP_FILE_ID))
    })
    fs.writeFileSync(filePath, filtered.join('\n'), 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function linuxIsDefault(ext) {
  const { stdout } = await execFileAsync('xdg-mime', ['query', 'default', MIME_BY_EXT[ext]])
  return stdout.trim() === DESKTOP_FILE_ID
}

// ---------- 对外接口 ----------

/**
 * 查询各分组的系统默认程序状态。
 * @returns {{ supported: boolean, reason?: string, exts: Record<string, Array<{ext: string, isDefault: boolean}>> }}
 */
export async function getFileAssocStatus() {
  if (process.platform === 'darwin') {
    return { supported: false, reason: 'darwin-unsupported', exts: {} }
  }
  const exts = {}
  for (const g of FILE_ASSOC_GROUPS) {
    exts[g.key] = []
    for (const ext of g.exts) {
      const isDefault = process.platform === 'win32'
        ? await winIsDefault(ext)
        : await linuxIsDefault(ext)
      exts[g.key].push({ ext, isDefault })
    }
  }
  return { supported: true, exts }
}

/**
 * 将指定分组注册为系统默认打开程序。
 * @param {string[]} groups 分组 key（markdown/word/excel/ppt），空数组表示全部分组
 */
export async function setFileAssoc(groups) {
  if (process.platform === 'darwin') {
    return { success: false, error: 'darwin-unsupported' }
  }
  if (!app.isPackaged) {
    return { success: false, error: 'require-packaged' }
  }
  const exts = extsOfGroups(groups)
  if (process.platform === 'win32') {
    const results = []
    for (const ext of exts) results.push(await winSet(ext))
    const failed = results.find(r => r && r.success === false)
    return failed || { success: true }
  }
  return linuxSet(exts)
}

/**
 * 取消指定分组的系统默认打开程序注册。
 * @param {string[]} groups 分组 key，空数组表示全部分组
 */
export async function clearFileAssoc(groups) {
  if (process.platform === 'darwin') {
    return { success: false, error: 'darwin-unsupported' }
  }
  if (!app.isPackaged) {
    return { success: false, error: 'require-packaged' }
  }
  const exts = extsOfGroups(groups)
  if (process.platform === 'win32') {
    const results = []
    for (const ext of exts) results.push(await winClear(ext))
    const failed = results.find(r => r && r.success === false)
    return failed || { success: true }
  }
  return linuxClear(exts)
}
