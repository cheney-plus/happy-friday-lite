import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import AdmZip from 'adm-zip'
import { flushDb, closeDb, initDb } from './db.js'
import { loadConfig, saveConfig, getDataDir } from './config.js'

// 生成带时间戳的备份文件名
function generateBackupName() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `friday-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`
}

/**
 * 在 worker 线程中执行 zip 压缩，避免阻塞主进程。
 * @param {string} dataDir
 * @param {string} zipPath
 * @param {(p:{current:number,total:number,name?:string,compressing?:boolean})=>void} [onProgress]
 * @returns {Promise<{success:boolean,path?:string,error?:string}>}
 */
function runBackupWorker(dataDir, zipPath, onProgress) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./backup-worker.js', import.meta.url), {
      workerData: { dataDir, zipPath }
    })
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      worker.terminate().catch(() => {})
      resolve(result)
    }
    worker.on('message', (msg) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'progress' && onProgress) {
        onProgress({ current: msg.current, total: msg.total, name: msg.name })
      } else if (msg.type === 'compressing' && onProgress) {
        onProgress({ compressing: true })
      } else if (msg.type === 'done') {
        finish(msg.success
          ? { success: true, path: msg.path }
          : { success: false, error: msg.error })
      }
    })
    worker.on('error', (err) => finish({ success: false, error: err?.message || String(err) }))
    worker.on('exit', (code) => {
      if (code !== 0) finish({ success: false, error: `worker exited with code ${code}` })
    })
  })
}

/**
 * 创建备份
 * @param {string} destPath - 目标 zip 文件路径（或目录）
 * @param {boolean} isAutoDir - destPath 是否为目录（自动备份场景）
 * @param {(p:{current:number,total:number,name?:string,compressing?:boolean})=>void} [onProgress] 进度回调
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function createBackup(destPath, isAutoDir = false, onProgress = null) {
  const dataDir = getDataDir()
  if (!dataDir) return { success: false, error: '数据目录未初始化' }

  // 确保数据库落盘（必须在主进程中完成，使 zip 内容一致）
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

    // 在 worker 线程中执行收集与压缩，主进程保持响应
    const workerResult = await runBackupWorker(dataDir, zipPath, onProgress)
    if (!workerResult.success) {
      return workerResult
    }

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
