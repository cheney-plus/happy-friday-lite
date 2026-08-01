import { loadConfig, saveConfig } from './config.js'
import { cleanOldSessions } from './db.js'

// 每个阈值对应的时间跨度（毫秒）
const DAY_MS = 24 * 60 * 60 * 1000
const THRESHOLD_MS = {
  '1month': 30 * DAY_MS,
  '3months': 90 * DAY_MS,
  '6months': 180 * DAY_MS,
  '1year': 365 * DAY_MS
}

/**
 * 检查并执行对话历史自动清理。
 * 在应用启动时调用一次：仅在距离上次清理超过 24 小时时才真正扫描，
 * 避免频繁扫描数据库。清理对象为 sessions/messages（对话历史），
 * 不涉及 agent_threads（与对话历史相互独立）。
 */
export async function checkAutoCleanHistory() {
  try {
    const config = loadConfig()
    const cfg = config.history
    if (!cfg || !cfg.autoClean) return

    const now = Date.now()
    const last = cfg.lastCleanAt ? new Date(cfg.lastCleanAt).getTime() : 0
    // 至多每天扫描一次，避免频繁扫描
    if (last && (now - last) < DAY_MS) return

    const thresholdMs = THRESHOLD_MS[cfg.cleanBefore]
    if (!thresholdMs) return

    const beforeISO = new Date(now - thresholdMs).toISOString()
    const result = cleanOldSessions(beforeISO)

    // 写回 lastCleanAt（无论是否清理到数据，都更新以节流下次扫描）
    config.history.lastCleanAt = new Date().toISOString()
    saveConfig(config)

    if (result.count > 0) {
      console.log(`[History] Auto-cleaned ${result.count} session(s) older than ${cfg.cleanBefore} (before ${beforeISO})`)
    }
  } catch (e) {
    console.error('[History] checkAutoCleanHistory error:', e)
  }
}

/**
 * 立即执行一次对话历史清理（用户在设置中开启或手动触发时调用）。
 * 这是用户主动操作，不属于频繁扫描；读取当前配置的阈值并据此清理。
 * @returns {{ count: number, lastCleanAt: string|null, skipped?: boolean }}
 */
export async function cleanHistoryNow() {
  const config = loadConfig()
  const cfg = config.history
  if (!cfg || !cfg.autoClean) {
    return { count: 0, lastCleanAt: cfg?.lastCleanAt || null, skipped: true }
  }
  const thresholdMs = THRESHOLD_MS[cfg.cleanBefore]
  if (!thresholdMs) {
    return { count: 0, lastCleanAt: cfg.lastCleanAt || null, skipped: true }
  }

  const beforeISO = new Date(Date.now() - thresholdMs).toISOString()
  const result = cleanOldSessions(beforeISO)

  config.history.lastCleanAt = new Date().toISOString()
  saveConfig(config)

  if (result.count > 0) {
    console.log(`[History] Manually cleaned ${result.count} session(s) (before ${beforeISO})`)
  }
  return { count: result.count, lastCleanAt: config.history.lastCleanAt }
}
