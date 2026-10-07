import { Notification } from 'electron'
import { loadConfig } from './config.js'
import { getScheduleEvents } from './db.js'

// 日程到期提醒调度器：
// - 定时扫描 reminder 开启的日程，通过系统通知（Electron Notification，跨平台）提醒
// - 有具体时间的日程：到期前 N 分钟 + 到期时各提醒一次（N 可在设置中配置）
// - 全天日程：到期日当天指定时间（默认 09:30，可在设置中配置）提醒一次

const CHECK_INTERVAL_MS = 30 * 1000
// 应用启动时若提醒点刚过去不久（如应用重启），仍在该窗口内补发一次，避免漏提醒
const CATCHUP_WINDOW_MS = 5 * 60 * 1000

let checkTimer = null
let mainWindowRef = null
// 已发送提醒的去重集合：`${eventId}|${type}|${时间戳}`
const sentKeys = new Set()

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 'YYYY-MM-DD' + 'HH:mm' → 本地 Date；非法输入返回 null
function buildPoint(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr)
  if (!dm || !tm) return null
  const d = new Date(
    Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]),
    Number(tm[1]), Number(tm[2]), 0, 0
  )
  return Number.isNaN(d.getTime()) ? null : d
}

// 计算单个日程的提醒点集合
function getReminderPoints(ev, cfg) {
  if (!ev.reminder || ev.completed || !ev.end) return []
  const points = []
  if (ev.allDay) {
    const at = buildPoint(ev.end, cfg.reminderAllDayTime || '09:30')
    if (at) points.push({ type: 'allday', at })
  } else if (ev.endTime) {
    const due = buildPoint(ev.end, ev.endTime)
    if (due) {
      const leadMinutes = Number(cfg.reminderLeadMinutes)
      const lead = new Date(due.getTime() - (Number.isFinite(leadMinutes) && leadMinutes > 0 ? leadMinutes : 60) * 60 * 1000)
      points.push({ type: 'lead', at: lead })
      points.push({ type: 'due', at: due })
    }
  }
  return points
}

function formatDueLabel(date) {
  return `${toLocalDateStr(date).slice(5).replace('-', '/')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function showNotification(ev, point, cfg) {
  if (!Notification.isSupported()) return
  const isZh = (cfg.language || 'zh-CN').startsWith('zh')
  let body
  if (point.type === 'due') {
    body = isZh ? '该日程已到到期时间' : 'This schedule is due now'
  } else if (point.type === 'lead') {
    body = isZh
      ? `将于 ${formatDueLabel(point.at)} 前到期（提前 ${cfg.reminderLeadMinutes || 60} 分钟提醒）`
      : `Due at ${formatDueLabel(point.at)} (reminded ${cfg.reminderLeadMinutes || 60} min ahead)`
  } else {
    body = isZh ? '该全天日程今天到期' : 'This all-day schedule is due today'
  }

  const notification = new Notification({
    title: `${isZh ? '日程提醒' : 'Schedule'}: ${ev.title || ''}`,
    body,
  })
  notification.on('click', () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      if (mainWindowRef.isMinimized()) mainWindowRef.restore()
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })
  notification.show()
}

function tick() {
  let cfg
  let events
  try {
    cfg = loadConfig()
  } catch (e) {
    console.warn('[ScheduleReminder] loadConfig failed:', e?.message || e)
    return
  }
  try {
    events = getScheduleEvents() || []
  } catch (e) {
    console.warn('[ScheduleReminder] load events failed:', e?.message || e)
    return
  }

  const now = Date.now()
  for (const ev of events) {
    for (const point of getReminderPoints(ev, cfg)) {
      const at = point.at.getTime()
      if (at > now) continue
      const key = `${ev.id}|${point.type}|${at}`
      if (sentKeys.has(key)) continue
      // 过期已久的提醒点不补发，避免启动/恢复时通知轰炸
      if (now - at > CATCHUP_WINDOW_MS) continue
      sentKeys.add(key)
      showNotification(ev, point, cfg)
    }
  }
}

export function startReminderScheduler(mainWindow) {
  mainWindowRef = mainWindow
  if (checkTimer) return
  tick()
  checkTimer = setInterval(tick, CHECK_INTERVAL_MS)
  console.log('[ScheduleReminder] scheduler started')
}

export function stopReminderScheduler() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
    console.log('[ScheduleReminder] scheduler stopped')
  }
}
