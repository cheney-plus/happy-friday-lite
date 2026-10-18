import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { fileURLToPath } from 'url'
import { AppError } from './error.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 项目根目录（main.js 所在目录）
const projectRoot = path.resolve(__dirname, '..')

const isDev = !app.isPackaged

/**
 * 默认数据目录（必须在 main.js 执行 app.setPath('userData') 之前捕获，
 * 本模块 import 时即求值，早于 main.js 体内代码，因此 app.getPath('userData')
 * 返回的仍是系统默认值 %APPDATA%/Happy Friday Lite）
 */
export const defaultDataDir = isDev
  ? path.join(projectRoot, 'app-data')
  : app.getPath('userData')

/**
 * 指针文件位置：记录用户自定义数据目录。
 * - 生产环境：存放在系统默认 userData 下（重定向后仍可定位）
 * - 开发环境：存放在项目 app-data 下
 */
const pointerFilePath = isDev
  ? path.join(projectRoot, 'app-data', 'data-dir.json')
  : path.join(app.getPath('userData'), 'data-dir.json')

/** 迁移白名单：仅复制应用自身数据，跳过日志与 Chromium 缓存 */
const MIGRATE_ENTRIES = [
  'config.json',
  'friday.db',
  'knowledge',
  'app-settings.json',
  'office-ai-panel-prefs.json',
  'happyOffice'
]

function readPointer() {
  try {
    const raw = JSON.parse(fs.readFileSync(pointerFilePath, 'utf8'))
    if (raw && typeof raw === 'object' && typeof raw.dataDir === 'string') {
      return raw
    }
  } catch { /* missing or corrupt: no override */ }
  return null
}

function writePointer(dataDir, migrated) {
  const dir = path.dirname(pointerFilePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(pointerFilePath, JSON.stringify({ dataDir, migrated }, null, 2), 'utf8')
}

/**
 * 解析实际使用的数据目录：
 * 有有效指针且目录可用 → 自定义目录；否则回退默认目录。
 * @returns {{ dataDir: string, isCustom: boolean, defaultDir: string, pendingMigration: boolean }}
 */
export function resolveDataDir() {
  const pointer = readPointer()
  if (pointer) {
    const custom = pointer.dataDir
    if (path.isAbsolute(custom) && custom !== defaultDataDir) {
      try {
        if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true })
        // 可写性探测
        const probe = path.join(custom, '.data-dir-probe')
        fs.writeFileSync(probe, 'ok')
        fs.unlinkSync(probe)
        return {
          dataDir: custom,
          isCustom: true,
          defaultDir: defaultDataDir,
          pendingMigration: pointer.migrated === false
        }
      } catch (e) {
        // 自定义目录不可用：回退默认目录
        console.error('[DataDir] Custom data dir unavailable, fallback to default:', e.message)
      }
    }
  }
  return { dataDir: defaultDataDir, isCustom: false, defaultDir: defaultDataDir, pendingMigration: false }
}

/** 生产环境且使用自定义目录时，重定向 userData（须在 requestSingleInstanceLock 之前调用） */
export function applyUserDataRedirect(dataDir, isCustom) {
  if (!isDev && isCustom && dataDir !== app.getPath('userData')) {
    app.setPath('userData', dataDir)
  }
}

/** 记录用户选择的新数据目录（下次启动生效并自动迁移） */
export function setDataDirPointer(dir) {
  if (!path.isAbsolute(dir)) {
    throw AppError.config('Data directory must be an absolute path')
  }
  writePointer(dir, false)
}

/** 恢复默认数据目录（下次启动生效，数据保留在原自定义目录中） */
export function clearDataDirPointer() {
  try {
    if (fs.existsSync(pointerFilePath)) fs.unlinkSync(pointerFilePath)
  } catch (e) {
    throw AppError.config(`Failed to clear data dir pointer: ${e.message}`)
  }
}

function markMigrated() {
  const pointer = readPointer()
  if (pointer) writePointer(pointer.dataDir, true)
}

/**
 * 启动时迁移：将旧目录（默认目录）中的应用数据复制到新目录。
 * 在 initDb 之前调用，确保数据库文件未被占用。
 */
export function migrateDataIfNeeded(resolved) {
  if (!resolved.isCustom || !resolved.pendingMigration) return
  const oldDir = resolved.defaultDir
  const newDir = resolved.dataDir
  console.log(`[DataDir] Migrating data from ${oldDir} to ${newDir} ...`)
  for (const name of MIGRATE_ENTRIES) {
    const src = path.join(oldDir, name)
    const dest = path.join(newDir, name)
    if (!fs.existsSync(src)) continue
    try {
      fs.cpSync(src, dest, { recursive: true, force: true })
    } catch (e) {
      // 迁移失败：删除指针回退默认目录，避免数据不完整
      console.error(`[DataDir] Failed to migrate "${name}":`, e.message)
      clearDataDirPointer()
      throw AppError.config(`Data migration failed at "${name}": ${e.message}`)
    }
  }
  markMigrated()
  console.log('[DataDir] Migration completed')
}
