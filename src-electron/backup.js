import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { flushDb, closeDb, initDb } from './db.js'
import { loadConfig, saveConfig, getDataDir } from './config.js'

// 生成带时间戳的备份文件名
function generateBackupName() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `friday-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`
}

// 递归收集目录下所有文件
function collectFiles(dir, baseDir) {
  const results = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return results
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(baseDir, fullPath)
    if (entry.isDirectory()) {
      results.push({ path: fullPath, relPath, isDirectory: true })
      results.push(...collectFiles(fullPath, baseDir))
    } else {
      results.push({ path: fullPath, relPath, isDirectory: false })
    }
  }
  return results
}

/**
 * 创建备份
 * @param {string} destPath - 目标 zip 文件路径（或目录）
 * @param {boolean} isAutoDir - destPath 是否为目录（自动备份场景）
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function createBackup(destPath, isAutoDir = false) {
  const dataDir = getDataDir()
  if (!dataDir) return { success: false, error: '数据目录未初始化' }

  // 确保数据库落盘
  flushDb()

  try {
    // 确定最终 zip 路径
    let zipPath = destPath
    if (isAutoDir) {
      // 自动备份：目标为目录，生成带时间戳的文件名
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true })
      }
      zipPath = path.join(destPath, generateBackupName())
    }

    const zip = new AdmZip()
    const files = collectFiles(dataDir, dataDir)

    for (const file of files) {
      if (file.isDirectory) {
        // adm-zip 会自动处理空目录，跳过
        continue
      }
      // 排除临时/锁文件
      if (file.relPath.endsWith('.lock') || file.relPath.endsWith('-wal') || file.relPath.endsWith('-shm')) {
        continue
      }
      zip.addLocalFile(file.path, path.dirname(file.relPath) === '.' ? '' : path.dirname(file.relPath))
    }

    zip.writeZip(zipPath)

    // 自动备份：清理旧备份
    if (isAutoDir) {
      const config = loadConfig()
      const maxKeep = config.backup?.maxKeep || 7
      cleanOldBackups(destPath, maxKeep)

      // 更新 lastBackupAt
      config.backup.lastBackupAt = new Date().toISOString()
      saveConfig(config)
    }

    return { success: true, path: zipPath }
  } catch (e) {
    console.error('[Backup] createBackup error:', e)
    return { success: false, error: e.message }
  }
}

/**
 * 从备份恢复
 * @param {string} zipPath - zip 文件路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function restoreBackup(zipPath) {
  const dataDir = getDataDir()
  if (!dataDir) return { success: false, error: '数据目录未初始化' }

  try {
    if (!fs.existsSync(zipPath)) {
      return { success: false, error: '备份文件不存在' }
    }

    const zip = new AdmZip(zipPath)

    // 验证 zip 内容：必须包含 friday.db
    const entries = zip.getEntries()
    const hasDb = entries.some(e => e.entryName === 'friday.db' || e.entryName.endsWith('/friday.db'))
    if (!hasDb) {
      return { success: false, error: '备份文件无效：缺少 friday.db' }
    }

    // 关闭数据库连接
    closeDb()

    // 解压到临时目录
    const tmpDir = path.join(dataDir, '..', '.friday-restore-tmp')
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tmpDir, { recursive: true })
    zip.extractAllTo(tmpDir, true)

    // 如果解压出来有一层根目录（如 friday-backup-xxx/），进入它
    let restoreRoot = tmpDir
    const tmpEntries = fs.readdirSync(tmpDir, { withFileTypes: true })
    // 检查是否解压出了单个子目录且该子目录包含 friday.db
    if (tmpEntries.length === 1 && tmpEntries[0].isDirectory()) {
      const subDir = path.join(tmpDir, tmpEntries[0].name)
      if (fs.existsSync(path.join(subDir, 'friday.db'))) {
        restoreRoot = subDir
      }
    }

    // 清空当前 dataDir（保留目录本身）
    const currentEntries = fs.readdirSync(dataDir, { withFileTypes: true })
    for (const entry of currentEntries) {
      const fullPath = path.join(dataDir, entry.name)
      fs.rmSync(fullPath, { recursive: true, force: true })
    }

    // 将恢复内容复制到 dataDir
    const restoreEntries = fs.readdirSync(restoreRoot, { withFileTypes: true })
    for (const entry of restoreEntries) {
      const src = path.join(restoreRoot, entry.name)
      const dst = path.join(dataDir, entry.name)
      fs.cpSync(src, dst, { recursive: true })
    }

    // 清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true })

    // 重新初始化数据库
    await initDb()

    return { success: true }
  } catch (e) {
    console.error('[Backup] restoreBackup error:', e)
    // 尝试重新打开数据库
    try { await initDb() } catch (_) {}
    return { success: false, error: e.message }
  }
}

/**
 * 清理旧备份，只保留最近 maxKeep 份
 */
function cleanOldBackups(dir, maxKeep) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const backups = entries
      .filter(e => !e.isDirectory() && e.name.startsWith('friday-backup-') && e.name.endsWith('.zip'))
      .map(e => {
        const fullPath = path.join(dir, e.name)
        const stat = fs.statSync(fullPath)
        return { name: e.name, path: fullPath, mtime: stat.mtime }
      })
      .sort((a, b) => b.mtime - a.mtime)

    // 删除超出 maxKeep 的旧备份
    for (let i = maxKeep; i < backups.length; i++) {
      try {
        fs.unlinkSync(backups[i].path)
      } catch (e) {
        // 忽略删除失败
      }
    }
  } catch (e) {
    // 忽略
  }
}

/**
 * 检查并执行自动备份
 * 在应用启动时调用
 */
export async function checkAutoBackup() {
  const dataDir = getDataDir()
  if (!dataDir) return

  try {
    const config = loadConfig()
    const backupCfg = config.backup
    if (!backupCfg || !backupCfg.enabled) return
    if (!backupCfg.autoDir) return

    const lastBackup = backupCfg.lastBackupAt ? new Date(backupCfg.lastBackupAt) : null
    const now = new Date()

    // 判断是否到达备份间隔
    let needBackup = false
    if (!lastBackup) {
      needBackup = true
    } else {
      const diffMs = now - lastBackup
      const intervalMs = backupCfg.interval === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      if (diffMs >= intervalMs) {
        needBackup = true
      }
    }

    if (needBackup) {
      console.log('[Backup] Auto backup triggered')
      const result = await createBackup(backupCfg.autoDir, true)
      if (!result.success) {
        console.error('[Backup] Auto backup failed:', result.error)
      }
    }
  } catch (e) {
    console.error('[Backup] checkAutoBackup error:', e)
  }
}
